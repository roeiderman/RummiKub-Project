import subprocess
import sys

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
from pathlib import Path
from kaggle_secrets import UserSecretsClient
from huggingface_hub import hf_hub_download, snapshot_download, HfApi
from ultralytics import YOLO

# ── Configuration ──────────────────────────────────────────────────────────
HF_MODEL_REPO    = "roeiderman/Rummikub"
HF_DATASET_REPO  = "roeiderman/rummikub-training-dataset"
HF_MODEL_FILE    = "rummikub_best.pt"
EPOCHS           = 50
IMG_SIZE         = 640
BATCH            = 8      # T4 GPU handles batch 8 for OBB
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
    for subset in ["train", "val"]:
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

# ── 3. Dataset Preparation (80/20 split) ───────────────────────────────────
print("\n=== Preparing Dataset Split (80/20) ===")
all_images = sorted((dataset_raw_dir / "images").glob("*.jpg"))
split = int(len(all_images) * 0.8)
train_imgs, val_imgs = all_images[:split], all_images[split:]

data_path = WORKING_DIR / "dataset"
for subset, imgs in [("train", train_imgs), ("val", val_imgs)]:
    (data_path / "images" / subset).mkdir(parents=True, exist_ok=True)
    (data_path / "labels" / subset).mkdir(parents=True, exist_ok=True)
    for img in imgs:
        shutil.copy(img, data_path / "images" / subset / img.name)
        lbl = dataset_raw_dir / "labels" / (img.stem + ".txt")
        if lbl.exists():
            shutil.copy(lbl, data_path / "labels" / subset / lbl.name)

data_yaml = WORKING_DIR / "data.yaml"
with open(data_yaml, "w") as f:
    yaml.dump({
        "path": str(data_path),
        "train": "images/train",
        "val": "images/val",
        "nc": 54,
        "names": CLASS_NAMES
    }, f)
print(f"Data ready: {len(train_imgs)} train, {len(val_imgs)} val images.")

# Clear stale caches before training
clear_dataset_cache(data_path)

# ── 4. Fine-tuning (same stable params as continue_training.py) ────────────
print(f"\n=== Starting Fine-tuning ({EPOCHS} epochs) ===")
model = YOLO(model_path)
model.train(
    data=str(data_yaml),
    epochs=EPOCHS,
    imgsz=IMG_SIZE,
    batch=BATCH,
    device=0,               # Kaggle NVIDIA GPU
    amp=False,              # Disabled for stability (same as continue_training.py)
    task='obb',
    project='runs/continue_train',
    name='rummikub_continued',
    patience=30,
    resume=False,

    # Optimization — same as continue_training.py
    optimizer='SGD',
    lr0=0.00005,
    lrf=0.01,
    momentum=0.937,
    weight_decay=0.0005,

    # ALL augmentation DISABLED for OBB stability
    degrees=0.0,
    translate=0.0,
    scale=0.0,
    shear=0.0,
    perspective=0.0,
    flipud=0.0,
    fliplr=0.0,
    mosaic=0.0,
    mixup=0.0,
    copy_paste=0.0,
    auto_augment=None,      # Disable RandAugment/AutoAugment
    erasing=0.0,            # Disable random erasing

    # Color augmentation only (safe for OBB)
    hsv_h=0.015,
    hsv_s=0.7,
    hsv_v=0.4,

    # Training behaviour
    rect=False,
    close_mosaic=0,
    workers=4,              # Kaggle supports multiprocessing
    verbose=True,
    save_period=5,
)

# ── 5. Evaluate new model vs old model ─────────────────────────────────────
print("\n=== Evaluating New Model vs Old Model ===")

def get_map(m_path):
    m = YOLO(str(m_path))
    res = m.val(data=str(data_yaml), imgsz=IMG_SIZE, device=0, verbose=False)
    try:
        return res.obb.map
    except AttributeError:
        return res.box.map

# Updated to match YOLO's actual save path for OBB tasks
new_model_path = WORKING_DIR / "runs/obb/runs/continue_train/rummikub_continued/weights/best.pt"
old_map = get_map(model_path)
new_map = get_map(new_model_path)
print(f"Old mAP50: {old_map:.4f} | New mAP50: {new_map:.4f}")

# ── 6. Push to HF only if better ───────────────────────────────────────────
if new_map >= old_map:
    print(f"Improvement detected (+{new_map - old_map:.4f}). Pushing to {HF_MODEL_REPO}...")
    api = HfApi(token=hf_token)
    api.upload_file(
        path_or_fileobj=str(new_model_path),
        path_in_repo=HF_MODEL_FILE,
        repo_id=HF_MODEL_REPO,
        repo_type="model",
        commit_message=f"Auto-retrain: mAP50 {old_map:.4f} -> {new_map:.4f}"
    )
    print("Model pushed to HuggingFace successfully.")
else:
    print(f"New model did not outperform the old one. Keeping existing model on Hub.")
