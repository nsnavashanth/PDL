import secrets
import hashlib
import json
from datetime import datetime, timezone, timedelta
from database import get_db, log_event

TOKEN_PREFIX = "csec_tok_"

def build_canonical_preimage(cube_faces, audio_features, salt=None):
    """
    Builds a defined, canonical, reproducible representation of the cube state
    and audio features.
    
    Structure:
    Domain: CubeSec-Protocol-v1.0
    Cube Faces (sorted U, D, F, B, L, R): 54 sticker sequence
    Audio Telemetry: deterministic descriptor
    Salt: optional 16-byte nonce
    """
    canonical_faces = {}
    ordered_keys = ['U', 'D', 'F', 'B', 'L', 'R']

    for k in ordered_keys:
        face_data = cube_faces.get(k)
        if face_data and 'grid' in face_data:
            # Flatten 3x3 grid into 9-character color code string
            stickers = []
            for row in face_data['grid']:
                for cell in row:
                    stickers.append(cell.get('code', '?'))
            canonical_faces[k] = "".join(stickers)
        else:
            canonical_faces[k] = "?????????"

    audio_desc = audio_features.get('feature_descriptor', 'AUDIO:NONE') if audio_features else 'AUDIO:NONE'

    payload = {
        "protocol": "CubeSec-Physical-Bridge/v1.0",
        "domain_separator": "CubeSec-PhysicalEntropy-Context",
        "faces": canonical_faces,
        "audio_descriptor": audio_desc,
        "salt": salt or "static-demo-context-salt-0x42"
    }

    # Strict JSON serialization with sorted keys
    canonical_str = json.dumps(payload, sort_keys=True, separators=(',', ':'))
    return canonical_str, payload

def compute_entropy_digest(cube_faces, audio_features, salt=None):
    """
    Combines the cube face state with scrambling audio features,
    checks validation criteria, and produces a SHA-256 digest.
    """
    # Validation check: All 6 faces must be present and valid
    ordered_keys = ['U', 'D', 'F', 'B', 'L', 'R']
    faces_detected = 0
    for k in ordered_keys:
        if k in cube_faces and cube_faces[k].get('success'):
            faces_detected += 1

    has_audio = bool(audio_features and audio_features.get('success'))

    is_valid = (faces_detected == 6) and has_audio

    canonical_str, payload = build_canonical_preimage(cube_faces, audio_features, salt)
    digest_hex = hashlib.sha256(canonical_str.encode('utf-8')).hexdigest()

    validation_report = {
        "faces_detected": faces_detected,
        "faces_required": 6,
        "audio_valid": has_audio,
        "all_inputs_ready": is_valid,
        "missing_components": []
    }

    if faces_detected < 6:
        missing_faces = [k for k in ordered_keys if k not in cube_faces or not cube_faces[k].get('success')]
        validation_report["missing_components"].append(f"Missing {6 - faces_detected} cube faces: {', '.join(missing_faces)}")
    if not has_audio:
        validation_report["missing_components"].append("Scrambling audio not yet analyzed or invalid")

    return {
        "digest": digest_hex,
        "canonical_preimage": canonical_str,
        "preimage_structure": payload,
        "validation": validation_report,
        "security_notice": {
            "digest_type": "SHA-256 (256-bit Cryptographic Hash)",
            "entropy_disclaimer": "SHA-256 produces a fixed-size digest; it does not generate or amplify entropy. The digest represents a deterministic fingerprint of physical inputs.",
            "cryptographic_scope": "Basic audio characteristics and cube permutations are demonstrative physical inputs, not cryptographically vetted random number generators (TRNGs). This digest must not be used as a raw secret key."
        }
    }

def generate_demo_token(cube_digest_ref=None, ttl_seconds=180, client_ip="127.0.0.1"):
    """
    Generates a cryptographically random demo token using Python's secrets module.
    Never relies on predictable physical inputs as the sole source of randomness.
    """
    # 256 bits of CSPRNG entropy from OS via secrets
    raw_random = secrets.token_urlsafe(32)
    token = f"{TOKEN_PREFIX}{raw_random}"

    now = datetime.now(timezone.utc)
    expires = now + timedelta(seconds=ttl_seconds)

    issued_at_iso = now.isoformat()
    expires_at_iso = expires.isoformat()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO auth_tokens (token, issued_at, expires_at, ttl_seconds, cube_digest_ref, status)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (token, issued_at_iso, expires_at_iso, ttl_seconds, cube_digest_ref or "none", "ACTIVE"))
        conn.commit()

    log_event(
        event_type="TOKEN_ISSUED",
        module="Authentication Core",
        status="SUCCESS",
        summary=f"Issued demo token {token[:16]}... (TTL: {ttl_seconds}s)",
        details={
            "token_masked": f"{token[:14]}...{token[-6:]}",
            "ttl_seconds": ttl_seconds,
            "expires_at": expires_at_iso,
            "cube_digest_ref": cube_digest_ref
        },
        client_ip=client_ip
    )

    return {
        "token": token,
        "issued_at": issued_at_iso,
        "expires_at": expires_at_iso,
        "ttl_seconds": ttl_seconds,
        "status": "ACTIVE",
        "cube_digest_ref": cube_digest_ref,
        "entropy_source": "Python secrets (OS CSPRNG / Cryptographically Secure Randomness)"
    }

