import os
import cv2
import numpy as np
import wave
import struct
import math

SAMPLE_DIR = os.path.join(os.path.dirname(__file__), "sample_data")
os.makedirs(SAMPLE_DIR, exist_ok=True)

# Rubik's color hex definitions
COLOR_MAP = {
    'W': (245, 245, 248),   # BGR for White
    'Y': (15, 215, 255),    # BGR for Yellow
    'G': (35, 165, 25),     # BGR for Green
    'B': (190, 60, 15),     # BGR for Blue
    'O': (10, 105, 255),    # BGR for Orange
    'R': (35, 20, 205)      # BGR for Red
}

# 6 scrambled faces definition (row-major 3x3 for each face)
SAMPLE_FACES = {
    'U': {
        'name': 'cube_up.png',
        'grid': [
            ['W', 'G', 'R'],
            ['B', 'W', 'O'],
            ['Y', 'R', 'W']
        ]
    },
    'D': {
        'name': 'cube_down.png',
        'grid': [
            ['Y', 'B', 'O'],
            ['G', 'Y', 'R'],
            ['W', 'O', 'Y']
        ]
    },
    'F': {
        'name': 'cube_front.png',
        'grid': [
            ['G', 'W', 'B'],
            ['O', 'G', 'Y'],
            ['R', 'G', 'W']
        ]
    },
    'B': {
        'name': 'cube_back.png',
        'grid': [
            ['B', 'R', 'Y'],
            ['W', 'B', 'G'],
            ['O', 'B', 'R']
        ]
    },
    'L': {
        'name': 'cube_left.png',
        'grid': [
            ['O', 'Y', 'G'],
            ['R', 'O', 'W'],
            ['B', 'O', 'Y']
        ]
    },
    'R': {
        'name': 'cube_right.png',
        'grid': [
            ['R', 'W', 'O'],
            ['Y', 'R', 'B'],
            ['G', 'R', 'G']
        ]
    }
}

def create_cube_face_image(grid_colors, output_path):
    img_size = 500
    # Clean neutral background (e.g. tabletop)
    img = np.full((img_size, img_size, 3), 235, dtype=np.uint8)

    # Cube face border (black plastic body)
    face_margin = 40
    cube_size = img_size - 2 * face_margin
    cv2.rectangle(img, (face_margin - 8, face_margin - 8), 
                  (face_margin + cube_size + 8, face_margin + cube_size + 8), 
                  (22, 22, 24), -1)

    # Rounded sticker slots
    sticker_gap = 10
    total_gaps = sticker_gap * 4
    sticker_size = (cube_size - total_gaps) // 3

    for r in range(3):
        for c in range(3):
            code = grid_colors[r][c]
            base_bgr = COLOR_MAP[code]

            x1 = face_margin + sticker_gap + c * (sticker_size + sticker_gap)
            y1 = face_margin + sticker_gap + r * (sticker_size + sticker_gap)
            x2 = x1 + sticker_size
            y2 = y1 + sticker_size

            # Draw sticker with rounded appearance
            sticker = np.full((sticker_size, sticker_size, 3), base_bgr, dtype=np.uint8)

            # Add subtle gradient / lighting for realism
            for y in range(sticker_size):
                factor = 1.05 - 0.1 * (y / sticker_size)
                sticker[y, :] = np.clip(sticker[y, :] * factor, 0, 255)

            # Insert into main image
            img[y1:y2, x1:x2] = sticker

            # Fine border line on sticker
            cv2.rectangle(img, (x1, y1), (x2, y2), (40, 40, 42), 2)

    # Save PNG
    cv2.imwrite(output_path, img)

def generate_sample_scramble_audio(output_path):
    """
    Synthesizes a realistic Rubik's cube scrambling audio sequence:
    mechanical rotational clicks and friction bursts over 2.8 seconds.
    """
    sample_rate = 44100
    duration = 2.8
    total_frames = int(sample_rate * duration)
    
    # 5 distinct turn clicks at specific millisecond offsets
    click_times = [0.35, 0.85, 1.40, 1.95, 2.45]
    
    samples = np.zeros(total_frames, dtype=np.float32)

    for click_t in click_times:
        start_idx = int(click_t * sample_rate)
        # Click duration ~ 0.12s
        click_len = int(0.12 * sample_rate)
        t = np.linspace(0, 0.12, click_len, endpoint=False)

        # High frequency snap (2200 Hz) + mechanical body resonance (650 Hz) + white noise burst
        snap = np.sin(2 * np.pi * 2150 * t) * np.exp(-t * 90)
        body = np.sin(2 * np.pi * 680 * t) * np.exp(-t * 40)
        friction = (np.random.rand(click_len) * 2 - 1) * np.exp(-t * 50) * 0.4

        click_burst = (0.5 * snap + 0.3 * body + 0.2 * friction)
        end_idx = min(total_frames, start_idx + click_len)
        samples[start_idx:end_idx] += click_burst[:end_idx - start_idx]

    # Add very faint ambient room noise floor
    samples += (np.random.rand(total_frames) * 2 - 1) * 0.005

    # Normalize amplitude to -3 dB
    max_val = np.max(np.abs(samples))
    if max_val > 0:
        samples = samples / max_val * 0.85

    # Convert to 16-bit PCM
    pcm_data = (samples * 32767).astype(np.int16)

    with wave.open(output_path, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_data.tobytes())

if __name__ == "__main__":
    print("Generating sample cube face images...")
    for face_id, face_info in SAMPLE_FACES.items():
        out_file = os.path.join(SAMPLE_DIR, face_info['name'])
        create_cube_face_image(face_info['grid'], out_file)
        print(f"Generated {face_info['name']} for Face {face_id}")

    audio_file = os.path.join(SAMPLE_DIR, "sample_scramble.wav")
    print("Generating sample scrambling audio WAV...")
    generate_sample_scramble_audio(audio_file)
    print(f"Generated {audio_file}")
    print("Sample generation complete.")
