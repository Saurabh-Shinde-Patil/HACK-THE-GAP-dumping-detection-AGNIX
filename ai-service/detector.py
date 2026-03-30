import io
import base64
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from ultralytics import YOLO
import cv2

# Fix for PyTorch 2.6+ weights_only unpickling errors with YOLOv8
import torch
_original_torch_load = torch.load
torch.load = lambda f, *args, **kwargs: _original_torch_load(f, *args, **{**kwargs, 'weights_only': False})


class GarbageDetector:
    """
    YOLOv8-based garbage detection wrapper.
    Forces CPU mode to avoid torchvision CUDA NMS compatibility issues.
    yolov8n on CPU runs at ~20-30ms per frame — perfectly real-time.
    """

    def __init__(self, model_path: str = "yolov8n.pt"):
        # FORCE CPU — torchvision::nms CUDA kernel is not compiled for this env
        self.device = 'cpu'
        self.model = YOLO(model_path)
        self.model.to(self.device)

        # COCO classes that represent waste / litter
        self.garbage_keywords = {
            "bottle", "cup", "bowl", "banana", "apple", "sandwich",
            "backpack", "handbag", "suitcase", "book",
            "cell phone", "laptop", "keyboard", "mouse",
            "vase", "potted plant", "teddy bear",
        }
        # Bounding-box colours by severity
        self.colors = {
            "critical": (239, 68, 68),   # red
            "high":     (249, 115, 22),  # orange
            "medium":   (234, 179, 8),   # yellow
            "low":      (34, 197, 94),   # green
        }
        print(f"✅ YOLOv8 model loaded on {self.device.upper()}: {model_path}")

    # ── helpers ──────────────────────────────────────────────────────

    def _get_severity(self, confidence: float) -> str:
        if confidence > 0.85:
            return "critical"
        elif confidence > 0.65:
            return "high"
        elif confidence > 0.40:
            return "medium"
        return "low"

    # ── core detection ───────────────────────────────────────────────

    def detect_from_pil(self, pil_image: Image.Image) -> dict:
        """Run detection on a PIL Image."""
        img_array = np.array(pil_image)
        results = self.model(img_array, verbose=False, conf=0.15, device=self.device)

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

                if label.lower() in self.garbage_keywords:
                    garbage_detected = True

        # Fallback: any object at decent confidence → potential garbage
        if not garbage_detected and max_confidence > 0.5:
            garbage_detected = True

        return {
            "detected": garbage_detected,
            "confidence": round(max_confidence, 4),
            "label": detections[0]["label"] if detections else "none",
            "detections": detections,
            "total_objects": len(detections),
        }

    def detect_and_annotate(self, pil_image: Image.Image) -> dict:
        """
        Run detection + draw bounding boxes.  Returns annotated base64 image.
        Used by the CCTV live monitoring system.
        """
        img_array = np.array(pil_image)
        results = self.model(img_array, verbose=False, conf=0.15, device=self.device)

        detections = []
        max_confidence = 0.0
        garbage_detected = False

        draw = ImageDraw.Draw(pil_image)

        for result in results:
            for box in result.boxes:
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                label = self.model.names[cls_id]
                xyxy = box.xyxy[0].tolist()
                x1, y1, x2, y2 = [int(v) for v in xyxy]

                detections.append({
                    "label": label,
                    "confidence": round(conf, 4),
                    "bbox": [round(x, 2) for x in xyxy],
                })

                if conf > max_confidence:
                    max_confidence = conf

                if label.lower() in self.garbage_keywords:
                    garbage_detected = True

                # Draw bounding box
                severity = self._get_severity(conf)
                color = self.colors.get(severity, (255, 255, 255))
                draw.rectangle([x1, y1, x2, y2], outline=color, width=3)

                # Label background
                text = f"{label} {conf:.0%}"
                text_bbox = draw.textbbox((x1, y1 - 18), text)
                draw.rectangle(
                    [text_bbox[0] - 2, text_bbox[1] - 2,
                     text_bbox[2] + 2, text_bbox[3] + 2],
                    fill=color,
                )
                draw.text((x1, y1 - 18), text, fill=(255, 255, 255))

        if not garbage_detected and max_confidence > 0.5:
            garbage_detected = True

        # Convert annotated image → base64
        buffer = io.BytesIO()
        pil_image.save(buffer, format="JPEG", quality=85)
        annotated_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        return {
            "detected": garbage_detected,
            "confidence": round(max_confidence, 4),
            "severity": self._get_severity(max_confidence) if garbage_detected else "low",
            "label": detections[0]["label"] if detections else "none",
            "detections": detections,
            "total_objects": len(detections),
            "annotated_image": annotated_base64,
        }

    # ── convenience wrappers ─────────────────────────────────────────

    def detect_from_bytes(self, image_bytes: bytes) -> dict:
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        return self.detect_from_pil(pil_image)

    def detect_from_base64(self, b64_string: str) -> dict:
        if "," in b64_string:
            b64_string = b64_string.split(",")[1]
        image_bytes = base64.b64decode(b64_string)
        return self.detect_from_bytes(image_bytes)
