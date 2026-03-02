# Rummikub Backend

JavaScript/Node.js backend for Rummikub tile detection and best move calculation.

## Architecture

The Backend uses **pure JavaScript** (no Python files here!). It calls the existing `use_model.py` in the `model/` folder for tile detection, then processes results in JavaScript.

- **detect.js**: JavaScript module that receives images and returns JSON detections
- **Backend only contains JavaScript** - the Python model stays in the `model/` folder

## Setup

1. **Install Python dependencies** (for the model):
```bash
cd ../model
pip install -r requirements.txt
```

2. **Ensure model is trained** and available at:
   - `../model/models/rummikub_best.pt`

## Usage

### Command Line

```bash
# Detect tiles in an image
node detect.js path/to/image.jpg

# Save results as JSON
node detect.js path/to/image.jpg --json
```

### As a Module

```javascript
const { detectTiles, printResults } = require('./detect');

// From file path
detectTiles('image.jpg')
    .then(result => {
        console.log(`Detected ${result.num_tiles_detected} tiles`);

        result.tiles.forEach(tile => {
            console.log(`${tile.tile}: ${tile.confidence}`);
        });
    })
    .catch(err => console.error(err));

// From Buffer (e.g., uploaded file)
const fs = require('fs');
const imageBuffer = fs.readFileSync('image.jpg');

detectTiles(imageBuffer)
    .then(printResults)
    .catch(err => console.error(err));
```

## Response Format

The `detectTiles()` function returns a JSON object:

```javascript
{
  "success": true,
  "image": "tile0501.jpg",
  "image_width": 640,
  "image_height": 640,
  "num_tiles_detected": 13,
  "tiles": [
    {
      "id": 0,
      "tile": "Red_13",
      "color": "Red",
      "number": "13",
      "confidence": 0.987,
      "position": { "x": 379.0, "y": 187.0 },
      "size": { "width": 58.2, "height": 82.1 },
      "rotation_degrees": 1.4,
      "corners": [
        { "x": 351.2, "y": 146.3 },
        { "x": 407.1, "y": 149.8 },
        { "x": 404.5, "y": 227.9 },
        { "x": 348.6, "y": 224.4 }
      ]
    },
    // ... more tiles
  ]
}
```

## Next Steps

- [ ] Add REST API server (Express.js)
- [ ] Implement best move calculation algorithm
- [ ] Add endpoint for analyzing player's board vs table tiles
- [ ] Add game logic for valid Rummikub combinations
