from flask import Flask, request, jsonify, send_file
from flask_socketio import SocketIO
from flask_cors import CORS
from detector import run_inference
from twilio.rest import Client as TwilioClient
from twilio.twiml.voice_response import VoiceResponse
from collections import deque
from call911_api import bp as call911_bp
from services.gemini_service import analyze_evidence_and_generate_message
from services.env_config import get_aws_env
from services.s3_service import upload_evidence_frame, delete_evidence_prefix
import time
import os
import uuid
import tempfile
import base64
import json
import sqlite3
import pathlib

app = Flask(__name__, static_folder='static', static_url_path='/static')
CORS(app)
app.register_blueprint(call911_bp)
socketio = SocketIO(app, cors_allowed_origins="*")

# confidence window - stores last 5 detections
recent_detections = deque(maxlen=5)
incident_log = []
is_processing = False

# rolling buffer of last 5 frames (bytes) for evidence capture
frame_buffer = deque(maxlen=5)
alert_active = False

# evidence database
DB_PATH = pathlib.Path(__file__).parent / 'evidence.db'

def init_db():
    con = sqlite3.connect(DB_PATH)
    con.execute('''
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            confidence REAL,
            folder TEXT,
            frame_urls TEXT
        )
    ''')
    try:
        con.execute('ALTER TABLE incidents ADD COLUMN frame_urls TEXT')
    except sqlite3.OperationalError:
        pass
    con.commit()
    con.close()

init_db()

def save_evidence(confidence, timestamp):
    prefix = f'evidence/{timestamp}'

    aws = get_aws_env()
    frame_urls = []
    for i, frame_bytes in enumerate(frame_buffer):
        url = upload_evidence_frame(
            key=f'{prefix}/frame_{i}.jpg',
            data=frame_bytes,
            aws_access_key_id=aws.aws_access_key_id,
            aws_secret_access_key=aws.aws_secret_access_key,
            aws_region=aws.aws_region,
            aws_bucket_name=aws.aws_bucket_name,
        )
        frame_urls.append(url)

    con = sqlite3.connect(DB_PATH)
    con.execute(
        'INSERT INTO incidents (timestamp, confidence, folder, frame_urls) VALUES (?, ?, ?, ?)',
        (timestamp, confidence, prefix, json.dumps(frame_urls))
    )
    con.commit()
    con.close()

    return frame_urls

@app.route('/static/generated_audio/<path:filename>')
def serve_generated_audio(filename):
    resp = send_file(os.path.join(app.static_folder, 'generated_audio', filename))
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    resp.headers['Pragma'] = 'no-cache'
    resp.headers['Expires'] = '0'
    return resp

@app.route('/detect', methods=['POST'])
def detect():
    global is_processing

    # drop frame if still processing previous one
    if is_processing:
        return jsonify({"status": "busy"}), 429

    is_processing = True

    try:
        # get image from request
        file = request.files['frame']

        # save to temp file (roboflow needs a file path)
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            file.save(tmp.name)
            predictions = run_inference(tmp.name)
            with open(tmp.name, 'rb') as f:
                frame_bytes = f.read()
                frame_b64 = base64.b64encode(frame_bytes).decode('utf-8')
        os.unlink(tmp.name)

        # add frame to rolling buffer
        frame_buffer.append(frame_bytes)

        # check if any prediction is theft
        def risk_score(p):
            return p['confidence'] if p['class'] == '1' else 1 - p['confidence']

        theft_detected = any(
            risk_score(p) > 0.50
            for p in predictions
        )

        # add to confidence window
        recent_detections.append(1 if theft_detected else 0)

        # alert if theft in 2 of last 5 frames
        global alert_active
        alert = False
        if sum(recent_detections) >= 2:
            alert = True
            if not alert_active:
                alert_active = True
                top_confidence = max((risk_score(p) for p in predictions), default=0)
                timestamp = time.strftime("%Y-%m-%d_%H-%M-%S")
                save_evidence(top_confidence, timestamp)

                suspect_description = analyze_evidence_and_generate_message(
                    frames=list(frame_buffer),
                    gemini_api_key=os.getenv('GEMINI_API_KEY'),
                )
                incident = {
                    "time": time.strftime("%H:%M:%S"),
                    "confidence": top_confidence,
                    "timestamp": timestamp,
                    "description": suspect_description,
                }
                incident_log.append(incident)
                socketio.emit('alert', incident)
        else:
            alert_active = False

        # push result to dashboard
        socketio.emit('detection', {
            "predictions": predictions,
            "alert": alert,
            "recent": list(recent_detections),
            "frame": frame_b64
        })

        return jsonify({"status": "ok", "alert": alert})

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

    finally:
        is_processing = False

