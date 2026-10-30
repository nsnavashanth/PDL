import os
import io
import json
import base64
from flask import Flask, render_template, request, jsonify, send_file
from database import init_db, log_event, get_recent_logs, clear_logs
from cv_analyzer import detect_cube_face_grid, FACES
from audio_analyzer import analyze_audio_data
from auth_core import compute_entropy_digest, generate_demo_token, verify_demo_token

app = Flask(__name__, template_folder='templates', static_folder='static')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max upload limit

# In-memory shared session state for the single-user local prototype
session_state = {
    'cube_faces': {},      # 'U', 'D', 'F', 'B', 'L', 'R' -> detection result
    'audio_features': None,# latest extracted audio telemetry
    'last_digest': None,   # latest computed entropy digest & validation
    'active_token': None   # latest issued demo token
}

SAMPLE_DIR = os.path.join(os.path.dirname(__file__), "sample_data")

FACE_IMAGE_MAP = {
    'U': 'cube_up.png',
    'D': 'cube_down.png',
    'F': 'cube_front.png',
    'B': 'cube_back.png',
    'L': 'cube_left.png',
    'R': 'cube_right.png'
}

# Initialize database
init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/session/status', methods=['GET'])
def get_session_status():
    detected_faces = {}
    for f_id in ['U', 'D', 'F', 'B', 'L', 'R']:
        f_data = session_state['cube_faces'].get(f_id)
        if f_data and f_data.get('success'):
            detected_faces[f_id] = {
                'detected': True,
                'confidence': f_data.get('average_confidence', 0),
                'name': FACES[f_id]['name']
            }
        else:
            detected_faces[f_id] = {
                'detected': False,
                'name': FACES[f_id]['name']
            }

    audio_ready = bool(session_state['audio_features'] and session_state['audio_features'].get('success'))
    faces_ready_count = sum(1 for v in detected_faces.values() if v['detected'])
    pipeline_ready = (faces_ready_count == 6) and audio_ready

    return jsonify({
        'faces_detected_count': faces_ready_count,
        'faces_total': 6,
        'faces_status': detected_faces,
        'audio_processed': audio_ready,
        'audio_summary': {
            'duration_sec': session_state['audio_features'].get('duration_seconds') if audio_ready else None,
            'rms_energy': session_state['audio_features'].get('rms_energy') if audio_ready else None,
            'centroid_hz': session_state['audio_features'].get('spectral_centroid_hz') if audio_ready else None
        } if audio_ready else None,
        'pipeline_ready': pipeline_ready,
        'last_digest': session_state['last_digest']['digest'] if session_state['last_digest'] else None,
        'active_token': session_state['active_token']
    })

@app.route('/api/session/reset', methods=['POST'])
def reset_session():
    client_ip = request.remote_addr or "127.0.0.1"
    session_state['cube_faces'] = {}
    session_state['audio_features'] = None
    session_state['last_digest'] = None
    session_state['active_token'] = None

    log_event(
        event_type="SESSION_RESET",
        module="System",
        status="SUCCESS",
        summary="Demo session reset to initial state",
        client_ip=client_ip
    )

    return jsonify({
        'success': True,
        'message': 'Demo session reset successfully. All module states cleared.'
    })

# --- Module A: Cube Vision Endpoints ---

@app.route('/api/cube/analyze', methods=['POST'])
def analyze_cube_face():
    client_ip = request.remote_addr or "127.0.0.1"
    face = request.form.get('face') or request.args.get('face')
    
    # Also support JSON payload with base64 or sample flag
    if not face and request.is_json:
        data = request.get_json() or {}
        face = data.get('face')

    if not face or face.upper() not in FACES:
        return jsonify({
            'success': False,
            'error': f"Invalid or missing face identifier. Must be one of: {list(FACES.keys())}"
        }), 400

    face = face.upper()
    image_bytes = None

    # Check for sample data request
    use_sample = False
    if request.is_json:
        data = request.get_json() or {}
        use_sample = data.get('use_sample', False)
        b64_img = data.get('image_base64')
        if b64_img:
            try:
                if ',' in b64_img:
                    b64_img = b64_img.split(',', 1)[1]
                image_bytes = base64.b64decode(b64_img)
            except Exception as e:
                return jsonify({'success': False, 'error': f"Base64 decoding failed: {str(e)}"}), 400

    if not image_bytes and 'image' in request.files:
        file = request.files['image']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No image file selected.'}), 400
        image_bytes = file.read()

    if use_sample or (not image_bytes and request.form.get('use_sample') == 'true'):
        sample_filename = FACE_IMAGE_MAP.get(face)
        if sample_filename:
            sample_path = os.path.join(SAMPLE_DIR, sample_filename)
            if os.path.exists(sample_path):
                with open(sample_path, 'rb') as f:
                    image_bytes = f.read()

    if not image_bytes:
        return jsonify({
            'success': False,
            'error': f"No image provided for face {face}. Please upload an image or select sample data."
        }), 400

    # Run OpenCV analysis
    result = detect_cube_face_grid(image_bytes)

    if result.get('success'):
        session_state['cube_faces'][face] = result
        log_event(
            event_type="CV_ANALYSIS",
            module="Cube Vision",
            status="SUCCESS",
            summary=f"Face {face} ({FACES[face]['name']}) analyzed successfully",
            details={
                'face': face,
                'confidence': result.get('average_confidence'),
                'blur_score': result.get('blur_score'),
                'brightness': result.get('brightness')
            },
            client_ip=client_ip
        )
    else:
        log_event(
            event_type="CV_ANALYSIS",
            module="Cube Vision",
            status="FAILED",
            summary=f"Face {face} detection failed: {result.get('error')}",
            details={'face': face, 'error': result.get('error')},
            client_ip=client_ip
        )

    # Invalidate downstream digest if faces changed
    session_state['last_digest'] = None

    return jsonify({
        'face': face,
        'face_info': FACES[face],
        **result
    }), (200 if result.get('success') else 422)

