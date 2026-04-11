from roboflow import Roboflow
from dotenv import load_dotenv
import os

load_dotenv()

rf = Roboflow(api_key=os.getenv("ROBOFLOW_API_KEY"))
project = rf.workspace().project("shoplifting-xwimk")
model = project.version(1).model

def run_inference(image_path):
    result = model.predict(image_path, confidence=40).json()
    predictions = result["predictions"]

    for p in predictions:
        print(f"Class: {p['class']}, Confidence: {p['confidence']:.2f}")

    return predictions

if __name__ == "__main__":
    frames = sorted([f for f in os.listdir('.') if f.startswith('frame_') and f.endswith('.jpg')])
    
    for frame in frames:
        print(f"\nTesting {frame}:")
        run_inference(frame)