@app.route('/evidence', methods=['GET'])
def get_evidence():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    rows = con.execute('SELECT * FROM incidents ORDER BY id DESC').fetchall()
    con.close()
    incidents = []
    for r in rows:
        d = dict(r)
        d['frame_urls'] = json.loads(d['frame_urls']) if d.get('frame_urls') else []
        incidents.append(d)
    return jsonify(incidents)

@app.route('/evidence/<int:incident_id>', methods=['DELETE'])
def delete_evidence(incident_id):
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    row = con.execute('SELECT * FROM incidents WHERE id = ?', (incident_id,)).fetchone()
    if not row:
        con.close()
        return jsonify({"error": "Not found"}), 404
    con.execute('DELETE FROM incidents WHERE id = ?', (incident_id,))
    con.commit()
    con.close()

    aws = get_aws_env()
    delete_evidence_prefix(
        prefix=row['folder'],
        aws_access_key_id=aws.aws_access_key_id,
        aws_secret_access_key=aws.aws_secret_access_key,
        aws_region=aws.aws_region,
        aws_bucket_name=aws.aws_bucket_name,
    )
    return jsonify({"status": "deleted"})

@app.route('/evidence/<int:incident_id>/frames', methods=['GET'])
def get_evidence_frames(incident_id):
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    row = con.execute('SELECT * FROM incidents WHERE id = ?', (incident_id,)).fetchone()
    con.close()
    if not row:
        return jsonify({"error": "Incident not found"}), 404
    incident = dict(row)
    frame_urls = json.loads(incident['frame_urls']) if incident.get('frame_urls') else []
    incident['frame_urls'] = frame_urls
    return jsonify({"incident": incident, "frames": frame_urls})

@app.route('/trigger-alert', methods=['POST'])
def trigger_alert():
    try:
        msg_path = pathlib.Path(__file__).parent / 'data' / 'emergency_message.txt'
        message = msg_path.read_text(encoding='utf-8').strip() if msg_path.is_file() else "Security alert. Shoplifting detected."

        elevenlabs_api_key = os.getenv('ELEVENLABS_API_KEY')
        elevenlabs_voice_id = os.getenv('ELEVENLABS_VOICE_ID')

        twilio_client = TwilioClient(
            os.getenv('TWILIO_ACCOUNT_SID'),
            os.getenv('TWILIO_AUTH_TOKEN')
        )

        # Use ElevenLabs TTS if configured, otherwise fall back to alice
        if elevenlabs_api_key and elevenlabs_voice_id:
            from services.elevenlabs_service import synthesize_mp3
            print(f"ElevenLabs will speak: {message[:100]}")
            mp3_bytes = synthesize_mp3(api_key=elevenlabs_api_key, voice_id=elevenlabs_voice_id, text=message)
            filename = f"{uuid.uuid4().hex}.mp3"
            audio_path = pathlib.Path(__file__).parent / 'static' / 'generated_audio' / filename
            audio_path.parent.mkdir(parents=True, exist_ok=True)
            audio_path.write_bytes(mp3_bytes)
            public_url = (os.getenv('PUBLIC_BASE_URL') or os.getenv('PUBLIC_SERVER_URL', '')).rstrip('/')
            audio_url = f"{public_url}/static/generated_audio/{filename}"
            response = VoiceResponse()
            response.play(f"{audio_url}?nocache={uuid.uuid4().hex}")
        else:
            response = VoiceResponse()
            response.say(message, voice='alice')

        twilio_client.calls.create(
            twiml=str(response),
            from_=os.getenv('TWILIO_CALLER_ID'),
            to=os.getenv('FRIEND_PHONE_NUMBER')
        )

        if elevenlabs_api_key and elevenlabs_voice_id:
            import threading
            def _cleanup(path=audio_path):
                import time
                time.sleep(300)
                try:
                    path.unlink(missing_ok=True)
                except Exception:
                    pass
            threading.Thread(target=_cleanup, daemon=True).start()

        return jsonify({"status": "call initiated"})

    except Exception as e:
        print(f"Twilio error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/incidents', methods=['GET'])
def get_incidents():
    return jsonify(incident_log)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "running"})

@app.route('/phone')
def phone():
    return send_file('../frontend/phone.html')

@app.route('/demo-video')
def demo_video():
    for name in ['demo.mp4', 'demo.mov', 'demo.MOV', 'IMG_7614.MOV']:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), name)
        if os.path.exists(path):
            return send_file(path)
    return jsonify({"error": "No demo video found. Add demo.mp4 to the backend folder."}), 404

if __name__ == '__main__':
    print("Starting server on http://0.0.0.0:5001")
    socketio.run(app, host='0.0.0.0', port=5001, debug=True, allow_unsafe_werkzeug=True)
