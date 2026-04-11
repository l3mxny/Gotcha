from flask import Flask, request, jsonify
from flask_socketio import SocketIO
from detector import run_inference
from collections import deque
import time
import os
import tempfile

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
        os.unlink(tmp.name)

        # check if any prediction is theft
        theft_detected = any(
            p['class'] == '1' and p['confidence'] > 0.5
            for p in predictions
        )

        # add to confidence window
        recent_detections.append(1 if theft_detected else 0)

        # alert if theft in 3 of last 5 frames
        alert = False
        if sum(recent_detections) >= 3:
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
            "recent": list(recent_detections)
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

if __name__ == '__main__':
    print("Starting server on http://0.0.0.0:5001")
    socketio.run(app, host='0.0.0.0', port=5001, debug=True)