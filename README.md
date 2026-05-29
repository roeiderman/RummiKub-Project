# RummiKub — AI-Powered Rummikub Assistant

> **Snap a photo of your Rummikub board, get the optimal move instantly.**

RummiKub is a full-stack mobile application that uses computer vision and linear programming to help players calculate the best possible move in any Rummikub game state. Point your camera at the board, the AI detects every tile, and the solver engine tells you exactly which tiles to play and where.

---

## Demo

> _Screenshots and video demo coming soon._

---

## Features

### Core Gameplay
- **AI Tile Detection** — Photograph your board and rack; YOLOv8 identifies all 54 tile classes (4 colors × 13 numbers + 2 jokers) with oriented bounding boxes
- **Background Removal** — BRIA RMBG-2.0 removes the background before detection for higher accuracy
- **Optimal Move Solver** — Linear programming engine (PuLP + CBC) finds the move that places the maximum number of rack tiles legally on the board
- **Manual Board & Rack Editor** — Add, remove, or correct tiles by hand if the camera misses any
- **Best Move Visualisation** — After detection or manual editing, see the optimal move displayed step-by-step: which tiles to take from your rack and exactly where to place them on the board

### Training & Learning
- **Tile Correction Feedback** — Correct any wrong detection; your corrections are uploaded to the training dataset automatically
- **Auto-Retraining Pipeline** — Every 100 corrections triggers a Kaggle notebook to retrain the YOLOv8 model; the new model is pushed back to HuggingFace and **automatically delivered to every user** — on each tile detection request the backend checks the latest model version on HuggingFace and downloads it if a newer one is available, so no app update is needed
- **Training Challenges** — High-value game states (4+ tiles placed) are saved as puzzle scenarios for other players to attempt

### Challenges & Leaderboards
- **Challenge Browser** — Browse scenarios grouped by difficulty (Easy / Medium / Hard), computed from tiles removed, board complexity, and joker usage
- **Challenge Play** — Solve a scenario manually; your best score and attempt count are recorded
- **Global Leaderboard** — Tracks turn-by-turn scores across all players
- **Per-Scenario Leaderboard** — See how your best solution compares to other players and the AI benchmark

### Account Management
- **Sign-Up & Login** — Email/password authentication with JWT access tokens (1 h) and refresh tokens (7 d)
- **Profile** — Update your name, gender, date of birth, and profile photo
- **Secure Session** — Tokens stored in encrypted device storage (expo-secure-store); sessions expire gracefully with a re-login prompt

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Mobile App (Expo / React Native)           │
│  Login · Register · Home · Detection · Board Editor · Solver    │
│  Challenges · Challenge Play · Global & Scenario Leaderboards   │
└─────────────────────┬───────────────────────────────────────────┘
                      │ REST API  (JSON over HTTPS)
┌─────────────────────▼───────────────────────────────────────────┐
│                      Backend  (Node.js / Express 5)             │
│                                                                  │
│   Auth ──► Users ──► Detection ──► Optimize ──► Scenarios       │
│                          │               │                       │
│              ┌───────────▼──┐   ┌────────▼────────┐             │
│              │  Python      │   │  Python          │             │
│              │  use_model.py│   │  run_solver.py   │             │
│              └───────────┬──┘   └────────┬────────┘             │
│              YOLOv8 OBB  │   PuLP / CBC  │                       │
│              + BRIA BG   │   Linear Prog │                       │
│              Removal     │               │                       │
└──────────────┬───────────┴───────────────┴───────────────────────┘
               │                                    │
   ┌───────────▼──────────┐          ┌──────────────▼──────────────┐
   │  MongoDB Atlas       │          │  HuggingFace Hub             │
   │  - users             │          │  - YOLOv8 model weights      │
   │  - leaderboard stats │          │  - Training dataset          │
   │  - scenario boards   │          │  - Challenge scenarios        │
   │  - correction counts │          │  - BRIA RMBG-2.0 weights     │
   └──────────────────────┘          └─────────────────────────────┘
                                               ▲
                                     ┌─────────┴──────────┐
                                     │  Kaggle            │
                                     │  (auto-retraining) │
                                     └────────────────────┘
