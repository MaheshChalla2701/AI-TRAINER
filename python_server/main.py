import cv2
import mediapipe as mp
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import time
import math
import io
from PIL import Image, ImageOps

app = Flask(__name__)
CORS(app)

# Initialize MediaPipe Pose
mp_pose = mp.solutions.pose
mp_draw = mp.solutions.drawing_utils
pose = mp_pose.Pose(
    static_image_mode=False,
    model_complexity=2, # Highest accuracy
    smooth_landmarks=True,
    enable_segmentation=False,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)



def decode_image(base64_string):
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    img_data = base64.b64decode(base64_string)
    
    # Use PIL to handle EXIF orientation (sideways photos from phones)
    img = Image.open(io.BytesIO(img_data))
    img = ImageOps.exif_transpose(img) 
    
    # Convert back to CV2 (BGR)
    img_cv2 = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    return img_cv2

# --- Utility: Angle Calculation (OpenCV/Numpy style) ---
def calculate_angle(p1, p2, p3):
    """Calculate the angle between three points (p1, p2, p3) where p2 is the vertex."""
    # Convert MediaPipe landmarks to numpy arrays
    a = np.array([p1.x, p1.y])
    b = np.array([p2.x, p2.y]) # Vertex
    c = np.array([p3.x, p3.y])

    radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
    angle = np.abs(radians*180.0/np.pi)
    
    if angle > 180.0:
        angle = 360 - angle
        
    return angle



# --- Endpoints ---

@app.route('/pose', methods=['POST'])
def detect_pose():
    try:
        data = request.json
        if not data or 'image' not in data:
            return jsonify({"error": "No image data"}), 400

        img = decode_image(data['image'])
        
        # Consistent resizing to 640x640 with padding (square for MediaPipe)
        h, w = img.shape[:2]
        target_size = 640
        scale = target_size / max(h, w)
        new_w, new_h = int(w * scale), int(h * scale)
        
        img_resized = cv2.resize(img, (new_w, new_h))
        img_padded = np.zeros((target_size, target_size, 3), dtype=np.uint8)
        
        x_offset = (target_size - new_w) // 2
        y_offset = (target_size - new_h) // 2
        img_padded[y_offset:y_offset+new_h, x_offset:x_offset+new_w] = img_resized
        
        img_rgb = cv2.cvtColor(img_padded, cv2.COLOR_BGR2RGB)
        results = pose.process(img_rgb)
        
        response_data = {
            "keypoints": [],
            "angles": {},
            "score": 0,
            "processed_dims": {"w": w, "h": h} # Tell frontend original aspect
        }

        if results.pose_landmarks:
            # 1. Landmarks
            landmarks = results.pose_landmarks.landmark
            keypoints = []
            
            # Complete MediaPipe Pose landmark names (all 33 landmarks)
            mp_names = {
                0: "nose",
                1: "left_eye_inner", 2: "left_eye", 3: "left_eye_outer",
                4: "right_eye_inner", 5: "right_eye", 6: "right_eye_outer",
                7: "left_ear", 8: "right_ear",
                9: "mouth_left", 10: "mouth_right",
                11: "left_shoulder", 12: "right_shoulder",
                13: "left_elbow", 14: "right_elbow",
                15: "left_wrist", 16: "right_wrist",
                17: "left_pinky", 18: "right_pinky",
                19: "left_index", 20: "right_index",
                21: "left_thumb", 22: "right_thumb",
                23: "left_hip", 24: "right_hip",
                25: "left_knee", 26: "right_knee",
                27: "left_ankle", 28: "right_ankle",
                29: "left_heel", 30: "right_heel",
                31: "left_foot_index", 32: "right_foot_index"
            }

            for idx, lm in enumerate(landmarks):
                name = mp_names.get(idx, f"point_{idx}")
                
                # Correct coordinates back to original image aspect ratio (remove padding)
                # lm.x/lm.y are [0,1] in 640x640 space
                corrected_x = (lm.x * target_size - x_offset) / new_w
                corrected_y = (lm.y * target_size - y_offset) / new_h
                
                keypoints.append({
                    "x": corrected_x, "y": corrected_y, "z": lm.z,
                    "score": lm.visibility, "name": name
                })
            
            response_data["keypoints"] = keypoints
            response_data["score"] = 1.0

            # 2. Angle Detections (Calculated using OpenCV/Numpy logic)
            # Left Elbow Angle (Shoulder -> Elbow -> Wrist)
            response_data["angles"]["left_elbow"] = calculate_angle(landmarks[11], landmarks[13], landmarks[15])
            # Right Elbow Angle
            response_data["angles"]["right_elbow"] = calculate_angle(landmarks[12], landmarks[14], landmarks[16])
            # Left Knee Angle (Hip -> Knee -> Ankle)
            response_data["angles"]["left_knee"] = calculate_angle(landmarks[23], landmarks[25], landmarks[27])
            # Right Knee Angle
            response_data["angles"]["right_knee"] = calculate_angle(landmarks[24], landmarks[26], landmarks[28])

            # 3. Optional: DRAW using OpenCV on the server (useful for server-side debugging logs if saved)
            # For now, we just ensure mp_draw is used correctly. 
            # In a local dev environment, you could call cv2.imshow here.

        return jsonify(response_data)

    except Exception as e:
        print(f"Error in pose: {e}")
        return jsonify({"error": str(e)}), 500



@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "opencv-enhanced-backend"})

if __name__ == '__main__':
    print("Starting OpenCV Enhanced Vision Backend on port 5002...")
    app.run(host='0.0.0.0', port=5002, debug=False)
