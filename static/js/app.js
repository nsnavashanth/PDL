/**
 * CubeSec Prototype - Main Application Controller
 * Handles navigation, theme toggling, shared session state, and UI orchestration.
 */

const App = {
  currentView: 'overview',
  sessionState: {
    faces_detected_count: 0,
    faces_total: 6,
    faces_status: {},
    audio_processed: false,
    audio_summary: null,
    pipeline_ready: false,
    last_digest: null,
    active_token: null
  },

  init() {
    this.initTheme();
    this.initNavigation();
    this.initModals();
    this.initGlobalEvents();
    this.fetchSessionStatus();
    this.fetchOverviewLogs();

    // Periodic sync
    setInterval(() => {
      this.fetchSessionStatus();
    }, 6000);
  },

  /* --- Theme System --- */
  initTheme() {
    const savedTheme = localStorage.getItem('cubesec_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    this.setTheme(initialTheme);

    const toggleBtn = document.getElementById('themeToggleBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
      });
    }
  },

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cubesec_theme', theme);
    
    const iconSun = document.getElementById('themeIconSun');
    const iconMoon = document.getElementById('themeIconMoon');
    const label = document.getElementById('themeToggleLabel');

    if (theme === 'dark') {
      if (iconSun) iconSun.style.display = 'inline-block';
      if (iconMoon) iconMoon.style.display = 'none';
      if (label) label.textContent = 'Light';
    } else {
      if (iconSun) iconSun.style.display = 'none';
      if (iconMoon) iconMoon.style.display = 'inline-block';
      if (label) label.textContent = 'Dark';
    }
  },

  /* --- Navigation & Views --- */
  initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const viewId = item.getAttribute('data-view');
        if (viewId) {
          this.navigateTo(viewId);
        }
      });
    });

    const mobileToggle = document.getElementById('mobileNavToggle');
    const sidebar = document.getElementById('appSidebar');
    if (mobileToggle && sidebar) {
      mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
    }

    // Direct links inside buttons
    const btnStart = document.getElementById('btnStartGuidedDemo');
    if (btnStart) {
      btnStart.addEventListener('click', () => this.navigateTo('cube-vision'));
    }

    const btnOverviewStepCv = document.getElementById('overview-step-cv');
    if (btnOverviewStepCv) {
      btnOverviewStepCv.style.cursor = 'pointer';
      btnOverviewStepCv.addEventListener('click', () => this.navigateTo('cube-vision'));
    }

    const btnOverviewStepEe = document.getElementById('overview-step-ee');
    if (btnOverviewStepEe) {
      btnOverviewStepEe.style.cursor = 'pointer';
      btnOverviewStepEe.addEventListener('click', () => this.navigateTo('entropy-engine'));
    }

    const btnOverviewStepAc = document.getElementById('overview-step-ac');
    if (btnOverviewStepAc) {
      btnOverviewStepAc.style.cursor = 'pointer';
      btnOverviewStepAc.addEventListener('click', () => this.navigateTo('authentication'));
    }
  },

  navigateTo(viewId) {
    this.currentView = viewId;

    // Update active nav button
    document.querySelectorAll('.nav-item').forEach(btn => {
      if (btn.getAttribute('data-view') === viewId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update view visibility
    document.querySelectorAll('.module-view').forEach(view => {
      if (view.id === `view-${viewId}`) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    // Update Breadcrumb text
    const breadcrumb = document.getElementById('headerBreadcrumb');
    const titles = {
      'overview': 'Overview',
      'cube-vision': 'Cube Vision (Module A)',
      'entropy-engine': 'Entropy Engine (Module B)',
      'authentication': 'Authentication (Module C)',
      'api-playground': 'API Playground',
      'security-logs': 'Security Logs',
      'tech-report': 'Technical Report'
    };
    if (breadcrumb) {
      breadcrumb.textContent = titles[viewId] || viewId;
    }

    // Close mobile nav drawer if open
    const sidebar = document.getElementById('appSidebar');
    if (sidebar) sidebar.classList.remove('mobile-open');

    // Trigger destination-specific initializations
    if (viewId === 'security-logs' && window.SecurityLogs) {
      window.SecurityLogs.loadLogs();
    }
    if (viewId === 'api-playground' && window.ApiPlayground) {
      window.ApiPlayground.initEditor();
    }
    if (viewId === 'overview') {
      this.fetchOverviewLogs();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  /* --- Session State Synchronization --- */
  async fetchSessionStatus() {
    try {
      const resp = await fetch('/api/session/status');
      if (!resp.ok) return;
      const data = await resp.json();
      this.sessionState = data;
      this.renderSessionBadges(data);
    } catch (err) {
      console.warn("Could not fetch session status:", err);
    }
  },

  renderSessionBadges(data) {
    // 1. Cube Vision badges
    const cvBadge = document.getElementById('badge-cube-faces');
    const miniCv = document.getElementById('mini-status-faces');
    const overviewCv = document.getElementById('overview-status-cv');
    const count = data.faces_detected_count || 0;

    if (cvBadge) cvBadge.textContent = `${count}/6`;
    if (miniCv) {
      const dot = count === 6 ? 'dot-success' : count > 0 ? 'dot-warning' : 'dot-idle';
      miniCv.innerHTML = `<span class="indicator-dot ${dot}"></span> ${count} of 6`;
    }
    if (overviewCv) {
      overviewCv.textContent = `${count}/6 Faces Ready`;
      overviewCv.className = `badge ${count === 6 ? 'badge-success' : count > 0 ? 'badge-warning' : 'badge-neutral'}`;
    }

    // 2. Audio badges
    const audioBadge = document.getElementById('badge-audio-status');
    const miniAudio = document.getElementById('mini-status-audio');
    const overviewAudio = document.getElementById('overview-status-ee');
    const hasAudio = data.audio_processed;

    if (audioBadge) {
      audioBadge.textContent = hasAudio ? 'Analyzed' : 'Idle';
    }
    if (miniAudio) {
      const dot = hasAudio ? 'dot-success' : 'dot-idle';
      miniAudio.innerHTML = `<span class="indicator-dot ${dot}"></span> ${hasAudio ? 'Ready' : 'Pending'}`;
    }
    if (overviewAudio) {
      overviewAudio.textContent = hasAudio ? 'Audio Processed' : 'Audio Pending';
      overviewAudio.className = `badge ${hasAudio ? 'badge-success' : 'badge-neutral'}`;
    }

    // 3. Auth Token badges
    const authBadge = document.getElementById('badge-auth-status');
    const miniToken = document.getElementById('mini-status-token');
    const overviewToken = document.getElementById('overview-status-ac');
    const hasToken = data.active_token && data.active_token.status === 'ACTIVE';

    if (authBadge) {
      authBadge.textContent = hasToken ? 'Active' : 'Inactive';
    }
    if (miniToken) {
      const dot = hasToken ? 'dot-success' : 'dot-idle';
      miniToken.innerHTML = `<span class="indicator-dot ${dot}"></span> ${hasToken ? 'Active' : 'None'}`;
    }
    if (overviewToken) {
      overviewToken.textContent = hasToken ? 'Active Token' : 'No Active Token';
      overviewToken.className = `badge ${hasToken ? 'badge-success' : 'badge-neutral'}`;
    }

    // Continue buttons availability
    const btnContinueEntropy = document.getElementById('btnContinueToEntropy');
    if (btnContinueEntropy) {
      btnContinueEntropy.disabled = (count < 6);
    }

    const btnContinueAuth = document.getElementById('btnContinueToAuth');
    if (btnContinueAuth) {
      btnContinueAuth.disabled = !(data.last_digest && count === 6 && hasAudio);
    }
  },

  async resetSession() {
    if (!confirm('Are you sure you want to reset the entire demonstration session? All uploaded faces, audio, and tokens will be cleared.')) {
      return;
    }
    try {
      const res = await fetch('/api/session/reset', { method: 'POST' });
      const data = await res.json();
      alert('Session reset: ' + data.message);
      window.location.reload();
    } catch (err) {
      alert('Failed to reset session: ' + err.message);
    }
  },

  async quickLoadAllSamples() {
    try {
      // 1. Load faces
      const resFaces = await fetch('/api/cube/load-all-samples', { method: 'POST' });
      const facesData = await resFaces.json();

      // 2. Load audio
      const resAudio = await fetch('/api/audio/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ use_sample: true })
      });
      const audioData = await resAudio.json();

      // 3. Compute digest
      const resDigest = await fetch('/api/entropy/process', { method: 'POST' });
      const digestData = await resDigest.json();

      await this.fetchSessionStatus();
      this.fetchOverviewLogs();

      if (window.CubeVision && window.CubeVision.renderAllFacesFromSession) {
        window.CubeVision.renderAllFacesFromSession();
      }
      if (window.EntropyEngine && window.EntropyEngine.renderAudioResult) {
        window.EntropyEngine.renderAudioResult(audioData);
        window.EntropyEngine.renderDigestResult(digestData);
      }

      alert('Sample data loaded! 6 cube faces analyzed, scrambling acoustic telemetry extracted, and SHA-256 digest computed.');
    } catch (err) {
      alert('Failed to load sample data: ' + err.message);
    }
  },

  async fetchOverviewLogs() {
    const list = document.getElementById('overviewRecentLogsList');
    if (!list) return;

    try {
      const res = await fetch('/api/logs?limit=5');
      const data = await res.json();
      if (!data.logs || data.logs.length === 0) {
        list.innerHTML = `<span style="color:var(--text-muted);">No activity recorded in this session yet.</span>`;
        return;
      }

      list.innerHTML = data.logs.map(log => {
        const timeStr = log.timestamp ? log.timestamp.split('T')[1].substring(0, 8) : '';
        const badgeClass = log.status === 'SUCCESS' ? 'badge-success' : log.status === 'WARNING' ? 'badge-warning' : 'badge-danger';
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border-light);">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge ${badgeClass}" style="font-size:10px;">${log.event_type}</span>
              <span style="color:var(--text-primary); font-weight:500;">${log.summary}</span>
            </div>
            <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">${timeStr} UTC</span>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.warn("Failed to fetch overview logs:", err);
    }
  },

  /* --- Global Modals & Legal Terms --- */
  initModals() {
    const modal = document.getElementById('legalModal');
    const closeBtn = document.getElementById('btnCloseLegalModal');
    const linkPrivacy = document.getElementById('link-privacy-policy');
    const linkTerms = document.getElementById('link-terms-service');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBodyText');

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.remove('open'));
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
      });
    }

    if (linkPrivacy) {
      linkPrivacy.addEventListener('click', (e) => {
        e.preventDefault();
        title.textContent = "CubeSec Privacy Practices (Local Prototype)";
        body.innerHTML = `
          <p><strong>1. Local Execution:</strong> CubeSec is a self-contained local research prototype executing on <code>127.0.0.1</code>. No images, audio files, or token payloads are transmitted to any external cloud service or third party.</p>
          <br>
          <p><strong>2. Ephemeral Processing:</strong> Uploaded cube photographs and recorded scrambling audio are processed in system memory for visual feature identification and acoustic feature extraction. Uploaded data is not retained in persistent long-term storage.</p>
          <br>
          <p><strong>3. Activity Logging:</strong> Operational events (e.g. OpenCV detection confidence, token verification results) are recorded into a local SQLite database (<code>cubesec.db</code>) solely for demonstration audit purposes. The database can be cleared at any time via the Security Logs tab.</p>
          <br>
          <p><strong>4. Status:</strong> <em>Draft for Project Evaluation / Hackathon Demonstration.</em></p>
        `;
        modal.classList.add('open');
      });
    }

    if (linkTerms) {
      linkTerms.addEventListener('click', (e) => {
        e.preventDefault();
        title.textContent = "CubeSec Prototype Terms of Service & Notice";
        body.innerHTML = `
          <p><strong>1. Demonstrative Prototype Notice:</strong> CubeSec is developed strictly as an educational and proof-of-concept demonstration exploring the integration of physical-world sensing (computer vision + acoustics) with cryptographic authentication workflows.</p>
          <br>
          <p><strong>2. Non-Production Software:</strong> This prototype is NOT certified for production authentication, high-assurance security, or sensitive data protection. Cube arrangements and audio telemetry provide demonstrative physical inputs and have not undergone NIST SP 800-90B entropy validation.</p>
          <br>
          <p><strong>3. Cryptographic Scope:</strong> SHA-256 produces a deterministic collision-resistant digest; it does not amplify or prove sufficient physical entropy. Demo session tokens are generated via Python's standard OS CSPRNG (<code>secrets</code> module).</p>
          <br>
          <p><strong>4. No Warranty:</strong> Provided "as-is" without warranty of any kind, express or implied.</p>
        `;
        modal.classList.add('open');
      });
    }
  },

  initGlobalEvents() {
    const btnReset = document.getElementById('btnQuickResetSession');
    if (btnReset) btnReset.addEventListener('click', () => this.resetSession());

    const btnOverviewLoad = document.getElementById('btnOverviewLoadSample');
    if (btnOverviewLoad) btnOverviewLoad.addEventListener('click', () => this.quickLoadAllSamples());

    const btnRefreshOverviewLogs = document.getElementById('btnOverviewRefreshLogs');
    if (btnRefreshOverviewLogs) btnRefreshOverviewLogs.addEventListener('click', () => this.fetchOverviewLogs());
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
