from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from detector import AIImageDetector
from lesson_generator import LessonGenerator
from models import DetectionResult
import os
import uuid
import logging
from typing import Dict, Optional, Any
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="AI Image Detection System",
    description="Comprehensive AI image detection with severity scoring and educational explanations",
    version="2.0.0"
)

# Add CORS middleware for web client integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize unified detector at startup
logger.info("Initializing AI Image Detector...")
detector = AIImageDetector()
logger.info("AI Image Detector ready")

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "model": "Organika/sdxl-detector",
        "lesson_generator_available": lesson_generator is not None
    }


@app.post("/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Analyze an uploaded image with complete detection pipeline (fast path).
    
    This endpoint immediately returns detection results and triggers
    background lesson generation. Use /analyze/{job_id}/lesson to get the lesson.
    
    Args:
        file: Image file (multipart/form-data)
    
    Returns:
        JSON response with DetectionResult and job_id:
        {
            "detection": {
                "is_ai": bool,
                "confidence": float,
                "severity": "LOW" | "MEDIUM" | "HIGH",
                "reasons": List[str],
                "risk_factors": Dict,
                "classifier_scores": Dict
            },
            "job_id": str
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
        
        # Run complete detection pipeline (fast path)
        detection_result = detector.analyze(image_bytes)
        
        # Generate job ID for lesson generation
        job_id = str(uuid.uuid4())
        
        # Return detection result immediately
        response = {
            "detection": detection_result.to_dict(),
            "job_id": job_id
        }
        
        logger.info(f"Detection complete: {detection_result.severity} severity "
                   f"({'AI' if detection_result.is_ai else 'Human'}, "
                   f"{detection_result.confidence:.0%} confidence)")
        
        return JSONResponse(content=response)
        
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