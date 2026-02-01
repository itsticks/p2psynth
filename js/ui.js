// Moog Mother Canvas UI
// Renders knobs, switches, patch points, sequencer, and waveform display

class MoogUI {
  constructor(canvas, synth, network) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.synth = synth;
    this.network = network;
    this.controls = [];
    this.patchPoints = [];
    this.patchCables = [];
    this.activePatchStart = null;
    this.dragging = null;
    this.mousePos = { x: 0, y: 0 };
    this.mySection = -1; // -1 = not assigned, 0=osc, 1=filter, 2=seq
    this.sectionColors = ['#ff6b4a', '#4af0ff', '#b84aff'];
    this.sectionNames = ['OSCILLATOR', 'FILTER / AMP', 'SEQ / MOD'];
    this.playerNames = ['', '', ''];
    this.sequencerStep = -1;
    this.keyboardOctave = 3;
    this.showHelp = true;
    this.helpTimer = null;

    // Colors - Moog Mother aesthetic
    this.colors = {
      bg: '#1a1a1a',
      panel: '#2a2a2a',
      panelLight: '#333333',
      accent: '#d4a44c',    // warm gold
      accentDim: '#8a6a2c',
      text: '#cccccc',
      textBright: '#ffffff',
      knobBg: '#111111',
      knobFg: '#3a3a3a',
      knobPointer: '#d4a44c',
      patchHole: '#0a0a0a',
      patchRing: '#555555',
      cable1: '#ff4444',
      cable2: '#44ff44',
      cable3: '#4488ff',
      cable4: '#ffaa00',
      sectionOsc: '#ff6b4a',
      sectionFilter: '#4af0ff',
      sectionSeq: '#b84aff',
      seqActive: '#ff6b4a',
      seqInactive: '#3a3a3a',
      waveform: '#44ff88',
    };

    this.layout = {};
    this._buildLayout();
    this._bindEvents();

