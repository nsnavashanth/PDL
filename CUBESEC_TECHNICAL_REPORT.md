# CubeSec: Cube Entropy-Based Secure Authentication System
## Comprehensive Technical, Architectural & Functional Report

**Project Name:** CubeSec  
**Document Version:** 1.0.0 (Prototype Specification & Technical Report)  
**Author:** Senior Frontend & Security Engineering Team  
**Repository:** [https://github.com/nsnavashanth/PDL](https://github.com/nsnavashanth/PDL)  
**Runtime Environment:** Python 3.13 / Flask / OpenCV 5.0 / NumPy / SQLite / Vanilla Web Technologies  
**Target Audience:** Hackathon Judges, Project Evaluators, Cybersecurity Researchers, Security API Developers  

---

## 1. Executive Summary & Product Positioning

### 1.1 Concept Overview
CubeSec investigates the utilization of physical-world chaotic inputs—specifically the physical permutations of a scrambled Rubik's Cube and the acoustic transients of its mechanical turns—to construct a physical context-binding and entropy-processing pipeline for cryptographic authentication demonstrations.

In traditional digital authentication, credentials rely exclusively on pre-shared secrets (passwords), biometric templates, or software-generated pseudo-random tokens. CubeSec explores a hybrid paradigm: physically sampling an analog, mechanical artifact in the real world through multi-modal sensors (optical computer vision and acoustic sensing), binding the digitized physical state into a canonical pre-image, and linking this physical context to a cryptographically secure token service.

### 1.2 Target Audience & Evaluation Criteria
1. **Hackathon Judges & Technical Evaluators:** Require a working, verifiable prototype running smoothly on a standard laptop without complex cloud configuration or external dependencies.
2. **Cybersecurity Enthusiasts & Students:** Seeking an educational look at how computer vision, digital signal processing (DSP), canonical hashing, and token issuance intersect.
3. **API & Cloud Security Engineers:** Interested in how physical context binding can be packaged as a clean, RESTful microservice with comprehensive audit logging.

### 1.3 Prototype Scope & Cryptographic Integrity Statement
> [!IMPORTANT]
> **Integrity Notice:** CubeSec is strictly an exploratory demonstration prototype. 
> - Physical cube permutations and acoustic turn transients serve as **demonstrative physical seeds**, not certified True Random Number Generators (TRNGs). They have not undergone NIST SP 800-90B or FIPS 140-3 statistical randomness testing.
> - **SHA-256 produces a deterministic collision-resistant digest; it does NOT create or amplify entropy.** The resulting digest is a fingerprint of physical inputs, not a raw private encryption key.
> - Demo session tokens are generated using Python’s standard operating system CSPRNG (`secrets.token_urlsafe`), completely segregating security-critical token generation from unconditioned physical sensor noise.

---

## 2. High-Level System Architecture

CubeSec is structured into a modular pipeline with three sequential processing modules, an interactive API testing laboratory, a persistent SQLite audit engine, and a conversational guidance assistant.

```
+---------------------------------------------------------------------------------------------------+
|                                  PHYSICAL WORLD ACQUISITION                                       |
|  +----------------------------------------------+  +-------------------------------------------+  |
|  | Scrambled Rubik's Cube (6 Optical Faces)     |  | Mechanical Scramble Audio (Turn Clicks)   |  |
|  +----------------------------------------------+  +-------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
                                         |                                     |
                                         v                                     v
+-------------------------------------------------+  +----------------------------------------------+
| MODULE A: CUBE VISION (OpenCV 5.0)             |  | MODULE B: ENTROPY ENGINE (NumPy DSP)         |
| - Laplacian Variance Sharpness Check (>= 15.0) |  | - HTML5 Waveform & Signal Energy Canvas      |
| - 3x3 Region of Interest (ROI) Sticker Grid     |  | - RMS Energy, Peak Amplitude, Zero-Crossing  |
| - HSV Color Space Boundary Classification       |  | - Real-FFT: Spectral Centroid & Roll-off     |
| - Annotated Visual Overlay (54 Color Stickers) |  | - Acoustic Feature Vector Descriptor         |
+-------------------------------------------------+  +----------------------------------------------+
                                         \                                     /
                                          \                                   /
                                           v                                 v
+---------------------------------------------------------------------------------------------------+
| FEATURE FUSION & CANONICAL PRE-IMAGE PIPELINE                                                     |
| - Domain Separator: CubeSec-PhysicalEntropy-Context                                               |
| - Strict Sorted UTF-8 JSON Serialization (Ordered U, D, F, B, L, R Faces + Audio Descriptor)      |
| - Deterministic SHA-256 Digest (hashlib.sha256) -> 64-char Hexadecimal Fingerprint                |
+---------------------------------------------------------------------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------------------------+
| MODULE C: AUTHENTICATION CORE                                                                     |
| - Token Issuance: Python secrets.token_urlsafe(32) [256-bit OS CSPRNG Entropy]                    |
| - Context Binding: Session bound to SHA-256 Physical Digest & Active TTL (60s / 180s / 600s)       |
| - Security Gateway Verification: Active TTL Validation, Tamper Detection, Malformed Prefix Check  |
+---------------------------------------------------------------------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------------------------+
| DEVELOPER & AUDIT INFRASTRUCTURE                                                                  |
| - API Playground: Interactive Endpoint Tester, ms Latency Measurement, cURL / Fetch Generator     |
| - Security Logs: Persistent SQLite Audit Store (cubesec.db), Event Filtering, JSON Modal Viewer   |
| - CubeSec Assistant: Floating Client-Side Rule-Based Chatbot with Predefined Security Guidance    |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. In-Depth Module Specifications & Algorithms

### 3.1 Module A: Cube Vision Engine (`cv_analyzer.py`)

#### Purpose
Acquires, validates, and decodes the physical configuration of the Rubik's Cube across all six faces: Up (`U`), Down (`D`), Front (`F`), Back (`B`), Left (`L`), and Right (`R`).

#### Key Algorithms & Workflow
1. **Image Quality & Sharpness Assessment:**
   To adhere to the core requirement of honest detection, the system evaluates incoming images before attempting sticker classification:
   $$\text{Sharpness Score} = \text{Var}(\nabla^2 I_{\text{gray}})$$
   If the Laplacian variance is below $15.0$, the image is classified as too blurry. The system also calculates average pixel brightness ($\mu$). If $\mu < 25.0$ (underexposed) or $\mu > 245.0$ (glare/overexposed), processing is aborted with an explanatory error message, preventing fabricated detections.

2. **3x3 Grid Sampling:**
   The image is resized to a standardized coordinate box while preserving aspect ratio. A central bounding area is calculated across the central 68% of the frame. The algorithm iterates through $3 \times 3 = 9$ spatial coordinates:
   $$c_x = \text{margin}_x + (col + 0.5) \times \text{step}_x, \quad c_y = \text{margin}_y + (row + 0.5) \times \text{step}_y$$
   A circular kernel of radius $r = 0.20 \times \min(\text{step}_x, \text{step}_y)$ extracts the median pixel values, filtering out black plastic borders and specular reflections.

3. **HSV Color Space Classification:**
   RGB colors fluctuate heavily under different lighting. Converting to HSV (Hue: 0–179, Saturation: 0–255, Value: 0–255) isolates chromaticity:
   - **White (`W`):** $S < 55$ and $V > 90$
   - **Red (`R`):** $H \in [0, 10] \cup [165, 179]$
   - **Orange (`O`):** $H \in [11, 25]$
   - **Yellow (`Y`):** $H \in [26, 42]$
   - **Green (`G`):** $H \in [43, 85]$
   - **Blue (`B`):** $H \in [86, 135]$

4. **Visual Feedback Generation:**
   OpenCV draws rectangular sticker bounding boxes, centroid coordinates, and alphanumeric labels directly onto the frame, returning a Base64-encoded JPEG preview alongside an interactive DOM grid.

---

### 3.2 Module B: Entropy Engine & Acoustic Telemetry (`audio_analyzer.py`)

#### Purpose
Digitizes mechanical scrambling audio (clicks, snaps, friction swishes) to extract reproducible acoustic characteristics and fuse them with the visual cube representation.

#### Acoustic Telemetry Algorithms
1. **Signal Energy (RMS) & Peak Amplitude:**
   Measures the acoustic power of physical rotational clicks:
   $$\text{RMS Energy} = \sqrt{\frac{1}{N} \sum_{i=1}^{N} x[i]^2}, \quad \text{Peak Amplitude} = \max_{1 \le i \le N} |x[i]|$$
2. **Zero-Crossing Rate (ZCR):**
   Measures the frequency of signal sign changes, capturing mechanical impact sharpness:
   $$\text{ZCR} = \frac{1}{N-1} \sum_{i=2}^{N} \mathbb{I}(\text{sgn}(x[i]) \ne \text{sgn}(x[i-1]))$$
3. **Spectral Centroid (Frequency Center of Mass):**
   Computed via Real Fast Fourier Transform ($r\text{FFT}$):
   $$\text{Centroid (Hz)} = \frac{\sum_{k} f_k \cdot |X[k]|}{\sum_{k} |X[k]|}$$
   Reflects the brightness and acoustic hardness of the plastic turn mechanism.
4. **Spectral Roll-off:**
   The frequency below which 85% of total spectral power resides, isolating friction bursts from ambient noise.
5. **Waveform Summary Array:**
   The audio signal is downsampled into 100 normalized bins for instant rendering on the HTML5 canvas.

#### Feature Fusion & Canonical Pre-image Generation (`auth_core.py`)
To prevent serialization malleability, the system establishes a deterministic JSON representation with sorted keys:
```json
{
  "protocol": "CubeSec-Physical-Bridge/v1.0",
  "domain_separator": "CubeSec-PhysicalEntropy-Context",
  "faces": {
    "U": "WGRBWYOYR",
    "D": "YPBGYRWOY",
    "F": "GWBOGYRGW",
    "B": "BRYWBGOBR",
    "L": "OYGROBWY",
    "R": "RWOYRBGRG"
  },
  "audio_descriptor": "SR:44100|DUR:2.800|RMS:0.05622|PEAK:0.8500|ZCR:0.04312|CENTROID:6228.3|ROLLOFF:11400.0",
  "salt": "demo-context-salt-0x42"
}
```
This payload is hashed with standard SHA-256:
$$\text{Digest} = \text{SHA-256}(\text{Canonical UTF-8 Payload}) \in \{0, 1\}^{256}$$

---

### 3.3 Module C: Authentication Core (`auth_core.py`)

#### Purpose
Demonstrates how physical context verification integrates with an authentication server and security gateway.

#### Architecture & Security Separation
- **Token Generation:** The prototype utilizes Python’s `secrets.token_urlsafe(32)`, accessing OS-level CSPRNG (`CryptGenRandom` / `getrandom`) to produce 256 bits of true cryptographic entropy.
- **Context Binding:** The token is prefixed (`csec_tok_...`) and stored in the SQLite database linked to:
  - `cube_digest_ref`: The SHA-256 digest reference from Module B.
  - `issued_at` & `expires_at`: UTC timestamps.
  - `ttl_seconds`: Configurable session lifetime (60s, 180s, 600s).
  - `status`: `ACTIVE`, `EXPIRED`, or `REVOKED`.
- **Gateway Verification Flow:**
  - `MISSING_TOKEN` (HTTP 400): If submission is blank.
  - `MALFORMED_TOKEN` (HTTP 400): If prefix does not start with `csec_tok_`.
  - `TOKEN_NOT_FOUND` (HTTP 401): If token is unrecognized or revoked.
  - `TOKEN_EXPIRED` (HTTP 401): If current time $> \text{expires\_at}$, status updates to `EXPIRED`.
  - `AUTHENTICATED` (HTTP 200): If active and within TTL, returns remaining lifetime in seconds.

---

### 3.4 API Playground & Security Logs

1. **API Playground (`static/js/api_playground.js`):**
   - Direct interactive testbench for all backend routes.
   - Pre-populated editable JSON payloads.
   - Live measurement of HTTP round-trip latency in milliseconds.
   - One-click copy buttons for terminal `cURL` commands and modern JavaScript `fetch()` scripts.

2. **Security & Audit Logs (`database.py`, `static/js/security_logs.js`):**
   - Backed by an embedded SQLite table (`security_logs`).
   - Records every event: `CV_ANALYSIS`, `AUDIO_EXTRACTION`, `ENTROPY_PIPELINE`, `TOKEN_ISSUED`, `AUTH_VERIFY_SUCCESS`, `AUTH_VERIFY_FAILURE`, `SESSION_RESET`.
   - Stores client IP, status, summary, and full structured JSON payload.
   - Offers real-time filtering and modal payload inspection.

3. **CubeSec Assistant Chatbot (`static/js/chatbot.js`):**
   - Floating circular widget at bottom-right.
   - 100% client-side, rule-based execution (zero external API keys or recurring network calls).
   - Knowledge base mapping keywords and providing quick-reply chips for concepts, modules, demo steps, and security disclaimers.

---

## 4. Technology Stack Justification

| Layer | Technology | Rationale & Selection Criteria |
| :--- | :--- | :--- |
| **Frontend Core** | HTML5, Vanilla JavaScript (ES6+) | Maximum speed, zero build-step overhead, runs natively in any standard browser. |
| **Styling & Theme** | Modern CSS Custom Properties | Restrained Apple-inspired product aesthetic; full light and charcoal dark themes with `localStorage` persistence. No heavy third-party CSS frameworks. |
| **Backend Server** | Python 3.13 + Flask 3.1 | Clean, lightweight microframework providing REST API endpoints and static asset serving. |
| **Computer Vision** | OpenCV 5.0.0 (`opencv-python-headless`) | Industry-standard computer vision library providing Laplacian sharpness variance, HSV color space conversion, and bounding box annotations. |
| **Acoustic Analysis** | NumPy 2.5 + Python `wave` | Fast numerical matrix operations for Real-FFT, RMS energy, and Zero-Crossing Rate without needing heavy audio toolchains or FFmpeg binaries. |
| **Cryptographic Engine** | Python `hashlib` & `secrets` | Standardized SHA-256 cryptographic hashing and operating-system-level CSPRNG entropy. |
| **Audit Storage** | SQLite 3 (Embedded `cubesec.db`) | Zero-configuration, ACID-compliant local database for audit logs and active session token tracking. |

---

## 5. Potential Use Cases & Future Roadmaps

### 5.1 Hackathon & Research Demonstration (Current Prototype)
Showcases multi-modal physical sensing feeding into a cryptographic application. Evaluators can experience the end-to-end journey in under two minutes using either bundled sample data or live microphone recording.

### 5.2 Physical Multi-Factor Authentication (MFA)
In high-security facilities, users could scramble a physical object before entering a secure terminal. The physical scramble and turn sound form an out-of-band physical authentication factor that cannot be phished through standard network credential harvesting.

### 5.3 Air-Gapped Key Seed Initialization
For hardware security modules (HSMs) operating in air-gapped environments, mechanical noise and physical visual permutations can serve as supplementary entropy seeds to mitigate firmware PRNG predictability.

---

## 6. Security Analysis & Threat Model

| Potential Threat | Analysis | Prototype Mitigation Strategy |
| :--- | :--- | :--- |
| **Predictable Physical Input** | Rubik's cube states, while vast ($4.33 \times 10^{19}$ combinations), can be photographed or observed. | Physical digests are explicitly **never used as private encryption keys**. Tokens are generated via OS CSPRNG (`secrets`). |
| **Acoustic Replay Attack** | An adversary records the audio and attempts replaying it. | The pipeline binds the optical cube vector, acoustic vector, and an ephemeral salt simultaneously. |
| **Fabricated Detections** | Blurry or completely black images could cause erroneous sticker classification. | Laplacian sharpness ($\ge 15.0$) and brightness validation prevent false positives and provide honest errors. |
| **Token Hijacking & Replay** | Intercepting a valid token string in transit. | Tokens have strict configurable Time-To-Live (TTL) countdowns, after which they are irrevocably expired in SQLite. |
| **External Data Leakage** | Transmitting physical photographs or audio files to third-party cloud servers. | 100% local execution on `127.0.0.1`. Ephemeral in-memory processing with zero external API calls. |

---

## 7. Verification & Test Report

The prototype was thoroughly tested and verified:
1. **End-to-End Walkthrough:** Executed full workflow from overview, cube sample acquisition (6 faces), scramble audio analysis, canonical SHA-256 computation, demo token issuance, and gateway verification.
2. **Error Handling & Presets:** Verified gateway rejection on expired tokens, tampered tokens, and invalid prefix formats.
3. **Responsive UI & Themes:** Verified light and dark mode toggles, sidebar responsive drawers, and mobile screen layouts.
4. **Chatbot Operations:** Verified quick-reply chips, custom keyword questions, chat reset, and modal disclosures.
5. **Version Control:** All source code and documentation committed and pushed to GitHub at [https://github.com/nsnavashanth/PDL](https://github.com/nsnavashanth/PDL).
