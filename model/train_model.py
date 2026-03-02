#!/usr/bin/env python3
"""
Simple YOLOv8-OBB training script for Rummikub tile detection.
This script trains a model and exports it to TFLite for Android deployment.

Usage:
    python train_model.py
    python train_model.py --epochs 50 --batch 32
    python train_model.py --model yolov8s-obb.pt  # Use larger model variant
"""

from ultralytics import YOLO
import argparse


def train_model(
    data_yaml='data.yaml',
    model_name='yolov8m-obb.pt',
    epochs=300,
    imgsz=640,
    batch=32,
    patience=75,
    device='mps'
):
    """
    Train YOLOv8-OBB model for Rummikub detection.

    Args:
        data_yaml: Path to dataset configuration file
        model_name: Pretrained model to start from (yolov8n/s/m/l/x-obb.pt)
        epochs: Number of training epochs
        imgsz: Input image size
        batch: Batch size
        patience: Early stopping patience
        device: Device to use ('' for auto, '0' for GPU, 'cpu' for CPU)
    """
    print(f"Loading model: {model_name}")
    model = YOLO(model_name)

    print(f"Starting training for {epochs} epochs...")
    results = model.train(
        data=data_yaml,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        device=device,
        project='runs/train',
        name='rummikub_500img_medium',
        patience=patience,
        save=True,
        plots=True,

        # Optimizer settings for better accuracy
        optimizer='AdamW',
        lr0=0.001,
        lrf=0.01,
        momentum=0.937,
        weight_decay=0.0005,

        # Augmentation for better generalization (conservative to avoid numerical issues)
        hsv_h=0.01,
        hsv_s=0.5,
        hsv_v=0.3,
        degrees=10.0,
        translate=0.05,
        scale=0.3,
        shear=0.0,
        perspective=0.0,
        flipud=0.0,
        fliplr=0.5,
        mosaic=0.8,
        mixup=0.0,

        # Training settings
        pretrained=True,
        verbose=True,
        save_period=25,
        val=True
    )

    # Export to TFLite for Android
    print("Exporting model to TFLite...")
    model.export(format='tflite', imgsz=imgsz, int8=True)

    print(f"Training complete! Model saved to: runs/train/rummikub/")
    print(f"TFLite model: runs/train/rummikub/weights/best.tflite")

    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Train YOLOv8-OBB model for Rummikub detection')
    parser.add_argument('--data', default='data.yaml', help='Path to data.yaml')
    parser.add_argument('--model', default='yolov8m-obb.pt', help='Model variant')
    parser.add_argument('--epochs', type=int, default=300, help='Number of epochs')
    parser.add_argument('--batch', type=int, default=32, help='Batch size')
    parser.add_argument('--imgsz', type=int, default=640, help='Image size')
    parser.add_argument('--patience', type=int, default=75, help='Early stopping patience')
    parser.add_argument('--device', default='mps', help='Device ("mps" for Apple Silicon, "0" for CUDA GPU, "cpu")')

    args = parser.parse_args()

    train_model(
        data_yaml=args.data,
        model_name=args.model,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        patience=args.patience,
        device=args.device
    )
