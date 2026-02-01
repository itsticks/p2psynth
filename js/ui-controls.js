// Shared UI control rendering and interaction utilities
// All functions are stateless - pure render + hit-test

const UIControls = {

  // === Value/Angle Conversion ===

  valueToAngle(value, min, max, scale) {
    let norm;
    if (scale === 'log') {
      norm = Math.log(Math.max(value, min) / min) / Math.log(max / min);
    } else {
      norm = (value - min) / (max - min);
    }
    return -Math.PI * 0.75 + Math.max(0, Math.min(1, norm)) * Math.PI * 1.5;
  },

  angleToValue(angle, min, max, scale) {
    let norm = (angle + Math.PI * 0.75) / (Math.PI * 1.5);
    norm = Math.max(0, Math.min(1, norm));
    if (scale === 'log') {
      return min * Math.pow(max / min, norm);
    }
    return min + norm * (max - min);
  },

  // === Knob ===

  renderKnob(ctx, knob, color, s) {
    const { x, y, r, label } = knob;
    const angle = UIControls.valueToAngle(knob.value, knob.min, knob.max, knob.scale);

    // Track arc (background)
    ctx.beginPath();
    ctx.arc(x, y, r + 3 * s, -Math.PI * 0.75, Math.PI * 0.75, false);
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 4 * s;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Value arc
    ctx.beginPath();
    ctx.arc(x, y, r + 3 * s, -Math.PI * 0.75, angle, false);
    ctx.strokeStyle = color + 'cc';
    ctx.lineWidth = 3 * s;
    ctx.stroke();

    // Knob body
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    grad.addColorStop(0, '#555555');
    grad.addColorStop(1, '#3a3a3a');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    // Pointer
    const px = x + Math.cos(angle) * r * 0.7;
    const py = y + Math.sin(angle) * r * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(px, py);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5 * s;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(x, y, 3 * s, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Label
    ctx.fillStyle = '#cccccc';
    ctx.font = `${Math.max(8, 8 * s)}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + r + 14 * s);
  },

  hitTestKnob(x, y, knob) {
    return Math.hypot(x - knob.x, y - knob.y) < knob.r * 1.4;
  },

  // === Switch ===

  renderSwitch(ctx, sw, color, s) {
    const { x, y, w, h, options, value, label } = sw;

    // Label
    ctx.fillStyle = '#cccccc';
    ctx.font = `${Math.max(7, 7 * s)}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - h / 2 - 5 * s);

    // Background
    ctx.fillStyle = '#111111';
    UIControls.roundRect(ctx, x - w / 2, y - h / 2, w, h, 4 * s);
    ctx.fill();

    // Options
    const optW = w / options.length;
    for (let i = 0; i < options.length; i++) {
      const ox = x - w / 2 + i * optW;
      if (i === value) {
        ctx.fillStyle = color + '40';
        UIControls.roundRect(ctx, ox + 2, y - h / 2 + 2, optW - 4, h - 4, 3 * s);
        ctx.fill();
        ctx.fillStyle = color;
      } else {
        ctx.fillStyle = '#cccccc80';
      }
      ctx.font = `${Math.max(7, 7 * s)}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(options[i], ox + optW / 2, y + 3 * s);
    }
  },

  hitTestSwitch(x, y, sw) {
    return x > sw.x - sw.w / 2 && x < sw.x + sw.w / 2 &&
           y > sw.y - sw.h / 2 && y < sw.y + sw.h / 2;
  },

  // === Button ===

  renderButton(ctx, btn, color, s) {
    const { x, y, r, label, active } = btn;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = active ? color : '#3a3a3a';
    ctx.fill();
    ctx.strokeStyle = active ? color : '#555';
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    // LED
    ctx.beginPath();
    ctx.arc(x, y - r - 6 * s, 3 * s, 0, Math.PI * 2);
    ctx.fillStyle = active ? '#44ff88' : '#333333';
    ctx.fill();

    // Label
    ctx.fillStyle = active ? '#ffffff' : '#cccccc';
    ctx.font = `bold ${Math.max(7, 7 * s)}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + r + 14 * s);
  },

  hitTestButton(x, y, btn) {
    return Math.hypot(x - btn.x, y - btn.y) < btn.r * 1.3;
  },

  // === Sequencer Step ===

  renderSeqStep(ctx, step, isActive, color, s) {
    const { x, y, size, note } = step;

    ctx.fillStyle = isActive ? color : '#3a3a3a';
    UIControls.roundRect(ctx, x - size / 2, y - size / 2, size, size, 3 * s);
    ctx.fill();

    if (isActive) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * s;
      UIControls.roundRect(ctx, x - size / 2, y - size / 2, size, size, 3 * s);
      ctx.stroke();
    }

    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteName = noteNames[note % 12];
    const octave = Math.floor(note / 12) - 1;
    ctx.fillStyle = isActive ? '#ffffff' : '#cccccc';
    ctx.font = `${Math.max(6, 6 * s)}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(noteName, x, y);
    ctx.fillText(octave, x, y + 8 * s);
  },

  hitTestSeqStep(x, y, step) {
    return Math.abs(x - step.x) < step.size / 2 && Math.abs(y - step.y) < step.size / 2;
  },

  // === Stepped Selector (for sub-osc divisions, rhythm dividers) ===

  renderStepped(ctx, sel, color, s) {
    const { x, y, r, label, value, min, max } = sel;

    // Background circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#222222';
    ctx.fill();
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    // Tick marks
    const range = max - min;
    for (let i = min; i <= max; i++) {
      const norm = (i - min) / range;
      const angle = -Math.PI * 0.75 + norm * Math.PI * 1.5;
      const ix = x + Math.cos(angle) * (r + 4 * s);
      const iy = y + Math.sin(angle) * (r + 4 * s);
      ctx.beginPath();
      ctx.arc(ix, iy, 1 * s, 0, Math.PI * 2);
      ctx.fillStyle = i === value ? color : '#555555';
      ctx.fill();
    }

    // Value display
    ctx.fillStyle = color;
    ctx.font = `bold ${Math.max(10, 10 * s)}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`1/${value}`, x, y + 4 * s);

    // Label
    ctx.fillStyle = '#cccccc';
    ctx.font = `${Math.max(7, 7 * s)}px 'Courier New', monospace`;
    ctx.fillText(label, x, y + r + 12 * s);
  },

  hitTestStepped(x, y, sel) {
    return Math.hypot(x - sel.x, y - sel.y) < sel.r * 1.4;
  },

  // === Velocity Bar (for Edge sequencer) ===

  renderVelBar(ctx, bar, color, s) {
    const { x, y, w, h, value } = bar;
    const fillH = h * value;

    // Background
    ctx.fillStyle = '#1a1a1a';
    UIControls.roundRect(ctx, x - w / 2, y - h / 2, w, h, 2 * s);
    ctx.fill();

    // Fill
    ctx.fillStyle = color + '80';
    UIControls.roundRect(ctx, x - w / 2, y + h / 2 - fillH, w, fillH, 2 * s);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1 * s;
    UIControls.roundRect(ctx, x - w / 2, y - h / 2, w, h, 2 * s);
    ctx.stroke();
  },

  hitTestVelBar(x, y, bar) {
    return Math.abs(x - bar.x) < bar.w / 2 + 5 && Math.abs(y - bar.y) < bar.h / 2 + 5;
  },

  // === Keyboard ===

  renderKeyboard(ctx, kbY, kbH, canvasW, pad, octave, s) {
    const totalW = canvasW - pad * 2;
    const keyW = totalW / 15;

    // Background
    ctx.fillStyle = '#111111';
    UIControls.roundRect(ctx, pad - 4 * s, kbY - 4 * s, totalW + 8 * s, kbH + 8 * s, 6 * s);
    ctx.fill();

    // White keys
    for (let i = 0; i < 15; i++) {
      const kx = pad + i * keyW;
      ctx.fillStyle = '#eeeedd';
      ctx.strokeStyle = '#999999';
      ctx.lineWidth = 1;
      UIControls.roundRect(ctx, kx + 1, kbY, keyW - 2, kbH - 2, 0);
      ctx.fill();
      ctx.stroke();
    }

    // Black keys
    const blackKeyH = kbH * 0.6;
    for (let oct = 0; oct < 2; oct++) {
      for (const bp of [0, 1, 3, 4, 5]) {
        const bx = pad + (oct * 7 + bp + 0.7) * keyW;
        ctx.fillStyle = '#222222';
        UIControls.roundRect(ctx, bx, kbY, keyW * 0.6, blackKeyH, 0);
        ctx.fill();
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    // Octave label
    ctx.fillStyle = '#cccccc60';
    ctx.font = `${Math.max(8, 8 * s)}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`OCT ${octave} (Z/X)`, canvasW / 2, kbY - 5 * s);
  },

  getKeyAtPosition(x, y, kbY, kbH, canvasW, pad, octave) {
    if (y < kbY || y > kbY + kbH) return null;

    const totalW = canvasW - pad * 2;
    const keyW = totalW / 15;
    const kx = x - pad;
    if (kx < 0 || kx > 15 * keyW) return null;

    // Black keys first
    const blackKeyH = kbH * 0.6;
    for (let oct = 0; oct < 2; oct++) {
      const bps = [0, 1, 3, 4, 5];
      const semitones = [1, 3, 6, 8, 10];
      for (let b = 0; b < bps.length; b++) {
        const bx = pad + (oct * 7 + bps[b] + 0.7) * keyW;
        if (x >= bx && x <= bx + keyW * 0.6 && y >= kbY && y <= kbY + blackKeyH) {
          return (octave + 1 + oct) * 12 + semitones[b];
        }
      }
    }

    // White keys
    const whiteKeyIndex = Math.floor(kx / keyW);
    if (whiteKeyIndex >= 0 && whiteKeyIndex < 15) {
      const oct = Math.floor(whiteKeyIndex / 7);
      const whitePos = whiteKeyIndex % 7;
      const semitones = [0, 2, 4, 5, 7, 9, 11];
      return (octave + 1 + oct) * 12 + semitones[whitePos];
    }
    return null;
  },

  // === Waveform Scope ===

  renderWaveform(ctx, rect, data, color, s) {
    ctx.fillStyle = '#0a0a0a';
    ctx.strokeStyle = (color || '#d4a44c') + '30';
    ctx.lineWidth = 1 * s;
    UIControls.roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 4 * s);
    ctx.fill();
    ctx.stroke();

    if (!data) return;

    ctx.beginPath();
    const sliceWidth = rect.w / data.length * 4;
    let x = rect.x;
    for (let i = 0; i < data.length && x < rect.x + rect.w; i++) {
      const v = data[i] / 128.0;
      const y = rect.y + (v * rect.h) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.strokeStyle = '#44ff88';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();
  },

  // === Utility ===

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  },
};
