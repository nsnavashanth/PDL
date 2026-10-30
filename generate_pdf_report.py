import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, Preformatted
)
from reportlab.pdfgen import canvas

PDF_PATH = os.path.join(os.path.dirname(__file__), "CubeSec_Technical_Report.pdf")

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_footer(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_header_footer(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#64748b"))

        # Header (Pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "CubeSec — Technical, Architectural & Functional Report")
            self.drawRightString(558, 750, "Prototype Specification")
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.5)
            self.line(54, 742, 558, 742)

        # Footer
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawString(54, 38, "CubeSec Prototype | Confidential Hackathon Evaluation Document")
        self.drawRightString(558, 38, page_str)
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.5)
        self.line(54, 48, 558, 48)
        self.restoreState()

def build_pdf():
    doc = SimpleDocTemplate(
        PDF_PATH,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom styles
    brand_dark = colors.HexColor("#18633e")
    slate_dark = colors.HexColor("#1e293b")
    slate_muted = colors.HexColor("#64748b")
    bg_subtle = colors.HexColor("#f8fafc")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=brand_dark,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=slate_muted,
        spaceAfter=14
    )

    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=brand_dark,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=slate_dark,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=slate_dark,
        spaceAfter=8
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#92400e")
    )

    code_style = ParagraphStyle(
        'CodeSnippet',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#0f172a")
    )

    story = []

    # Title & Metadata Cover Box
    story.append(Paragraph("CubeSec — System Architecture & Technical Report", title_style))
    story.append(Paragraph("Cube Entropy-Based Secure Authentication Prototype — Comprehensive Technical Analysis", subtitle_style))

    meta_data = [
        [
            Paragraph("<b>Project:</b> CubeSec Prototype v1.0", body_style),
            Paragraph("<b>Repository:</b> github.com/nsnavashanth/PDL", body_style)
        ],
        [
            Paragraph("<b>Runtime:</b> Python 3.13 / Flask / OpenCV 5.0 / NumPy", body_style),
            Paragraph("<b>Target Audience:</b> Hackathon Evaluators, Security Engineers", body_style)
        ]
    ]
    t_meta = Table(meta_data, colWidths=[250, 254])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f1f5f9")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 14))

    # Section 1: Executive Summary
    story.append(Paragraph("1. Executive Summary & Problem Formulation", h1_style))
    story.append(Paragraph(
        "Digital authentication systems typically rely on pre-shared static credentials, biometric templates, "
        "or software-generated pseudorandom tokens. <b>CubeSec</b> investigates a hybrid physical-digital security model: "
        "sampling physical chaotic permutations of a scrambled Rubik's Cube and the acoustic transients of its mechanical "
        "rotations to construct a reproducible physical context-binding and entropy-processing pipeline.",
        body_style
    ))

    # Disclaimer Callout Box
    disclaimer_data = [[
        Paragraph(
            "<b>Prototype Integrity Notice:</b> CubeSec is developed as an educational and proof-of-concept prototype. "
            "Physical cube permutations and acoustic turn signatures are demonstrative physical inputs, not NIST SP 800-90B "
            "vetted True Random Number Generators (TRNGs). SHA-256 produces a deterministic collision-resistant digest; it "
            "does not amplify entropy. Security-critical demo tokens are issued via OS CSPRNG (Python secrets).",
            callout_style
        )
    ]]
    t_disc = Table(disclaimer_data, colWidths=[504])
    t_disc.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#fffbeb")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#fde68a")),
        ('LINEBEFORE', (0,0), (0,-1), 3.5, colors.HexColor("#d97706")),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_disc)
    story.append(Spacer(1, 10))

    # Section 2: Architecture & Data Flow
    story.append(Paragraph("2. System Architecture & Processing Pipeline", h1_style))
    story.append(Paragraph(
        "The architecture is organized into three sequential core processing modules, supplemented by developer tools "
        "and audit logging:",
        body_style
    ))

    arch_text = """[Physical Scrambled Cube] ---> Module A: Cube Vision (OpenCV 5.0)
                              - Laplacian Sharpness Validation (Var >= 15.0)
                              - 3x3 Region of Interest (ROI) Sticker Grid
                              - HSV Color Space Classification (54 Stickers)
                                      |
[Scramble Audio Clicks]   ---> Module B: Entropy Engine (NumPy DSP)
                              - RMS Signal Energy & Peak Amplitude
                              - Zero-Crossing Rate (ZCR) & FFT Spectral Centroid
                              - Canonical Pre-image UTF-8 JSON Serialization
                              - Deterministic SHA-256 Digest (256-bit Hex)
                                      |
                                      v
                               Module C: Authentication Core
                              - 256-bit OS CSPRNG Demo Token (Python secrets)
                              - Active TTL Countdown (60s / 180s / 600s)
                              - Gateway Verification: Valid, Expired, Tampered
                                      |
                                      v
                        [Audit & Developer Infrastructure]
                         - API Playground (Interactive REST tester)
                         - Security Logs (Embedded SQLite Audit Trail)
                         - CubeSec Assistant (Client-Side Guidance Bot)"""
    story.append(Preformatted(arch_text, code_style))
    story.append(Spacer(1, 10))

    # Section 3: In-Depth Module Specifications
    story.append(Paragraph("3. Detailed Module Specifications", h1_style))
    
    story.append(Paragraph("3.1 Module A: Cube Vision Engine (cv_analyzer.py)", h2_style))
    story.append(Paragraph(
        "The visual acquisition engine analyzes photographs of all six cube faces (Up, Down, Front, Back, Left, Right). "
        "To satisfy the core requirement of honest detection, images first pass sharpness evaluation using the Laplacian variance "
        "metric: Var(Laplacian(I)). If the score is below 15.0, or average brightness is below 25.0 (underexposed) or above 245.0 "
        "(glare), processing fails with descriptive feedback rather than fabricating a false grid.",
        body_style
    ))
    story.append(Paragraph(
        "For valid images, 9 regional sticker patches are sampled across the central 68% bounding region. Pixel patches are "
        "converted to HSV color space, mapping Hue, Saturation, and Value to canonical Rubik's stickers: White (W), Yellow (Y), "
        "Green (G), Blue (B), Orange (O), and Red (R). An annotated OpenCV visual overlay is produced with bounding boxes and labels.",
        body_style
    ))

    story.append(Paragraph("3.2 Module B: Entropy Engine & Acoustic Telemetry (audio_analyzer.py)", h2_style))
    story.append(Paragraph(
        "The Entropy Engine processes mechanical click acoustics. Scrambling audio can be recorded live via the browser MediaRecorder "
        "(synthesized into standard 16-bit PCM WAV) or uploaded. Using NumPy, the engine extracts RMS signal energy, peak amplitude, "
        "Zero-Crossing Rate (ZCR), and spectral centroid (mean frequency in Hz via real-FFT).",
        body_style
    ))
    story.append(Paragraph(
        "The visual cube state (54 stickers) and acoustic telemetry are fused into a canonical UTF-8 JSON pre-image with strict "
        "sorted keys, which is hashed using standard SHA-256 (hashlib.sha256).",
        body_style
    ))

    story.append(Paragraph("3.3 Module C: Authentication Core (auth_core.py)", h2_style))
    story.append(Paragraph(
        "To maintain cryptographic soundness, the prototype does NOT use predictable physical sensor noise as raw key material. "
        "Instead, session tokens are generated via Python's secrets.token_urlsafe(32) (256-bit OS CSPRNG). Tokens are bound to the "
        "physical digest reference and stored in SQLite with an active TTL (Time-To-Live). The gateway validates submitted tokens "
        "and handles active, expired, tampered, and malformed submissions.",
        body_style
    ))

    story.append(PageBreak())

    # Section 4: Technology Stack
    story.append(Paragraph("4. Technology Stack Justification", h1_style))
    
    tech_table_data = [
        ["Layer", "Technology", "Architectural Role & Justification"],
        ["Frontend UI", "HTML5, Vanilla JS", "Zero build tooling overhead; executes instantly on any laptop browser."],
        ["Styling System", "Vanilla CSS Variables", "Product-focused Apple aesthetic, full light and charcoal dark themes."],
        ["Backend Server", "Python 3.13 + Flask", "Lightweight, clean REST microservice with synchronous execution."],
        ["Computer Vision", "OpenCV 5.0 (Headless)", "Laplacian variance blur check, HSV color extraction, visual overlays."],
        ["Acoustic DSP", "NumPy 2.5 + wave", "Real-FFT, RMS energy, and ZCR calculations without external FFmpeg."],
        ["Cryptographic Core", "hashlib & secrets", "SHA-256 canonical hashing and 256-bit OS CSPRNG token generation."],
        ["Audit Store", "SQLite 3 (cubesec.db)", "Zero-configuration ACID relational store for audit logs and token TTLs."],
        ["Privacy & Security", "100% Localhost (127.0.0.1)", "Zero cloud transmission; temporary in-memory data processing."]
    ]
    t_tech = Table(tech_table_data, colWidths=[90, 114, 300])
    t_tech.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#18633e")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_tech)
    story.append(Spacer(1, 14))

    # Section 5: Threat Model & Risk Analysis
    story.append(Paragraph("5. Threat Model & Security Mitigations", h1_style))
    
    threat_data = [
        ["Threat Vector", "Vulnerability Analysis", "CubeSec Prototype Mitigation"],
        ["Predictable Input", "Cube face colors can be photographed.", "Digest is physical context binding, NEVER a private key."],
        ["Acoustic Replay", "Replaying a recorded turn sound.", "Fused with optical cube vector and ephemeral session salt."],
        ["Image Fabrication", "Uploading blank/dark images.", "Laplacian sharpness (>=15) & brightness checks reject falsification."],
        ["Token Hijacking", "Valid demo token intercepted.", "Strict configurable TTL countdown automatically expires tokens."]
    ]
    t_threat = Table(threat_data, colWidths=[100, 174, 230])
    t_threat.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#334155")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_threat)
    story.append(Spacer(1, 14))

    # Section 6: Verification Results
    story.append(Paragraph("6. Verification & End-to-End Test Summary", h1_style))
    story.append(Paragraph(
        "• <b>Cube Vision:</b> Analyzed 6 reference faces with 94% average confidence, verified sticker grid reconstruction.<br/>"
        "• <b>Entropy Engine:</b> Analyzed mechanical scramble WAV, verified waveform rendering and spectral centroid.<br/>"
        "• <b>Digest Generation:</b> Produced deterministic SHA-256 digest 990ed93c5309d2d899e21613d59c7bc9fa2d1472b9373c3a3577e0f77587a7e5.<br/>"
        "• <b>Token Lifecycle:</b> Generated 256-bit csec_tok_... token, verified countdown, confirmed gateway rejection on tampered tokens.<br/>"
        "• <b>Audit Trail:</b> Verified persistent SQLite event logging across all operational stages.<br/>"
        "• <b>Repository Status:</b> Source code and technical documentation committed to git on branch main.",
        body_style
    ))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully built at: {PDF_PATH}")

if __name__ == "__main__":
    build_pdf()
