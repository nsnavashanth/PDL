/**
 * CubeSec Prototype - API Playground
 * Interactive API testing console for developers and hackathon evaluators.
 */

const ApiPlayground = {
  endpoints: {
    '/api/cube/analyze': {
      method: 'POST',
      body: {
        face: 'F',
        use_sample: true
      }
    },
    '/api/cube/load-all-samples': {
      method: 'POST',
      body: {}
    },
    '/api/audio/analyze': {
      method: 'POST',
      body: {
        use_sample: true
      }
    },
    '/api/entropy/process': {
      method: 'POST',
      body: {
        salt: 'demo-playground-salt-0x99'
      }
    },
    '/api/auth/token': {
      method: 'POST',
      body: {
        ttl_seconds: 180
      }
    },
    '/api/auth/verify': {
      method: 'POST',
      body: {
        token: 'csec_tok_example_sample_token_string'
      }
    },
    '/api/session/status': {
      method: 'GET',
      body: null
    },
    '/api/logs': {
      method: 'GET',
      body: null
    }
  },

  init() {
    this.bindEvents();
    this.updateEndpointTemplate('/api/cube/analyze');
  },

  bindEvents() {
    const select = document.getElementById('playgroundEndpointSelect');
    if (select) {
      select.addEventListener('change', (e) => {
        this.updateEndpointTemplate(e.target.value);
      });
    }

    const btnSend = document.getElementById('btnPlaygroundSend');
    if (btnSend) {
      btnSend.addEventListener('click', () => this.sendRequest());
    }

    const btnCurl = document.getElementById('btnCopyCurl');
    if (btnCurl) {
      btnCurl.addEventListener('click', () => this.copyAsCurl());
    }
  },

  initEditor() {
    const select = document.getElementById('playgroundEndpointSelect');
    if (select) {
      this.updateEndpointTemplate(select.value);
    }
  },

  updateEndpointTemplate(endpoint) {
    const conf = this.endpoints[endpoint];
    if (!conf) return;

    const methodBadge = document.getElementById('playgroundMethodBadge');
    if (methodBadge) {
      methodBadge.textContent = conf.method;
      methodBadge.className = conf.method === 'GET' ? 'badge badge-info' : 'badge badge-success';
    }

    const editor = document.getElementById('playgroundRequestBody');
    if (editor) {
      if (conf.method === 'GET') {
        editor.value = "// GET request has no body payload.";
        editor.disabled = true;
      } else {
        editor.disabled = false;
        // If auth/verify, check if we have an active token to populate!
        if (endpoint === '/api/auth/verify' && window.AuthCore && window.AuthCore.activeTokenData) {
          conf.body.token = window.AuthCore.activeTokenData.token;
        }
        editor.value = JSON.stringify(conf.body, null, 2);
      }
    }
  },

  async sendRequest() {
    const select = document.getElementById('playgroundEndpointSelect');
    const endpoint = select ? select.value : '/api/session/status';
    const conf = this.endpoints[endpoint] || { method: 'GET' };
    const editor = document.getElementById('playgroundRequestBody');

    let bodyData = null;
    if (conf.method === 'POST') {
      try {
        bodyData = editor.value.trim() ? JSON.parse(editor.value) : {};
      } catch (err) {
        alert('Invalid JSON in Request Body: ' + err.message);
        return;
      }
    }

    const statusBadge = document.getElementById('playgroundStatusBadge');
    const latencyBadge = document.getElementById('playgroundLatencyBadge');
    const responseBox = document.getElementById('playgroundResponseBody');

    if (responseBox) responseBox.textContent = 'Sending request to ' + endpoint + '...';

    const startTime = performance.now();

    try {
      const options = {
        method: conf.method,
        headers: conf.method === 'POST' ? { 'Content-Type': 'application/json' } : {}
      };
      if (bodyData) {
        options.body = JSON.stringify(bodyData);
      }

      const res = await fetch(endpoint, options);
      const elapsed = Math.round(performance.now() - startTime);
      const data = await res.json();

      if (statusBadge) {
        statusBadge.textContent = `${res.status} ${res.statusText}`;
        statusBadge.className = res.ok ? 'badge badge-success' : 'badge badge-danger';
      }

      if (latencyBadge) {
        latencyBadge.textContent = `${elapsed} ms`;
      }

      if (responseBox) {
        responseBox.textContent = JSON.stringify(data, null, 2);
      }
    } catch (err) {
      const elapsed = Math.round(performance.now() - startTime);
      if (statusBadge) {
        statusBadge.textContent = 'Network Error';
        statusBadge.className = 'badge badge-danger';
      }
      if (latencyBadge) latencyBadge.textContent = `${elapsed} ms`;
      if (responseBox) responseBox.textContent = `Error: ${err.message}`;
    }
  },

  copyAsCurl() {
    const select = document.getElementById('playgroundEndpointSelect');
    const endpoint = select ? select.value : '/api/session/status';
    const conf = this.endpoints[endpoint] || { method: 'GET' };
    const editor = document.getElementById('playgroundRequestBody');

    let curl = `curl -X ${conf.method} "http://127.0.0.1:5000${endpoint}"`;
    if (conf.method === 'POST') {
      curl += ` \\\n  -H "Content-Type: application/json"`;
      try {
        const body = editor ? editor.value.trim() : '{}';
        curl += ` \\\n  -d '${body.replace(/'/g, "\\'")}'`;
      } catch (e) {}
    }

    navigator.clipboard.writeText(curl).then(() => {
      alert('cURL command copied to clipboard!');
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ApiPlayground.init();
});

window.ApiPlayground = ApiPlayground;
