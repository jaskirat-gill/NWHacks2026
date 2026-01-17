from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from classifier import Classifier
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="AI vs Human Image Classifier",
    description="Classify images as AI-generated or human-created using Ateeqq/ai-vs-human-image-detector",
    version="1.0.0"
)

# Load classifier at startup
logger.info("Initializing classifier...")
classifier = Classifier()
logger.info("Classifier initialized successfully")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "model": "Ateeqq/ai-vs-human-image-detector"}


@app.post("/classify")
async def classify_image(file: UploadFile = File(...)):
    """
    Classify an uploaded image as AI-generated or human-created.
    
    Args:
        file: Image file (multipart/form-data)
        
    Returns:
        JSON response with classification results:
        {
            "label": "ai" or "hum",
            "confidence": float (0-1),
            "scores": {
                "ai": float,
                "hum": float
            }
        }
    """
    # Validate content type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Expected an image file."
        )
    
    try:
        # Read image bytes
        image_bytes = await file.read()
        
        if len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded")
        
        # Classify image
        result = classifier.predict(image_bytes)
        
        logger.info(f"Classification result: {result['label']} (confidence: {result['confidence']:.4f})")
        
        return JSONResponse(content=result)
        
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}", exc_info=True)
        
        if isinstance(e, HTTPException):
            raise e
        
        raise HTTPException(
            status_code=500,
            detail=f"Error processing image: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

