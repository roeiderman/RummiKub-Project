import subprocess
import sys

SCRIPT_VERSION = "v2-auto-trigger"
print(f"=== Rummikub Retraining Script {SCRIPT_VERSION} ===")

# ── 0. Install Dependencies ────────────────────────────────────────────────
print("=== Fixing PyTorch for Kaggle's P100 GPU Compatibility ===")
# 1. מחיקת הגרסה החדשה והלא-תואמת
subprocess.check_call([sys.executable, "-m", "pip", "uninstall", "-y", "torch", "torchvision", "torchaudio"])

# 2. התקנת הגרסה שעדיין תומכת ב-P100 (CUDA 11.8)
subprocess.check_call([sys.executable, "-m", "pip", "install", "torch", "torchvision", "torchaudio", "--index-url", "https://download.pytorch.org/whl/cu118"])

print("=== Installing Ultralytics ===")
subprocess.check_call([sys.executable, "-m", "pip", "install", "ultralytics", "huggingface_hub"])

# עכשיו אפשר לייבא את הכל בבטחה
import os
import shutil
import yaml
import random
from pathlib import Path
from kaggle_secrets import UserSecretsClient
from huggingface_hub import hf_hub_download, snapshot_download, HfApi
from ultralytics import YOLO

# ── Configuration ──────────────────────────────────────────────────────────
HF_MODEL_REPO    = "roeiderman/Rummikub"
HF_DATASET_REPO  = "roeiderman/rummikub-training-dataset"
HF_MODEL_FILE    = "rummikub_best.pt"
EPOCHS           = 50     # Updated to match your model.train() parameter
IMG_SIZE         = 1280   # Updated to match your model.train() parameter for reading tiny numbers
BATCH            = 4      # T4 GPU handles batch 8 for OBB
WORKING_DIR      = Path("/kaggle/working")

CLASS_NAMES = {
    0: "Black_1",  1: "Black_2",  2: "Black_3",  3: "Black_4",  4: "Black_5",
    5: "Black_6",  6: "Black_7",  7: "Black_8",  8: "Black_9",  9: "Black_10",
    10: "Black_11", 11: "Black_12", 12: "Black_13", 13: "Blue_1",
    14: "Blue_2",  15: "Blue_3",  16: "Blue_4",  17: "Blue_5",  18: "Blue_6",
    19: "Blue_7",  20: "Blue_8",  21: "Blue_9",  22: "Blue_10", 23: "Blue_11",
    24: "Blue_12", 25: "Blue_13", 26: "Red_1",   27: "Red_2",   28: "Red_3",
    29: "Red_4",   30: "Red_5",   31: "Red_6",   32: "Red_7",   33: "Red_8",
    34: "Red_9",   35: "Red_10",  36: "Red_11",  37: "Red_12",  38: "Red_13",
    39: "Yellow_1", 40: "Yellow_2", 41: "Yellow_3", 42: "Yellow_4",
    43: "Yellow_5", 44: "Yellow_6", 45: "Yellow_7", 46: "Yellow_8",
    47: "Yellow_9", 48: "Yellow_10", 49: "Yellow_11", 50: "Yellow_12",
    51: "Yellow_13", 52: "Red_Joker", 53: "Black_Joker"
}

# ── Cache clearing (prevents corrupted labels from persisting) ──────────────
def clear_dataset_cache(data_path):
    for subset in ["train", "val", "test"]:
        cache_file = data_path / "labels" / f"{subset}.cache"
        if cache_file.exists():
            print(f"Removing old cache: {cache_file}")
            cache_file.unlink()

# ── 1. Authentication ───────────────────────────────────────────────────────
print("=== Authenticating with Hugging Face ===")
secrets = UserSecretsClient()
hf_token = secrets.get_secret("HF_TOKEN")
os.environ["HF_TOKEN"] = hf_token

# ── 2. Download Assets from HF ─────────────────────────────────────────────
print("\n=== Downloading Assets from Hugging Face ===")

model_dir = WORKING_DIR / "base_model"
model_dir.mkdir(exist_ok=True)
model_path = hf_hub_download(
    repo_id=HF_MODEL_REPO,
    filename=HF_MODEL_FILE,
    local_dir=str(model_dir),
    token=hf_token
)
print(f"Model downloaded: {model_path}")

dataset_raw_dir = WORKING_DIR / "raw_dataset"
snapshot_download(
    repo_id=HF_DATASET_REPO,
    repo_type="dataset",
    local_dir=str(dataset_raw_dir),
    token=hf_token
)
print(f"Dataset downloaded: {dataset_raw_dir}")

# ── 3. Dataset Preparation (80/10/10 split with white-background grouping) ─
print("\n=== Preparing Dataset Split (80/10/10) ===")
valid_extensions = {".jpg", ".jpeg", ".png"}
img_dir = dataset_raw_dir / "images"
lbl_dir = dataset_raw_dir / "labels"

all_images = [f for f in img_dir.iterdir() if f.suffix.lower() in valid_extensions]
print(f"Total raw images found: {len(all_images)}")

image_groups = {}
valid_base_names = []
missing_labels = 0

