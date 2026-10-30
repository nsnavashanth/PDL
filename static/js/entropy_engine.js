/**
 * CubeSec Prototype - Module B: Entropy Engine
 * Handles live audio recording, waveform visualization, acoustic feature extraction,
 * and canonical SHA-256 pre-image digest computation.
 */

const EntropyEngine = {
  audioContext: null,
  mediaRecorder: null,
  audioChunks: [],
  isRecording: false,
  latestAudioFeatures: null,
  latestDigest: null,

  init() {
    this.bindEvents();
    this.drawEmptyWaveform();
  },

  bindEvents() {
    const btnRecord = document.getElementById('btnRecordToggle');
    if (btnRecord) {
      btnRecord.addEventListener('click', () => this.toggleLiveRecording());
    }

    const btnSampleAudio = document.getElementById('btnLoadSampleAudio');
    if (btnSampleAudio) {
      btnSampleAudio.addEventListener('click', () => this.loadSampleAudio());
    }

    const btnCompute = document.getElementById('btnComputeDigest');
    if (btnCompute) {
      btnCompute.addEventListener('click', () => this.computeDigest());
    }

    const btnCopy = document.getElementById('btnCopyDigest');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => this.copyDigestToClipboard());
    }

    const btnProceed = document.getElementById('btnContinueToAuth');
    if (btnProceed) {
      btnProceed.addEventListener('click', () => {
        if (window.App) window.App.navigateTo('authentication');
      });
    }
  },

  drawEmptyWaveform() {
    const canvas = document.getElementById('waveformCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#808892';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    ctx.fillStyle = '#808892';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Awaiting audio input (Record live scramble or upload WAV)', canvas.width / 2, canvas.height / 2 - 8);
  },

  drawWaveform(waveformArray) {
    const canvas = document.getElementById('waveformCanvas');
    if (!canvas || !waveformArray || waveformArray.length === 0) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const midY = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Draw center line
    ctx.strokeStyle = 'rgba(128, 136, 146, 0.2)';
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();

    // Draw bars
    const barWidth = w / waveformArray.length;
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim() || '#18633e';
    ctx.fillStyle = accentColor;

    waveformArray.forEach((val, idx) => {
      const barHeight = Math.max(2, val * (h / 2) * 0.95);
      const x = idx * barWidth;
      const y = midY - barHeight;
      ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight * 2);
    });
  },

  async toggleLiveRecording() {
    if (this.isRecording) {
      this.stopRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.startRecording(stream);
    } catch (err) {
      alert(`Microphone access error: ${err.message}. Please allow microphone permissions or use "Load Sample Audio".`);
    }
  },

  startRecording(stream) {
    this.isRecording = true;
    this.audioChunks = [];

    const btn = document.getElementById('btnRecordToggle');
    const dot = document.getElementById('recordIconDot');
    const text = document.getElementById('recordBtnText');

    if (btn) btn.className = 'btn btn-danger-outline';
    if (dot) dot.className = 'recording-pulse';
    if (text) text.textContent = 'Recording (Click to Stop)...';

    // Build audio context to record and convert to WAV Float32
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass();
    const source = this.audioContext.createMediaStreamSource(stream);
    
    // Use ScriptProcessor or MediaRecorder
    this.mediaRecorder = new MediaRecorder(stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.audioChunks.push(e.data);
    };

    this.mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());
      const rawBlob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType });
      await this.processRecordedAudio(rawBlob);
    };

    this.mediaRecorder.start();

    // Automatically auto-stop after 3.2 seconds
    setTimeout(() => {
      if (this.isRecording) {
        this.stopRecording();
      }
    }, 3200);
  },

  stopRecording() {
    if (!this.isRecording) return;
    this.isRecording = false;

    const btn = document.getElementById('btnRecordToggle');
    const dot = document.getElementById('recordIconDot');
    const text = document.getElementById('recordBtnText');

    if (btn) btn.className = 'btn btn-primary';
    if (dot) dot.className = 'indicator-dot dot-idle';
    if (text) text.textContent = 'Record Live Scramble (3s)';

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  },

  async processRecordedAudio(blob) {
    const spinner = document.getElementById('audioProcessingSpinner');
    if (spinner) spinner.style.display = 'inline';

    try {
      // Decode audio data using browser AudioContext to produce valid standard PCM WAV
      const arrayBuffer = await blob.arrayBuffer();
      const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
      const wavBlob = this.audioBufferToWavBlob(audioBuffer);

      // Setup audio playback preview
      const playerWrapper = document.getElementById('audioPlayerWrapper');
      const player = document.getElementById('audioPlayback');
      if (playerWrapper && player) {
        player.src = URL.createObjectURL(wavBlob);
        playerWrapper.style.display = 'block';
      }

      // Send WAV to backend
      const formData = new FormData();
      formData.append('audio', wavBlob, 'scramble_recording.wav');

      const res = await fetch('/api/audio/analyze', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (spinner) spinner.style.display = 'none';

      if (data.success) {
        this.renderAudioResult(data);
      } else {
        alert('Audio Analysis Error: ' + (data.error || 'Failed to process audio'));
      }
    } catch (err) {
      if (spinner) spinner.style.display = 'none';
      alert('Failed to process recorded audio: ' + err.message);
    }
  },

  audioBufferToWavBlob(buffer) {
    const numOfChan = 1;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    const channels = [];
    let sample = 0;
    let offset = 0;
    let pos = 0;

    function setUint16(data) { out.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { out.setUint32(pos, data, true); pos += 4; }

    // RIFF chunk descriptor
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    // fmt sub-chunk
    setUint32(0x20746d66); // "fmt "
    setUint32(16); // subchunk1size (16 for PCM)
    setUint16(1);  // PCM format
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
    setUint16(numOfChan * 2); // block align
    setUint16(16); // bits per sample
    // data sub-chunk
    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4);

    // Merge channels down to mono
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) {
      sample = Math.max(-1, Math.min(1, channelData[i]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }

    return new Blob([out.buffer], { type: 'audio/wav' });
  },

  async loadSampleAudio() {
    const spinner = document.getElementById('audioProcessingSpinner');
    if (spinner) spinner.style.display = 'inline';

    try {
      const res = await fetch('/api/audio/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ use_sample: true })
      });
      const data = await res.json();
      if (spinner) spinner.style.display = 'none';

      if (data.success) {
        this.renderAudioResult(data);
        const playerWrapper = document.getElementById('audioPlayerWrapper');
        const player = document.getElementById('audioPlayback');
        if (playerWrapper && player) {
          player.src = '/api/sample/audio';
          playerWrapper.style.display = 'block';
        }
      } else {
        alert('Error loading sample audio: ' + data.error);
      }
    } catch (err) {
      if (spinner) spinner.style.display = 'none';
      alert('Network error loading sample audio: ' + err.message);
    }
  },

  renderAudioResult(result) {
    this.latestAudioFeatures = result;

    const badge = document.getElementById('audioAnalysisBadge');
    if (badge) {
      badge.className = 'badge badge-success';
      badge.textContent = 'Telemetry Extracted';
    }

    document.getElementById('m-audio-duration').textContent = `${result.duration_seconds} sec`;
    document.getElementById('m-audio-sr').textContent = `${result.sample_rate} Hz`;
    document.getElementById('m-audio-rms').textContent = `${result.rms_energy}`;
    document.getElementById('m-audio-peak').textContent = `${result.peak_amplitude}`;
    document.getElementById('m-audio-zcr').textContent = `${result.zero_crossing_rate}`;
    document.getElementById('m-audio-centroid').textContent = `${result.spectral_centroid_hz} Hz`;
    document.getElementById('m-audio-rolloff').textContent = `${result.spectral_rolloff_hz} Hz`;
    document.getElementById('m-audio-peaks').textContent = result.dominant_frequencies_hz ? result.dominant_frequencies_hz.join(', ') + ' Hz' : '—';

    if (result.waveform) {
      this.drawWaveform(result.waveform);
    }

    if (window.App) window.App.fetchSessionStatus();
  },

  async computeDigest() {
    const btn = document.getElementById('btnComputeDigest');
    if (btn) btn.disabled = true;

    try {
      const res = await fetch('/api/entropy/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (btn) btn.disabled = false;

      this.renderDigestResult(data);
    } catch (err) {
      if (btn) btn.disabled = false;
      alert('Failed to compute digest: ' + err.message);
    }
  },

  renderDigestResult(data) {
    this.latestDigest = data;

    const alertBox = document.getElementById('digestValidationAlert');
    const preimageView = document.getElementById('canonicalPreimageView');
    const digestBox = document.getElementById('digestOutputBox');
    const btnCopy = document.getElementById('btnCopyDigest');
    const btnProceed = document.getElementById('btnContinueToAuth');

    if (preimageView) {
      preimageView.value = JSON.stringify(data.preimage_structure, null, 2);
    }

    if (digestBox) {
      digestBox.textContent = data.digest;
    }

    if (btnCopy) btnCopy.disabled = false;

    const val = data.validation;
    if (val && val.all_inputs_ready) {
      if (alertBox) {
        alertBox.className = 'alert alert-success';
        alertBox.innerHTML = `<strong>Input Validation Passed:</strong> All 6 cube faces and scramble audio verified. Reproducible canonical SHA-256 digest generated.`;
      }
      if (btnProceed) btnProceed.disabled = false;
    } else {
      const missing = (val && val.missing_components) ? val.missing_components.join('; ') : 'Missing required inputs';
      if (alertBox) {
        alertBox.className = 'alert alert-warning';
        alertBox.innerHTML = `<strong>Incomplete Inputs:</strong> ${missing}. Digest computed with available telemetry for inspection.`;
      }
      if (btnProceed) btnProceed.disabled = true;
    }

    // Sync digest into Auth Core view reference
    const authRefInput = document.getElementById('authDigestRef');
    if (authRefInput) {
      authRefInput.value = data.digest;
    }

    if (window.App) window.App.fetchSessionStatus();
  },

  copyDigestToClipboard() {
    const digestBox = document.getElementById('digestOutputBox');
    if (digestBox && digestBox.textContent) {
      navigator.clipboard.writeText(digestBox.textContent.trim()).then(() => {
        alert('SHA-256 Digest copied to clipboard!');
      }).catch(err => {
        alert('Could not copy to clipboard: ' + err.message);
      });
    }
  }
};

// Global helper for file upload
function handleAudioUpload(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const formData = new FormData();
    formData.append('audio', file);

    const spinner = document.getElementById('audioProcessingSpinner');
    if (spinner) spinner.style.display = 'inline';

    fetch('/api/audio/analyze', {
      method: 'POST',
      body: formData
    })
    .then(r => r.json())
    .then(data => {
      if (spinner) spinner.style.display = 'none';
      if (data.success) {
        EntropyEngine.renderAudioResult(data);
        const playerWrapper = document.getElementById('audioPlayerWrapper');
        const player = document.getElementById('audioPlayback');
        if (playerWrapper && player) {
          player.src = URL.createObjectURL(file);
          playerWrapper.style.display = 'block';
        }
      } else {
        alert('Audio Analysis Error: ' + (data.error || 'Invalid audio'));
      }
    })
    .catch(err => {
      if (spinner) spinner.style.display = 'none';
      alert('Upload failed: ' + err.message);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  EntropyEngine.init();
});

window.EntropyEngine = EntropyEngine;
