# YOLOv8 Custom Dataset Integration Guide

To dramatically improve the accuracy of the CleanCity AI Service in detecting specific types of garbage relevant to your city, you can train it on a custom dataset from Kaggle.

This guide explains how to acquire a Kaggle dataset, prepare it, and use the included `train.py` script.

## Step 1: Find a Dataset on Kaggle

First, find a computer vision dataset on Kaggle that is formatted for YOLO (e.g., YOLOv8, YOLOv5 format). 
- Search term examples: "Garbage YOLO format", "Waste Detection YOLO dataset".
- **Crucial Requirement:** The dataset MUST have `.txt` annotation files, not JSON (COCO) or XML (Pascal VOC), unless you convert them first.

## Step 2: Set up Kaggle CLI (Optional but Recommended)

It's easiest to download directly to your server using the Kaggle CLI:

1. Install it via terminal:
   ```powershell
   pip install kaggle
   ```
2. Go to your Kaggle Account -> "Create New API Token". This downloads a `kaggle.json` file.
3. Place `kaggle.json` in the `~/.kaggle/` folder on your machine (`C:\Users\YOUR_NAME\.kaggle\` on Windows).

## Step 3: Download and Extract the Dataset

Run the following command in the `ai-service` folder. Replace `[author/dataset-name]` with the actual Kaggle path.

```powershell
# Create a datasets folder
mkdir datasets
cd datasets

# Download using Kaggle CLI
kaggle datasets download -d [author/dataset-name]

# Unzip the file
tar -xf [dataset-name].zip
```

## Step 4: Verify the `data.yaml` File

YOLO requires a `data.yaml` file to tell it where images are and what classes exist. Look inside your downloaded dataset folder. It should look something like this:

```yaml
# datasets/my_dataset/data.yaml
train: ../train/images
val: ../valid/images

nc: 5
names: ['bottle', 'plastic_bag', 'can', 'cardboard', 'mixed_waste']
```

> [!WARNING]
> Check the paths in `data.yaml` closely. If the paths are absolute (e.g., `C:/users/...`), you need to modify them to be relative to the dataset folder.

## Step 5: Start Training

We've provided a simple wrapper script `train.py`. Run it from the `ai-service` root directory.

```powershell
# Change back to ai-service root
cd ..

# Start training. Point --data to your specific data.yaml file
python train.py --data datasets/my_dataset/data.yaml --epochs 50 --batch 16
```

> [!NOTE]
> If your PC has an NVIDIA GPU and CUDA installed, YOLO will automatically use it, drastically speeding up training.

## Step 6: Update the AI Service (After Training)

When training completes successfully, YOLO saves the best model weights.

Look at the console output at the very end of training. It will show you a path, typically:
`garbage_runs/garbage_model/weights/best.pt`

To use your newly trained, highly accurate model:
1. Open `ai-service/detector.py` and `ai-service/main.py`.
2. Change the model loading path:
   ```python
   # From:
   self.model = YOLO("yolov8n.pt")
   
   # To:
   self.model = YOLO("garbage_runs/garbage_model/weights/best.pt")
   ```
3. Restart your AI Service.
