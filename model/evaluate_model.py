#!/usr/bin/env python3
"""
Model evaluation script for Rummikub tile detection.
Evaluates trained model on test set with detailed per-class metrics.

Usage:
    python evaluate_model.py --model runs/train/rummikub_500img_medium/weights/best.pt
    python evaluate_model.py --model best.pt --split val  # Evaluate on validation set
"""

from ultralytics import YOLO
import argparse
import yaml
from pathlib import Path


def load_class_names(data_yaml='data.yaml'):
    """Load class names from data.yaml"""
    with open(data_yaml, 'r') as f:
        data = yaml.safe_load(f)
    return data.get('names', [])


def evaluate_model(model_path, data_yaml='data.yaml', split='test', conf=0.25, iou=0.5):
    """
    Evaluate trained model on specified dataset split.

    Args:
        model_path: Path to trained model weights (.pt file)
        data_yaml: Path to dataset configuration file
        split: Dataset split to evaluate on ('train', 'val', or 'test')
        conf: Confidence threshold for predictions
        iou: IoU threshold for NMS
    """
    print("=" * 60)
    print(f"RUMMIKUB MODEL EVALUATION - {split.upper()} SET")
    print("=" * 60)

    # Load model
    print(f"\nLoading model: {model_path}")
    model = YOLO(model_path)

    # Load class names
    class_names = load_class_names(data_yaml)
    print(f"Classes: {len(class_names)}")

    # Run validation on specified split
    print(f"\nRunning evaluation on {split} set...")
    print(f"Confidence threshold: {conf}")
    print(f"IoU threshold: {iou}")

    results = model.val(
        data=data_yaml,
        split=split,
        conf=conf,
        iou=iou,
        verbose=True,
        plots=True,
        save_json=True
    )

    # Display overall metrics
    print("\n" + "=" * 60)
    print("OVERALL PERFORMANCE")
    print("=" * 60)

    map50 = results.box.map50 if hasattr(results.box, 'map50') else 0
    map75 = results.box.map75 if hasattr(results.box, 'map75') else 0
    map_all = results.box.map if hasattr(results.box, 'map') else 0
    precision = results.box.mp if hasattr(results.box, 'mp') else 0
    recall = results.box.mr if hasattr(results.box, 'mr') else 0

    print(f"mAP50:      {map50*100:.1f}%  {'[Excellent]' if map50 >= 0.8 else '[Good]' if map50 >= 0.7 else '[Fair]' if map50 >= 0.5 else '[Poor]'}")
    print(f"mAP75:      {map75*100:.1f}%")
    print(f"mAP50-95:   {map_all*100:.1f}%")
    print(f"Precision:  {precision*100:.1f}%")
    print(f"Recall:     {recall*100:.1f}%")

    # Per-class metrics
    if hasattr(results.box, 'ap_class_index') and len(results.box.ap_class_index) > 0:
        print("\n" + "=" * 60)
        print("PER-CLASS PERFORMANCE (AP50)")
        print("=" * 60)
        print(f"{'Class':<20} {'AP50':>8}  Status")
        print("-" * 60)

        ap50_per_class = results.box.ap50 if hasattr(results.box, 'ap50') else []
        class_indices = results.box.ap_class_index if hasattr(results.box, 'ap_class_index') else []

        weak_classes = []
        good_classes = []

        for i, class_idx in enumerate(class_indices):
            if i < len(ap50_per_class):
                ap50 = ap50_per_class[i]
                class_name = class_names[class_idx] if class_idx < len(class_names) else f"Class_{class_idx}"

                if ap50 < 0.5:
                    status = "[Weak]"
                    weak_classes.append((class_name, ap50))
                elif ap50 < 0.7:
                    status = "[Fair]"
                else:
                    status = "[Good]"
                    good_classes.append((class_name, ap50))

                print(f"{class_name:<20} {ap50*100:>7.1f}%  {status}")

        # Weak classes analysis
        if weak_classes:
            print("\n" + "=" * 60)
            print(f"WEAK CLASSES (< 50% AP) - {len(weak_classes)} classes")
            print("=" * 60)
            weak_classes.sort(key=lambda x: x[1])  # Sort by AP (lowest first)
            for class_name, ap in weak_classes:
                print(f"  • {class_name}: {ap*100:.1f}%")

        # Top performers
        if good_classes:
            print("\n" + "=" * 60)
            print(f"✓ TOP PERFORMERS (≥ 70% AP) - {len(good_classes)} classes")
            print("=" * 60)
            good_classes.sort(key=lambda x: x[1], reverse=True)  # Sort by AP (highest first)
            for class_name, ap in good_classes[:10]:  # Show top 10
                print(f"  • {class_name}: {ap*100:.1f}%")

    # Recommendations
    print("\n" + "=" * 60)
    print("RECOMMENDATIONS")
    print("=" * 60)

    if map50 >= 0.8:
        print("✓ Excellent performance! Model is production-ready.")
    elif map50 >= 0.7:
        print("✓ Good performance! Model is suitable for most use cases.")
        if weak_classes:
            print(f"• Consider collecting more examples for {len(weak_classes)} weak classes")
    elif map50 >= 0.5:
        print("• Fair performance. Consider the following improvements:")
        print("  - Collect 20-30 more examples of weak classes")
        print("  - Review annotation quality for underperforming classes")
        print("  - Try training for more epochs (current patience may have stopped early)")
    else:
        print("  Poor performance. Action required:")
        print("  - Review dataset quality and annotations")
        print("  - Check for class imbalance issues")
        print("  - Consider collecting more diverse training examples")
        print("  - Verify data.yaml paths and class labels are correct")

    if weak_classes:
        print(f"\nFocus on these {len(weak_classes)} weak classes:")
        for class_name, ap in weak_classes[:5]:  # Show top 5 weakest
            print(f"  - {class_name}: collect 20-30 more varied examples")

    print("\n" + "=" * 60)
    print("Next steps:")
    print("  • Review confusion matrix: runs/val/confusion_matrix.png")
    print("  • Check predictions: runs/val/val_batch*_pred.jpg")
    if map50 < 0.7:
        print("  • Consider re-training with expanded dataset")
    print("=" * 60)

    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Evaluate YOLOv8-OBB model for Rummikub detection')
    parser.add_argument('--model', required=True, help='Path to trained model weights (.pt file)')
    parser.add_argument('--data', default='data.yaml', help='Path to data.yaml')
    parser.add_argument('--split', default='test', choices=['train', 'val', 'test'],
                        help='Dataset split to evaluate on')
    parser.add_argument('--conf', type=float, default=0.25, help='Confidence threshold')
    parser.add_argument('--iou', type=float, default=0.5, help='IoU threshold for NMS')

    args = parser.parse_args()

    evaluate_model(
        model_path=args.model,
        data_yaml=args.data,
        split=args.split,
        conf=args.conf,
        iou=args.iou
    )
