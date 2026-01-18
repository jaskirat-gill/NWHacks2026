import torch
from transformers import AutoImageProcessor, AutoModelForImageClassification
from PIL import Image
import io
from typing import Dict, Any

MODEL_ID = "Organika/sdxl-detector"

class Classifier:
    """SDXL-focused AI image detector."""
    
    def __init__(self, device=None):
        self.device = device or (torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu"))
        print(f"Loading {MODEL_ID} on {self.device}")
        
        self.processor = AutoImageProcessor.from_pretrained(MODEL_ID)
        self.model = AutoModelForImageClassification.from_pretrained(MODEL_ID)
        self.model.to(self.device)
        self.model.eval()
        
        print(f"Model loaded successfully")
        print(f"Labels: {self.model.config.id2label}")
    
    def predict(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Classify an image as AI-generated or real.
        
        Args:
            image_bytes: Raw image bytes
            
        Returns:
            Dictionary with label, confidence, and full score distribution
        """
        # Load and convert image
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # Preprocess
        inputs = self.processor(images=image, return_tensors="pt").to(self.device)
        
        # Inference
        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits
            probs = torch.softmax(logits, dim=-1)[0]
        
        # Get prediction
        predicted_idx = logits.argmax(-1).item()
        label = self.model.config.id2label[predicted_idx]
        confidence = probs[predicted_idx].item()
        
        # Full distribution
        distribution = {
            self.model.config.id2label[i]: float(probs[i].item())
            for i in range(len(probs))
        }
        
        return {
            "label": label,
            "confidence": confidence,
            "scores": distribution
        }

# Usage example
if __name__ == "__main__":
    classifier = Classifier()
    
    # Test with an image
    with open("test_image.jpg", "rb") as f:
        result = classifier.predict(f.read())
    
    print(f"Prediction: {result['label']}")
    print(f"Confidence: {result['confidence']:.2%}")
    print(f"All scores: {result['scores']}")