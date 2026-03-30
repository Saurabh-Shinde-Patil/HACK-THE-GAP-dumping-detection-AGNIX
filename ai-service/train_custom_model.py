"""
CleanCity Custom AI Training Script (Roboflow + YOLOv8)
======================================================
This script downloads your specified Roboflow dataset and runs a quick 20-epoch
training session on YOLOv8 Nano.

INSTRUCTIONS:
1. Ensure you have installed the Roboflow package:
   pip install roboflow ultralytics

2. Get your free API Key from Roboflow (Settings -> API).
   Replace 'YOUR_ROBOFLOW_API_KEY' with your actual key below.

3. Run this script!
   python train_custom_model.py

When training finishes, a file called 'best.pt' will be generated in the 
runs/detect/train/weights folder. We have already updated detector.py to 
automatically find and use this file if it exists!
"""

import os
import shutil
from roboflow import Roboflow
from ultralytics import YOLO

# Fix for PyTorch 2.6+ weights_only unpickling errors with YOLOv8
import torch
_original_torch_load = torch.load
torch.load = lambda f, *args, **kwargs: _original_torch_load(f, *args, **{**kwargs, 'weights_only': False})
# ========== CONFIGURATION ==========
ROBOFLOW_API_KEY = "LL0AXQhFkf0bMDVrtH3X"
WORKSPACE_NAME = "fypgarbage"
PROJECT_NAME = "fyp-garbage-detection"
VERSION_NUMBER = 1 # Update if you created multiple dataset versions on Roboflow
# ===================================

def run_training():
    print("🗑️ Beginning CleanCity Custom AI Training 🗑️")
    print("=" * 50)
    
    if ROBOFLOW_API_KEY == "YOUR_ROBOFLOW_API_KEY":
        print("❌ ERROR: You must insert your Roboflow API key into the script first!")
        print("   Edit train_custom_model.py at line 18.")
        return

    # 1. Download Dataset
    print("\n[1/3] Downloading dataset from Roboflow...")
    rf = Roboflow(api_key=ROBOFLOW_API_KEY)
    project = rf.workspace(WORKSPACE_NAME).project(PROJECT_NAME)
    version = project.version(VERSION_NUMBER)
    dataset = version.download("yolov8")
    
    # 2. Train Model
    print(f"\n[2/3] Starting quick training (yolov8n, 20 epochs) on dataset: {dataset.location}")
    print("      Depending on your GPU, this will take a few minutes to a few hours.")
    
    model = YOLO("yolov8n.pt")  # Load base YOLOv8 Nano
    
    # Train the model
    # Note: We are forcing 'cpu' because the torchvision CUDA ops are failing on this machine
    results = model.train(
        data=f"{dataset.location}/data.yaml",
        epochs=20,
        imgsz=640,
        device='cpu' 
    )
    
    # 3. Apply the Model
    # YOLO saves the best weights in runs/detect/train/weights/best.pt
    # Let's cleanly copy it to the root of the ai-service directory for production use!
    print("\n[3/3] Training complete. Searching for the output weights...")
    
    best_weights_path = None
    
    # Simple search for the output directory
    for root, dirs, files in os.walk('runs'):
        if 'best.pt' in files:
            best_weights_path = os.path.join(root, 'best.pt')
            # Assuming the last created runs folder is the one we want
    
    if best_weights_path and os.path.exists(best_weights_path):
        print(f"  ✅ Found new trained model at: {best_weights_path}")
        print("  🚚 Moving model to ai-service root as 'best.pt'...")
        shutil.copy(best_weights_path, "best.pt")
        print("  🎉 All Done! Next time you start live_monitor.py, it will use your fresh AI!")
    else:
        print("  ⚠️ Training finished, but couldn't locate best.pt. Check the /runs folder manually.")

if __name__ == "__main__":
    import torch
    run_training()
