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

# Initialize lesson generator if API key is available
gemini_api_key = os.getenv("GEMINI_API_KEY")
lesson_generator: Optional[LessonGenerator] = None
if gemini_api_key:
    try:
        lesson_generator = LessonGenerator(gemini_api_key)
        logger.info("Lesson Generator initialized successfully")
    except Exception as e:
        logger.warning(f"Failed to initialize Lesson Generator: {str(e)}")
else:
    logger.warning("GEMINI_API_KEY environment variable not found - lesson generation disabled")
    logger.info("To enable lesson generation, set GEMINI_API_KEY environment variable before starting the server")

# In-memory job storage for lesson generation
# In production, consider using Redis or a database
lesson_jobs: Dict[str, Dict[str, Any]] = {}


def generate_lesson_background(job_id: str, detection_result: DetectionResult):
    """
    Background task to generate educational lesson.
    Updates job status in lesson_jobs dict.
    """
    import asyncio
    
    if not lesson_generator:
        lesson_jobs[job_id] = {
            "status": "error",
            "error": "Lesson generator not available (GEMINI_API_KEY not set)"
        }
        return
    
    try:
        lesson_jobs[job_id] = {"status": "processing"}
        
        # Run async lesson generation
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        lesson = loop.run_until_complete(lesson_generator.generate_lesson(detection_result))
        loop.close()
        
        lesson_jobs[job_id] = {
            "status": "completed",
            "lesson": lesson
        }
        logger.info(f"Lesson generated for job {job_id}")
        
    except Exception as e:
        logger.error(f"Error generating lesson for job {job_id}: {str(e)}", exc_info=True)
        lesson_jobs[job_id] = {
            "status": "error",
            "error": str(e)
        }


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
        
        # Trigger background lesson generation if available
        if lesson_generator:
            background_tasks.add_task(generate_lesson_background, job_id, detection_result)
            logger.info(f"Started background lesson generation for job {job_id}")
        else:
            # Mark job as unavailable
            lesson_jobs[job_id] = {
                "status": "unavailable",
                "error": "Lesson generator not available"
            }
        
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


@app.get("/analyze/{job_id}/lesson")
async def get_lesson(job_id: str):
    """
    Get educational lesson for a detection job (slow path).
    
    This endpoint polls the status of lesson generation and returns
    the lesson when ready. Check the status field to see if processing is complete.
    
    Args:
        job_id: Job ID returned from /analyze endpoint
    
    Returns:
        JSON response with lesson status:
        {
            "status": "processing" | "completed" | "error" | "unavailable",
            "lesson": str (if completed),
            "error": str (if error)
        }
    """
    if job_id not in lesson_jobs:
        raise HTTPException(
            status_code=404,
            detail=f"Job {job_id} not found. It may have expired or never existed."
        )
    
    job_status = lesson_jobs[job_id]
    
    return JSONResponse(content=job_status)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)