@app.route('/api/cube/load-all-samples', methods=['POST'])
def load_all_cube_samples():
    client_ip = request.remote_addr or "127.0.0.1"
    results = {}
    ordered_keys = ['U', 'D', 'F', 'B', 'L', 'R']

    for face in ordered_keys:
        sample_filename = FACE_IMAGE_MAP.get(face)
        sample_path = os.path.join(SAMPLE_DIR, sample_filename)
        if os.path.exists(sample_path):
            with open(sample_path, 'rb') as f:
                img_data = f.read()
            res = detect_cube_face_grid(img_data)
            if res.get('success'):
                session_state['cube_faces'][face] = res
                results[face] = res
            else:
                results[face] = res
        else:
            results[face] = {'success': False, 'error': f"Sample file not found: {sample_filename}"}

    session_state['last_digest'] = None

    log_event(
        event_type="CV_ANALYSIS",
        module="Cube Vision",
        status="SUCCESS",
        summary="Loaded and analyzed all 6 sample cube faces",
        details={'faces_count': len(results)},
        client_ip=client_ip
    )

    return jsonify({
        'success': True,
        'message': 'All 6 sample cube faces loaded and verified.',
        'faces': results
    })

# --- Module B: Entropy Engine Endpoints ---

@app.route('/api/audio/analyze', methods=['POST'])
def analyze_scramble_audio():
    client_ip = request.remote_addr or "127.0.0.1"
    audio_bytes = None

    # Check for sample data request
    if request.is_json:
        data = request.get_json() or {}
        if data.get('use_sample'):
            sample_path = os.path.join(SAMPLE_DIR, "sample_scramble.wav")
            if os.path.exists(sample_path):
                with open(sample_path, 'rb') as f:
                    audio_bytes = f.read()
        elif data.get('audio_base64'):
            b64_audio = data.get('audio_base64')
            if ',' in b64_audio:
                b64_audio = b64_audio.split(',', 1)[1]
            try:
                audio_bytes = base64.b64decode(b64_audio)
            except Exception as e:
                return jsonify({'success': False, 'error': f"Invalid audio base64: {str(e)}"}), 400

    if not audio_bytes and 'audio' in request.files:
        file = request.files['audio']
        if file.filename != '':
            audio_bytes = file.read()

    if not audio_bytes and request.form.get('use_sample') == 'true':
        sample_path = os.path.join(SAMPLE_DIR, "sample_scramble.wav")
        if os.path.exists(sample_path):
            with open(sample_path, 'rb') as f:
                audio_bytes = f.read()

    if not audio_bytes:
        return jsonify({
            'success': False,
            'error': 'No audio data received. Please record audio or upload a WAV file.'
        }), 400

    # Execute audio analysis
    result = analyze_audio_data(audio_bytes)

    if result.get('success'):
        session_state['audio_features'] = result
        session_state['last_digest'] = None
        log_event(
            event_type="AUDIO_EXTRACTION",
            module="Entropy Engine",
            status="SUCCESS",
            summary=f"Acoustic features extracted ({result.get('duration_seconds')}s, RMS: {result.get('rms_energy')})",
            details={
                'duration': result.get('duration_seconds'),
                'rms_energy': result.get('rms_energy'),
                'centroid_hz': result.get('spectral_centroid_hz'),
                'zcr': result.get('zero_crossing_rate')
            },
            client_ip=client_ip
        )
    else:
        log_event(
            event_type="AUDIO_EXTRACTION",
            module="Entropy Engine",
            status="FAILED",
            summary=f"Audio analysis failed: {result.get('error')}",
            details={'error': result.get('error')},
            client_ip=client_ip
        )

    return jsonify(result), (200 if result.get('success') else 422)

