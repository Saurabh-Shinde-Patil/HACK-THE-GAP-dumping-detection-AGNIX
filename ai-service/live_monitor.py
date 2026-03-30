"""
CleanCity — Live CCTV Garbage Detection Monitor
================================================
Captures frames from a video source (webcam, DroidCam, RTSP, video file),
runs YOLOv8 detection, validates across multiple frames, and sends alerts
to the CleanCity backend API.

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
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import requests
from PIL import Image

# Fix for PyTorch 2.6+ weights_only unpickling errors with YOLOv8
import torch
original_load = torch.load
torch.load = lambda f, *args, **kwargs: original_load(f, *args, **{**kwargs, 'weights_only': False})

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

# Camera defaults (override with --camera-id, --lat, --lng)
DEFAULT_CAMERA_ID = "cam-001"
DEFAULT_CAMERA_NAME = "Main Gate Camera"
DEFAULT_LAT = 18.5204
DEFAULT_LNG = 73.8567
DEFAULT_ADDRESS = "FC Road, Pune"
DEFAULT_WARD = "Ward-1"

# Detection settings
FRAME_INTERVAL = 2          # seconds between frame captures
CONFIDENCE_THRESHOLD = 0.4  # minimum confidence to consider
DUPLICATE_COOLDOWN = 300     # seconds before re-alerting same camera (5 min)
DISPLAY_WINDOW = True        # show live preview window

# Evidence folder
EVIDENCE_DIR = Path("evidence")
EVIDENCE_DIR.mkdir(exist_ok=True)


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


# ─── Main Monitor Loop ──────────────────────────────────────────────────────

def run_monitor(args):
    print("=" * 60)
    print("  🏙️  CleanCity — Live CCTV Garbage Detection Monitor")
    print("=" * 60)

    # Determine video source
    if args.source == "webcam":
        # On Windows, use DirectShow backend (more reliable than MSMF)
        cap = None
        cam_index = 0
        backends = [
            (cv2.CAP_DSHOW, "DirectShow"),
            (cv2.CAP_MSMF, "MSMF"),
            (cv2.CAP_ANY, "Auto"),
        ]
        for backend, backend_name in backends:
            for idx in range(3):  # Try camera indices 0, 1, 2
                print(f"  🔍 Trying webcam index {idx} with {backend_name} backend...")
                test_cap = cv2.VideoCapture(idx, backend)
                if test_cap.isOpened():
                    ret, test_frame = test_cap.read()
                    if ret and test_frame is not None:
                        cap = test_cap
                        cam_index = idx
                        print(f"  ✅ Webcam found at index {idx} ({backend_name})")
                        break
                    else:
                        test_cap.release()
                else:
                    test_cap.release()
            if cap is not None:
                break

        if cap is None:
            print("\n  ❌ ERROR: No webcam detected!")
            print("  ─────────────────────────────────────────")
            print("  Possible fixes:")
            print("  1. Close any app using the camera (Teams, Zoom, Browser, etc.)")
            print("  2. Check Windows Settings → Privacy → Camera → Allow apps access")
            print("  3. Try using a video file instead:")
            print("     python live_monitor.py --source video --file test_video.mp4")
            print("  4. Try DroidCam (use your phone as camera):")
            print("     python live_monitor.py --source droidcam --url http://PHONE_IP:4747/video")
            sys.exit(1)

        source_label = f"Webcam (index {cam_index})"
    elif args.source == "droidcam":
        if not args.url:
            print("❌ --url is required for DroidCam source")
            sys.exit(1)
        
        url = args.url
        cap = cv2.VideoCapture(url)
        
        # If simple URL fails, try common DroidCam suffixes
        if not cap.isOpened():
            print(f"  ⚠️  Initial connection to {url} failed. Trying common suffixes...")
            suffixes = ["/video", "/mjpegfeed"]
            for suffix in suffixes:
                test_url = url.rstrip('/') + suffix
                print(f"  🔍 Trying: {test_url}")
                cap = cv2.VideoCapture(test_url)
                if cap.isOpened():
                    url = test_url
                    break
                    
        source_label = f"DroidCam ({url})"
    elif args.source == "rtsp":
        if not args.url:
            print("❌ --url is required for RTSP source")
            sys.exit(1)
        cap = cv2.VideoCapture(args.url)
        source_label = f"RTSP ({args.url})"
    elif args.source == "video":
        if not args.file:
            print("❌ --file is required for video source")
            sys.exit(1)
        cap = cv2.VideoCapture(args.file)
        source_label = f"Video file ({args.file})"
    else:
        print(f"❌ Unknown source: {args.source}")
        sys.exit(1)

    if not cap.isOpened():
        print(f"❌ Could not open video source: {source_label}")
        sys.exit(1)

    print(f"  📹 Source: {source_label}")
    print(f"  📍 Camera: {args.camera_name} ({args.camera_id})")
    print(f"  🌍 Location: ({args.lat}, {args.lng})")
    print(f"  ⏱️  Frame interval: {FRAME_INTERVAL}s")
    print(f"  🎯 Confidence threshold: {CONFIDENCE_THRESHOLD}")
    print(f"  🔄 Duplicate cooldown: {DUPLICATE_COOLDOWN}s")
    print(f"  🖥️  Display window: {args.display}")
    print("-" * 60)

    # Load local detector if available
    detector = None
    if LOCAL_DETECTOR and not args.remote:
        print("  🤖 Loading YOLOv8 model locally...")
        detector = GarbageDetector(model_path="yolov8n.pt")
        print("  ✅ Local detector ready")
    else:
        print(f"  🌐 Using remote AI service: {AI_SERVICE_URL}")

    print("-" * 60)
    print("  ▶️  Monitoring started. Press Ctrl+C to stop.\n")

    # State tracking
    consecutive_count = 0
    last_alert_time = 0
    frame_num = 0
    failed_reads = 0
    MAX_FAILED_READS = 5

    try:
        while True:
            try:
                if not cap.isOpened():
                    print(f"⚠️  Camera disconnected. Attempting to reconnect to {url if args.source == 'droidcam' else source_label}...")
                    time.sleep(2)
                    cap = cv2.VideoCapture(url if args.source == 'droidcam' else (args.url or args.file or 0))
                    if not cap.isOpened():
                        continue
                    else:
                        print("✅ Reconnected to camera successfully.")
                        failed_reads = 0

                ret, frame = cap.read()
                if not ret:
                    if args.source == "video":
                        print("📹 Video file ended. Restarting...")
                        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        continue
                    else:
                        failed_reads += 1
                        print(f"❌ Failed to capture frame ({failed_reads}/{MAX_FAILED_READS}). Retrying in 2s...")
                        time.sleep(2)
                        if failed_reads >= MAX_FAILED_READS:
                            print("🔄 Too many failed reads. Forcing reconnect...")
                            cap.release()
                        continue

                # Reset consecutive failed reads on success
                failed_reads = 0
                frame_num += 1
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                # Run detection
                if detector:
                    pil_img = frame_to_pil(frame)
                    result = detect_local(pil_img, detector)
                else:
                    frame_b64 = frame_to_base64(frame)
                    result = detect_remote(
                        frame_b64, args.camera_id, args.camera_name,
                        args.lat, args.lng
                    )

                if result is None:
                    time.sleep(FRAME_INTERVAL)
                    continue

                detected = result.get("detected", False)
                confidence = result.get("confidence", 0)
                label = result.get("label", "none")
                total = result.get("total_objects", 0)

                # Status line
                status = "🟢 DETECTED" if detected and confidence >= CONFIDENCE_THRESHOLD else "⚪ Clear"
                print(f"  [{timestamp}] Frame #{frame_num:04d} | {status} | "
                      f"Conf: {confidence:.1%} | Objects: {total} | Label: {label}")

                # Continuous Alert logic: trigger immediately if garbage is seen
                if detected and confidence >= CONFIDENCE_THRESHOLD:
                    now = time.time()

                    # Duplicate cooldown check
                    if now - last_alert_time < DUPLICATE_COOLDOWN:
                        remaining = int(DUPLICATE_COOLDOWN - (now - last_alert_time))
                        # Still log status on screen but prevent alert spam to backend
                        # print(f"  ⏳ Cooldown active ({remaining}s remaining). Skipping API alert.")
                    else:
                        print(f"\n  🚨 ALERT! Garbage detected immediately!")
                        print(f"     Confidence: {confidence:.1%} | Label: {label}")

                        # Save evidence
                        evidence_path = save_evidence(frame, args.camera_id)
                        print(f"     📸 Evidence saved: {evidence_path}")

                        # Get annotated image as base64
                        annotated_b64 = result.get("annotated_image", "")
                        if not annotated_b64:
                            annotated_b64 = frame_to_base64(frame)

                        # Send to backend
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
                            "frameCount": 1, # Changed from consecutive_count to 1
                        }

                        send_to_backend(detection_payload)
                        last_alert_time = now
                        print()

                # Display window
                if args.display:
                    # Draw status overlay on frame
                    color = (0, 0, 255) if detected and confidence >= CONFIDENCE_THRESHOLD else (0, 255, 0)
                    cv2.putText(frame, f"CleanCity Monitor | {args.camera_name}",
                                (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                    cv2.putText(frame, f"Status: {status} | Conf: {confidence:.1%}",
                                (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
                    cv2.putText(frame, timestamp,
                                (10, frame.shape[0] - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1)

                    cv2.imshow("CleanCity CCTV Monitor", frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        print("\n  ⏹️  Monitoring stopped by user (q pressed).")
                        break

                time.sleep(FRAME_INTERVAL)

            except Exception as e:
                print(f"  ❌ Unexpected error in monitoring loop: {e}")
                print("  🔄 Attempting to recover in 5 seconds...")
                time.sleep(5)
                # Force reconnect on next iteration by releasing the capture
                if cap:
                    cap.release()

    except KeyboardInterrupt:
        print("\n  ⏹️  Monitoring stopped by user (Ctrl+C).")
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
