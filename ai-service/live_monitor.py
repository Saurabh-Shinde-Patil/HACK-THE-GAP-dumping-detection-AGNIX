"""
CleanCity — Live CCTV Garbage Detection Monitor  (v3 — optimised)
=================================================================
- Resizes every frame to 640×480 before inference
- Skips 4 out of 5 frames (only processes every 5th frame = 5× faster)
- Uses threaded VideoStream for zero-latency capture
- Forces CPU YOLO inference (avoids torchvision CUDA NMS crash)
- Robust reconnect logic without crash loop

Usage:
  python live_monitor.py --source webcam
  python live_monitor.py --source droidcam --url http://192.168.1.5:4747/video
  python live_monitor.py --source video --file test_video.mp4
  python live_monitor.py --source rtsp --url rtsp://admin:pass@192.168.1.100:554/stream1
"""

import argparse
import base64
import cv2
import io
import urllib.request
import json
import os
import sys
import logging
import time
import threading
from datetime import datetime
from pathlib import Path

import requests
from PIL import Image

# Try to import detector for local detection (faster, no network round-trip)
try:
    from detector import GarbageDetector
    LOCAL_DETECTOR = True
except ImportError:
    LOCAL_DETECTOR = False

# ─── Configuration ───────────────────────────────────────────────────────────

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:5000")
AI_SERVICE_URL = os.environ.get("AI_SERVICE_URL", "http://localhost:8000")
DETECTION_API_KEY = os.environ.get("DETECTION_API_KEY", "cleancity-detection-key")

# Camera defaults
DEFAULT_CAMERA_ID = "cam-001"
DEFAULT_CAMERA_NAME = "Main Gate Camera"

def get_live_location():
    try:
        logging.info("🌍 Requesting live IP Geolocation from ip-api.com...")
        req = urllib.request.Request('http://ip-api.com/json/', headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=5)
        data = json.loads(response.read().decode('utf-8'))
        if data.get('status') == 'success':
            logging.info(f"📍 Location Acquired: {data.get('city')} ({data.get('lat')}, {data.get('lon')})")
            return data.get('lat', 19.8762), data.get('lon', 75.3433), f"{data.get('city', 'Unknown City')}, {data.get('regionName', '')}"
    except Exception as e:
        logging.warning(f"⚠️ Failed to fetch live IP geolocation: {e}. Using fallback coordinates.")
    return 19.8762, 75.3433, "Chhatrapati Sambhajinagar (Aurangabad)"

# Dynamically fetch the real coordinates of the deployment
DEFAULT_LAT, DEFAULT_LNG, DEFAULT_ADDRESS = get_live_location()

DEFAULT_WARD = "Ward-1"

# Detection settings
PROCESS_EVERY_N = 2          # process 1 out of every 2 frames (faster detection)
FRAME_WIDTH = 640            # resize to this width before inference
FRAME_HEIGHT = 480           # resize to this height before inference
CONFIDENCE_THRESHOLD = 0.2   # lower threshold for more sensitivity
DISPLAY_WINDOW = True        # show live preview window

# Evidence folder
EVIDENCE_DIR = Path("evidence")
EVIDENCE_DIR.mkdir(exist_ok=True)


# ─── Threaded Video Stream ──────────────────────────────────────────────────

class VideoStream:
    """Continuously grabs the latest frame in a background thread.
    This prevents OpenCV's internal buffer from growing and causing lag."""

    def __init__(self, src, backend=None):
        if backend is not None:
            self.stream = cv2.VideoCapture(src, backend)
        else:
            self.stream = cv2.VideoCapture(src)
        self.stream.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        self.grabbed = False
        self.frame = None
        self.lock = threading.Lock()
        self.stopped = False

        if self.stream.isOpened():
            # Initial read to verify it's working
            try:
                self.grabbed, self.frame = self.stream.read()
            except Exception as e:
                logging.warning(f"Error on initial stream read: {e}")
            
            self.thread = threading.Thread(target=self._update, daemon=True)
            self.thread.start()

    def _update(self):
        while not self.stopped:
            try:
                grabbed, frame = self.stream.read()
                with self.lock:
                    self.grabbed = grabbed
                    self.frame = frame
                if not grabbed:
                    time.sleep(0.1)  # small pause before retrying
            except Exception as e:
                logging.error(f"Stream read error: {e}")
                time.sleep(0.5)

    def read(self):
        with self.lock:
            return self.grabbed, self.frame.copy() if self.frame is not None else (False, None)

    def isOpened(self):
        return self.stream.isOpened()

    def release(self):
        self.stopped = True
        self.stream.release()

    def set(self, prop, val):
        self.stream.set(prop, val)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def frame_to_base64(frame):
    """Convert an OpenCV frame (BGR numpy array) to base64 JPEG."""
    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return base64.b64encode(buffer).decode('utf-8')