@app.route('/api/entropy/process', methods=['POST'])
def process_entropy_pipeline():
    client_ip = request.remote_addr or "127.0.0.1"
    salt = None
    if request.is_json:
        data = request.get_json() or {}
        salt = data.get('salt')

    cube_faces = session_state['cube_faces']
    audio_features = session_state['audio_features']

    result = compute_entropy_digest(cube_faces, audio_features, salt=salt)
    session_state['last_digest'] = result

    log_status = "SUCCESS" if result['validation']['all_inputs_ready'] else "WARNING"
    log_event(
        event_type="ENTROPY_PIPELINE",
        module="Entropy Engine",
        status=log_status,
        summary=f"Computed SHA-256 digest: {result['digest'][:16]}... (Inputs ready: {result['validation']['all_inputs_ready']})",
        details={
            'digest': result['digest'],
            'faces_count': result['validation']['faces_detected'],
            'audio_valid': result['validation']['audio_valid'],
            'ready': result['validation']['all_inputs_ready']
        },
        client_ip=client_ip
    )

    return jsonify(result)

# --- Module C: Authentication Core Endpoints ---

@app.route('/api/auth/token', methods=['POST'])
def issue_token():
    client_ip = request.remote_addr or "127.0.0.1"
    ttl = 180
    if request.is_json:
        data = request.get_json() or {}
        ttl = int(data.get('ttl_seconds', 180))

    cube_digest_ref = session_state['last_digest']['digest'] if session_state['last_digest'] else "unverified_pipeline"
    token_data = generate_demo_token(cube_digest_ref=cube_digest_ref, ttl_seconds=ttl, client_ip=client_ip)
    session_state['active_token'] = token_data

    return jsonify(token_data)

@app.route('/api/auth/verify', methods=['POST'])
def verify_token():
    client_ip = request.remote_addr or "127.0.0.1"
    token_str = ""
    if request.is_json:
        data = request.get_json() or {}
        token_str = data.get('token', '')
    else:
        token_str = request.form.get('token', '')

    result = verify_demo_token(token_str, client_ip=client_ip)
    return jsonify(result), (200 if result.get('verified') else 401 if result.get('error_code') in ['TOKEN_EXPIRED', 'TOKEN_NOT_FOUND', 'TOKEN_INACTIVE'] else 400)

# --- Supporting Endpoints: Logs, Samples, Health ---

@app.route('/api/logs', methods=['GET'])
def fetch_logs():
    limit = int(request.args.get('limit', 50))
    event_type = request.args.get('event_type')
    status = request.args.get('status')
    logs = get_recent_logs(limit=limit, event_type=event_type, status=status)
    return jsonify({'logs': logs, 'count': len(logs)})

@app.route('/api/logs/clear', methods=['POST'])
def clear_all_logs():
    clear_logs()
    return jsonify({'success': True, 'message': 'Activity logs purged.'})

@app.route('/api/sample/cube/<face_id>', methods=['GET'])
def get_sample_cube_image(face_id):
    face_id = face_id.upper()
    filename = FACE_IMAGE_MAP.get(face_id)
    if not filename:
        return jsonify({'error': 'Unknown face'}), 404
    path = os.path.join(SAMPLE_DIR, filename)
    if os.path.exists(path):
        return send_file(path, mimetype='image/png')
    return jsonify({'error': 'Sample file missing'}), 404

@app.route('/api/sample/audio', methods=['GET'])
def get_sample_audio_file():
    path = os.path.join(SAMPLE_DIR, "sample_scramble.wav")
    if os.path.exists(path):
        return send_file(path, mimetype='audio/wav')
    return jsonify({'error': 'Sample audio missing'}), 404

@app.route('/api/download/report.pdf', methods=['GET'])
def download_pdf_report():
    pdf_path = os.path.join(os.path.dirname(__file__), "CubeSec_Technical_Report.pdf")
    if not os.path.exists(pdf_path):
        import generate_pdf_report
        generate_pdf_report.build_pdf()
    return send_file(pdf_path, as_attachment=True, download_name="CubeSec_Technical_Report.pdf", mimetype='application/pdf')

# Error handlers
@app.errorhandler(404)
def not_found(e):
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Resource not found', 'path': request.path}), 404
    return render_template('index.html')

@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error occurred.', 'code': 500}), 500

if __name__ == '__main__':
    print("CubeSec Server starting on http://127.0.0.1:5000 ...")
    app.run(host='127.0.0.1', port=5000, debug=True)
