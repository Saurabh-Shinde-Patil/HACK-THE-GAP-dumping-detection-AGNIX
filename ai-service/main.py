from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import uvicorn
import io
import os

# Fix for PyTorch 2.6+ weights_only unpickling errors with YOLOv8
import torch
original_load = torch.load
torch.load = lambda f, *args, **kwargs: original_load(f, *args, **{**kwargs, 'weights_only': False})

from detector import GarbageDetector


app = FastAPI(
    title="CleanCity AI Detection Service",
    description="YOLOv8-based garbage detection for images and CCTV frames",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model at startup
detector = None

@app.on_event("startup")
async def startup_event():
    global detector
    print("🚀 Loading YOLOv8 model...")
    detector = GarbageDetector(model_path="yolov8n.pt")
    print("✅ AI Detection Service ready")


# --- Request Models ---

class FrameRequest(BaseModel):
    frame: str  # base64 encoded frame


class LiveFrameRequest(BaseModel):
    frame: str  # base64 encoded frame
    camera_id: str
    camera_name: Optional[str] = "Camera"
    latitude: Optional[float] = 0.0
    longitude: Optional[float] = 0.0


class CameraConfig(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    source: str  # webcam, droidcam, rtsp, video
    url: Optional[str] = None
    address: Optional[str] = "CCTV Location"
    ward: Optional[str] = "Unassigned"


# --- Pre-configured cameras (can be extended via API or config file) ---
CAMERAS = [
    {
        "id": "cam-001",
        "name": "Main Gate Camera",
        "latitude": 18.5204,
        "longitude": 73.8567,
        "source": "webcam",
        "url": None,
        "address": "FC Road, Pune",
        "ward": "Ward-1"
    },
    {
        "id": "cam-002",
        "name": "Parking Area Camera",
        "latitude": 18.5157,
        "longitude": 73.8699,
        "source": "droidcam",
        "url": "http://192.168.1.5:4747/video",
        "address": "Camp, Pune",
        "ward": "Ward-2"
    },
]


# --- Endpoints ---

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "model_loaded": detector is not None,
        "service": "CleanCity AI",
        "version": "2.0.0",
        "cameras": len(CAMERAS),
    }


@app.get("/cameras")
def list_cameras():
    """List all configured cameras."""
    return {"success": True, "cameras": CAMERAS}


@app.post("/detect-image")
async def detect_image(file: UploadFile = File(...)):
    """
    Detect garbage in an uploaded image.
    Used by the citizen reporting system.
    """
    if detector is None:
        raise HTTPException(status_code=503, detail="Model not yet loaded")

    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP images are allowed")

    try:
        image_bytes = await file.read()
        result = detector.detect_from_bytes(image_bytes)
        return {
            "success": True,
            "filename": file.filename,
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")


@app.post("/detect-frame")
async def detect_frame(request: FrameRequest):
    """
    Detect garbage in a base64-encoded CCTV frame.
    Used by the CCTV monitoring system.
    """
    if detector is None:
        raise HTTPException(status_code=503, detail="Model not yet loaded")

    if not request.frame:
        raise HTTPException(status_code=400, detail="Frame data is required")

    try:
        result = detector.detect_from_base64(request.frame)
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Frame detection failed: {str(e)}")


@app.post("/detect-frame-live")
async def detect_frame_live(request: LiveFrameRequest):
    """
    Detect garbage in a base64-encoded frame WITH annotation.
    Returns annotated image + detection metadata.
    Used by the live CCTV monitoring pipeline.
    """
    if detector is None:
        raise HTTPException(status_code=503, detail="Model not yet loaded")

    if not request.frame:
        raise HTTPException(status_code=400, detail="Frame data is required")

    try:
        from PIL import Image
        import base64

        # Decode frame
        b64 = request.frame
        if "," in b64:
            b64 = b64.split(",")[1]
        image_bytes = base64.b64decode(b64)
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        # Run detection with annotation
        result = detector.detect_and_annotate(pil_image)

        return {
            "success": True,
            "camera_id": request.camera_id,
            "camera_name": request.camera_name,
            "latitude": request.latitude,
            "longitude": request.longitude,
            **result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Live detection failed: {str(e)}")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
