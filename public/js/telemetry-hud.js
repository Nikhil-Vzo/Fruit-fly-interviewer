/**
 * Telemetry HUD & Multi-Channel Laboratory Oscilloscope
 * Renders high-frequency biophysical membrane potentials, action potentials,
 * and 16-channel Central Complex polar attractor at 60 FPS.
 */

class TelemetryHUD {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.historyLength = 220;
    this.voltageHistory = new Float32Array(this.historyLength).fill(-70.0);
    this.spikeMarkers = [];
    this.ringState = new Float32Array(16).fill(0.1);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = this.canvas.clientWidth * (window.devicePixelRatio || 1);
    this.canvas.height = this.canvas.clientHeight * (window.devicePixelRatio || 1);
  }

  pushVoltage(vm, isSpike) {
    for (let i = 0; i < this.historyLength - 1; i++) {
      this.voltageHistory[i] = this.voltageHistory[i + 1];
    }
    this.voltageHistory[this.historyLength - 1] = vm;

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
    const compassRadius = 24 * (window.devicePixelRatio || 1);
    const compassCenterX = width - compassRadius - 16;
    const compassCenterY = compassRadius + 16;

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
}

if (typeof window !== 'undefined') {
  window.TelemetryHUD = TelemetryHUD;
}
