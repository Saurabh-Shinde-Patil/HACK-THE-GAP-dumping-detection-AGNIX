import os
import argparse
from ultralytics import YOLO

def train_custom_dataset(data_yaml_path, epochs=50, batch_size=16, imgsz=640, model_name="yolov8n.pt"):
    """
    Fine-tunes a pre-trained YOLOv8 model on a custom dataset.
    
    Args:
        data_yaml_path (str): Path to the `data.yaml` file defining the dataset.
        epochs (int): Number of training epochs.
        batch_size (int): Batch size.
        imgsz (int): Image size for training.
        model_name (str): Base model to start from (e.g., 'yolov8n.pt', 'yolov8s.pt').
    """
    if not os.path.exists(data_yaml_path):
        print(f"❌ Error: data.yaml file not found at {data_yaml_path}")
        print("Please ensure you have downloaded and extracted your dataset correctly.")
        return

    print("=" * 60)
    print("  🚀 Starting YOLOv8 Custom Training")
    print(f"  Dataset File : {data_yaml_path}")
    print(f"  Base Model   : {model_name}")
    print(f"  Epochs       : {epochs}")
    print(f"  Batch Size   : {batch_size}")
    print(f"  Image Size   : {imgsz}")
    print("=" * 60)

    # 1. Load a pre-trained model (recommended for training)
    print("Loading model...")
    model = YOLO(model_name)

    # 2. Train the model
    print("\nStarting training process. This may take a while depending on your hardware...")
    results = model.train(
        data=data_yaml_path,
        epochs=epochs,
        batch=batch_size,
        imgsz=imgsz,
        project="garbage_runs",  # Folder where results will be saved
        name="garbage_model",    # Name of the sub-folder for this specific run
        device="auto"            # Automatically use GPU if available, else CPU
    )

    print("\n" + "=" * 60)
    print("  ✅ Training Complete!")
    print(f"  Best model saved to: garbage_runs/garbage_model/weights/best.pt")
    print("=" * 60)
    print("\nTo use this new model, update 'detector.py' and 'live_monitor.py' to load: 'garbage_runs/garbage_model/weights/best.pt'")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CleanCity YOLOv8 Custom Dataset Trainer")
    
    parser.add_argument("--data", type=str, required=True, 
                        help="Path to the data.yaml file (e.g., datasets/garbage/data.yaml)")
    parser.add_argument("--epochs", type=int, default=50, 
                        help="Number of epochs to train for (default: 50)")
    parser.add_argument("--batch", type=int, default=16, 
                        help="Training batch size (default: 16)")
    parser.add_argument("--imgsz", type=int, default=640, 
                        help="Image size parameter (default: 640)")
    parser.add_argument("--model", type=str, default="yolov8n.pt", 
                        help="Base model to use (default: yolov8n.pt). Try yolov8s.pt for better accuracy but slower speed.")
    
    args = parser.parse_args()
    
    train_custom_dataset(
        data_yaml_path=args.data,
        epochs=args.epochs,
        batch_size=args.batch,
        imgsz=args.imgsz,
        model_name=args.model
    )