    // Auto-hide help
    this.helpTimer = setTimeout(() => { this.showHelp = false; }, 8000);
  }

  _buildLayout() {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Responsive sizing
    const isPortrait = h > w;
    this.scale = Math.min(w / 900, h / 700);
    if (isPortrait) {
      this.scale = Math.min(w / 500, h / 1200);
    }

    const s = this.scale;
    const pad = 15 * s;

    this.layout = { w, h, s, pad, isPortrait };

    // Clear existing controls
    this.controls = [];
    this.patchPoints = [];

    if (isPortrait) {
      this._buildPortraitLayout(s, pad);
    } else {
      this._buildLandscapeLayout(s, pad);
    }
  }

  _buildLandscapeLayout(s, pad) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Three sections side by side
    const sectionW = (w - pad * 4) / 3;
    const headerH = 50 * s;
    const topY = headerH + pad;

    // Waveform display at top center
    this.layout.waveformRect = {
      x: w / 2 - 120 * s,
      y: 5 * s,
      w: 240 * s,
      h: 40 * s,
    };

    // Section areas
    for (let i = 0; i < 3; i++) {
      const sx = pad + i * (sectionW + pad);

      this.layout[`section${i}`] = {
        x: sx, y: topY, w: sectionW, h: h - topY - pad,
      };
    }

    const knobR = 22 * s;
    const knobSpaceX = 70 * s;
    const knobSpaceY = 80 * s;

    // === Section 0: Oscillator ===
    const s0 = this.layout.section0;
    const s0cx = s0.x + s0.w / 2;
    let y0 = s0.y + 40 * s;

    this._addKnob('vco_freq', 'FREQ', s0cx - knobSpaceX * 0.7, y0, knobR, 20, 2000, this.synth.state.vco.frequency, 0, 'log');
    this._addKnob('vco_pw', 'PULSE W', s0cx + knobSpaceX * 0.7, y0, knobR, 0.01, 0.99, this.synth.state.vco.pulseWidth, 0);

    y0 += knobSpaceY;
    this._addKnob('vco_sub', 'SUB', s0cx - knobSpaceX * 0.7, y0, knobR * 0.8, 0, 1, this.synth.state.vco.subOscLevel, 0);
    this._addKnob('vco_noise', 'NOISE', s0cx + knobSpaceX * 0.7, y0, knobR * 0.8, 0, 1, this.synth.state.vco.noiseLevel, 0);

    y0 += knobSpaceY * 0.9;
    this._addSwitch('vco_wave', 'WAVE', s0cx, y0, ['SAW', 'SQR', 'TRI'], 0, 0);

    y0 += knobSpaceY * 0.7;
    this._addKnob('vco_glide', 'GLIDE', s0cx, y0, knobR * 0.8, 0, 1, this.synth.state.vco.glide, 0);

    // === Section 1: Filter / Amp ===
    const s1 = this.layout.section1;
    const s1cx = s1.x + s1.w / 2;
    let y1 = s1.y + 40 * s;

    this._addKnob('vcf_cutoff', 'CUTOFF', s1cx - knobSpaceX * 0.7, y1, knobR, 20, 18000, this.synth.state.vcf.cutoff, 1, 'log');
    this._addKnob('vcf_res', 'RESO', s1cx + knobSpaceX * 0.7, y1, knobR, 0, 1, this.synth.state.vcf.resonance, 1);

    y1 += knobSpaceY;
    this._addKnob('vcf_env', 'ENV AMT', s1cx - knobSpaceX * 0.7, y1, knobR * 0.8, 0, 1, this.synth.state.vcf.envAmount, 1);
    this._addKnob('vca_level', 'VOLUME', s1cx + knobSpaceX * 0.7, y1, knobR * 0.8, 0, 1, this.synth.state.vca.level, 1);

    y1 += knobSpaceY;
    this._addKnob('env_attack', 'ATTACK', s1cx - knobSpaceX, y1, knobR * 0.7, 0.001, 2, this.synth.state.env.attack, 1, 'log');
    this._addKnob('env_decay', 'DECAY', s1cx - knobSpaceX / 3, y1, knobR * 0.7, 0.01, 3, this.synth.state.env.decay, 1, 'log');
    this._addKnob('env_sustain', 'SUSTAIN', s1cx + knobSpaceX / 3, y1, knobR * 0.7, 0, 1, this.synth.state.env.sustain, 1);
    this._addKnob('env_release', 'RELEASE', s1cx + knobSpaceX, y1, knobR * 0.7, 0.01, 5, this.synth.state.env.release, 1, 'log');

    // === Section 2: Sequencer / Mod ===
    const s2 = this.layout.section2;
    const s2cx = s2.x + s2.w / 2;
    let y2 = s2.y + 40 * s;

    this._addKnob('lfo_rate', 'LFO RATE', s2cx - knobSpaceX * 0.7, y2, knobR, 0.1, 30, this.synth.state.lfo.rate, 2, 'log');
    this._addKnob('lfo_amt', 'LFO AMT', s2cx + knobSpaceX * 0.7, y2, knobR, 0, 1, this.synth.state.lfo.amount, 2);

    y2 += knobSpaceY;
    this._addSwitch('lfo_wave', 'LFO WAVE', s2cx, y2, ['TRI', 'SQR', 'SAW'], 0, 2);

    y2 += knobSpaceY * 0.7;
    this._addKnob('seq_tempo', 'TEMPO', s2cx - knobSpaceX * 0.7, y2, knobR * 0.8, 40, 300, this.synth.state.seq.tempo, 2);
    this._addKnob('seq_gate', 'GATE LEN', s2cx + knobSpaceX * 0.7, y2, knobR * 0.8, 0.05, 0.95, this.synth.state.seq.gateLength, 2);

    y2 += knobSpaceY * 0.8;
    this._addButton('seq_run', 'RUN / STOP', s2cx, y2, 2);

    // === Sequencer steps (at bottom of section 2) ===
    y2 += knobSpaceY * 0.6;
    const stepW = Math.min(25 * s, (s2.w - 20 * s) / 8);
    const stepStartX = s2cx - (stepW * 8) / 2 + stepW / 2;
    for (let i = 0; i < 8; i++) {
      this._addSeqStep(i, stepStartX + i * stepW, y2, stepW * 0.8, 2);
    }

    // === Patch Bay (bottom area) ===
    const patchY = Math.max(y0, y1, y2) + knobSpaceY * 0.8;
    this._buildPatchBay(pad, patchY, s);

    // === Keyboard (very bottom) ===
    this.layout.keyboardY = this.canvas.height - 65 * s;
    this.layout.keyboardH = 55 * s;
  }

  _buildPortraitLayout(s, pad) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Three sections stacked
    const sectionH = (h - pad * 6) / 4; // 3 sections + keyboard/patch
    const headerH = 40 * s;

    this.layout.waveformRect = {
      x: w / 2 - 100 * s,
      y: 5 * s,
      w: 200 * s,
      h: 30 * s,
    };

    const knobR = 20 * s;
    const knobSpaceX = 65 * s;
    const knobSpaceY = 65 * s;

    // Similar layout but stacked vertically - simplified for mobile
    let cy = headerH + pad;

    // Section 0: Oscillator
    this.layout.section0 = { x: pad, y: cy, w: w - pad * 2, h: sectionH };
    const s0cx = w / 2;
    let y0 = cy + 30 * s;

    this._addKnob('vco_freq', 'FREQ', s0cx - knobSpaceX, y0, knobR, 20, 2000, this.synth.state.vco.frequency, 0, 'log');
    this._addKnob('vco_pw', 'PW', s0cx, y0, knobR, 0.01, 0.99, this.synth.state.vco.pulseWidth, 0);
    this._addKnob('vco_sub', 'SUB', s0cx + knobSpaceX, y0, knobR * 0.7, 0, 1, this.synth.state.vco.subOscLevel, 0);

    y0 += knobSpaceY * 0.8;
    this._addSwitch('vco_wave', 'WAVE', s0cx - knobSpaceX * 0.5, y0, ['SAW', 'SQR', 'TRI'], 0, 0);
    this._addKnob('vco_glide', 'GLIDE', s0cx + knobSpaceX * 0.5, y0, knobR * 0.7, 0, 1, this.synth.state.vco.glide, 0);

    cy += sectionH + pad * 0.5;

    // Section 1: Filter
    this.layout.section1 = { x: pad, y: cy, w: w - pad * 2, h: sectionH };
    const s1cx = w / 2;
    let y1 = cy + 30 * s;

    this._addKnob('vcf_cutoff', 'CUTOFF', s1cx - knobSpaceX, y1, knobR, 20, 18000, this.synth.state.vcf.cutoff, 1, 'log');
    this._addKnob('vcf_res', 'RESO', s1cx, y1, knobR, 0, 1, this.synth.state.vcf.resonance, 1);
    this._addKnob('vcf_env', 'ENV', s1cx + knobSpaceX, y1, knobR * 0.7, 0, 1, this.synth.state.vcf.envAmount, 1);

    y1 += knobSpaceY * 0.8;
    this._addKnob('env_attack', 'ATK', s1cx - knobSpaceX * 1.1, y1, knobR * 0.6, 0.001, 2, this.synth.state.env.attack, 1, 'log');
    this._addKnob('env_decay', 'DEC', s1cx - knobSpaceX * 0.35, y1, knobR * 0.6, 0.01, 3, this.synth.state.env.decay, 1, 'log');
    this._addKnob('env_sustain', 'SUS', s1cx + knobSpaceX * 0.35, y1, knobR * 0.6, 0, 1, this.synth.state.env.sustain, 1);
    this._addKnob('env_release', 'REL', s1cx + knobSpaceX * 1.1, y1, knobR * 0.6, 0.01, 5, this.synth.state.env.release, 1, 'log');

    cy += sectionH + pad * 0.5;

    // Section 2: Seq/Mod
    this.layout.section2 = { x: pad, y: cy, w: w - pad * 2, h: sectionH };
    const s2cx = w / 2;
    let y2 = cy + 30 * s;

    this._addKnob('lfo_rate', 'LFO', s2cx - knobSpaceX, y2, knobR, 0.1, 30, this.synth.state.lfo.rate, 2, 'log');
    this._addKnob('lfo_amt', 'AMT', s2cx, y2, knobR * 0.7, 0, 1, this.synth.state.lfo.amount, 2);
    this._addKnob('seq_tempo', 'BPM', s2cx + knobSpaceX, y2, knobR * 0.7, 40, 300, this.synth.state.seq.tempo, 2);

    y2 += knobSpaceY * 0.7;
    this._addButton('seq_run', 'RUN/STOP', s2cx - knobSpaceX * 0.5, y2, 2);
    this._addKnob('seq_gate', 'GATE', s2cx + knobSpaceX * 0.5, y2, knobR * 0.6, 0.05, 0.95, this.synth.state.seq.gateLength, 2);

    y2 += knobSpaceY * 0.6;
    const stepW = Math.min(22 * s, (w - 40 * s) / 8);
    const stepStartX = s2cx - (stepW * 8) / 2 + stepW / 2;
    for (let i = 0; i < 8; i++) {
      this._addSeqStep(i, stepStartX + i * stepW, y2, stepW * 0.8, 2);
    }

    cy += sectionH + pad * 0.5;

    // Patch bay at bottom
    this._buildPatchBay(pad, cy, s);

    this.layout.keyboardY = h - 55 * s;
    this.layout.keyboardH = 50 * s;
    this.layout.section2.h = this.layout.keyboardY - this.layout.section2.y - pad;
  }

  _addKnob(id, label, x, y, r, min, max, value, section, scale = 'linear') {
    this.controls.push({
      type: 'knob', id, label, x, y, r, min, max, value, section, scale,
      angle: this._valueToAngle(value, min, max, scale),
    });
  }

  _addSwitch(id, label, x, y, options, value, section) {
    this.controls.push({
      type: 'switch', id, label, x, y, options, value, section,
      w: 60 * this.scale, h: 25 * this.scale,
    });
  }

  _addButton(id, label, x, y, section) {
    this.controls.push({
      type: 'button', id, label, x, y, section,
      r: 18 * this.scale, active: false,
    });
  }

  _addSeqStep(index, x, y, size, section) {
    this.controls.push({
      type: 'seqStep', id: `seq_step_${index}`, index, x, y, size, section,
      note: this.synth.state.seq.steps[index],
    });
  }

  _buildPatchBay(padX, startY, s) {
    const w = this.canvas.width;
    const sources = ['LFO', 'EG', 'NOISE', 'KB CV', 'SEQ'];
    const dests = ['VCO', 'PW', 'CUTOFF', 'RES', 'VCA', 'LFO RT'];

    const totalPoints = sources.length + dests.length;
    const spacing = Math.min(50 * s, (w - padX * 2) / (totalPoints + 1));
    const patchR = 8 * s;

    // Patch bay background
    this.layout.patchBay = {
      x: padX, y: startY - 10 * s,
      w: w - padX * 2, h: 60 * s,
    };

    const srcStartX = padX + spacing;
    const srcY = startY + 10 * s;

    // Source points (top row)
    for (let i = 0; i < sources.length; i++) {
      const px = srcStartX + i * spacing;
      this.patchPoints.push({
        type: 'source', id: MoogSynth.PATCH_SOURCES[i],
        label: sources[i], x: px, y: srcY, r: patchR,
      });
    }

    // Destination points (bottom row or right side)
    const destStartX = srcStartX + sources.length * spacing + spacing;
    for (let i = 0; i < dests.length; i++) {
      const px = destStartX + i * spacing;
      this.patchPoints.push({
        type: 'dest', id: MoogSynth.PATCH_DESTS[i],
        label: dests[i], x: px, y: srcY, r: patchR,
      });
    }
  }

  _valueToAngle(value, min, max, scale) {
    let norm;
    if (scale === 'log') {
      norm = Math.log(value / min) / Math.log(max / min);
    } else {
      norm = (value - min) / (max - min);
    }
    return -Math.PI * 0.75 + norm * Math.PI * 1.5;
  }

  _angleToValue(angle, min, max, scale) {
    let norm = (angle + Math.PI * 0.75) / (Math.PI * 1.5);
    norm = Math.max(0, Math.min(1, norm));
    if (scale === 'log') {
      return min * Math.pow(max / min, norm);
    }
    return min + norm * (max - min);
  }

  // === Event Binding ===

  _bindEvents() {
    // Mouse
    this.canvas.addEventListener('mousedown', (e) => this._onPointerDown(e, e.offsetX, e.offsetY));
    this.canvas.addEventListener('mousemove', (e) => this._onPointerMove(e, e.offsetX, e.offsetY));
    this.canvas.addEventListener('mouseup', (e) => this._onPointerUp(e));
    this.canvas.addEventListener('wheel', (e) => this._onWheel(e));

    // Touch
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this._onPointerDown(e, (t.clientX - rect.left) * scaleX, (t.clientY - rect.top) * scaleY);
    }, { passive: false });
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this._onPointerMove(e, (t.clientX - rect.left) * scaleX, (t.clientY - rect.top) * scaleY);
    }, { passive: false });
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this._onPointerUp(e);
    }, { passive: false });

    // Keyboard for playing notes
    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup', (e) => this._onKeyUp(e));
  }

  _getPointerTarget(x, y) {
    // Check controls
    for (const ctrl of this.controls) {
      if (ctrl.type === 'knob') {
        const dist = Math.hypot(x - ctrl.x, y - ctrl.y);
        if (dist < ctrl.r * 1.3) return { type: 'control', control: ctrl };
      } else if (ctrl.type === 'switch') {
        if (x > ctrl.x - ctrl.w / 2 && x < ctrl.x + ctrl.w / 2 &&
            y > ctrl.y - ctrl.h / 2 && y < ctrl.y + ctrl.h / 2) {
          return { type: 'control', control: ctrl };
        }
      } else if (ctrl.type === 'button') {
        const dist = Math.hypot(x - ctrl.x, y - ctrl.y);
        if (dist < ctrl.r) return { type: 'control', control: ctrl };
      } else if (ctrl.type === 'seqStep') {
        if (Math.abs(x - ctrl.x) < ctrl.size / 2 && Math.abs(y - ctrl.y) < ctrl.size / 2) {
          return { type: 'control', control: ctrl };
        }
      }
    }

    // Check patch points
    for (const pp of this.patchPoints) {
      const dist = Math.hypot(x - pp.x, y - pp.y);
      if (dist < pp.r * 2) return { type: 'patch', point: pp };
    }

    // Check keyboard
    const key = this._getKeyAtPosition(x, y);
    if (key !== null) return { type: 'key', note: key };

    return null;
  }

  _onPointerDown(e, x, y) {
    this.showHelp = false;
    const target = this._getPointerTarget(x, y);
    if (!target) return;

    if (target.type === 'control') {
      const ctrl = target.control;

      if (ctrl.type === 'switch') {
        ctrl.value = (ctrl.value + 1) % ctrl.options.length;
        this._applyControlValue(ctrl);
        return;
      }

      if (ctrl.type === 'button') {
        ctrl.active = !ctrl.active;
        this._applyControlValue(ctrl);
        return;
      }

      if (ctrl.type === 'seqStep') {
        // Cycle note up by semitone, wrap around
        ctrl.note = ((ctrl.note - 48 + 1) % 25) + 48;
        this.synth.state.seq.steps[ctrl.index] = ctrl.note;
        this._syncState();
        return;
      }

      this.dragging = { control: ctrl, startY: y, startAngle: ctrl.angle };
    } else if (target.type === 'patch') {
      if (!this.activePatchStart) {
        // First click - select any point
        this.activePatchStart = target.point;
      } else if (this.activePatchStart.type !== target.point.type) {
        // Second click on opposite type - complete the cable
        const source = this.activePatchStart.type === 'source' ? this.activePatchStart : target.point;
        const dest = this.activePatchStart.type === 'dest' ? this.activePatchStart : target.point;
        this._addPatchCable(source, dest);
        this.activePatchStart = null;
      } else {
        // Same type clicked - restart selection
        this.activePatchStart = target.point;
      }
    } else if (target.type === 'key') {
      this.synth.init().then(() => {
        this.synth.triggerNote(target.note);
        if (this.network && this.network.connected) {
          this.network.broadcastNoteOn(target.note);
        }
      });
    }
    this.mousePos = { x, y };
  }

  _onPointerMove(e, x, y) {
    this.mousePos = { x, y };
    if (!this.dragging) return;

    const ctrl = this.dragging.control;
    if (ctrl.type === 'knob') {
      const dy = this.dragging.startY - y;
      const sensitivity = 0.005;
      const newAngle = Math.max(-Math.PI * 0.75, Math.min(Math.PI * 0.75,
        this.dragging.startAngle + dy * sensitivity));
      ctrl.angle = newAngle;
      ctrl.value = this._angleToValue(newAngle, ctrl.min, ctrl.max, ctrl.scale);
      this._applyControlValue(ctrl);
    }
  }

  _onPointerUp(e) {
    if (this.dragging) {
      this.dragging = null;
    }
    if (this.synth.noteOn && !this.synth.state.seq.running) {
      this.synth.releaseNote();
      if (this.network && this.network.connected) {
        this.network.broadcastNoteOff();
      }
    }
    // Cancel incomplete patch
    if (this.activePatchStart && !this.dragging) {
      // Keep it active for destination click
    }
  }

  _onWheel(e) {
    const target = this._getPointerTarget(e.offsetX, e.offsetY);
    if (!target || target.type !== 'control') return;
    e.preventDefault();

    const ctrl = target.control;
    if (ctrl.type === 'knob') {
      const delta = -e.deltaY * 0.002;
      const newAngle = Math.max(-Math.PI * 0.75, Math.min(Math.PI * 0.75,
        ctrl.angle + delta));
      ctrl.angle = newAngle;
      ctrl.value = this._angleToValue(newAngle, ctrl.min, ctrl.max, ctrl.scale);
      this._applyControlValue(ctrl);
    } else if (ctrl.type === 'seqStep') {
      const dir = e.deltaY < 0 ? 1 : -1;
      ctrl.note = Math.max(36, Math.min(84, ctrl.note + dir));
      this.synth.state.seq.steps[ctrl.index] = ctrl.note;
      this._syncState();
    }
  }

  // Keyboard mapping (computer keyboard -> MIDI notes)
  _keyToNote(key) {
    const map = {
      'a': 0, 'w': 1, 's': 2, 'e': 3, 'd': 4, 'f': 5, 't': 6,
      'g': 7, 'y': 8, 'h': 9, 'u': 10, 'j': 11, 'k': 12, 'o': 13, 'l': 14,
    };
    if (key in map) return map[key] + (this.keyboardOctave + 1) * 12;
    return null;
  }

  _onKeyDown(e) {
    if (e.repeat) return;

    if (e.key === 'z') { this.keyboardOctave = Math.max(1, this.keyboardOctave - 1); return; }
    if (e.key === 'x') { this.keyboardOctave = Math.min(6, this.keyboardOctave + 1); return; }

    const note = this._keyToNote(e.key);
    if (note !== null) {
      this.synth.init().then(() => {
        this.synth.triggerNote(note);
        if (this.network && this.network.connected) {
          this.network.broadcastNoteOn(note);
        }
      });
    }
  }

  _onKeyUp(e) {
    const note = this._keyToNote(e.key);
    if (note !== null) {
      this.synth.releaseNote();
      if (this.network && this.network.connected) {
        this.network.broadcastNoteOff();
      }
    }
  }

  // On-screen keyboard hit test
  _getKeyAtPosition(x, y) {
    const kbY = this.layout.keyboardY;
    const kbH = this.layout.keyboardH;
    if (!kbY || y < kbY || y > kbY + kbH) return null;

    const w = this.canvas.width;
    const pad = this.layout.pad;
    const keyW = (w - pad * 2) / 15;
    const kx = x - pad;
    if (kx < 0 || kx > 15 * keyW) return null;

    // Check black keys first (they're on top)
    const blackKeyPattern = [1, 3, -1, 6, 8, 10, -1]; // semitone positions in an octave
    const blackKeyH = kbH * 0.6;

    // Two octaves of keys
    for (let oct = 0; oct < 2; oct++) {
      const blackPositions = [0, 1, 3, 4, 5]; // C#, D#, F#, G#, A#
      const whitePositions = [0, 2, 4, 5, 7, 9, 11]; // C, D, E, F, G, A, B
      for (let b = 0; b < blackPositions.length; b++) {
        const whiteIndex = [0, 1, 3, 4, 5][b]; // white key index before each black key
        const bx = pad + (oct * 7 + whiteIndex + 0.7) * keyW;
        if (x >= bx && x <= bx + keyW * 0.6 && y >= kbY && y <= kbY + blackKeyH) {
          const semitone = [1, 3, 6, 8, 10][b];
          return (this.keyboardOctave + 1 + oct) * 12 + semitone;
        }
      }
    }

    // White keys
    const whiteKeyIndex = Math.floor(kx / keyW);
    if (whiteKeyIndex >= 0 && whiteKeyIndex < 15) {
      const oct = Math.floor(whiteKeyIndex / 7);
      const whitePos = whiteKeyIndex % 7;
      const semitones = [0, 2, 4, 5, 7, 9, 11];
      return (this.keyboardOctave + 1 + oct) * 12 + semitones[whitePos];
    }

    return null;
  }

  _applyControlValue(ctrl) {
    switch (ctrl.id) {
      case 'vco_freq': this.synth.setVCO('frequency', ctrl.value); break;
      case 'vco_pw': this.synth.setVCO('pulseWidth', ctrl.value); break;
      case 'vco_sub': this.synth.setVCO('subOscLevel', ctrl.value); break;
      case 'vco_noise': this.synth.setVCO('noiseLevel', ctrl.value); break;
      case 'vco_glide': this.synth.state.vco.glide = ctrl.value; break;
      case 'vco_wave':
        const waves = ['sawtooth', 'square', 'triangle'];
        this.synth.setVCO('waveform', waves[ctrl.value]);
        break;
      case 'vcf_cutoff': this.synth.setVCF('cutoff', ctrl.value); break;
      case 'vcf_res': this.synth.setVCF('resonance', ctrl.value); break;
      case 'vcf_env': this.synth.state.vcf.envAmount = ctrl.value; break;
      case 'vca_level': this.synth.setVCA('level', ctrl.value); break;
      case 'env_attack': this.synth.setEnv('attack', ctrl.value); break;
      case 'env_decay': this.synth.setEnv('decay', ctrl.value); break;
      case 'env_sustain': this.synth.setEnv('sustain', ctrl.value); break;
      case 'env_release': this.synth.setEnv('release', ctrl.value); break;
      case 'lfo_rate': this.synth.setLFO('rate', ctrl.value); break;
      case 'lfo_amt': this.synth.setLFO('amount', ctrl.value); break;
      case 'lfo_wave':
        const lfoWaves = ['triangle', 'square', 'sawtooth'];
        this.synth.setLFO('waveform', lfoWaves[ctrl.value]);
        break;
      case 'seq_tempo': this.synth.setSeq('tempo', ctrl.value); break;
      case 'seq_gate': this.synth.setSeq('gateLength', ctrl.value); break;
      case 'seq_run': this.synth.init().then(() => {
        this.synth.setSeq('running', ctrl.active);
      }); break;
    }
    this._syncState();
  }

  _syncState() {
    if (this.network && this.network.connected) {
      this.network.broadcastState(this.synth.getFullState());
    }
  }

  _addPatchCable(source, dest) {
    const cableColors = [this.colors.cable1, this.colors.cable2, this.colors.cable3, this.colors.cable4];
    const color = cableColors[this.patchCables.length % cableColors.length];

    // Check if patch already exists
    const existing = this.patchCables.find(c => c.source.id === source.id && c.dest.id === dest.id);
    if (existing) {
      // Remove it
      this.patchCables = this.patchCables.filter(c => c !== existing);
      this.synth.removePatch(source.id, dest.id);
    } else {
      this.patchCables.push({ source, dest, color });
      this.synth.addPatch(source.id, dest.id);
    }
    this._syncState();
  }

  // === Rendering ===

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const s = this.scale;

    // Background
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, w, h);

    // Section backgrounds
    for (let i = 0; i < 3; i++) {
      const sec = this.layout[`section${i}`];
      if (!sec) continue;

      ctx.fillStyle = this.colors.panel;
      ctx.strokeStyle = this.sectionColors[i] + '40';
      ctx.lineWidth = 2 * s;
      this._roundRect(sec.x, sec.y, sec.w, sec.h, 8 * s);
      ctx.fill();
      ctx.stroke();

      // Section header
      ctx.fillStyle = this.sectionColors[i];
      ctx.font = `bold ${12 * s}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(this.sectionNames[i], sec.x + sec.w / 2, sec.y + 18 * s);

      // Player indicator
      if (this.playerNames[i]) {
        ctx.fillStyle = this.sectionColors[i] + '80';
        ctx.font = `${9 * s}px 'Courier New', monospace`;
        ctx.fillText(this.playerNames[i], sec.x + sec.w / 2, sec.y + 30 * s);
      }

      // Highlight owned section
      if (i === this.mySection) {
        ctx.strokeStyle = this.sectionColors[i];
        ctx.lineWidth = 3 * s;
        this._roundRect(sec.x, sec.y, sec.w, sec.h, 8 * s);
        ctx.stroke();
      }
    }

    // Controls
    for (const ctrl of this.controls) {
      this._renderControl(ctx, ctrl, s);
    }

    // Patch bay
    this._renderPatchBay(ctx, s);

    // Keyboard
    this._renderKeyboard(ctx, s);

    // Waveform display
    this._renderWaveform(ctx, s);

    // Title
    ctx.fillStyle = this.colors.accent;
    ctx.font = `bold ${14 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'left';
    ctx.fillText('MOOG MOTHER', this.layout.pad, 20 * s);
    ctx.fillStyle = this.colors.text;
    ctx.font = `${10 * s}px 'Courier New', monospace`;
    ctx.fillText('P2P SYNTH', this.layout.pad, 35 * s);

    // Connection status
    const statusX = w - this.layout.pad;
    ctx.textAlign = 'right';
    if (this.network && this.network.connected) {
      ctx.fillStyle = '#44ff88';
      ctx.fillText(`${this.network.peers.length + 1} CONNECTED`, statusX, 20 * s);
      ctx.fillStyle = this.colors.text;
      ctx.fillText(`ROOM: ${this.network.roomId || '...'}`, statusX, 33 * s);
    } else {
      ctx.fillStyle = this.colors.accentDim;
      ctx.fillText('SOLO MODE', statusX, 20 * s);
    }

    // Help overlay
    if (this.showHelp) {
      this._renderHelp(ctx, s);
    }
  }

  _renderControl(ctx, ctrl, s) {
    if (ctrl.type === 'knob') this._renderKnob(ctx, ctrl, s);
    else if (ctrl.type === 'switch') this._renderSwitch(ctx, ctrl, s);
    else if (ctrl.type === 'button') this._renderButton(ctx, ctrl, s);
    else if (ctrl.type === 'seqStep') this._renderSeqStep(ctx, ctrl, s);
  }

  _renderKnob(ctx, ctrl, s) {
    const { x, y, r, angle, label } = ctrl;
    const sectionColor = this.sectionColors[ctrl.section] || this.colors.accent;

    // Knob track
    ctx.beginPath();
    ctx.arc(x, y, r + 3 * s, -Math.PI * 0.75, Math.PI * 0.75, false);
    ctx.strokeStyle = this.colors.knobBg;
    ctx.lineWidth = 4 * s;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Value arc
    ctx.beginPath();
    ctx.arc(x, y, r + 3 * s, -Math.PI * 0.75, angle, false);
    ctx.strokeStyle = sectionColor + 'cc';
    ctx.lineWidth = 3 * s;
    ctx.stroke();

    // Knob body
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    grad.addColorStop(0, '#555555');
    grad.addColorStop(1, this.colors.knobFg);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    // Pointer line
    const px = x + Math.cos(angle) * r * 0.7;
    const py = y + Math.sin(angle) * r * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(px, py);
    ctx.strokeStyle = sectionColor;
    ctx.lineWidth = 2.5 * s;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(x, y, 3 * s, 0, Math.PI * 2);
    ctx.fillStyle = sectionColor;
    ctx.fill();

    // Label
    ctx.fillStyle = this.colors.text;
    ctx.font = `${8 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + r + 14 * s);
  }

  _renderSwitch(ctx, ctrl, s) {
    const { x, y, w, h, options, value, label } = ctrl;
    const sectionColor = this.sectionColors[ctrl.section] || this.colors.accent;

    // Label
    ctx.fillStyle = this.colors.text;
    ctx.font = `${8 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - h / 2 - 5 * s);

    // Background
    ctx.fillStyle = this.colors.knobBg;
    this._roundRect(x - w / 2, y - h / 2, w, h, 4 * s);
    ctx.fill();

    // Options
    const optW = w / options.length;
    for (let i = 0; i < options.length; i++) {
      const ox = x - w / 2 + i * optW;
      if (i === value) {
        ctx.fillStyle = sectionColor + '40';
        this._roundRect(ox + 2, y - h / 2 + 2, optW - 4, h - 4, 3 * s);
        ctx.fill();
        ctx.fillStyle = sectionColor;
      } else {
        ctx.fillStyle = this.colors.text + '80';
      }
      ctx.font = `${7 * s}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(options[i], ox + optW / 2, y + 3 * s);
    }
  }

  _renderButton(ctx, ctrl, s) {
    const { x, y, r, label, active } = ctrl;
    const sectionColor = this.sectionColors[ctrl.section] || this.colors.accent;

    // Button
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = active ? sectionColor : this.colors.knobFg;
    ctx.fill();
    ctx.strokeStyle = active ? sectionColor : '#555';
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    // LED indicator
    ctx.beginPath();
    ctx.arc(x, y - r - 6 * s, 3 * s, 0, Math.PI * 2);
    ctx.fillStyle = active ? '#44ff88' : '#333333';
    ctx.fill();

    // Label
    ctx.fillStyle = active ? '#ffffff' : this.colors.text;
    ctx.font = `bold ${7 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + r + 14 * s);
  }

  _renderSeqStep(ctx, ctrl, s) {
    const { x, y, size, index, note } = ctrl;
    const isActive = this.sequencerStep === index;

    // Step box
    ctx.fillStyle = isActive ? this.colors.seqActive : this.colors.seqInactive;
    this._roundRect(x - size / 2, y - size / 2, size, size, 3 * s);
    ctx.fill();

    if (isActive) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * s;
      this._roundRect(x - size / 2, y - size / 2, size, size, 3 * s);
      ctx.stroke();
    }

    // Note name
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteName = noteNames[note % 12];
    const octave = Math.floor(note / 12) - 1;
    ctx.fillStyle = isActive ? '#ffffff' : this.colors.text;
    ctx.font = `${6 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(noteName, x, y + 1 * s);
    ctx.fillText(octave, x, y + 8 * s);
  }

  _renderPatchBay(ctx, s) {
    const pb = this.layout.patchBay;
    if (!pb) return;

    // Background
    ctx.fillStyle = '#1a1a0a';
    ctx.strokeStyle = this.colors.accent + '40';
    ctx.lineWidth = 1 * s;
    this._roundRect(pb.x, pb.y, pb.w, pb.h, 6 * s);
    ctx.fill();
    ctx.stroke();

    // Label
    ctx.fillStyle = this.colors.accent;
    ctx.font = `bold ${9 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'left';
    ctx.fillText('PATCH BAY', pb.x + 8 * s, pb.y + 12 * s);

    // Patch points
    for (const pp of this.patchPoints) {
      const isSource = pp.type === 'source';

      // Outer ring
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, pp.r + 2 * s, 0, Math.PI * 2);
      ctx.fillStyle = isSource ? '#2a2a1a' : '#1a2a2a';
      ctx.fill();
      ctx.strokeStyle = this.colors.patchRing;
      ctx.lineWidth = 1.5 * s;
      ctx.stroke();

      // Inner hole
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, pp.r * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = this.colors.patchHole;
      ctx.fill();

      // Highlight if this is the active start
      if (this.activePatchStart === pp) {
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, pp.r + 4 * s, 0, Math.PI * 2);
        ctx.strokeStyle = this.colors.cable1;
        ctx.lineWidth = 2 * s;
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = isSource ? this.colors.accent : this.colors.text;
      ctx.font = `${6 * s}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(pp.label, pp.x, pp.y + pp.r + 10 * s);

      // S/D indicator
      ctx.fillStyle = isSource ? '#ff6b4a60' : '#4af0ff60';
      ctx.font = `${5 * s}px 'Courier New', monospace`;
      ctx.fillText(isSource ? 'OUT' : 'IN', pp.x, pp.y - pp.r - 4 * s);
    }

    // Draw cables
    for (const cable of this.patchCables) {
      this._renderCable(ctx, cable, s);
    }

    // Draw in-progress cable
    if (this.activePatchStart) {
      ctx.beginPath();
      ctx.moveTo(this.activePatchStart.x, this.activePatchStart.y);

      // Catenary curve to mouse
      const mx = this.mousePos.x;
      const my = this.mousePos.y;
      const midX = (this.activePatchStart.x + mx) / 2;
      const midY = Math.max(this.activePatchStart.y, my) + 20 * s;
      ctx.quadraticCurveTo(midX, midY, mx, my);
      ctx.strokeStyle = this.colors.cable1 + '80';
      ctx.lineWidth = 3 * s;
      ctx.stroke();
    }
  }

  _renderCable(ctx, cable, s) {
    const sx = cable.source.x;
    const sy = cable.source.y;
    const dx = cable.dest.x;
    const dy = cable.dest.y;

    // Catenary-like curve
    const midX = (sx + dx) / 2;
    const sag = Math.abs(dx - sx) * 0.15 + 15 * s;
    const midY = Math.max(sy, dy) + sag;

    // Cable shadow
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(midX, midY + 2 * s, dx, dy);
    ctx.strokeStyle = '#00000060';
    ctx.lineWidth = 5 * s;
    ctx.stroke();

    // Cable
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(midX, midY, dx, dy);
    ctx.strokeStyle = cable.color;
    ctx.lineWidth = 3.5 * s;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Plugs
    ctx.beginPath();
    ctx.arc(sx, sy, 5 * s, 0, Math.PI * 2);
    ctx.fillStyle = cable.color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dx, dy, 5 * s, 0, Math.PI * 2);
    ctx.fillStyle = cable.color;
    ctx.fill();
  }

  _renderKeyboard(ctx, s) {
    const kbY = this.layout.keyboardY;
    const kbH = this.layout.keyboardH;
    if (!kbY) return;

    const w = this.canvas.width;
    const pad = this.layout.pad;
    const totalW = w - pad * 2;
    const keyW = totalW / 15;

    // Background
    ctx.fillStyle = '#111111';
    this._roundRect(pad - 4 * s, kbY - 4 * s, totalW + 8 * s, kbH + 8 * s, 6 * s);
    ctx.fill();

    // White keys
    for (let i = 0; i < 15; i++) {
      const kx = pad + i * keyW;
      ctx.fillStyle = '#eeeedd';
      ctx.strokeStyle = '#999999';
      ctx.lineWidth = 1;
      this._roundRect(kx + 1, kbY, keyW - 2, kbH - 2, 0);
      ctx.fill();
      ctx.stroke();
    }

    // Black keys
    const blackKeyH = kbH * 0.6;
    for (let oct = 0; oct < 2; oct++) {
      const blackPositions = [0, 1, 3, 4, 5]; // which white key they're after
      for (const bp of blackPositions) {
        const bx = pad + (oct * 7 + bp + 0.7) * keyW;
        ctx.fillStyle = '#222222';
        this._roundRect(bx, kbY, keyW * 0.6, blackKeyH, 0);
        ctx.fill();
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    // Octave label
    ctx.fillStyle = this.colors.text + '60';
    ctx.font = `${8 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`OCT ${this.keyboardOctave} (Z/X)`, w / 2, kbY - 6 * s);
  }

  _renderWaveform(ctx, s) {
    const rect = this.layout.waveformRect;
    if (!rect) return;

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.strokeStyle = this.colors.accent + '30';
    ctx.lineWidth = 1 * s;
    this._roundRect(rect.x, rect.y, rect.w, rect.h, 4 * s);
    ctx.fill();
    ctx.stroke();

    // Waveform data
    const data = this.synth.getWaveformData();
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
    ctx.strokeStyle = this.colors.waveform;
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();
  }

  _renderHelp(ctx, s) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = '#000000aa';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const boxW = Math.min(380 * s, w * 0.9);
    const boxH = 220 * s;

    ctx.fillStyle = '#1a1a1a';
    ctx.strokeStyle = this.colors.accent;
    ctx.lineWidth = 2 * s;
    this._roundRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, 10 * s);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = this.colors.accent;
    ctx.font = `bold ${16 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('MOOG MOTHER P2P', cx, cy - boxH / 2 + 30 * s);

    const lines = [
      'Drag knobs to adjust / scroll to fine-tune',
      'Click switches to toggle',
      'Keys A-L = play notes (Z/X = octave)',
      'Patch bay: click OUT then IN to connect',
      'Share the room code to jam with friends!',
      '',
      'Click anywhere to start',
    ];

    ctx.fillStyle = this.colors.text;
    ctx.font = `${10 * s}px 'Courier New', monospace`;
    let ly = cy - boxH / 2 + 55 * s;
    for (const line of lines) {
      ctx.fillText(line, cx, ly);
      ly += 18 * s;
    }
  }

  _roundRect(x, y, w, h, r) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
  }

  resize() {
    this._buildLayout();
  }

  // Update controls from synth state (after network sync)
  syncFromState() {
    const state = this.synth.state;
    for (const ctrl of this.controls) {
      switch (ctrl.id) {
        case 'vco_freq': ctrl.value = state.vco.frequency; break;
        case 'vco_pw': ctrl.value = state.vco.pulseWidth; break;
        case 'vco_sub': ctrl.value = state.vco.subOscLevel; break;
        case 'vco_noise': ctrl.value = state.vco.noiseLevel; break;
        case 'vco_glide': ctrl.value = state.vco.glide; break;
        case 'vco_wave':
          ctrl.value = ['sawtooth', 'square', 'triangle'].indexOf(state.vco.waveform);
          break;
        case 'vcf_cutoff': ctrl.value = state.vcf.cutoff; break;
        case 'vcf_res': ctrl.value = state.vcf.resonance; break;
        case 'vcf_env': ctrl.value = state.vcf.envAmount; break;
        case 'vca_level': ctrl.value = state.vca.level; break;
        case 'env_attack': ctrl.value = state.env.attack; break;
        case 'env_decay': ctrl.value = state.env.decay; break;
        case 'env_sustain': ctrl.value = state.env.sustain; break;
        case 'env_release': ctrl.value = state.env.release; break;
        case 'lfo_rate': ctrl.value = state.lfo.rate; break;
        case 'lfo_amt': ctrl.value = state.lfo.amount; break;
        case 'lfo_wave':
          ctrl.value = ['triangle', 'square', 'sawtooth'].indexOf(state.lfo.waveform);
          break;
        case 'seq_tempo': ctrl.value = state.seq.tempo; break;
        case 'seq_gate': ctrl.value = state.seq.gateLength; break;
        case 'seq_run': ctrl.active = state.seq.running; break;
      }
      if (ctrl.type === 'knob') {
        ctrl.angle = this._valueToAngle(ctrl.value, ctrl.min, ctrl.max, ctrl.scale);
      }
      if (ctrl.type === 'seqStep') {
        ctrl.note = state.seq.steps[ctrl.index];
      }
    }
  }
}
