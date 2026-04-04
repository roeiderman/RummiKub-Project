#!/usr/bin/env python3
"""
Simple script to use trained Rummikub model for tile detection.

Usage:
    python use_model.py image.jpg                    # Detect tiles in image
    python use_model.py image.jpg --show             # Show results window
    python use_model.py image.jpg --save             # Save annotated image
    python use_model.py image.jpg --json output.json # Export to JSON
"""

import os
import subprocess
from ultralytics import YOLO
import argparse
import json
from pathlib import Path


MODEL_PATH = Path(__file__).parent / 'models' / 'rummikub_best.pt'
HF_REPO     = os.environ.get('HF_MODEL_REPO', 'roeiderman/Rummikub')
HF_TOKEN    = os.environ.get('HF_TOKEN')
HF_FILENAME = 'rummikub_best.pt'


def ensure_model():
    """Download model from Hugging Face using curl (uses system TLS — no Python SSL issues)."""
    if not MODEL_PATH.exists():
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)

        url = f"https://huggingface.co/{HF_REPO}/resolve/main/{HF_FILENAME}"
        print(f"Downloading model from Hugging Face: {HF_REPO}")

        tmp_path = str(MODEL_PATH) + f'.tmp.{os.getpid()}'
        try:
            subprocess.run(
                [
                    'curl', '-L', '-f',
                    '-H', f'Authorization: Bearer {HF_TOKEN}',
                    '-o', tmp_path,
                    url,
                ],
                check=True,
            )
            if MODEL_PATH.exists():
                os.unlink(tmp_path)  # our download is redundant, clean up
                return
            os.replace(tmp_path, str(MODEL_PATH))
            print(f"Model downloaded successfully to {MODEL_PATH}")
        except Exception as e:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            raise RuntimeError(f"Failed to download model from Hugging Face: {e}")


def detect_tiles(image_path, show=False, save=False, json_output=None):
    """Detect Rummikub tiles in an image."""

    ensure_model()
    print("Loading model...")
    model = YOLO(str(MODEL_PATH))

    # Get absolute path for predict folder in project root
    project_root = Path(__file__).parent
    predict_folder = project_root / 'predict'

    # Run detection
    print(f"Detecting tiles in: {image_path}")
    results = model.predict(
        source=image_path,
        imgsz=1280,         
        conf=0.6,          # TWEAK: 0.5 keeps it sensitive enough for dark/blurry photos
        iou=0.60,           # CHANGE: Lower to 0.60 to catch heavily overlapping boxes
        agnostic_nms=True,  # CHANGE: Set to True to force overlapping classes to eliminate each other
        max_det=300, 
        save=save,          
        show=show,          
        verbose=True,
        project=str(predict_folder),  
        exist_ok=False      
    )

    # Prepare JSON data
    json_data = {
        "image": str(Path(image_path).name),
        "image_width": results[0].orig_shape[1] if results else 0,
        "image_height": results[0].orig_shape[0] if results else 0,
        "tiles": []
    }

    # Print results
    print("\n" + "="*60)
    print("DETECTED TILES")
    print("="*60)

    for result in results:
        boxes = result.obb

        if boxes is None or len(boxes) == 0:
            print("No tiles detected!")
            continue

        print(f"\nFound {len(boxes)} tiles:\n")

        # Count by tile type
        tile_counts = {}

        # Process each detected tile
        for i, box in enumerate(boxes):
            class_id = int(box.cls[0])
            tile_name = model.names[class_id]
            confidence = float(box.conf[0])

            # Get oriented bounding box (4 corners + rotation)
            xyxyxyxy = box.xyxyxyxy[0].cpu().numpy()  # 4 corner points (shape: 4x2)
            xywhr = box.xywhr[0].cpu().numpy()  # [x_center, y_center, width, height, rotation]

            # Parse tile name (e.g., "Red_5" -> color="Red", number=5)
            parts = tile_name.split('_')
            color = parts[0] if len(parts) > 0 else "Unknown"
            number = parts[1] if len(parts) > 1 else "?"

            # Normalize Yellow to Orange (Rummikub has 4 colors: Red, Blue, Black, Orange)
            if color == "Yellow":
                color = "Orange"

            # Extract tile info
            tile_info = {
                "id": i,
                "tile": tile_name,
                "color": color,
                "number": number,
                "confidence": round(confidence, 3),
                "position": {
                    "x": float(xywhr[0]),
                    "y": float(xywhr[1])
                },
                "size": {
                    "width": float(xywhr[2]),
                    "height": float(xywhr[3])
                },
                "rotation_degrees": float(xywhr[4]),
                "corners": [
                    {"x": float(xyxyxyxy[0][0]), "y": float(xyxyxyxy[0][1])},
                    {"x": float(xyxyxyxy[1][0]), "y": float(xyxyxyxy[1][1])},
                    {"x": float(xyxyxyxy[2][0]), "y": float(xyxyxyxy[2][1])},
                    {"x": float(xyxyxyxy[3][0]), "y": float(xyxyxyxy[3][1])}
                ]
            }

            json_data["tiles"].append(tile_info)
            tile_counts[tile_name] = tile_counts.get(tile_name, 0) + 1

        # Print summary
        for tile_name, count in sorted(tile_counts.items()):
            print(f"  {tile_name}: {count}x")

    print("="*60)

    if save:
        save_dir = results[0].save_dir if results else "predict/"
        print(f"\n✓ Annotated image saved to: {save_dir}")

    # Export to JSON if requested
    if json_output:
        with open(json_output, 'w') as f:
            json.dump(json_data, f, indent=2)
        print(f"\n✓ JSON data exported to: {json_output}")

    return results, json_data


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Detect Rummikub tiles')
    parser.add_argument('image', help='Path to image file')
    parser.add_argument('--show', action='store_true', help='Display results window')
    parser.add_argument('--save', action='store_true', help='Save annotated image')
    parser.add_argument('--json', type=str, help='Export detection data to JSON file')

    args = parser.parse_args()

    detect_tiles(args.image, show=args.show, save=args.save, json_output=args.json)
