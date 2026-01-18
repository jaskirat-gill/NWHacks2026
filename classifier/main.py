from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from detector import AIImageDetector
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="AI Image Detection System",
    description="Comprehensive AI image detection with severity scoring and risk analysis",
    version="2.0.0"
)

# Initialize unified detector at startup
logger.info("Initializing AI Image Detector...")
detector = AIImageDetector()
logger.info("AI Image Detector ready")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "model": "Ateeqq/ai-vs-human-image-detector"}


@app.post("/classify")
async def classify_image(file: UploadFile = File(...)):
    """
    Analyze an uploaded image with complete detection pipeline.
    
    This endpoint runs the full detection pipeline:
    - ML classification
    - Visual analysis
    - Intent detection
    - Severity calculation
    
    Args:
        file: Image file (multipart/form-data)
        
    Returns:
        JSON response with complete DetectionResult:
        {
            "is_ai": bool,
            "confidence": float (0-1),
            "severity": "LOW" | "MEDIUM" | "HIGH",
            "reasons": List[str],
            "risk_factors": Dict,
            "classifier_scores": Dict
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
        
        # Run complete detection pipeline
        detection_result = detector.analyze(image_bytes)
        
        # Convert DetectionResult to dict for JSON response
        result = detection_result.to_dict()
        
        logger.info(f"Detection complete: {detection_result.severity} severity "
                   f"({'AI' if detection_result.is_ai else 'Human'}, "
                   f"{detection_result.confidence:.0%} confidence)")
        
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

