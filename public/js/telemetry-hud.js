/**
 * Telemetry HUD & Multi-Channel Laboratory Oscilloscope
 * Renders:
 * 1. TRACE: High-frequency biophysical membrane potentials & Central Complex compass
 * 2. MATRIX: 7x7 Drosophila Connectome Synaptic Connectivity Matrix
 * 3. STF: Tsodyks-Markram Short-Term Facilitation & Vesicle Depletion Curves
 */

class TelemetryHUD {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.historyLength = 220;
    this.voltageHistory = new Float32Array(this.historyLength).fill(-70.0);
    this.uHistory = new Float32Array(this.historyLength).fill(0.2);
    this.rHistory = new Float32Array(this.historyLength).fill(1.0);
    this.spikeMarkers = [];
    this.ringState = new Float32Array(16).fill(0.1);
    this.mode = 'TRACE'; // 'TRACE', 'MATRIX', 'STF'

    // 7x7 Drosophila Connectome Synaptic Weight Matrix (Micro-Siemens)
    this.circuitLabels = ['AL-PN', 'MB-KC', 'LHON', 'ExR2', 'DNp01', 'PPL1', 'OA-VUM'];
    this.circuitTransmitters = ['ACh', 'ACh', 'GABA', 'Glu', 'ACh+Elec', 'DA', 'OA'];
    this.synapticMatrix = [
      // AL-PN1 MB-KC   LHON   ExR2  DNp01  PPL1  OA-VUM
      [   0,    18,    14,     0,     2,     0,    0 ], // AL-PN1 ->
      [   0,     4,     0,     6,     0,   -16,    0 ], // MB-KC ->
      [   0,     0,     0,     0,    28,     0,    0 ], // LHON -> (Direct escape trigger)
      [   0,     8,     0,    12,     0,     0,    0 ], // ExR2 -> (Ring recurrent)
      [   0,     0,     0,     0,     0,     0,    0 ], // DNp01 -> (Descending output)
      [   0,   -22,     0,     0,     0,     0,    0 ], // PPL1-DA -> (Dopaminergic depression)
      [  10,    15,     8,     5,    20,     0,    0 ]  // OA-VUM -> (Stress sensitization)
    ];

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = this.canvas.clientWidth * (window.devicePixelRatio || 1);
    this.canvas.height = this.canvas.clientHeight * (window.devicePixelRatio || 1);
  }

  setMode(m) {
    if (['TRACE', 'MATRIX', 'STF'].includes(m)) {
      this.mode = m;
    }
  }

  pushVoltage(vm, isSpike, u_rel = 0.2, r_pool = 1.0) {
    for (let i = 0; i < this.historyLength - 1; i++) {
      this.voltageHistory[i] = this.voltageHistory[i + 1];
      this.uHistory[i] = this.uHistory[i + 1];
      this.rHistory[i] = this.rHistory[i + 1];
    }
    this.voltageHistory[this.historyLength - 1] = vm;
    this.uHistory[this.historyLength - 1] = u_rel;
    this.rHistory[this.historyLength - 1] = r_pool;

    if (isSpike) {
      this.spikeMarkers.push(this.historyLength - 1);
    }
    for (let j = this.spikeMarkers.length - 1; j >= 0; j--) {
      this.spikeMarkers[j]--;
      if (this.spikeMarkers[j] < 0) this.spikeMarkers.splice(j, 1);
    }
  }

  updateRingState(ringArr) {
    if (ringArr && ringArr.length === 16) {
      this.ringState.set(ringArr);
    }
  }

  render(metrics = {}) {
    const { width, height } = this.canvas;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    if (this.mode === 'TRACE') {
      this.renderTrace(width, height, ctx);
    } else if (this.mode === 'MATRIX') {
      this.renderMatrix(width, height, ctx, metrics);
    } else if (this.mode === 'STF') {
      this.renderSTF(width, height, ctx);
    }
  }

  renderTrace(width, height, ctx) {
    // 1. Oscilloscope Grid Lines (Laboratory CRT Green/Cyan aesthetic)
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 0; y < height; y += height / 4) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    for (let x = 0; x < width; x += width / 8) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    ctx.stroke();

    // 2. Voltage Scale Mapping (-90mV -> height, +35mV -> 0)
    const vMin = -90.0;
    const vMax = 35.0;
    const getY = (v) => height - ((v - vMin) / (vMax - vMin)) * height;

    // Threshold Line (-38mV)
    const threshY = getY(-38.0);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, threshY);
    ctx.lineTo(width, threshY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.font = '10px monospace';
    ctx.fillText('GF THRESHOLD (-38mV)', 8, threshY - 4);

    // 3. Draw Giant Fiber Membrane Potential Trace
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2 * (window.devicePixelRatio || 1);
    ctx.beginPath();
    for (let i = 0; i < this.historyLength; i++) {
      const x = (i / (this.historyLength - 1)) * width;
      const y = getY(this.voltageHistory[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 4. Action Potential High-Voltage Spike Highlights
    for (const markerX of this.spikeMarkers) {
      const x = (markerX / (this.historyLength - 1)) * width;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.fillRect(x - 3, 0, 6, height);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // 5. Mini Polar Compass (Central Complex 16-Column Ring Attractor)
    const compassRadius = 22 * (window.devicePixelRatio || 1);
    const compassCenterX = width - compassRadius - 16;
    const compassCenterY = compassRadius + 14;

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.beginPath();
    ctx.arc(compassCenterX, compassCenterY, compassRadius, 0, 2 * Math.PI);
    ctx.stroke();

    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * 2 * Math.PI;
      const val = this.ringState[i] || 0.1;
      const barLen = compassRadius * val;
      const bx = compassCenterX + Math.cos(angle) * barLen;
      const by = compassCenterY + Math.sin(angle) * barLen;

      ctx.strokeStyle = val > 0.5 ? '#10b981' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(compassCenterX, compassCenterY);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
  }

  renderMatrix(width, height, ctx, metrics) {
    const n = 7;
    const dpr = window.devicePixelRatio || 1;
    const padX = 58 * dpr;
    const padY = 22 * dpr;
    const gridW = width - padX - 16 * dpr;
    const gridH = height - padY - 8 * dpr;
    const cellW = gridW / n;
    const cellH = gridH / n;

    ctx.font = `${Math.max(9, Math.floor(9 * dpr))}px monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // Rows
    for (let r = 0; r < n; r++) {
      const y = padY + r * cellH + cellH / 2;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(this.circuitLabels[r], padX - 6 * dpr, y);

      for (let c = 0; c < n; c++) {
        const x = padX + c * cellW;
        const cellY = padY + r * cellH;
        const w = this.synapticMatrix[r][c];

        // Cell background
        if (w > 0) {
          ctx.fillStyle = `rgba(16, 185, 129, ${Math.min(0.7, 0.15 + w * 0.02)})`;
        } else if (w < 0) {
          ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.7, 0.15 + Math.abs(w) * 0.025)})`;
        } else {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
        }
        ctx.fillRect(x + 1, cellY + 1, cellW - 2, cellH - 2);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.strokeRect(x + 1, cellY + 1, cellW - 2, cellH - 2);

        // Weight text
        if (w !== 0) {
          ctx.textAlign = 'center';
          ctx.fillStyle = w > 0 ? '#6ee7b7' : '#fca5a5';
          ctx.fillText((w > 0 ? '+' : '') + w, x + cellW / 2, cellY + cellH / 2);
          ctx.textAlign = 'right';
        }
      }
    }

    // Top Column Headers
    ctx.textAlign = 'center';
    ctx.fillStyle = '#38bdf8';
    for (let c = 0; c < n; c++) {
      const x = padX + c * cellW + cellW / 2;
      ctx.fillText(this.circuitLabels[c], x, padY - 8 * dpr);
    }
  }

  renderSTF(width, height, ctx) {
    const dpr = window.devicePixelRatio || 1;
    // Tsodyks-Markram Dual-Trace (u_rel and R_pool)
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 0; y < height; y += height / 4) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    const getU_Y = (u) => height - (u * 0.82 + 0.08) * height;
    const getR_Y = (r) => height - (r * 0.82 + 0.08) * height;

    // Legend
    ctx.font = `${Math.max(10, Math.floor(10 * dpr))}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('— u_rel (Release Prob, tau_facil=200ms)', 12 * dpr, 16 * dpr);
    ctx.fillStyle = '#10b981';
    ctx.fillText('— R_pool (Vesicle Availability, tau_rec=800ms)', 12 * dpr, 30 * dpr);

    // Cyan curve for u_rel
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    for (let i = 0; i < this.historyLength; i++) {
      const x = (i / (this.historyLength - 1)) * width;
      const y = getU_Y(this.uHistory[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Emerald curve for R_pool
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    for (let i = 0; i < this.historyLength; i++) {
      const x = (i / (this.historyLength - 1)) * width;
      const y = getR_Y(this.rHistory[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

if (typeof window !== 'undefined') {
  window.TelemetryHUD = TelemetryHUD;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TelemetryHUD;
}
