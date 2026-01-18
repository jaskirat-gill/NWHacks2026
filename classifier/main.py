from fastapi import FastAPI, File, UploadFile, HTTPException, Path, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from detector import AIImageDetector
from models import DetectionResult
from gemini_analyzer import GeminiAnalyzer
from lesson_generator import LessonGenerator
import logging
import os
import glob
import base64
import json
from typing import Dict, List, Optional, Tuple, Set
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

# Initialize LessonGenerator for educational content (lazy initialization)
lesson_generator: Optional[LessonGenerator] = None

def get_lesson_generator() -> LessonGenerator:
    """Get or initialize the LessonGenerator with Gemini API."""
    global lesson_generator
    if lesson_generator is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="GEMINI_API_KEY environment variable not set"
            )
        lesson_generator = LessonGenerator(api_key=api_key)
        logger.info("LessonGenerator initialized")
    return lesson_generator

# Screenshots directory (relative to classifier folder)
SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'screenshots')

# In-memory storage for analysis results
# Key: analysis_id (string), Value: Tuple[DetectionResult, bytes] (result and original image bytes)
analysis_results: Dict[str, Tuple[DetectionResult, bytes]] = {}

# WebSocket connections for pushing results
# Key: analysis_id (string), Value: Set of WebSocket connections
active_connections: Dict[str, Set[WebSocket]] = {}

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


@app.websocket("/ws/analysis/{analysis_id}")
async def websocket_analysis(websocket: WebSocket, analysis_id: str):
    """
    WebSocket endpoint for receiving push notifications when analysis completes.
    
    Clients connect to this endpoint to receive real-time updates when analysis
    results are ready. The server will push the result as soon as it's available.
    
    Args:
        websocket: WebSocket connection
        analysis_id: Unique identifier for the analysis (path parameter)
    """
    await websocket.accept()
    logger.info(f"WebSocket client connected for analysis_id: {analysis_id}")
    
    # Add connection to active connections set
    if analysis_id not in active_connections:
        active_connections[analysis_id] = set()
    active_connections[analysis_id].add(websocket)
    
    # If result already exists, send it immediately
    if analysis_id in analysis_results:
        detection_result, _ = analysis_results[analysis_id]
        try:
            await websocket.send_json(detection_result.to_dict())
            logger.info(f"Sent existing result to WebSocket client for {analysis_id}")
        except Exception as e:
            logger.error(f"Error sending existing result to WebSocket: {e}")
    
    try:
        # Keep connection alive and wait for disconnect
        while True:
            # Wait for ping or disconnect
            data = await websocket.receive_text()
            # Echo back ping messages for connection health check
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected for analysis_id: {analysis_id}")
    except Exception as e:
        logger.error(f"WebSocket error for {analysis_id}: {e}")
    finally:
        # Remove connection from active connections
        if analysis_id in active_connections:
            active_connections[analysis_id].discard(websocket)
            # Clean up empty sets
            if not active_connections[analysis_id]:
                del active_connections[analysis_id]


async def push_result(analysis_id: str, result: DetectionResult):
    """
    Push analysis result to all connected WebSocket clients for this analysis_id.
    
    Args:
        analysis_id: Unique identifier for the analysis
        result: DetectionResult to push to clients
    """
    if analysis_id not in active_connections:
        return
    
    result_dict = result.to_dict()
    disconnected = set()
    
    for websocket in active_connections[analysis_id]:
        try:
            await websocket.send_json(result_dict)
            logger.info(f"Pushed result to WebSocket client for {analysis_id}")
        except Exception as e:
            logger.warning(f"Error pushing result to WebSocket: {e}")
            disconnected.add(websocket)
    
    # Remove disconnected connections
    for ws in disconnected:
        active_connections[analysis_id].discard(ws)
    
    # Clean up empty sets
    if analysis_id in active_connections and not active_connections[analysis_id]:
        del active_connections[analysis_id]


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
        
        # Push result to connected WebSocket clients
        await push_result(analysis_id, detection_result)
        
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


@app.get("/educate/{analysis_id}")
async def get_education(analysis_id: str = Path(..., description="Unique identifier for the analysis")):
    """
    Generate educational content for a stored analysis using Gemini API.
    
    Returns frames from the video and an AI-generated explanation of why
    the content was flagged (or not flagged) as AI-generated.
    
    Args:
        analysis_id: Unique identifier for the analysis (e.g., "post_1")
    
    Returns:
        JSON response with:
        {
            "frames": List[str],       # base64 encoded JPEG images (up to 5)
            "explanation": str,        # Gemini-generated educational text
            "indicators": List[str],   # Key visual indicators found
            "detection_summary": {     # Summary of original detection
                "is_ai": bool,
                "confidence": float,
                "severity": str
            }
        }
    
    Raises:
        404: If the analysis_id doesn't exist
        500: If Gemini API fails
    """
    # Check if analysis exists
    if analysis_id not in analysis_results:
        raise HTTPException(
            status_code=404,
            detail=f"Analysis with ID '{analysis_id}' not found"
        )
    
    detection_result, _ = analysis_results[analysis_id]
    
    try:
        # Find frames for this post in screenshots directory
        frame_pattern = os.path.join(SCREENSHOTS_DIR, f"{analysis_id}_*.jpg")
        frame_files = sorted(glob.glob(frame_pattern))
        
        logger.info(f"Found {len(frame_files)} frames for {analysis_id}")
        
        # Select up to 5 representative frames (evenly spaced)
        max_frames = 5
        if len(frame_files) > max_frames:
            # Select evenly spaced frames
            step = len(frame_files) // max_frames
            frame_files = [frame_files[i * step] for i in range(max_frames)]
        
        # Read frame bytes
        frame_bytes_list: List[bytes] = []
        frames_base64: List[str] = []
        
        for frame_path in frame_files:
            try:
                with open(frame_path, 'rb') as f:
                    frame_data = f.read()
                    frame_bytes_list.append(frame_data)
                    frames_base64.append(base64.b64encode(frame_data).decode('utf-8'))
            except Exception as e:
                logger.warning(f"Failed to read frame {frame_path}: {str(e)}")
                continue
        
        logger.info(f"Loaded {len(frame_bytes_list)} frames for Gemini analysis")
        
        # Get LessonGenerator and generate educational content
        generator = get_lesson_generator()
        education = await generator.generate_education(
            detection_result=detection_result,
            image_bytes_list=frame_bytes_list if frame_bytes_list else None
        )
        
        logger.info(f"Generated educational content for {analysis_id}")
        
        return JSONResponse(content={
            "frames": frames_base64,
            "explanation": education.explanation,
            "indicators": education.indicators,
            "detection_summary": {
                "is_ai": detection_result.is_ai,
                "confidence": detection_result.confidence,
                "severity": detection_result.severity
            }
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating education for {analysis_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate educational content: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)