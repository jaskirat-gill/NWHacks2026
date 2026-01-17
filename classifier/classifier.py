import torch
from transformers import AutoImageProcessor, SiglipForImageClassification
from PIL import Image
import io
from typing import Dict, Any

MODEL_ID = "Ateeqq/ai-vs-human-image-detector"


class Classifier:
    """Image classifier for AI vs Human detection using Hugging Face model."""
    
    def __init__(self, device=None):
        """
        Initialize the classifier and load the model.
        
        Args:
            device: torch device (cuda/cpu). If None, auto-detects.
        """
        self.device = device or (torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu"))
        print(f"Loading model '{MODEL_ID}' to device: {self.device}")
        
        self.processor = AutoImageProcessor.from_pretrained(MODEL_ID)
        self.model = SiglipForImageClassification.from_pretrained(MODEL_ID)
        self.model.to(self.device)
        self.model.eval()
        
        print(f"Model loaded successfully on {self.device}")
    
    def predict(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Classify an image from bytes.
        
        Args:
            image_bytes: Raw image bytes (PNG, JPEG, etc.)
            
        Returns:
            Dictionary with:
                - label: "ai" or "hum"
                - confidence: float (0-1)
                - scores: dict with per-class probabilities
        """
        # Load and convert image to RGB
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # Preprocess image
        inputs = self.processor(images=image, return_tensors="pt").to(self.device)
        
        # Run inference
        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits
        
        # Convert logits to probabilities
        probs = torch.softmax(logits, dim=-1)[0]
        
        # Get predicted class
        class_idx = torch.argmax(probs).item()
        label = self.model.config.id2label[class_idx]
        confidence = probs[class_idx].item()
        
        # Get full distribution
        distribution = {
            self.model.config.id2label[i]: float(probs[i].item()) 
            for i in range(len(probs))
        }
        
        return {
            "label": label,
            "confidence": float(confidence),
            "scores": distribution
        }

