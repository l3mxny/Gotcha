from flask import Flask, request, jsonify, send_file
from flask_socketio import SocketIO
from detector import run_inference
from collections import deque
import time
import os
import tempfile
import base64


app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# confidence window - stores last 5 detections
recent_detections = deque(maxlen=5)
incident_log = []
is_processing = False

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
                frame_b64 = base64.b64encode(f.read()).decode('utf-8')
        os.unlink(tmp.name)

        # check if any prediction is theft
        theft_detected = any(
            p['class'].lower() in ('1', 'shoplifting', 'theft', 'stealing') and p['confidence'] > 0.35
            for p in predictions
        )

        # add to confidence window
        recent_detections.append(1 if theft_detected else 0)

        # alert if theft in 2 of last 5 frames
        alert = False
        if sum(recent_detections) >= 2:
            alert = True
            incident = {
                "time": time.strftime("%H:%M:%S"),
                "confidence": max((p['confidence'] for p in predictions), default=0)
            }
            incident_log.append(incident)
            socketio.emit('alert', incident)

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
    # place your demo video in the backend folder named demo.mp4 or demo.mov
    # falls back to IMG_7614.MOV if nothing else found
    for name in ['demo.mp4', 'demo.mov', 'demo.MOV', 'IMG_7614.MOV']:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), name)
        if os.path.exists(path):
            return send_file(path)
    return jsonify({"error": "No demo video found. Add demo.mp4 to the backend folder."}), 404
if __name__ == '__main__':
    print("Starting server on http://0.0.0.0:5001")
    socketio.run(app, host='0.0.0.0', port=5001, debug=True, allow_unsafe_werkzeug=True)