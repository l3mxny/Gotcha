from roboflow import Roboflow
from dotenv import load_dotenv
import os

load_dotenv()

_model = None

def _get_model():
    global _model
    if _model is None:
        api_key = os.getenv("ROBOFLOW_API_KEY")
        if not api_key:
            raise RuntimeError("ROBOFLOW_API_KEY is not set. Add it to backend/.env")
        rf = Roboflow(api_key=api_key)
        project = rf.workspace().project("shoplifting-xwimk")
        _model = project.version(1).model
    return _model

def run_inference(image_path):
    model = _get_model()
    result = model.predict(image_path, confidence=20, overlap=30).json()
    predictions = result["predictions"]

    for p in predictions:
        print(f"Class: {p['class']}, Confidence: {p['confidence']:.2f}")

    return predictions

if __name__ == "__main__":
    frames = sorted([f for f in os.listdir('.') if f.startswith('frame_') and f.endswith('.jpg')])
    
    for frame in frames:
        print(f"\nTesting {frame}:")
        run_inference(frame)