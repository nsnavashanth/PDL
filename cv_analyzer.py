import os
import cv2
import numpy as np

# Standard Rubik's cube face names and canonical colors
FACES = {
    'U': {'name': 'Up (Top)', 'center': 'White', 'color_code': '#FFFFFF'},
    'D': {'name': 'Down (Bottom)', 'center': 'Yellow', 'color_code': '#FFD500'},
    'F': {'name': 'Front', 'center': 'Green', 'color_code': '#009B48'},
    'B': {'name': 'Back', 'center': 'Blue', 'color_code': '#0046AD'},
    'L': {'name': 'Left', 'center': 'Orange', 'color_code': '#FF5800'},
    'R': {'name': 'Right', 'center': 'Red', 'color_code': '#B71234'}
}

# Color ranges in HSV space
# Note: OpenCV Hue is 0-179, Saturation is 0-255, Value is 0-255
def classify_hsv(h, s, v):
    """
    Classifies an HSV pixel or median HSV patch into standard Rubik's cube color codes.
    Returns (color_name, hex_code, confidence)
    """
    # Check for white first (low saturation, medium-to-high value)
    if s < 55 and v > 90:
        return 'W', 'White', '#FFFFFF', 0.95
    
    # Check for dark / underexposed
    if v < 40:
        return '?', 'Underexposed', '#333333', 0.30

    # Color Hue boundaries
    # Red wraps around 0 and 180
    if (h >= 0 and h <= 10) or (h >= 165 and h <= 179):
        # Orange vs Red boundary check
        if h >= 10 and h <= 12 and s < 200:
            return 'O', 'Orange', '#FF5800', 0.85
        return 'R', 'Red', '#B71234', 0.95
    elif 11 <= h <= 25:
        return 'O', 'Orange', '#FF5800', 0.92
    elif 26 <= h <= 42:
        return 'Y', 'Yellow', '#FFD500', 0.93
    elif 43 <= h <= 85:
        return 'G', 'Green', '#009B48', 0.95
    elif 86 <= h <= 135:
        return 'B', 'Blue', '#0046AD', 0.95
    else:
        # Ambiguous Hue range
        if s > 60:
            return 'R', 'Red', '#B71234', 0.70
        return 'W', 'White', '#FFFFFF', 0.60

def assess_image_quality(img_bgr):
    """
    Evaluates image sharpness via Laplacian variance and average brightness.
    Returns (is_acceptable, blur_score, brightness, message)
    """
    if img_bgr is None or img_bgr.size == 0:
        return False, 0.0, 0.0, "Empty image data."
    
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(np.mean(gray))

    if blur_score < 15.0:
        return False, blur_score, brightness, f"Image is too blurry (sharpness score {blur_score:.1f} < 15.0). Please provide a clearer shot."
    
    if brightness < 25.0:
        return False, blur_score, brightness, f"Image is too dark (average brightness {brightness:.1f} < 25.0). Needs better lighting."
    
    if brightness > 245.0:
        return False, blur_score, brightness, f"Image is overexposed (brightness {brightness:.1f} > 245.0). Reduce direct glare."

    return True, blur_score, brightness, "Image quality acceptable."

def detect_cube_face_grid(image_bytes):
    """
    Decodes an image from bytes, assesses quality, identifies 3x3 sticker grid,
    classifies sticker colors, and produces an annotated visualization.
    Returns dictionary with detection results.
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return {
            'success': False,
            'error': 'Unsupported image format or corrupted file. Please upload PNG, JPG, or WEBP.'
        }

    h, w, _ = img.shape
    if h < 100 or w < 100:
        return {
            'success': False,
            'error': f'Image resolution too small ({w}x{h}). Minimum required is 100x100 pixels.'
        }

    # Quality check
    is_ok, blur_score, brightness, quality_msg = assess_image_quality(img)
    if not is_ok:
        return {
            'success': False,
            'error': quality_msg,
            'blur_score': round(blur_score, 1),
            'brightness': round(brightness, 1)
        }

    # Normalize image size for consistent grid sampling while preserving aspect ratio
    target_dim = 600
    scale = min(target_dim / w, target_dim / h)
    new_w, new_h = int(w * scale), int(h * scale)
    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    # Convert to HSV
    hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)

    # In Rubik's cube photography, the cube face occupies the central area.
    # We sample a defined 3x3 grid across the central 70% of the image bounding region.
    # Center bounds:
    margin_x = int(new_w * 0.16)
    margin_y = int(new_h * 0.16)
    grid_w = new_w - 2 * margin_x
    grid_h = new_h - 2 * margin_y

    step_x = grid_w / 3.0
    step_y = grid_h / 3.0

    detected_grid = []
    annotated = resized.copy()
    confidences = []

    for row in range(3):
        row_colors = []
        for col in range(3):
            # Center of the sticker
            cx = int(margin_x + (col + 0.5) * step_x)
            cy = int(margin_y + (row + 0.5) * step_y)

            # Sample patch size (e.g. 20% of sticker size to avoid sticker border lines)
            patch_radius = max(4, int(min(step_x, step_y) * 0.20))
            y1 = max(0, cy - patch_radius)
            y2 = min(new_h, cy + patch_radius)
            x1 = max(0, cx - patch_radius)
            x2 = min(new_w, cx + patch_radius)

            patch_hsv = hsv[y1:y2, x1:x2]

            if patch_hsv.size == 0:
                code, name, hex_c, conf = '?', 'Unknown', '#888888', 0.0
            else:
                med_h = np.median(patch_hsv[:, :, 0])
                med_s = np.median(patch_hsv[:, :, 1])
                med_v = np.median(patch_hsv[:, :, 2])
                code, name, hex_c, conf = classify_hsv(med_h, med_s, med_v)

            confidences.append(conf)
            row_colors.append({
                'code': code,
                'name': name,
                'hex': hex_c,
                'confidence': round(conf, 2),
                'coords': [cx, cy]
            })

            # Draw visual feedback overlay on annotated image
            # Draw sticker boundary box
            bx1 = int(margin_x + col * step_x + 5)
            by1 = int(margin_y + row * step_y + 5)
            bx2 = int(margin_x + (col + 1) * step_x - 5)
            by2 = int(margin_y + (row + 1) * step_y - 5)

            # Draw border
            cv2.rectangle(annotated, (bx1, by1), (bx2, by2), (240, 240, 240), 2)
            # Draw sample center marker
            cv2.circle(annotated, (cx, cy), patch_radius, (20, 20, 20), 1)
            cv2.circle(annotated, (cx, cy), 3, (255, 255, 255), -1)

            # Text tag
            cv2.putText(annotated, code, (cx - 7, cy + 6),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 3)
            cv2.putText(annotated, code, (cx - 7, cy + 6),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

        detected_grid.append(row_colors)

    # Encode annotated image to Base64 JPEG for browser preview
    _, buffer = cv2.imencode('.jpg', annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    import base64
    annotated_b64 = base64.b64encode(buffer).decode('utf-8')

    avg_confidence = float(np.mean(confidences))

    return {
        'success': True,
        'grid': detected_grid,
        'average_confidence': round(avg_confidence, 2),
        'blur_score': round(blur_score, 1),
        'brightness': round(brightness, 1),
        'annotated_image': f"data:image/jpeg;base64,{annotated_b64}",
        'dimensions': {'width': w, 'height': h}
    }
