#!/usr/bin/env python3
"""
Continued training for Rummikub OBB detection.
Fixes: 
- Matmul/Overflow errors via augmentation stabilization.
- MPS stability via SGD and lower LR.
- Automatic cache clearing.
"""

from ultralytics import YOLO
import argparse
import shutil
import os
import re
from pathlib import Path

def get_latest_model():
    """Scans the models directory and returns the path to the highest versioned .pt file."""
    # 1. Get the absolute path of the folder containing this script
    current_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.join(current_dir, 'models')
    
    # 2. Your base fallback model (matches your current file name)
    default_model = os.path.join(models_dir, 'rummikub_best.pt')
    
    if not os.path.exists(models_dir):
        return default_model

    latest_model = default_model
    max_version = 0
    
    # 3. Scan the folder for files ending in .pt
    for file in os.listdir(models_dir):
        if file.endswith(".pt"):
            # Look for the 'v' followed by a number (e.g., v1, v2, v15)
            match = re.search(r'v(\d+)\.pt$', file)
            if match:
                version = int(match.group(1))
                if version > max_version:
                    max_version = version
                    latest_model = os.path.join(models_dir, file)
                
    return latest_model
    
def clear_dataset_cache(data_yaml):
    """Deletes .cache files to prevent corrupted labels from persisting."""
    paths = [
        'dataset/labels/train.cache',
        'dataset/labels/val.cache'
    ]
    for p in paths:
        cache_file = Path(p)
        if cache_file.exists():
            print(f"Removing old cache: {p}")
            os.remove(cache_file)

def continue_training(
    base_model=None,
    data_yaml='data.yaml',
    epochs=50,
    lr0=0.00005,  # Lowered for stability
    batch=4,      # Reduced to 4 for maximum stability (was 8)
    device='mps'
):
    if base_model is None:
        base_model = get_latest_model()

    print(f"\n🚀 Initializing Continued Training")
    print(f"Model: {base_model} | Device: {device} | Batch: {batch}\n")

    # 1. Clean up old caches
    clear_dataset_cache(data_yaml)

    # 2. Load model
    model = YOLO(base_model)

    # 3. Train with stability-focused parameters
    model.train(
        data=data_yaml,
        epochs=epochs,
        imgsz=640,
        batch=batch,
        device=device,
        amp=False,          # Disable AMP (Mixed Precision) to avoid NaNs on MPS
        project='runs/continue_train',
        name='rummikub_best',
        patience=30,
        resume=False,

        # Optimization settings
        optimizer='SGD',    # More stable for OBB when weights are diverging
        lr0=lr0,
        lrf=0.01,
        momentum=0.937,
        weight_decay=0.0005,

        # ALL Augmentation DISABLED for OBB stability
        degrees=0.0,        # No rotation
        translate=0.0,      # No translation
        scale=0.0,          # No scaling
        shear=0.0,          # No shear
        perspective=0.0,    # No perspective
        flipud=0.0,         # No vertical flip
        fliplr=0.0,         # No horizontal flip (was causing matmul errors)
        mosaic=0.0,         # No mosaic
        mixup=0.0,          # No mixup
        copy_paste=0.0,     # No copy-paste augmentation
        auto_augment=None,  # CRITICAL: Disable RandAugment/AutoAugment
        erasing=0.0,        # CRITICAL: Disable random erasing

        # Color augmentation only (safe for OBB)
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,

        # Training behavior
        rect=False,         # Disable rectangular training
        close_mosaic=0,     # Ensure mosaic stays off

        # Misc
        workers=0,          # Set to 0 on Mac to avoid multiprocessing overhead/crashes
        verbose=True,
        save_period=5
    )

    # 4. Save and version the resulting model
    best_path = Path('runs/continue_train/rummikub_continued/weights/best.pt')
    if best_path.exists():
        models_dir = Path('models')
        models_dir.mkdir(exist_ok=True)

        version = 1
        while (models_dir / f"rummikub_best_v{version}.pt").exists():
            version += 1

        output_path = models_dir / f"rummikub_best_v{version}.pt"
        shutil.copy2(best_path, output_path)
        print(f"\n✅ Success! Model saved to: {output_path}")
        return str(output_path)

    return None

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', default=None)
    parser.add_argument('--epochs', type=int, default=100)
    parser.add_argument('--lr', type=float, default=0.00005)
    parser.add_argument('--batch', type=int, default=4)
    parser.add_argument('--device', default='mps')

    args = parser.parse_args()

    result = continue_training(
        base_model=args.model,
        epochs=args.epochs,
        lr0=args.lr,
        batch=args.batch,
        device=args.device
    )