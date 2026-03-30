from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import io
import os
from detector import GarbageDetector


app = FastAPI(
    title="CleanCity AI Detection Service",
    description="YOLOv8-based garbage detection for images and CCTV frames",
    version="1.0.0"
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


class FrameRequest(BaseModel):
    frame: str  # base64 encoded frame


@app.get("/health")
def health_check():
    return {"status": "ok", "model_loaded": detector is not None, "service": "CleanCity AI"}


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


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

