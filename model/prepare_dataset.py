#!/usr/bin/env python3
"""
Simple dataset validation and statistics utility for Rummikub training.

Usage:
    python prepare_dataset.py validate     # Check annotations for errors
    python prepare_dataset.py stats        # Show dataset statistics
"""

import os
import sys
from pathlib import Path

def validate_dataset():
    """Validate the dataset annotations."""
    print("\nValidating dataset...\n")

    dataset_path = Path('dataset')
    if not dataset_path.exists():
        print("❌ Dataset directory not found!")
        return

    splits = ['train', 'val', 'test']
    total_errors = 0
    total_files = 0

    for split in splits:
        print(f"Checking {split}/ split...")

        labels_dir = dataset_path / 'labels' / split
        images_dir = dataset_path / 'images' / split

        if not labels_dir.exists():
            print(f"  ⚠ Labels directory not found: {labels_dir}")
            continue

        label_files = list(labels_dir.glob('*.txt'))

        if not label_files:
            print(f"  ⚠ No annotation files found in {split}/")
            continue

        split_errors = 0

        for label_file in label_files:
            total_files += 1
            errors = []

            try:
                with open(label_file, 'r') as f:
                    lines = f.readlines()

                for line_num, line in enumerate(lines, 1):
                    line = line.strip()
                    if not line:
                        continue

                    parts = line.split()

                    # Check correct number of values (class_id + 8 coordinates)
                    if len(parts) != 9:
                        errors.append(f"Line {line_num}: Expected 9 values, got {len(parts)}")
                        continue

                    # Validate class ID
                    try:
                        class_id = int(parts[0])
                        if not (0 <= class_id <= 53):
                            errors.append(f"Line {line_num}: Class ID {class_id} out of range (0-53)")
                    except ValueError:
                        errors.append(f"Line {line_num}: Invalid class ID '{parts[0]}'")

                    # Validate coordinates
                    for i, coord in enumerate(parts[1:], 1):
                        try:
                            val = float(coord)
                            if not (0.0 <= val <= 1.0):
                                errors.append(f"Line {line_num}: Coordinate #{i} = {val} out of range (0.0-1.0)")
                        except ValueError:
                            errors.append(f"Line {line_num}: Invalid coordinate '{coord}'")

            except Exception as e:
                errors.append(f"Error reading file: {str(e)}")

            if errors:
                split_errors += len(errors)
                print(f"  ❌ {label_file.name}:")
                for error in errors:
                    print(f"      {error}")

            # Check for matching image
            image_found = False
            for ext in ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']:
                if (images_dir / f"{label_file.stem}{ext}").exists():
                    image_found = True
                    break

            if not image_found:
                split_errors += 1
                print(f"  ⚠ {label_file.name}: No matching image found")

        total_errors += split_errors

        if split_errors == 0:
            print(f"  ✓ {split}/ validated successfully ({len(label_files)} files)")
        else:
            print(f"  ❌ {split}/ has {split_errors} error(s)")
        print()

    # Summary
    print("=" * 60)
    if total_errors == 0:
        print(f"✓ Validation passed! {total_files} files checked")
    else:
        print(f"❌ Validation failed with {total_errors} error(s)")
    print()


def show_statistics():
    """Display dataset statistics."""
    print("\nDataset Statistics\n")

    dataset_path = Path('dataset')
    if not dataset_path.exists():
        print("❌ Dataset directory not found!")
        return

    splits = ['train', 'val', 'test']

    print(f"{'Split':<10} {'Images':<10} {'Labels':<10} {'Objects':<10}")
    print("-" * 42)

    total_images = 0
    total_labels = 0
    total_objects = 0

    for split in splits:
        images_dir = dataset_path / 'images' / split
        labels_dir = dataset_path / 'labels' / split

        # Count images
        image_count = 0
        if images_dir.exists():
            for ext in ['*.jpg', '*.jpeg', '*.png', '*.JPG', '*.JPEG', '*.PNG']:
                image_count += len(list(images_dir.glob(ext)))

        # Count labels and objects
        label_count = 0
        object_count = 0
        if labels_dir.exists():
            label_files = list(labels_dir.glob('*.txt'))
            label_count = len(label_files)

            for label_file in label_files:
                with open(label_file, 'r') as f:
                    lines = [line.strip() for line in f if line.strip()]
                    object_count += len(lines)

        print(f"{split:<10} {image_count:<10} {label_count:<10} {object_count:<10}")

        total_images += image_count
        total_labels += label_count
        total_objects += object_count

    print("-" * 42)
    print(f"{'TOTAL':<10} {total_images:<10} {total_labels:<10} {total_objects:<10}\n")


def main():
    if len(sys.argv) < 2:
        print("\nUsage: python prepare_dataset.py <command>")
        print("\nCommands:")
        print("  validate   Check annotations for errors")
        print("  stats      Show dataset statistics")
        print()
        sys.exit(1)

    command = sys.argv[1].lower()

    if command == 'validate':
        validate_dataset()
    elif command == 'stats':
        show_statistics()
    else:
        print(f"❌ Unknown command: {command}")
        print("Available commands: validate, stats")
        sys.exit(1)


if __name__ == '__main__':
    main()
