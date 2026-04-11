from inference import get_model
import supervision as sv
import cv2
from dotenv import load_dotenv
import os

load_dotenv()

def run_inference(image_path):
    model = get_model(
    model_id="test-shoplifting-hsukh/1",
    api_key=os.getenv("ROBOFLOW_API_KEY")
)
    
    image = cv2.imread(image_path)
    results = model.infer(image)[0]
    detections = sv.Detections.from_inference(results)
    
    predictions = []
    for i in range(len(detections)):
        pred = {
            "class": str(int(detections.class_id[i])),
            "confidence": float(detections.confidence[i]),
            "x": float(detections.xyxy[i][0]),
            "y": float(detections.xyxy[i][1])
        }
        predictions.append(pred)
        print(f"Class: {pred['class']}, Confidence: {pred['confidence']:.2f}")
    
    return predictions

if __name__ == "__main__":
    run_inference("test.jpg")