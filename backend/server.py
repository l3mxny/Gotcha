import logging
import os
import tempfile
import time
from collections import deque
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

_BACKEND_ROOT = Path(__file__).resolve().parent
# Load env from backend/.env regardless of current working directory.
load_dotenv(_BACKEND_ROOT / ".env")

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO

from call911_api import bp as call911_bp

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("gotcha.server")

app = Flask(
    __name__,
    static_folder=str(_BACKEND_ROOT / "static"),
    static_url_path="/static",
)
CORS(app, resources={r"/api/*": {"origins": "*"}})
app.register_blueprint(call911_bp)

socketio = SocketIO(app, cors_allowed_origins="*")

# confidence window - stores last 5 detections
recent_detections = deque(maxlen=5)
incident_log = []
is_processing = False

_run_inference = None
_detector_import_error: Optional[str] = None


def _get_run_inference():
    """Load Roboflow detector lazily so the API server can run without vision deps."""
    global _run_inference, _detector_import_error
    if _run_inference is not None:
        return _run_inference
    if _detector_import_error is not None:
        raise RuntimeError(_detector_import_error)
    try:
        from detector import run_inference as ri

        _run_inference = ri
        return ri
    except ImportError as e:
        _detector_import_error = (
            "Vision stack not installed or unsupported Python version. "
            "Use Python 3.9–3.12 and run: pip install inference supervision opencv-python-headless. "
            f"Import error: {e}"
        )
        logger.warning("%s", _detector_import_error)
        raise RuntimeError(_detector_import_error) from e


@app.route('/detect', methods=['POST'])
def detect():
    global is_processing

    # drop frame if still processing previous one
    if is_processing:
        return jsonify({"status": "busy"}), 429

    is_processing = True

    try:
        try:
            run_inference = _get_run_inference()
        except RuntimeError as e:
            return jsonify({"status": "error", "message": str(e)}), 503

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
        logger.exception("Detect error")
        return jsonify({"status": "error", "message": str(e)}), 500

    finally:
        is_processing = False


@app.route('/incidents', methods=['GET'])
def get_incidents():
    return jsonify(incident_log)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "running"})


def _startup_env_check() -> None:
    """Log Call 911 env health on startup so issues are visible immediately."""
    from services.env_config import get_call911_env, twilio_env_shape_hints, validate_call911_env

    miss = validate_call911_env()
    if miss:
        logger.warning("=== CALL 911 DISABLED — missing env: %s ===", ", ".join(miss))
        return

    cfg = get_call911_env()
    hints = twilio_env_shape_hints(cfg)
    if hints:
        logger.warning("=== CALL 911 ENV ISSUES ===")
        for h in hints:
            logger.warning("  -> %s", h)
    else:
        logger.info("=== Call 911 env looks good ===")


if __name__ == '__main__':
    print("Starting server on http://0.0.0.0:5001")
    _startup_env_check()
    socketio.run(app, host='0.0.0.0', port=5001, debug=True)
