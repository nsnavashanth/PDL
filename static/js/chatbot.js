/**
 * CubeSec Assistant - Floating Rule-Based Client-Side Chatbot
 * Self-contained assistant providing project context, module explanations,
 * demonstration guidance, and keyword-based troubleshooting.
 */

const Chatbot = {
  isOpen: false,
  messages: [],

  // Predefined knowledge base and keyword matcher
  knowledgeBase: [
    {
      keywords: ['what is cubesec', 'about', 'concept', 'what is this'],
      title: "What is CubeSec?",
      response: "CubeSec is a prototype authentication system exploring physical-world entropy acquisition. It combines computer vision analysis of a scrambled Rubik's Cube with acoustic feature extraction of mechanical scrambling clicks to bind physical state to cryptographic token issuance."
    },
    {
      keywords: ['how does it work', 'flow', 'pipeline', 'how to use', 'demo flow', 'steps'],
      title: "How does the demonstration work?",
      response: "The demo follows a 4-step journey:\n1. Cube Vision: Upload 6 cube face photos or load sample images to extract the 3x3 sticker grid.\n2. Entropy Engine: Record or upload scrambling audio to extract acoustic telemetry.\n3. Pre-image & Digest: Fuse visual and acoustic vectors into a canonical pre-image and compute a SHA-256 digest.\n4. Authentication Core: Issue a cryptographically random session token (via Python secrets) and test verification against active TTL."
    },
    {
      keywords: ['modules', 'explain the modules', 'module a', 'module b', 'module c'],
      title: "CubeSec System Modules",
      response: "CubeSec consists of three core modules:\n• Module A (Cube Vision): OpenCV image processing assessing sharpness and identifying 54 colored stickers.\n• Module B (Entropy Engine): NumPy acoustic analysis extracting RMS signal energy, Zero-Crossing Rate, and spectral centroid, generating a SHA-256 digest.\n• Module C (Authentication Core): Issues CSPRNG demo tokens bound to the session context and performs gateway validation."
    },
    {
      keywords: ['cube vision', 'opencv', 'vision', 'stickers', 'colors', 'face'],
      title: "Cube Vision Details",
      response: "Cube Vision utilizes OpenCV to sample 9 regions of interest across the cube face. Colors are classified in HSV space (Hue, Saturation, Value) for White, Yellow, Green, Blue, Orange, and Red. If an image is too blurry (Laplacian variance < 15.0) or underexposed, honest error feedback is returned without fabricating results."
    },
    {
      keywords: ['entropy engine', 'audio', 'waveform', 'scramble sound', 'sound', 'clicks', 'acoustic'],
      title: "Entropy Engine & Acoustic Telemetry",
      response: "The Entropy Engine analyzes mechanical turn clicks from Rubik's Cube scrambling. It extracts RMS signal energy, peak amplitude, Zero-Crossing Rate (ZCR), and spectral centroid (mean frequency in Hz). These physical features are combined with the cube state into a canonical UTF-8 JSON pre-image."
    },
    {
      keywords: ['digest', 'sha-256', 'sha256', 'hash', 'cryptographic'],
      title: "Understanding the SHA-256 Digest",
      response: "Important qualification: SHA-256 is a deterministic collision-resistant hash function; it does not amplify or create entropy. The 64-character hex digest represents a reproducible fingerprint of the physical cube configuration and acoustic features, not a raw secret encryption key."
    },
    {
      keywords: ['auth', 'test auth', 'how do i test authentication', 'token', 'verify'],
      title: "Testing Authentication",
      response: "To test authentication:\n1. Ensure Cube Vision and Entropy Engine have completed their inputs.\n2. In Authentication Core, click 'Generate Cryptographically Random Demo Token'.\n3. Notice the live TTL countdown.\n4. Click 'Verify Token Authenticity' to see successful verification.\n5. You can also click 'Tamper Token' or 'Invalid Prefix' to verify that the security gateway correctly rejects invalid tokens."
    },
    {
      keywords: ['production', 'production ready', 'real security', 'hackathon'],
      title: "Is CubeSec Production Ready?",
      response: "No. CubeSec is explicitly an exploratory prototype for hackathons and security research. While session tokens use secure randomness (Python secrets), the physical cube inputs have not been validated under NIST SP 800-90B entropy standards. It demonstrates physical-digital binding rather than a certified production authentication service."
    },
    {
      keywords: ['playground', 'api', 'curl'],
      title: "API Playground",
      response: "The API Playground allows you to test all backend endpoints interactively. You can select endpoints like /api/cube/analyze or /api/auth/verify, edit JSON request payloads, inspect live round-trip latency, and copy cURL commands for terminal execution."
    },
    {
      keywords: ['logs', 'audit', 'sqlite'],
      title: "Security Logs",
      response: "Every detection, acoustic extraction, pre-image hashing, and token verification event is recorded in a local SQLite database (cubesec.db). You can filter logs by event type or status, and click any row to inspect the full structured payload."
    }
  ],

  init() {
    this.bindEvents();
    this.sendWelcomeMessage();
  },

  bindEvents() {
    const launcher = document.getElementById('chatbotLauncher');
    const drawer = document.getElementById('chatbotDrawer');
    const closeBtn = document.getElementById('btnCloseChat');
    const resetBtn = document.getElementById('btnResetChat');
    const form = document.getElementById('chatInputForm');
    const quickChips = document.getElementById('chatQuickReplies');

    if (launcher) {
      launcher.addEventListener('click', () => this.toggleDrawer());
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.toggleDrawer(false));
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetChat());
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('chatInputField');
        if (input && input.value.trim()) {
          this.handleUserMessage(input.value.trim());
          input.value = '';
        }
      });
    }

    if (quickChips) {
      quickChips.addEventListener('click', (e) => {
        const btn = e.target.closest('.chip-btn');
        if (btn && btn.getAttribute('data-reply')) {
          this.handleUserMessage(btn.getAttribute('data-reply'));
        }
      });
    }

    // Keyboard support: Escape closes chatbot
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.toggleDrawer(false);
      }
    });
  },

  toggleDrawer(forceState) {
    this.isOpen = forceState !== undefined ? forceState : !this.isOpen;
    const drawer = document.getElementById('chatbotDrawer');
    if (drawer) {
      if (this.isOpen) {
        drawer.classList.add('open');
        const input = document.getElementById('chatInputField');
        if (input) setTimeout(() => input.focus(), 100);
      } else {
        drawer.classList.remove('open');
      }
    }
  },

  sendWelcomeMessage() {
    const welcome = "Hello! I'm the **CubeSec Assistant**. I can answer questions about the physical entropy pipeline, explain OpenCV cube detection and acoustic telemetry, or guide you through the authentication demonstration. Pick a quick topic below or type a question!";
    this.addMessage('bot', welcome);
  },

  resetChat() {
    const container = document.getElementById('chatMessages');
    if (container) container.innerHTML = '';
    this.messages = [];
    this.sendWelcomeMessage();
  },

  handleUserMessage(text) {
    this.addMessage('user', text);

    // Rule-based keyword matching
    const query = text.toLowerCase().trim();
    let matchedItem = null;

    // Check exact or keyword match
    for (const item of this.knowledgeBase) {
      if (item.keywords.some(kw => query.includes(kw))) {
        matchedItem = item;
        break;
      }
    }

    setTimeout(() => {
      if (matchedItem) {
        this.addMessage('bot', `**${matchedItem.title}**\n\n${matchedItem.response}`);
      } else {
        // Fallback response with helpful hints
        this.addMessage('bot', `I didn't find a direct match for *"${text}"*. \n\nI am a rule-based assistant. You can ask about:\n• **Cube Vision & OpenCV**\n• **Entropy Engine & Audio analysis**\n• **SHA-256 Digest meaning**\n• **How to test Authentication**\n• **Is CubeSec production ready?**`);
      }
    }, 200);
  },

  addMessage(sender, text) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble-${sender}`;

    // Simple markdown-style bold and newline formatting
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.06); padding:1px 4px; border-radius:3px;">$1</code>')
      .replace(/\n/g, '<br>');

    bubble.innerHTML = formatted;
    container.appendChild(bubble);

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Chatbot.init();
});

window.Chatbot = Chatbot;
