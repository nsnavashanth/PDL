/**
 * CubeSec Prototype - Module A: Cube Vision
 * Handles face image uploads, OpenCV 3x3 sticker grid extraction, and visual feedback.
 */

const CubeVision = {
  faces: ['U', 'D', 'F', 'B', 'L', 'R'],
  faceData: {},

  init() {
    this.bindEvents();
    this.initDragAndDrop();
  },

  bindEvents() {
    const btnLoadAll = document.getElementById('btnLoadAllSampleFaces');
    if (btnLoadAll) {
      btnLoadAll.addEventListener('click', () => this.loadAllSampleFaces());
    }

    const btnClearAll = document.getElementById('btnClearAllFaces');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', () => this.clearAllFaces());
    }

    const btnContinue = document.getElementById('btnContinueToEntropy');
    if (btnContinue) {
      btnContinue.addEventListener('click', () => {
        if (window.App) window.App.navigateTo('entropy-engine');
      });
    }
  },

  initDragAndDrop() {
    this.faces.forEach(faceId => {
      const card = document.getElementById(`face-card-${faceId}`);
      if (!card) return;
      const dropzone = card.querySelector('.face-dropzone');
      if (!dropzone) return;

      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.style.borderColor = 'var(--brand-primary)';
          dropzone.style.backgroundColor = 'var(--brand-subtle)';
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.style.borderColor = '';
          dropzone.style.backgroundColor = '';
        }, false);
      });

      dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
          this.uploadFaceImageFile(faceId, files[0]);
        }
      }, false);
    });
  },

  async uploadFaceImageFile(faceId, file) {
    if (!file) return;

    // Validate type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      this.renderFaceError(faceId, `Unsupported image format (${file.type}). Please provide PNG, JPG, or WEBP.`);
      return;
    }

    const formData = new FormData();
    formData.append('face', faceId);
    formData.append('image', file);

    this.setFaceLoading(faceId, true);

    try {
      const res = await fetch('/api/cube/analyze', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      this.setFaceLoading(faceId, false);

      if (data.success) {
        this.faceData[faceId] = data;
        this.renderFaceSuccess(faceId, data);
      } else {
        this.renderFaceError(faceId, data.error || 'Failed to detect Rubik\'s sticker grid.');
      }
      this.updateOverallStatus();
    } catch (err) {
      this.setFaceLoading(faceId, false);
      this.renderFaceError(faceId, `Analysis network error: ${err.message}`);
    }
  },

  async loadSingleSampleFace(faceId) {
    this.setFaceLoading(faceId, true);
    try {
      const res = await fetch('/api/cube/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ face: faceId, use_sample: true })
      });
      const data = await res.json();
      this.setFaceLoading(faceId, false);

      if (data.success) {
        this.faceData[faceId] = data;
        this.renderFaceSuccess(faceId, data);
      } else {
        this.renderFaceError(faceId, data.error || 'Sample loading error');
      }
      this.updateOverallStatus();
    } catch (err) {
      this.setFaceLoading(faceId, false);
      this.renderFaceError(faceId, err.message);
    }
  },

  async loadAllSampleFaces() {
    const alertBox = document.getElementById('cubeVisionStatusAlert');
    if (alertBox) alertBox.innerHTML = `<span>Loading and analyzing all 6 reference cube faces via OpenCV...</span>`;

    try {
      const res = await fetch('/api/cube/load-all-samples', { method: 'POST' });
      const data = await res.json();

      if (data.success && data.faces) {
        Object.keys(data.faces).forEach(faceId => {
          const fRes = data.faces[faceId];
          if (fRes.success) {
            this.faceData[faceId] = fRes;
            this.renderFaceSuccess(faceId, fRes);
          } else {
            this.renderFaceError(faceId, fRes.error);
          }
        });
        if (alertBox) {
          alertBox.className = "alert alert-success";
          alertBox.innerHTML = `<strong>Acquisition Complete:</strong> All 6 cube faces analyzed with high confidence. Proceed to Module B.`;
        }
      }
      this.updateOverallStatus();
      if (window.App) window.App.fetchSessionStatus();
    } catch (err) {
      if (alertBox) {
        alertBox.className = "alert alert-danger";
        alertBox.innerHTML = `Failed to load samples: ${err.message}`;
      }
    }
  },

  clearAllFaces() {
    this.faces.forEach(faceId => {
      delete this.faceData[faceId];
      const card = document.getElementById(`face-card-${faceId}`);
      if (!card) return;
      card.classList.remove('face-detected');

      const badge = card.querySelector('.face-badge');
      if (badge) {
        badge.className = 'badge badge-neutral face-badge';
        badge.textContent = 'Pending';
      }

      const dropzone = card.querySelector('.face-dropzone');
      if (dropzone) dropzone.style.display = 'flex';

      const previewArea = card.querySelector('.face-preview-area');
      if (previewArea) {
        previewArea.style.display = 'none';
        previewArea.innerHTML = '';
      }
    });

    this.updateOverallStatus();
    const alertBox = document.getElementById('cubeVisionStatusAlert');
    if (alertBox) {
      alertBox.className = "alert alert-info";
      alertBox.innerHTML = `<span>Face cache cleared. Please upload or load 6 cube face photographs.</span>`;
    }
  },

  setFaceLoading(faceId, isLoading) {
    const card = document.getElementById(`face-card-${faceId}`);
    if (!card) return;
    const badge = card.querySelector('.face-badge');
    if (badge) {
      if (isLoading) {
        badge.className = 'badge badge-warning face-badge';
        badge.textContent = 'Analyzing...';
      }
    }
  },

  renderFaceSuccess(faceId, result) {
    const card = document.getElementById(`face-card-${faceId}`);
    if (!card) return;
    card.classList.add('face-detected');

    // Update status badge
    const badge = card.querySelector('.face-badge');
    if (badge) {
      badge.className = 'badge badge-success face-badge';
      badge.textContent = `${Math.round((result.average_confidence || 0) * 100)}% Conf`;
    }

    // Hide dropzone, show preview area
    const dropzone = card.querySelector('.face-dropzone');
    if (dropzone) dropzone.style.display = 'none';

    const previewArea = card.querySelector('.face-preview-area');
    if (!previewArea) return;
    previewArea.style.display = 'flex';

    // Build 3x3 sticker grid HTML
    let gridHtml = '<div class="sticker-grid-preview">';
    if (result.grid) {
      result.grid.forEach(row => {
        row.forEach(cell => {
          gridHtml += `<div class="sticker-cell color-${cell.code}" title="${cell.name} (${cell.code})">${cell.code}</div>`;
        });
      });
    }
    gridHtml += '</div>';

    // Build preview area
    previewArea.innerHTML = `
      <div style="display:flex; gap:12px; align-items:center; width:100%; justify-content:center;">
        <img class="annotated-preview-img" src="${result.annotated_image}" alt="Face ${faceId} CV Preview" title="OpenCV Grid Annotation" />
        <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
          <div style="font-size:10px; font-weight:600; color:var(--text-muted); text-transform:uppercase;">Identified Grid</div>
          ${gridHtml}
        </div>
      </div>
      <div class="face-metrics-row">
        <span>Sharpness: <strong>${result.blur_score || 'N/A'}</strong></span>
        <span>Brightness: <strong>${result.brightness || 'N/A'}</strong></span>
        <span>Resolution: <strong>${result.dimensions ? `${result.dimensions.width}x${result.dimensions.height}` : '—'}</strong></span>
      </div>
    `;
  },

  renderFaceError(faceId, errorMsg) {
    const card = document.getElementById(`face-card-${faceId}`);
    if (!card) return;
    card.classList.remove('face-detected');

    const badge = card.querySelector('.face-badge');
    if (badge) {
      badge.className = 'badge badge-danger face-badge';
      badge.textContent = 'Error';
    }

    const dropzone = card.querySelector('.face-dropzone');
    if (dropzone) dropzone.style.display = 'none';

    const previewArea = card.querySelector('.face-preview-area');
    if (previewArea) {
      previewArea.style.display = 'flex';
      previewArea.innerHTML = `
        <div class="alert alert-danger" style="margin:0; width:100%; font-size:11px;">
          <strong>Detection Rejected:</strong> ${errorMsg}
        </div>
      `;
    }
  },

  updateOverallStatus() {
    const detectedCount = Object.keys(this.faceData).length;
    const countText = document.getElementById('cubeFacesCountText');
    const btnContinue = document.getElementById('btnContinueToEntropy');

    if (countText) {
      countText.textContent = `${detectedCount} of 6 faces identified and verified.`;
    }

    if (btnContinue) {
      btnContinue.disabled = (detectedCount < 6);
    }

    if (window.App) window.App.fetchSessionStatus();
  }
};

// Global helper handlers called from HTML inline attributes
function triggerFaceUpload(faceId) {
  const input = document.getElementById(`file-input-${faceId}`);
  if (input) input.click();
}

function handleFaceFileSelected(faceId, input) {
  if (input.files && input.files[0]) {
    CubeVision.uploadFaceImageFile(faceId, input.files[0]);
  }
}

function loadSingleSampleFace(faceId) {
  CubeVision.loadSingleSampleFace(faceId);
}

document.addEventListener('DOMContentLoaded', () => {
  CubeVision.init();
});

window.CubeVision = CubeVision;
