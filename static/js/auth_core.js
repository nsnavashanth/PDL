/**
 * CubeSec Prototype - Module C: Authentication Core
 * Handles cryptographically secure demo token generation, live TTL countdowns,
 * and gateway token verification demonstrations.
 */

const AuthCore = {
  activeTokenData: null,
  countdownInterval: null,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const btnIssue = document.getElementById('btnIssueToken');
    if (btnIssue) {
      btnIssue.addEventListener('click', () => this.issueDemoToken());
    }

    const btnVerify = document.getElementById('btnVerifyToken');
    if (btnVerify) {
      btnVerify.addEventListener('click', () => this.verifyToken());
    }

    const btnCopy = document.getElementById('btnCopyIssuedToken');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => this.copyToken());
    }

    // Quick Test presets
    const btnPresetActive = document.getElementById('btnPresetActive');
    if (btnPresetActive) {
      btnPresetActive.addEventListener('click', () => {
        if (this.activeTokenData && this.activeTokenData.token) {
          document.getElementById('verifyTokenInput').value = this.activeTokenData.token;
        } else {
          alert('No active token generated yet. Please generate a token first.');
        }
      });
    }

    const btnPresetTampered = document.getElementById('btnPresetTampered');
    if (btnPresetTampered) {
      btnPresetTampered.addEventListener('click', () => {
        if (this.activeTokenData && this.activeTokenData.token) {
          const tok = this.activeTokenData.token;
          // Alter a character in the middle
          const tampered = tok.slice(0, 15) + (tok[15] === 'A' ? 'B' : 'A') + tok.slice(16);
          document.getElementById('verifyTokenInput').value = tampered;
        } else {
          document.getElementById('verifyTokenInput').value = 'csec_tok_TAMPERED_INVALID_SIGNATURE_0x999';
        }
      });
    }

    const btnPresetInvalid = document.getElementById('btnPresetInvalid');
    if (btnPresetInvalid) {
      btnPresetInvalid.addEventListener('click', () => {
        document.getElementById('verifyTokenInput').value = 'invalid_prefix_random_token_string_12345';
      });
    }

    const btnPresetClear = document.getElementById('btnPresetClear');
    if (btnPresetClear) {
      btnPresetClear.addEventListener('click', () => {
        document.getElementById('verifyTokenInput').value = '';
        const outcome = document.getElementById('verifyOutcomeBox');
        if (outcome) outcome.style.display = 'none';
        const details = document.getElementById('verifyDetailsTable');
        if (details) details.style.display = 'none';
      });
    }
  },

  async issueDemoToken() {
    const ttlSelect = document.getElementById('authTtlSelect');
    const ttl = ttlSelect ? parseInt(ttlSelect.value, 10) : 180;
    const btnIssue = document.getElementById('btnIssueToken');
    if (btnIssue) btnIssue.disabled = true;

    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl_seconds: ttl })
      });
      const data = await res.json();
      if (btnIssue) btnIssue.disabled = false;

      this.activeTokenData = data;
      this.renderIssuedToken(data);
    } catch (err) {
      if (btnIssue) btnIssue.disabled = false;
      alert('Failed to issue demo token: ' + err.message);
    }
  },

  renderIssuedToken(tokenData) {
    const display = document.getElementById('issuedTokenDisplay');
    const badge = document.getElementById('tokenStatusBadge');
    const btnCopy = document.getElementById('btnCopyIssuedToken');

    if (display) display.textContent = tokenData.token;
    if (btnCopy) btnCopy.disabled = false;

    if (badge) {
      badge.className = 'badge badge-success';
      badge.textContent = 'Token Active';
    }

    // Auto-populate verification input for ease of testing
    const verifyInput = document.getElementById('verifyTokenInput');
    if (verifyInput && !verifyInput.value) {
      verifyInput.value = tokenData.token;
    }

    // Start live countdown timer
    this.startCountdown(new Date(tokenData.expires_at).getTime());

    if (window.App) window.App.fetchSessionStatus();
  },

  startCountdown(expiresTimestamp) {
    if (this.countdownInterval) clearInterval(this.countdownInterval);

    const countdownEl = document.getElementById('tokenExpiryCountdown');
    const badge = document.getElementById('tokenStatusBadge');

    const update = () => {
      const now = Date.now();
      const diffMs = expiresTimestamp - now;

      if (diffMs <= 0) {
        clearInterval(this.countdownInterval);
        if (countdownEl) countdownEl.textContent = 'TTL Countdown: Token Expired';
        if (badge) {
          badge.className = 'badge badge-danger';
          badge.textContent = 'Token Expired';
        }
        return;
      }

      const totalSec = Math.floor(diffMs / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      const formatted = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
      if (countdownEl) countdownEl.textContent = `TTL Countdown: ${formatted} remaining`;
    };

    update();
    this.countdownInterval = setInterval(update, 1000);
  },

  copyToken() {
    if (this.activeTokenData && this.activeTokenData.token) {
      navigator.clipboard.writeText(this.activeTokenData.token).then(() => {
        alert('Active demo token copied to clipboard!');
      });
    }
  },

  async verifyToken() {
    const input = document.getElementById('verifyTokenInput');
    const tokenStr = input ? input.value.trim() : '';

    const outcomeBox = document.getElementById('verifyOutcomeBox');
    const outcomeText = document.getElementById('verifyOutcomeText');
    const detailsTable = document.getElementById('verifyDetailsTable');

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenStr })
      });
      const data = await res.json();

      if (outcomeBox && outcomeText) {
        outcomeBox.style.display = 'flex';

        if (data.verified) {
          outcomeBox.className = 'alert alert-success';
          outcomeText.innerHTML = `
            <strong>Authentication Verified:</strong> Demo token is valid and active.
            <div style="font-size:12px; margin-top:4px;">Session valid for ${data.remaining_ttl_seconds} seconds. Physical context binding verified.</div>
          `;

          if (detailsTable) {
            detailsTable.style.display = 'table';
            document.getElementById('m-verify-ttl').textContent = `${data.remaining_ttl_seconds}s`;
            document.getElementById('m-verify-issued').textContent = data.issued_at.replace('T', ' ').substring(0, 19) + ' UTC';
            document.getElementById('m-verify-expires').textContent = data.expires_at.replace('T', ' ').substring(0, 19) + ' UTC';
            document.getElementById('m-verify-digest').textContent = (data.cube_digest_ref || 'None').substring(0, 24) + '...';
          }
        } else {
          outcomeBox.className = 'alert alert-danger';
          outcomeText.innerHTML = `
            <strong>Authentication Rejected:</strong> ${data.message || 'Token verification failed.'}
            <div style="font-size:11px; margin-top:4px; font-family:var(--font-mono);">Error Code: ${data.error_code || 'AUTH_FAILED'}</div>
          `;
          if (detailsTable) detailsTable.style.display = 'none';
        }
      }

      if (window.App) window.App.fetchOverviewLogs();
    } catch (err) {
      if (outcomeBox && outcomeText) {
        outcomeBox.style.display = 'flex';
        outcomeBox.className = 'alert alert-danger';
        outcomeText.innerHTML = `<strong>Network Error:</strong> ${err.message}`;
      }
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AuthCore.init();
});

window.AuthCore = AuthCore;
