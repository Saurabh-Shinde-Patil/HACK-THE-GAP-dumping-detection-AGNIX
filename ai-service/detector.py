import io
import base64
import numpy as np
from PIL import Image
from ultralytics import YOLO
import cv2

class GarbageDetector:
    """
    YOLOv8-based garbage detection wrapper.
    Integrates concepts from:
    - vishvaspatel/GARBAGE-DETECTION (YOLOv8 for image-based citizen reports)
    - sanjail3/garbage-detection-from-cctv (CCTV frame processing)
    """

    def __init__(self, model_path: str = "yolov8n.pt"):
        self.model = YOLO(model_path)
        # These are COCO class IDs that relate to waste/environment
        # For production, fine-tune with garbage-specific dataset
        self.garbage_keywords = {
            "bottle", "cup", "bowl", "banana", "apple", "sandwich",
            "backpack", "handbag", "suitcase", "book", "box",
        }
        print(f"✅ YOLOv8 model loaded: {model_path}")

    def detect_from_pil(self, pil_image: Image.Image) -> dict:
        """Run detection on a PIL Image."""
        img_array = np.array(pil_image)
        results = self.model(img_array, verbose=False)

        detections = []
        max_confidence = 0.0
        garbage_detected = False

        for result in results:
            for box in result.boxes:
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                label = self.model.names[cls_id]
                xyxy = box.xyxy[0].tolist()

                detections.append({
                    "label": label,
                    "confidence": round(conf, 4),
                    "bbox": [round(x, 2) for x in xyxy],
                })

                if conf > max_confidence:
                    max_confidence = conf

                # Flag if known garbage-related class
                if label.lower() in self.garbage_keywords:
                    garbage_detected = True

        # If any object detected with decent confidence, treat as potential garbage
        if not garbage_detected and max_confidence > 0.5:
            garbage_detected = True

        return {
            "detected": garbage_detected,
            "confidence": round(max_confidence, 4),
            "label": detections[0]["label"] if detections else "none",
            "detections": detections,
            "total_objects": len(detections),
        }

    def detect_from_bytes(self, image_bytes: bytes) -> dict:
        """Run detection on raw image bytes."""
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        return self.detect_from_pil(pil_image)

    def detect_from_base64(self, b64_string: str) -> dict:
        """Run detection on a base64 encoded frame (CCTV use case)."""
        # Strip data URL prefix if present
        if "," in b64_string:
            b64_string = b64_string.split(",")[1]
        image_bytes = base64.b64decode(b64_string)
        return self.detect_from_bytes(image_bytes)