# Group images by base name to keep originals and _white variants together
for img_path in all_images:
    stem = img_path.stem
    # Extract the base name (e.g., 'tile0001' from 'tile0001_white')
    base_name = stem[:-6] if stem.endswith("_white") else stem

    lbl_path = lbl_dir / f"{stem}.txt"
    base_lbl_path = lbl_dir / f"{base_name}.txt"

    # Use exact label if it exists, otherwise fallback to the base label
    if lbl_path.exists():
        active_lbl = lbl_path
    elif base_lbl_path.exists():
        active_lbl = base_lbl_path
    else:
        missing_labels += 1
        continue

    if base_name not in image_groups:
        image_groups[base_name] = []
        valid_base_names.append(base_name)

    image_groups[base_name].append((img_path, active_lbl))

print(f"Unique image groups created: {len(valid_base_names)}")
if missing_labels > 0:
    print(f"WARNING: Skipped {missing_labels} images due to missing labels.")

if len(valid_base_names) == 0:
    raise Exception("ERROR: No valid image/label pairs found. Aborting.")

# Shuffle the GROUPS to mix images evenly
random.seed(42)
random.shuffle(valid_base_names)

# 80/10/10 Split
train_split = int(len(valid_base_names) * 0.8)
val_split   = int(len(valid_base_names) * 0.9)

train_bases = valid_base_names[:train_split]
val_bases   = valid_base_names[train_split:val_split]
test_bases  = valid_base_names[val_split:]

data_path = WORKING_DIR / "dataset"
for subset, bases in [("train", train_bases), ("val", val_bases), ("test", test_bases)]:
    (data_path / "images" / subset).mkdir(parents=True, exist_ok=True)
    (data_path / "labels" / subset).mkdir(parents=True, exist_ok=True)

    for base in bases:
        for img_path, lbl_path in image_groups[base]:
            shutil.copy(img_path, data_path / "images" / subset / img_path.name)
            dest_lbl_name = f"{img_path.stem}.txt"
            shutil.copy(lbl_path, data_path / "labels" / subset / dest_lbl_name)

train_count = sum(len(image_groups[b]) for b in train_bases)
val_count   = sum(len(image_groups[b]) for b in val_bases)
test_count  = sum(len(image_groups[b]) for b in test_bases)

data_yaml = WORKING_DIR / "data.yaml"
with open(data_yaml, "w") as f:
    yaml.dump({
        "path": str(data_path),
        "train": "images/train",
        "val":   "images/val",
        "test":  "images/test",
        "nc":    54,
        "names": CLASS_NAMES
    }, f)
print(f"Data ready: {train_count} train, {val_count} val, {test_count} test total files.")

# Clear stale caches before training
clear_dataset_cache(data_path)

# ── 4. Fine-tuning ─────────────────────────────────────────────────────────
print(f"\n=== Starting Fine-tuning ({EPOCHS} epochs) ===")
model = YOLO(model_path)
model.train(
    data=str(data_yaml),
    epochs=EPOCHS,
    imgsz=IMG_SIZE,
    batch=BATCH,
    device=0,
    amp=False,
    task='obb',
    project='runs/continue_train',
    name='rummikub_ultimate',
    patience=30,
    resume=False,

    # Optimization
    optimizer='auto',
    lr0=0.001,
    lrf=0.01,
    weight_decay=0.0005,

    box=7.5,
    cls=3.0,
    dfl=1.5,

    # Strategic augmentation
    degrees=180.0,
    translate=0.1,
    scale=0.9,
    mosaic=0.5,

    close_mosaic=10,

    # Fatal for digits — keep zero
    shear=0.0,
    perspective=0.0,
    flipud=0.0,
    fliplr=0.0,

    # Extreme lighting augmentation
    hsv_h=0.015,
    hsv_s=0.7,
    hsv_v=0.9,
    bgr=0.3,

    workers=4,
    verbose=True,
    save_period=5,
)

# ── 5. Evaluate new model vs old model on TEST set ─────────────────────────
print("\n=== Evaluating New Model vs Old Model on TEST set ===")

def get_map(m_path):
    m = YOLO(str(m_path))
    res = m.val(data=str(data_yaml), split='test', imgsz=IMG_SIZE, device=0, verbose=False)
    try:
        return res.obb.map
    except AttributeError:
        return res.box.map

new_model_path = WORKING_DIR / 'runs/obb/runs/continue_train/rummikub_ultimate/weights/best.pt'
old_map = get_map(model_path)
new_map = get_map(new_model_path)
print(f"Old mAP50-95: {old_map:.4f} | New mAP50-95: {new_map:.4f}")

# ── 6. Push to HF only if better ───────────────────────────────────────────
if new_map >= old_map:
    print(f"Improvement detected (+{new_map - old_map:.4f}). Pushing to {HF_MODEL_REPO}...")
    api = HfApi(token=hf_token)
    api.upload_file(
        path_or_fileobj=str(new_model_path),
        path_in_repo=HF_MODEL_FILE,
        repo_id=HF_MODEL_REPO,
        repo_type="model",
        commit_message=f"Auto-retrain: mAP {old_map:.4f} -> {new_map:.4f}"
    )
    print("Model pushed to HuggingFace successfully.")
else:
    print(f"New model did not outperform the old one. Keeping existing model on Hub.")