def verify_demo_token(token_string, client_ip="127.0.0.1"):
    """
    Verifies a submitted demo token against the active store.
    Handles missing, malformed, expired, revoked, and valid tokens.
    """
    if not token_string or not isinstance(token_string, str) or not token_string.strip():
        log_event(
            event_type="AUTH_VERIFY_FAILURE",
            module="Authentication Core",
            status="FAILED",
            summary="Verification rejected: Token is missing or empty",
            details={"error": "MISSING_TOKEN"},
            client_ip=client_ip
        )
        return {
            "verified": False,
            "error_code": "MISSING_TOKEN",
            "message": "Token is required. Please provide a demo token string."
        }

    token_string = token_string.strip()

    if not token_string.startswith(TOKEN_PREFIX):
        log_event(
            event_type="AUTH_VERIFY_FAILURE",
            module="Authentication Core",
            status="FAILED",
            summary="Verification rejected: Malformed token prefix",
            details={"token_sample": token_string[:10]},
            client_ip=client_ip
        )
        return {
            "verified": False,
            "error_code": "MALFORMED_TOKEN",
            "message": f"Malformed token format. Valid tokens must start with '{TOKEN_PREFIX}'."
        }

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT token, issued_at, expires_at, ttl_seconds, cube_digest_ref, status FROM auth_tokens WHERE token = ?", (token_string,))
        row = cursor.fetchone()

        if not row:
            log_event(
                event_type="AUTH_VERIFY_FAILURE",
                module="Authentication Core",
                status="FAILED",
                summary="Verification rejected: Unknown or revoked token",
                details={"token_masked": f"{token_string[:12]}..."},
                client_ip=client_ip
            )
            return {
                "verified": False,
                "error_code": "TOKEN_NOT_FOUND",
                "message": "Token was not recognized or has been purged from active session store."
            }

        # Check expiration
        expires_at = datetime.fromisoformat(row["expires_at"])
        now = datetime.now(timezone.utc)

        if now > expires_at:
            cursor.execute("UPDATE auth_tokens SET status = 'EXPIRED' WHERE token = ?", (token_string,))
            conn.commit()

            time_diff = (now - expires_at).total_seconds()
            log_event(
                event_type="AUTH_VERIFY_FAILURE",
                module="Authentication Core",
                status="WARNING",
                summary=f"Verification rejected: Token expired {int(time_diff)}s ago",
                details={"token_masked": f"{token_string[:12]}...", "expired_ago_sec": round(time_diff, 1)},
                client_ip=client_ip
            )
            return {
                "verified": False,
                "error_code": "TOKEN_EXPIRED",
                "message": f"Token has expired ({int(time_diff)} seconds ago). Please generate a fresh token.",
                "issued_at": row["issued_at"],
                "expired_at": row["expires_at"]
            }

        if row["status"] != "ACTIVE":
            log_event(
                event_type="AUTH_VERIFY_FAILURE",
                module="Authentication Core",
                status="FAILED",
                summary=f"Verification rejected: Token status is '{row['status']}'",
                details={"status": row["status"]},
                client_ip=client_ip
            )
            return {
                "verified": False,
                "error_code": "TOKEN_INACTIVE",
                "message": f"Token is no longer active (Status: {row['status']})."
            }

        # Verification successful
        remaining_seconds = max(0, int((expires_at - now).total_seconds()))

        log_event(
            event_type="AUTH_VERIFY_SUCCESS",
            module="Authentication Core",
            status="SUCCESS",
            summary=f"Token verified successfully. Session valid for {remaining_seconds}s",
            details={
                "token_masked": f"{token_string[:12]}...{token_string[-6:]}",
                "remaining_seconds": remaining_seconds,
                "cube_digest_ref": row["cube_digest_ref"]
            },
            client_ip=client_ip
        )

        return {
            "verified": True,
            "status": "AUTHENTICATED",
            "message": "Demo token verified successfully. Demonstration session authenticated.",
            "remaining_ttl_seconds": remaining_seconds,
            "issued_at": row["issued_at"],
            "expires_at": row["expires_at"],
            "cube_digest_ref": row["cube_digest_ref"]
        }
