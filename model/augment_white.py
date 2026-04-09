#!/usr/bin/env python3
"""
augment_white.py

Takes every image in dataset/images/{train,val,test}, removes the background
using RMBG-2.0 (same model used at inference), and saves the result to
dataset/images_white/ with a _white suffix.  Label files are copied as-is
to dataset/labels_white/ with the same _white suffix.

Usage:
    python augment_white.py                  # process all splits
    python augment_white.py --split train    # process one split
    python augment_white.py --overwrite      # re-process already-done images
"""

import argparse
import os
import shutil
import sys
import types
import importlib.util
import subprocess
import yaml
from pathlib import Path
from PIL import ImageDraw, ImageFont

# ── paths ──────────────────────────────────────────────────────────────────────
BASE     = Path(__file__).parent
DATASET  = BASE / 'dataset'
BG_REPO  = os.environ.get('HF_BG_MODEL_REPO', 'Rummikub-project/remove_background')
BG_PATH  = BASE / 'models' / 'RMBG-2.0'
BG_FILES = ['config.json', 'model.safetensors', 'birefnet.py',
            'BiRefNet_config.py', 'preprocessor_config.json']
HF_TOKEN = os.environ.get('HF_TOKEN')

_bg_model = None


# ── model loading (copied from use_model.py so this script is self-contained) ──

def ensure_bg_model():
    BG_PATH.mkdir(parents=True, exist_ok=True)
    missing = [f for f in BG_FILES if not (BG_PATH / f).exists()]
    if not missing:
        return
    print(f"[BG] Downloading RMBG-2.0 ({len(missing)} file(s))...")
    base_url = f'https://huggingface.co/{BG_REPO}/resolve/main/RMBG-2.0'
    for filename in missing:
        print(f"[BG]   {filename}...")
        subprocess.run(
            ['curl', '-L', '-f',
             '-H', f'Authorization: Bearer {HF_TOKEN}',
             '-o', str(BG_PATH / filename),
             f'{base_url}/{filename}'],
            check=True,
        )
    print("[BG] RMBG-2.0 ready.")


def _load_birefnet():
    pkg = types.ModuleType("rmbg")
    pkg.__path__ = [str(BG_PATH)]
    pkg.__package__ = "rmbg"
    sys.modules["rmbg"] = pkg

    def _load(name, filepath):
        spec = importlib.util.spec_from_file_location(
            f"rmbg.{name}", filepath, submodule_search_locations=[])
        mod = importlib.util.module_from_spec(spec)
        mod.__package__ = "rmbg"
        sys.modules[f"rmbg.{name}"] = mod
        spec.loader.exec_module(mod)
        return mod

    _load("BiRefNet_config", str(BG_PATH / "BiRefNet_config.py"))
    bb = _load("birefnet",   str(BG_PATH / "birefnet.py"))

    import torch
    from safetensors.torch import load_file
    from rmbg.BiRefNet_config import BiRefNetConfig

    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    config = BiRefNetConfig()
    model  = bb.BiRefNet(config)
    state  = load_file(str(BG_PATH / "model.safetensors"))
    model.load_state_dict(state)
    model.to(device).eval()
    print(f"[BG] RMBG-2.0 loaded on {device}.")
    return model, device