```

### Components

| Component | Tech | Purpose |
|---|---|---|
| `mobile-app/` | Expo + React Native 0.81, TypeScript | Cross-platform iOS/Android/Web client |
| `Backend/` | Node.js, Express 5, Mongoose | REST API, auth, file handling, subprocess orchestration |
| `model/` | Python, Ultralytics YOLOv8, BRIA RMBG-2.0 | Tile detection from images |
| `solver_engine/` | Python, PuLP | Optimal move calculation via linear programming |

---

## Project Structure

```
RummiKub-Project/
├── Backend/
│   ├── app.js                  # Express app entry point
│   ├── config/                 # Database connection
│   ├── controllers/            # Route handlers
│   ├── services/               # Business logic
│   ├── models/                 # Mongoose schemas
│   ├── routes/                 # API route definitions
│   ├── middleware/             # Auth, upload, error handling
│   ├── utils/                  # Python subprocess bridge, game logic
│   └── public/                 # Uploaded & annotated images (temp)
│
├── mobile-app/
│   ├── app/                    # File-based screens (expo-router)
│   ├── components/             # Reusable UI components
│   └── src/
│       └── services/           # API client + service modules
│
├── model/
│   ├── use_model.py            # Detection script (spawned by Node)
│   ├── train_model.py          # Training script
│   ├── retrain_model_in_kaggle.py  # Kaggle retraining kernel
│   └── models/                 # Model weights (downloaded from HF)
│
└── solver_engine/
    ├── run_solver.py           # LP solver (spawned by Node)
    └── valid_combinations.json # Pre-computed legal runs/sets cache
```

---

## How to Run

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 18 |
| Python | ≥ 3.10 |
| npm | ≥ 9 |
| Expo CLI | `npm install -g expo-cli` |

### 1. Install all dependencies

```bash
npm run iba
```

This installs Node dependencies for both `Backend/` and `mobile-app/`, and pip-installs both `model/requirements.txt` and `solver_engine/requirements.txt`.

### 2. Configure environment variables

#### `Backend/.env`

Create this file in the `Backend/` directory:

```env
# Server
PORT=3000

# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/rummikub

# JWT
JWT_SECRET=<your-secret>
JWT_EXPIRE=1h
JWT_REFRESH_SECRET=<your-refresh-secret>
JWT_REFRESH_EXPIRE=7d

# File paths
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./public/uploads
ANNOTATED_DIR=./public/annotated

# Python / Model
MODEL_PATH=./model/models/rummikub_best.pt
PYTHON_PATH=python3

# HuggingFace (for model downloads & training data uploads)
HF_TOKEN=<your-hf-token>
HF_MODEL_REPO=roeiderman/Rummikub
HF_DATASET_REPO=roeiderman/rummikub-training-dataset
HF_SCENARIOS_REPO=Rummikub-project/training-scenarios

# Kaggle (for auto-retraining trigger)
KAGGLE_USERNAME=<your-kaggle-username>
KAGGLE_KEY=<your-kaggle-api-key>
KAGGLE_CLI=kaggle
```

#### `mobile-app/.env`

Create this file in the `mobile-app/` directory:

```env
# Replace with your machine's local IP address (not localhost)
# Find it with: ipconfig (Windows) / ifconfig (Mac/Linux)
# The phone and the backend must be on the same Wi-Fi network
EXPO_PUBLIC_API_BASE_URL=http://<your-local-ip>:3000
```

> **Important:** Use your machine's LAN IP address (e.g., `192.168.1.100`), not `localhost` or `127.0.0.1`. The mobile device connects over the network and cannot reach `localhost` on your computer.

### 3. Start the backend

```bash
cd Backend
npm run dev   # development (nodemon auto-reload)
# or
npm start     # production
```

On first start the backend will:
- Connect to MongoDB Atlas
- Pre-fetch the BRIA RMBG-2.0 background removal model from HuggingFace (only if you don't have it already)

### 4. Start the mobile app

```bash
cd mobile-app
npx expo start
```

Then:
- Press `i` to open iOS simulator
- Press `a` to open Android emulator
- Scan the QR code with Expo Go on a physical device

---

## API Reference

All endpoints are prefixed with `/api`.

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Create account |
| POST | `/auth/login` | — | Get access + refresh tokens |
| POST | `/auth/logout` | ✓ | Invalidate refresh token |
| POST | `/auth/refresh` | — | Exchange refresh token for new access token |

### Users

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/users/profile` | ✓ | Get current user profile |
| PUT | `/users/profile` | ✓ | Update profile (name, gender, DOB, photo) |

