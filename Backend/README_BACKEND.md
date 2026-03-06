# Rummikub Backend API

Complete MVC backend for Rummikub tile detection with MongoDB and JWT authentication.

## Features

✅ User authentication (register/login) with JWT
✅ User profile management
✅ Tile detection API (wraps Python YOLOv8 model)
✅ MongoDB database for user storage
✅ Rate limiting and security middleware
✅ Error handling

## Prerequisites

- Node.js v16+ and npm
- MongoDB installed and running locally
- Python 3 with the trained model (`model/models/rummikub_best.pt`)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

The `.env` file is already created with secure JWT secrets. Verify MongoDB is running:

```bash
# Check if MongoDB is running
mongosh

# Or start MongoDB (macOS with Homebrew)
brew services start mongodb-community

# Or manually
mongod
```

### 3. Start the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server will start on http://localhost:3000

## API Endpoints

### Authentication

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "gender": "male",
  "dateOfBirth": "1990-01-01"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <access_token>
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "<refresh_token>"
}
```

### Users

All user endpoints require authentication (`Authorization: Bearer <token>`)

#### Get Profile
```http
GET /api/users/profile
Authorization: Bearer <access_token>
```

#### Update Profile
```http
PUT /api/users/profile
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Jane Doe",
  "gender": "female",
  "dateOfBirth": "1995-05-15"
}
```

#### Get Statistics
```http
GET /api/users/statistics
Authorization: Bearer <access_token>
```

### Detection

#### Detect Tiles
```http
POST /api/detection
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

image: <file>
annotate: true
purpose: hand
```

**Response:**
```json
{
  "success": true,
  "data": {
    "imageWidth": 640,
    "imageHeight": 640,
    "numTilesDetected": 13,
    "tiles": [
      {
        "id": 0,
        "tile": "Red_13",
        "color": "Red",
        "number": "13",
        "confidence": 0.987,
        "position": { "x": 379, "y": 187 },
        "rotation_degrees": 1.4
      }
    ],
    "averageConfidence": 0.96,
    "detectionTime": 1234
  }
}
```

## Testing with cURL

### 1. Register a user
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Save the `accessToken` from the response.

### 3. Get Profile
```bash
curl -X GET http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer <your_access_token>"
```

### 4. Detect Tiles
```bash
curl -X POST http://localhost:3000/api/detection \
  -H "Authorization: Bearer <your_access_token>" \
  -F "image=@../model/tile0501.jpg" \
  -F "annotate=true"
```

## Project Structure

```
Backend/
├── app.js                      # Main Express application
├── package.json                # Dependencies and scripts
├── .env                        # Environment variables
│
├── config/
│   └── database.js             # MongoDB connection
│
├── models/
│   └── User.js                 # User schema
│
├── controllers/
│   ├── auth.js                 # Authentication handlers
│   ├── users.js                # User handlers
│   └── detection.js            # Detection handlers
│
├── services/
│   ├── auth.js                 # Auth business logic
│   ├── users.js                # User business logic
│   └── detection.js            # Detection logic (wraps detect.js)
│
├── routes/
│   ├── auth.js                 # Auth endpoints
│   ├── users.js                # User endpoints
│   └── detection.js            # Detection endpoints
│
├── middleware/
│   ├── auth.js                 # JWT authentication
│   ├── errorHandler.js         # Global error handler
│   └── upload.js               # File upload (Multer)
│
├── utils/
│   ├── tokenManager.js         # JWT utilities
│   └── passwordUtils.js        # Password hashing
│
├── public/
│   ├── uploads/                # Uploaded images
│   └── annotated/              # Annotated images
│
└── detect.js                   # Existing tile detection module
```

## Database Schema

### User
```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  password: String (hashed),
  gender: String,
  dateOfBirth: Date,
  photo: String,
  lastLogin: Date,
  refreshToken: String,
  statistics: {
    gamesPlayed: Number,
    totalDetections: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

## Security

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens for stateless authentication
- Access tokens expire in 1 hour
- Refresh tokens expire in 7 days
- Rate limiting: 100 requests/15min (general), 5 requests/15min (auth)
- Helmet.js for security headers
- CORS enabled
- File upload limited to 10MB, only JPEG/PNG

## Error Handling

All errors follow this format:
```json
{
  "success": false,
  "error": {
    "type": "ValidationError",
    "message": "Email is required"
  }
}
```

Error types:
- `ValidationError` (400)
- `AuthenticationError` (401)
- `NotFoundError` (404)
- `ConflictError` (409)
- `RateLimitError` (429)
- `InternalError` (500)

## Development

### View Database
Use MongoDB Compass to view the database:
- Connection string: `mongodb://localhost:27017/rummikub`

### Test Detection Module
```bash
npm test
```

## Troubleshooting

### MongoDB Connection Error
```bash
# Check if MongoDB is running
mongosh

# Start MongoDB
brew services start mongodb-community  # macOS
sudo systemctl start mongod            # Linux
```

### Python Model Not Found
Verify the model exists:
```bash
ls -la ../model/models/rummikub_best.pt
```

### Port Already in Use
Change PORT in `.env` file or:
```bash
PORT=4000 npm start
```

## Next Steps

- [ ] Add game session management
- [ ] Implement best move calculation algorithm
- [ ] Add detection history (if needed)
- [ ] Deploy to production server
- [ ] Add email verification
- [ ] Add password reset

## Contributing

This backend is part of the Rummikub Android application project.
