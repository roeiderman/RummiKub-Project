#!/usr/bin/env python3
"""
Continue training module for existing Rummikub detection model.

Usage:
    python continue_training.py
    python continue_training.py --epochs 100
    python continue_training.py --model models/rummikub_best.pt --lr 0.0001
"""

from ultralytics import YOLO
import argparse
import shutil
from pathlib import Path


def continue_training(
    base_model='models/rummikub_best.pt',
    data_yaml='data.yaml',
    epochs=50,
    lr0=0.0001,
    batch=16,
    device='mps'
):
    """
    Continue training an existing model.

    Args:
        base_model: Path to existing trained model (.pt file)
        data_yaml: Path to dataset configuration file
        epochs: Number of training epochs
        lr0: Initial learning rate
        batch: Batch size
        device: Training device ('mps', 'cuda', 'cpu')

    Returns:
        str: Path to saved model
    """
    print(f"\nContinue Training")
    print(f"Base Model: {base_model}")
    print(f"Epochs: {epochs}, LR: {lr0}, Batch: {batch}\n")

    # Load existing model
    model = YOLO(base_model)

    # Continue training
    model.train(
        data=data_yaml,
        epochs=epochs,
        imgsz=640,
        batch=batch,
        device=device,
        project='runs/continue_train',
        name='rummikub_continued',
        patience=25,
        resume=False,

        # Optimizer settings
        optimizer='AdamW',
        lr0=lr0,
        lrf=lr0/10,

        # Augmentation
        hsv_h=0.02,
        hsv_s=0.7,
        hsv_v=0.5,
        degrees=45.0,
        flipud=0.3,
        fliplr=0.5,
        mosaic=0.9,

        verbose=True,
        save_period=10
    )

    # Save model to models directory
    best_path = Path('runs/continue_train/rummikub_continued/weights/best.pt')
    if best_path.exists():
        models_dir = Path('models')
        models_dir.mkdir(exist_ok=True)

        # Find next version
        version = 1
        while (models_dir / f"rummikub_continued_v{version}.pt").exists():
            version += 1

        output_path = models_dir / f"rummikub_continued_v{version}.pt"
        shutil.copy2(best_path, output_path)

        print(f"\n✓ Model saved: {output_path}")
        return str(output_path)

    return None


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Continue training existing model')
    parser.add_argument('--model', default='models/rummikub_best.pt', help='Base model path')
    parser.add_argument('--data', default='data.yaml', help='Dataset config')
    parser.add_argument('--epochs', type=int, default=50, help='Training epochs')
    parser.add_argument('--lr', type=float, default=0.0001, help='Learning rate')
    parser.add_argument('--batch', type=int, default=16, help='Batch size')
    parser.add_argument('--device', default='mps', help='Device: mps, cuda, cpu')

    args = parser.parse_args()

    result = continue_training(
        base_model=args.model,
        data_yaml=args.data,
        epochs=args.epochs,
        lr0=args.lr,
        batch=args.batch,
        device=args.device
    )

    if result:
        print(f"✓ Training complete: {result}")
    else:
        print("❌ Training failed")
        exit(1)