### Detection

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/detection` | ✓ | Upload image (`multipart/form-data`), detect tiles |

Request fields: `image` (file), `annotate` (boolean), `groupFlag` (boolean)

Response: array of tiles with `id`, `tile`, `color`, `number`, `confidence`, `position`, `rotation`

### Optimize

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/optimize` | ✓ | Calculate optimal move from board + rack |

Request body:
```json
{
  "groups": [ [ { "color": "Red", "number": 5 }, ... ], ... ],
  "rack":   [ { "color": "Blue", "number": 7 }, ... ]
}
```

### Training

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/training/correction` | ✓ | Submit corrected tile detection |
| GET | `/training/stats` | ✓ | Correction count toward retraining threshold |
| DELETE | `/training/image/:id` | ✓ | Remove a training image |

### Leaderboard

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/leaderboard` | ✓ | Global leaderboard |
| POST | `/leaderboard/turn` | ✓ | Record a completed turn |

### Challenges (Scenarios)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/scenarios` | ✓ | List all challenges (sorted by difficulty) |
| GET | `/scenarios/:id` | ✓ | Get full scenario (board + rack) |
| POST | `/scenarios/:id/attempt` | ✓ | Submit your solution |
| GET | `/scenarios/:id/leaderboard` | ✓ | Per-scenario leaderboard |

---

## ML Pipeline

### Tile Detection

1. Mobile app uploads image to `/api/detection`
2. Backend saves image to `public/uploads/`, spawns `model/use_model.py`
3. `use_model.py` removes the background with BRIA RMBG-2.0, then runs YOLOv8 inference
4. Returns detections as JSON (tile name, confidence, OBB corners, rotation)
5. Optionally saves image to `public/training_images/` for correction

### Correction & Retraining Loop

```
User corrects wrong tile
        │
        ▼
Backend converts corners to YOLO OBB label format
        │
        ▼
Image + label uploaded to HuggingFace dataset repo
        │
        ▼
CorrectionCounter incremented  ──► count < 100: done
        │ count == 100
        ▼
Kaggle notebook triggered (roeiderman1/rummikub-retrain-model)
        │
        ▼
YOLOv8 trains on full dataset (GPU)
        │
        ▼
New model pushed to HuggingFace model repo
        │
        ▼
Backend downloads new model on next restart
```

### Solver

The solver reads `solver_engine/valid_combinations.json` (all ~100 k pre-computed legal runs and sets) and formulates an integer linear program:

- **Variables**: how many times to use each valid combination
- **Constraints**: tile conservation (board + rack = combinations used + leftovers), at least one rack tile must remain
- **Objective**: minimize leftover tiles, with a heavy penalty for leftover board tiles

---

## Technology Stack

| Layer | Technology |
|---|---|
| Mobile | React Native 0.81, Expo 54, TypeScript, expo-router |
| Backend | Node.js, Express 5, Mongoose, JWT, Multer, Helmet |
| Database | MongoDB Atlas |
| Tile Detection | Python, Ultralytics YOLOv8 OBB, BRIA RMBG-2.0 |
| Solver | Python, PuLP (COIN-BC LP solver) |
| Model Hosting | HuggingFace Hub |
| Retraining | Kaggle Notebooks (GPU) |

---

## Authors

Roey Derman
Dvir Hadad
Meital Basael
