# Trained Model Weights

This folder contains the trained YOLOv8-OBB model for Rummikub tile detection.

## Download the Model

The model file (`rummikub_best.pt`) is **not included in the git repository** because it's too large (159 MB exceeds GitHub's 100 MB limit).

### Option 1: Download from GitHub Releases

1. Go to the [Releases page](https://github.com/yourusername/rummikub/releases)
2. Download `rummikub_best.pt` from the latest release
3. Place it in this folder: `model/models/rummikub_best.pt`

### Option 2: Train Your Own Model

If you want to train from scratch:

```bash
cd model
python train_model.py --epochs 300 --batch 32
```

After training, copy the best weights:
```bash
cp runs/train/rummikub_500img_medium/weights/best.pt models/rummikub_best.pt
```

## Model Info

- **Architecture**: YOLOv8m-OBB (Oriented Bounding Box)
- **Classes**: 54 (4 colors × 13 numbers + 2 jokers)
- **Accuracy**: 99% mAP50
- **Size**: ~159 MB
- **Input**: 640×640 images
- **Output**: Oriented bounding boxes with rotation angles
