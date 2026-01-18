from fastapi import FastAPI, File, UploadFile, HTTPException, Path
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from detector import AIImageDetector
from models import DetectionResult
from gemini_analyzer import GeminiAnalyzer
import logging
from typing import Dict, List, Tuple
from dotenv import load_dotenv
import os

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

# In-memory storage for analysis results
# Key: analysis_id (string), Value: Tuple[DetectionResult, bytes] (result and original image bytes)
analysis_results: Dict[str, Tuple[DetectionResult, bytes]] = {}

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "model": "Organika/sdxl-detector",
        "stored_analyses": len(analysis_results)
    }


@app.get("/debug/analyses")
async def list_analyses():
    """Debug endpoint to list all stored analysis IDs."""
    return {
        "count": len(analysis_results),
        "analysis_ids": list(analysis_results.keys())
    }


@app.post("/analyze/{analysis_id}")
async def analyze_image(
    analysis_id: str = Path(..., description="Unique identifier for this analysis"),
    files: List[UploadFile] = File(...)
):
    """
    Analyze uploaded image (1 frame) and store the result in memory.
    
    The analysis is stored with the provided ID and can be retrieved later
    using GET /analyze/{analysis_id}.
    
    Args:
        analysis_id: Unique identifier for this analysis (path parameter)
        files: List of image files (multipart/form-data) - exactly 10 files expected
    
    Returns:
        JSON response indicating success:
        {
            "status": "success",
            "analysis_id": str,
            "message": "Analysis stored successfully"
        }
    """
    # Validate file count (should be 1 frame)
    if len(files) != 1:
        raise HTTPException(
            status_code=400,
            detail=f"Expected exactly 1 image file, but received {len(files)}"
        )
    
    # Validate content types
    for i, file in enumerate(files):
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type for file {i+1}: {file.content_type}. Expected an image file."
            )
    
    # Check if analysis_id already exists
    if analysis_id in analysis_results:
        logger.warning(f"Analysis ID {analysis_id} already exists, overwriting...")
    
    try:
        # Read all image bytes
        image_bytes_list = []
        for i, file in enumerate(files):
            image_bytes = await file.read()
            if len(image_bytes) == 0:
                raise HTTPException(status_code=400, detail=f"Empty file uploaded: file {i+1}")
            image_bytes_list.append(image_bytes)
        
        # Run complete detection pipeline (handles both single and multi-frame)
        detection_result = detector.analyze(image_bytes_list)
        
        # Store result and original image bytes in memory
        image_bytes = image_bytes_list[0]  # Store the single image
        analysis_results[analysis_id] = (detection_result, image_bytes)
        
        logger.info(f"Analysis stored with ID {analysis_id}: {detection_result.severity} severity "
                   f"({'AI' if detection_result.is_ai else 'Human'}, "
                   f"{detection_result.confidence:.0%} confidence)")
        
        return JSONResponse(content={
            "status": "success",
            "analysis_id": analysis_id,
            "message": "Analysis stored successfully"
        })
        
    except Exception as e:
        logger.error(f"Error processing images: {str(e)}", exc_info=True)
        
        if isinstance(e, HTTPException):
            raise e
        
        raise HTTPException(
            status_code=500,
            detail=f"Error processing images: {str(e)}"
        )


@app.get("/analyze/{analysis_id}")
async def get_analysis(analysis_id: str = Path(..., description="Unique identifier for the analysis")):
    """
    Retrieve a stored analysis result by ID.
    
    Args:
        analysis_id: Unique identifier for the analysis (path parameter)
    
    Returns:
        JSON response with DetectionResult:
        {
            "is_ai": bool,
            "confidence": float,
            "severity": "LOW" | "MEDIUM" | "HIGH",
            "reasons": List[str],
            "risk_factors": Dict,
            "classifier_scores": Dict
        }
    
    Raises:
        404: If the analysis_id doesn't exist
    """
    if analysis_id not in analysis_results:
        raise HTTPException(
            status_code=404,
            detail=f"Analysis with ID '{analysis_id}' not found"
        )
    
    detection_result, _ = analysis_results[analysis_id]
    
    logger.info(f"Retrieved analysis with ID {analysis_id}")
    
    return JSONResponse(content=detection_result.to_dict())


@app.get("/analyze/{analysis_id}/explain")
async def get_analysis_with_explanation(analysis_id: str = Path(..., description="Unique identifier for the analysis")):
    """
    Retrieve a stored analysis result by ID, with Gemini explanation if the image was classified as AI.
    
    This endpoint extends the GET /analyze/{analysis_id} endpoint by also calling Gemini
    to explain why something was classified as AI (if is_ai is True).
    
    Args:
        analysis_id: Unique identifier for the analysis (path parameter)
    
    Returns:
        JSON response with DetectionResult plus optional Gemini explanation:
        {
            ...DetectionResult fields...,
            "gemini_explanation": str | None  # Only present if is_ai is True
        }
    
    Raises:
        404: If the analysis_id doesn't exist
        500: If Gemini explanation fails (but still returns DetectionResult)
    """
    if analysis_id not in analysis_results:
        raise HTTPException(
            status_code=404,
            detail=f"Analysis with ID '{analysis_id}' not found"
        )
    
    detection_result, image_bytes = analysis_results[analysis_id]
    
    logger.info(f"Retrieved analysis with ID {analysis_id} for explanation")
    
    # Build base response with DetectionResult
    response_dict = detection_result.to_dict()
    
    # If the image was classified as AI, get Gemini explanation
    if detection_result.is_ai:
        try:
            # Initialize Gemini analyzer if needed
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                logger.warning("GEMINI_API_KEY not set, skipping Gemini explanation")
                response_dict["gemini_explanation"] = None
            else:
                gemini_analyzer = GeminiAnalyzer(api_key=api_key)
                explanation = gemini_analyzer.explain_why_ai(image_bytes)
                response_dict["gemini_explanation"] = explanation
                logger.info(f"Gemini explanation generated for analysis {analysis_id}")
        except Exception as e:
            logger.error(f"Failed to get Gemini explanation: {str(e)}", exc_info=True)
            # Don't fail the request, just omit the explanation
            response_dict["gemini_explanation"] = None
            response_dict["gemini_explanation_error"] = str(e)
    else:
        # Not AI, so no explanation needed
        response_dict["gemini_explanation"] = None
    
    return JSONResponse(content=response_dict)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)