def remove_background(image_path: Path) -> Path:
    global _bg_model
    import torch
    from torchvision import transforms
    from PIL import Image, ImageOps

    if _bg_model is None:
        ensure_bg_model()
        _bg_model = _load_birefnet()

    model, device = _bg_model
    image    = ImageOps.exif_transpose(Image.open(image_path)).convert("RGB")
    orig_size = image.size

    transform = transforms.Compose([
        transforms.Resize((1024, 1024)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    inp = transform(image).unsqueeze(0).to(device)

    with torch.no_grad():
        preds = model(inp)[-1].sigmoid().cpu()

    mask     = transforms.ToPILImage()(preds[0].squeeze()).resize(orig_size)
    white_bg = Image.new("RGB", orig_size, (255, 255, 255))
    white_bg.paste(image, mask=mask)
    return white_bg


# ── annotation drawing ─────────────────────────────────────────────────────────

def load_class_names() -> list:
    data_yaml = BASE / 'data.yaml'
    with open(data_yaml) as f:
        data = yaml.safe_load(f)
    return [data['names'][i] for i in range(len(data['names']))]


# Color per tile color family
_BOX_COLORS = {
    'Black':  '#00FFFF',
    'Blue':   '#0000FF',
    'Red':    '#FF0000',
    'Yellow': '#FFFF00',
}


def draw_annotations(white_img, label_path: Path, class_names: list):
    """Draw OBB boxes + labels on a copy of white_img. Returns annotated PIL image."""
    from PIL import ImageDraw
    img    = white_img.copy()
    draw   = ImageDraw.Draw(img)
    w, h   = img.size

    if not label_path.exists():
        return img

    for line in label_path.read_text().splitlines():
        parts = line.strip().split()
        if len(parts) != 9:
            continue
        cls_id = int(parts[0])
        coords = [float(x) for x in parts[1:]]
        # coords: x1 y1 x2 y2 x3 y3 x4 y4  (normalized)
        points = [(coords[i] * w, coords[i+1] * h) for i in range(0, 8, 2)]

        name   = class_names[cls_id] if cls_id < len(class_names) else str(cls_id)
        family = name.split('_')[0]
        color  = _BOX_COLORS.get(family, '#00FF00')

        draw.polygon(points, outline=color)
        draw.text((points[0][0], points[0][1] - 12), name, fill=color)

    return img


# ── main ───────────────────────────────────────────────────────────────────────

def process_split(split: str, overwrite: bool, from_tile: str = None):
    images_in   = DATASET / 'images' / split
    labels_in   = DATASET / 'labels' / split
    images_out  = DATASET / 'images_white'
    labels_out  = DATASET / 'labels_white'
    output_out  = DATASET / 'output_white'

    images_out.mkdir(parents=True, exist_ok=True)
    labels_out.mkdir(parents=True, exist_ok=True)
    output_out.mkdir(parents=True, exist_ok=True)

    class_names = load_class_names()

    image_files = sorted(images_in.glob('*.jpg')) + sorted(images_in.glob('*.png'))
    if from_tile:
        image_files = [f for f in image_files if f.stem >= from_tile]
    if not image_files:
        print(f"[{split}] No images found in {images_in}")
        return

    print(f"\n[{split}] Processing {len(image_files)} images...")
    done = skipped = failed = 0

    for i, img_path in enumerate(image_files, 1):
        stem      = img_path.stem
        out_name  = f"{stem}_white"
        out_img   = images_out / f"{out_name}.jpg"
        out_label = labels_out / f"{out_name}.txt"
        out_annot = output_out / f"{out_name}.jpg"

        if out_img.exists() and not overwrite:
            skipped += 1
            continue

        # Copy label (annotations don't change, only the image background does)
        label_src = labels_in / f"{stem}.txt"
        if label_src.exists():
            shutil.copy2(label_src, out_label)

        try:
            white_img = remove_background(img_path)
            white_img.save(out_img, "JPEG", quality=95)

            # Draw bounding boxes and save to output_white
            annotated = draw_annotations(white_img, out_label, class_names)
            annotated.save(out_annot, "JPEG", quality=95)

            done += 1
            print(f"  [{i}/{len(image_files)}] {img_path.name} → {out_img.name}")
        except Exception as e:
            print(f"  [{i}/{len(image_files)}] FAILED {img_path.name}: {e}")
            failed += 1

    print(f"[{split}] Done: {done} processed, {skipped} skipped, {failed} failed.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Generate white-background versions of training images')
    parser.add_argument('--split', choices=['train', 'val', 'test', 'all'], default='all')
    parser.add_argument('--overwrite', action='store_true', help='Re-process images that already exist')
    parser.add_argument('--from', dest='from_tile', default=None,
                        help='Only process images with stem >= this value (e.g. tile0887)')
    args = parser.parse_args()

    splits = ['train', 'val', 'test'] if args.split == 'all' else [args.split]
    for split in splits:
        process_split(split, overwrite=args.overwrite, from_tile=args.from_tile)

    print("\n✓ All done. White-background images saved to dataset/images_white/")