def frame_to_pil(frame):
    """Convert an OpenCV frame (BGR) to PIL Image (RGB)."""
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


def save_evidence(frame, camera_id):
    """Save evidence frame to disk and return the file path."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{camera_id}_{timestamp}.jpg"
    filepath = EVIDENCE_DIR / filename
    cv2.imwrite(str(filepath), frame)
    return str(filepath)


def detect_local(pil_image, detector):
    """Run detection locally using the loaded YOLOv8 model."""
    return detector.detect_and_annotate(pil_image)


def detect_remote(frame_b64, camera_id, camera_name, lat, lng):
    """Run detection via the AI FastAPI service."""
    try:
        resp = requests.post(
            f"{AI_SERVICE_URL}/detect-frame-live",
            json={
                "frame": frame_b64,
                "camera_id": camera_id,
                "camera_name": camera_name,
                "latitude": lat,
                "longitude": lng,
            },
            timeout=30,
        )
        if resp.status_code == 200:
            return resp.json()
        else:
            print(f"⚠️  AI service returned {resp.status_code}: {resp.text}")
            return None
    except Exception as e:
        print(f"⚠️  AI service error: {e}")
        return None


def send_to_backend(detection_data):
    """POST the detection to the CleanCity backend API."""
    try:
        resp = requests.post(
            f"{BACKEND_URL}/api/detections",
            json=detection_data,
            headers={"x-api-key": DETECTION_API_KEY},
            timeout=15,
        )
        if resp.status_code in (200, 201):
            data = resp.json()
            print(f"  ✅ Backend accepted: {data.get('message', 'OK')}")
            return True
        else:
            print(f"  ⚠️  Backend returned {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"  ❌ Backend error: {e}")
        return False


# ─── Video Source Setup ──────────────────────────────────────────────────────

def open_source(args):
    """Create and return (VideoStream, source_label, reconnect_url)."""
    url = None

    if args.source == "webcam":
        cap = None
        cam_index = 0
        backends = [
            (cv2.CAP_DSHOW, "DirectShow"),
            (cv2.CAP_MSMF, "MSMF"),
            (cv2.CAP_ANY, "Auto"),
        ]
        for backend, backend_name in backends:
            for idx in range(3):
                print(f"  🔍 Trying webcam index {idx} with {backend_name}...")
                test_cap = cv2.VideoCapture(idx, backend)
                if test_cap.isOpened():
                    ret, test_frame = test_cap.read()
                    test_cap.release()
                    if ret and test_frame is not None:
                        cap = VideoStream(idx, backend)
                        cam_index = idx
                        print(f"  ✅ Webcam found at index {idx} ({backend_name})")
                        break
                else:
                    test_cap.release()
            if cap is not None:
                break

        if cap is None:
            print("\n  ❌ ERROR: No webcam detected!")
            print("  Try: python live_monitor.py --source droidcam --url http://PHONE_IP:4747/video")
            sys.exit(1)

        return cap, f"Webcam (index {cam_index})", str(cam_index)

    elif args.source == "droidcam":
        if not args.url:
            print("❌ --url is required for DroidCam source")
            sys.exit(1)

        url = args.url
        cap = VideoStream(url, backend=cv2.CAP_FFMPEG)

        if not cap.isOpened():
            print(f"  ⚠️  Initial connection to {url} failed. Trying suffixes...")
            for suffix in ["/video", "/mjpegfeed"]:
                test_url = url.rstrip('/') + suffix
                print(f"  🔍 Trying: {test_url}")
                cap = VideoStream(test_url, backend=cv2.CAP_FFMPEG)
                if cap.isOpened():
                    url = test_url
                    break

        return cap, f"DroidCam ({url})", url

    elif args.source == "rtsp":
        if not args.url:
            print("❌ --url is required for RTSP source")
            sys.exit(1)
        url = args.url
        return VideoStream(url), f"RTSP ({url})", url

    elif args.source == "video":
        if not args.file:
            print("❌ --file is required for video source")
            sys.exit(1)
        return VideoStream(args.file), f"Video file ({args.file})", args.file

    else:
        print(f"❌ Unknown source: {args.source}")
        sys.exit(1)


# ─── Main Monitor Loop ──────────────────────────────────────────────────────

def run_monitor(args):
    print("=" * 60)
    print("  🏙️  CleanCity — Live CCTV Garbage Detection Monitor")
    print("=" * 60)

    cap, source_label, reconnect_url = open_source(args)

    if not cap.isOpened():
        print(f"❌ Could not open video source: {source_label}")
        sys.exit(1)

    print(f"  📹 Source: {source_label}")
    print(f"  📍 Camera: {args.camera_name} ({args.camera_id})")
    print(f"  🌍 Location: ({args.lat}, {args.lng})")
    print(f"  📐 Frame size: {FRAME_WIDTH}×{FRAME_HEIGHT}")
    print(f"  ⏭️  Process every: {PROCESS_EVERY_N}th frame")
    print(f"  🎯 Confidence threshold: {CONFIDENCE_THRESHOLD}")
    print(f"  🔄 Alert Logic: State-Based (reacts to new objects instantly)")
    print(f"  🖥️  Display window: {args.display}")
    print("-" * 60)

    # Load local detector
    detector = None
    if LOCAL_DETECTOR and not args.remote:
        print("  🤖 Loading YOLOv8 model (CPU)...")
        detector = GarbageDetector(model_path="yolov8n.pt")
        print("  ✅ Local detector ready")
    else:
        print(f"  🌐 Using remote AI service: {AI_SERVICE_URL}")

    print("-" * 60)
    print("  ▶️  Monitoring started. Press Ctrl+C or 'q' to stop.\n")

    # State tracking: State-Based AI memory
    last_garbage_state = [] 
    frame_num = 0
    last_status = ""

    try:
        while True:
            # ── grab frame ────────────────────────────────────────────
            ret, frame = cap.read()
            if not ret or frame is None:
                # Try reconnecting once
                print("  ⚠️  Lost frame. Reconnecting...")
                cap.release()
                time.sleep(2)
                cap = VideoStream(reconnect_url)
                if cap.isOpened():
                    print("  ✅ Reconnected.")
                else:
                    print("  ❌ Reconnect failed. Retrying in 5s...")
                    time.sleep(5)
                continue

            frame_num += 1

            # ── resize for display (always) ───────────────────────────
            frame = cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT))

            # ── skip frames: only process every Nth ───────────────────
            if frame_num % PROCESS_EVERY_N != 0:
                # Still show the live feed, just don't run AI
                if args.display:
                    cv2.putText(frame, f"CleanCity Monitor | {args.camera_name}",
                                (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                    cv2.putText(frame, last_status,
                                (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
                    cv2.imshow("CleanCity CCTV Monitor", frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break
                continue

            # ── run YOLO detection on this frame ──────────────────────
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            try:
                if detector:
                    pil_img = frame_to_pil(frame)
                    result = detect_local(pil_img, detector)
                else:
                    frame_b64 = frame_to_base64(frame)
                    result = detect_remote(
                        frame_b64, args.camera_id, args.camera_name,
                        args.lat, args.lng,
                    )
            except Exception as e:
                print(f"  ⚠️  Detection error (skipping frame): {e}")
                continue

            if result is None:
                continue

            detected = result.get("detected", False)
            confidence = result.get("confidence", 0)
            label = result.get("label", "none")
            total = result.get("total_objects", 0)

            # ── status line ───────────────────────────────────────────
            status = "🟢 DETECTED" if detected and confidence >= CONFIDENCE_THRESHOLD else "⚪ Clear"
            last_status = f"{status} | Conf: {confidence:.1%} | {label}"
            print(f"  [{timestamp}] Frame #{frame_num:04d} | {status} | "
                  f"Conf: {confidence:.1%} | Objects: {total} | Label: {label}")

            # ── alert logic (State-Based) ─────────────────────────────
            if detected and confidence >= CONFIDENCE_THRESHOLD:
                # Build a sorted list of current detected labels (e.g., ['bottle', 'cup'])
                current_labels = sorted([d.get("label", "unknown") for d in result.get("detections", [])])

                # Check if the state actually changed (to prevent spamming the backend for the same garbage)
                if current_labels != last_garbage_state:
                    print(f"\n  🚨 STATE CHANGE! New garbage detected: {current_labels}")
                    print(f"     Confidence: {confidence:.1%} | Top Label: {label}")

                    evidence_path = save_evidence(frame, args.camera_id)
                    print(f"     📸 Evidence saved: {evidence_path}")

                    annotated_b64 = result.get("annotated_image", "")
                    if not annotated_b64:
                        annotated_b64 = frame_to_base64(frame)

                    detection_payload = {
                        "imageBase64": annotated_b64,
                        "latitude": args.lat,
                        "longitude": args.lng,
                        "address": args.address,
                        "ward": args.ward,
                        "confidence": confidence,
                        "cameraId": args.camera_id,
                        "cameraName": args.camera_name,
                        "detectedObjects": result.get("detections", []),
                        "frameCount": 1,
                    }

                    send_to_backend(detection_payload)
                    last_garbage_state = current_labels
                    print()
                else:
                    # Garbage is exactly the same as last processed frame.
                    pass
            else:
                # If nothing is detected, the scene is clean again. Reset state.
                last_garbage_state = []

            # ── display window ────────────────────────────────────────
            if args.display:
                color = (0, 0, 255) if detected and confidence >= CONFIDENCE_THRESHOLD else (0, 255, 0)
                cv2.putText(frame, f"CleanCity Monitor | {args.camera_name}",
                            (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                cv2.putText(frame, f"Status: {status} | Conf: {confidence:.1%}",
                            (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                cv2.putText(frame, timestamp,
                            (10, FRAME_HEIGHT - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (180, 180, 180), 1)

                cv2.imshow("CleanCity CCTV Monitor", frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    print("\n  ⏹️  Stopped by user (q pressed).")
                    break

    except KeyboardInterrupt:
        print("\n  ⏹️  Stopped by user (Ctrl+C).")
    finally:
        cap.release()
        if args.display:
            cv2.destroyAllWindows()
        print("  🏁 Monitor shut down cleanly.")


# ─── CLI Entry Point ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="CleanCity Live CCTV Garbage Detection Monitor",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python live_monitor.py --source webcam
  python live_monitor.py --source droidcam --url http://192.168.1.5:4747/video
  python live_monitor.py --source video --file test_garbage.mp4
  python live_monitor.py --source rtsp --url rtsp://admin:pass@192.168.1.100:554/stream1
        """
    )

    parser.add_argument("--source", type=str, default="webcam",
                        choices=["webcam", "droidcam", "rtsp", "video"],
                        help="Video source type (default: webcam)")
    parser.add_argument("--url", type=str, default=None,
                        help="URL for DroidCam or RTSP stream")
    parser.add_argument("--file", type=str, default=None,
                        help="Path to video file (for --source video)")
    parser.add_argument("--camera-id", type=str, default=DEFAULT_CAMERA_ID,
                        help=f"Camera identifier (default: {DEFAULT_CAMERA_ID})")
    parser.add_argument("--camera-name", type=str, default=DEFAULT_CAMERA_NAME,
                        help=f"Camera display name (default: {DEFAULT_CAMERA_NAME})")
    parser.add_argument("--lat", type=float, default=DEFAULT_LAT,
                        help=f"Camera latitude (default: {DEFAULT_LAT})")
    parser.add_argument("--lng", type=float, default=DEFAULT_LNG,
                        help=f"Camera longitude (default: {DEFAULT_LNG})")
    parser.add_argument("--address", type=str, default=DEFAULT_ADDRESS,
                        help=f"Camera address (default: {DEFAULT_ADDRESS})")
    parser.add_argument("--ward", type=str, default=DEFAULT_WARD,
                        help=f"Ward name (default: {DEFAULT_WARD})")
    parser.add_argument("--remote", action="store_true",
                        help="Force using remote AI service instead of local detector")
    parser.add_argument("--no-display", dest="display", action="store_false",
                        help="Disable the live preview window")
    parser.set_defaults(display=DISPLAY_WINDOW)

    args = parser.parse_args()
    run_monitor(args)
