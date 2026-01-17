# AI vs Human Image Classifier API

A FastAPI service that classifies images as AI-generated or human-created using the [Ateeqq/ai-vs-human-image-detector](https://huggingface.co/Ateeqq/ai-vs-human-image-detector) model.

## Features

- Local model inference (no API calls needed)
- Fast image classification
- GPU support (auto-detects if available)
- Simple REST API interface

## Setup

### Prerequisites

- Python 3.8 or higher
- pip

### Installation

1. Create a virtual environment (recommended):

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

**Note**: The first run will download the model from Hugging Face (~350MB). This happens automatically when the classifier is initialized.

## Running the Server

Start the FastAPI server:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Or run directly:

```bash
python main.py
```

The API will be available at `http://localhost:8000`

## API Endpoints

### Health Check

```bash
GET /health
```

Returns:
```json
{
  "status": "ok",
  "model": "Ateeqq/ai-vs-human-image-detector"
}
```

### Classify Image

```bash
POST /classify
```

**Request**: Multipart form data with image file

**Example using curl**:
```bash
curl -X POST "http://localhost:8000/classify" \
  -F "file=@path/to/your/image.jpg"
```

**Response**:
```json
{
  "label": "ai",
  "confidence": 0.9996,
  "scores": {
    "ai": 0.9996,
    "hum": 0.0004
  }
}
```

**Example using Python requests**:
```python
import requests

url = "http://localhost:8000/classify"
with open("image.jpg", "rb") as f:
    files = {"file": f}
    response = requests.post(url, files=files)
    print(response.json())
```

## Response Format

- `label`: Predicted class ("ai" or "hum")
- `confidence`: Confidence score (0-1) for the predicted class
- `scores`: Dictionary with probabilities for each class

## Error Handling

The API returns appropriate HTTP status codes:

- `200`: Success
- `400`: Invalid file type or empty file
- `500`: Server error during processing

## Performance

- **CPU**: ~1-3 seconds per image (depending on hardware)
- **GPU**: ~0.1-0.5 seconds per image (if CUDA available)

## Model Information

- **Model**: Ateeqq/ai-vs-human-image-detector
- **Architecture**: SigLIP (Vision Transformer)
- **Training**: ~60,000 AI-generated images vs ~60,000 human images
- **Accuracy**: ~99.23% on test set

## Development

The project structure:

```
classifier-api/
├── main.py              # FastAPI application
├── classifier.py        # Model loading and inference
├── requirements.txt     # Python dependencies
└── README.md           # This file
```

## License

ISC

