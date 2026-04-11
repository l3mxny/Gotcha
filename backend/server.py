from flask import Flask, request, jsonify, send_file
from flask_socketio import SocketIO
from flask_cors import CORS
from detector import run_inference
from twilio.rest import Client as TwilioClient
from twilio.twiml.voice_response import VoiceResponse
from collections import deque
import time
import os
import tempfile
import base64
import sqlite3
import pathlib

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# confidence window - stores last 5 detections
recent_detections = deque(maxlen=5)
incident_log = []
is_processing = False

# rolling buffer of last 5 frames (bytes) for evidence capture
frame_buffer = deque(maxlen=5)
alert_active = False

# evidence folder and database
EVIDENCE_DIR = pathlib.Path(__file__).parent / 'evidence'
EVIDENCE_DIR.mkdir(exist_ok=True)
DB_PATH = pathlib.Path(__file__).parent / 'evidence.db'

def init_db():
    con = sqlite3.connect(DB_PATH)
    con.execute('''
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            confidence REAL,
            folder TEXT
        )
    ''')
    con.commit()
    con.close()

init_db()

def save_evidence(confidence):
    timestamp = time.strftime("%Y-%m-%d_%H-%M-%S")
    folder = EVIDENCE_DIR / timestamp
    folder.mkdir(exist_ok=True)

    for i, frame_bytes in enumerate(frame_buffer):
        with open(folder / f'frame_{i}.jpg', 'wb') as f:
            f.write(frame_bytes)

    con = sqlite3.connect(DB_PATH)
    con.execute(
        'INSERT INTO incidents (timestamp, confidence, folder) VALUES (?, ?, ?)',
        (timestamp, confidence, str(folder))
    )
    con.commit()
    con.close()

    return timestamp

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
        theft_detected = any(
            p['class'].lower() in ('1', 'shoplifting', 'theft', 'stealing') and p['confidence'] > 0.35
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
                top_confidence = max((p['confidence'] for p in predictions), default=0)
                timestamp = save_evidence(top_confidence)
                incident = {
                    "time": time.strftime("%H:%M:%S"),
                    "confidence": top_confidence,
                    "timestamp": timestamp
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
    return jsonify([dict(r) for r in rows])

@app.route('/evidence/<int:incident_id>/frames', methods=['GET'])
def get_evidence_frames(incident_id):
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    row = con.execute('SELECT * FROM incidents WHERE id = ?', (incident_id,)).fetchone()
    con.close()
    if not row:
        return jsonify({"error": "Incident not found"}), 404
    folder = pathlib.Path(row['folder'])
    frames = []
    for i in range(5):
        frame_path = folder / f'frame_{i}.jpg'
        if frame_path.exists():
            with open(frame_path, 'rb') as f:
                frames.append(base64.b64encode(f.read()).decode('utf-8'))
    return jsonify({"incident": dict(row), "frames": frames})

@app.route('/trigger-alert', methods=['POST'])
def trigger_alert():
    try:
        data = request.get_json()
        description = data.get('description', 'Unknown suspect') if data else 'Unknown suspect'

        twilio_client = TwilioClient(
            os.getenv('TWILIO_ACCOUNT_SID'),
            os.getenv('TWILIO_AUTH_TOKEN')
        )

        response = VoiceResponse()
        response.say(
            f"Security alert. Shoplifting detected. Suspect description: {description}. Please review the camera feed immediately.",
            voice='alice'
        )

        twilio_client.calls.create(
            twiml=str(response),
            from_=os.getenv('TWILIO_FROM_NUMBER'),
            to=os.getenv('MY_PHONE_NUMBER')
        )

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
