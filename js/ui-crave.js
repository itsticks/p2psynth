// Crave Panel - full-screen layout for the Crave mono synth

class CravePanel {
  constructor(synth, master) {
    this.synth = synth;
    this.master = master;
    this.controls = [];
    this.keyboardOctave = 3;
    this.color = '#ff6b4a';
    this.kbY = 0;
    this.kbH = 0;
    this.pad = 0;
  }

  buildLayout(area, s) {
    this.controls = [];
    const { w, h } = area;
    const pad = 12 * s;
    this.pad = pad;
    const cx = w / 2;
    const knobR = 24 * s;
    const knobSmR = 18 * s;
    const rowH = 72 * s;

    let y = 50 * s; // below waveform

    // Row 1: VCO - FREQ, PW, MIX
    this._knob('vco.frequency', 'FREQ', cx - 90 * s, y, knobR, 20, 2000, 'log');
    this._knob('vco.pulseWidth', 'PULSE W', cx, y, knobR, 0.01, 0.99);
    this._knob('vco.mix', 'VCO/NOISE', cx + 90 * s, y, knobR, 0, 1);

    y += rowH;
    // Row 2: WAVE switch, FILTER TYPE switch, GLIDE
    this._switch('vco.waveform', 'WAVE', cx - 80 * s, y, ['SAW', 'SQR'], 55 * s);
    this._switch('vcf.type', 'FILTER', cx, y, ['LP', 'HP'], 45 * s);
    this._knob('glide', 'GLIDE', cx + 85 * s, y, knobSmR, 0, 1);

    y += rowH;
    // Row 3: CUTOFF, RESO, ENV AMT
    this._knob('vcf.cutoff', 'CUTOFF', cx - 90 * s, y, knobR, 20, 18000, 'log');
    this._knob('vcf.resonance', 'RESO', cx, y, knobR, 0, 1);
    this._knob('vcf.envAmount', 'ENV AMT', cx + 90 * s, y, knobSmR, 0, 1);

    y += rowH;
    // Row 4: ADSR
    this._knob('env.attack', 'ATK', cx - 105 * s, y, knobSmR, 0.001, 2, 'log');
    this._knob('env.decay', 'DEC', cx - 35 * s, y, knobSmR, 0.01, 3, 'log');
    this._knob('env.sustain', 'SUS', cx + 35 * s, y, knobSmR, 0, 1);
    this._switch('env.sustainOn', 'SUS ON', cx + 105 * s, y, ['OFF', 'ON'], 45 * s);

    y += rowH;
    // Row 5: LFO
    this._knob('lfo.rate', 'LFO RATE', cx - 100 * s, y, knobSmR, 0.1, 30, 'log');
    this._knob('lfo.amount', 'LFO AMT', cx - 30 * s, y, knobSmR, 0, 1);
    this._switch('lfo.waveform', 'LFO', cx + 45 * s, y, ['TRI', 'SQR'], 45 * s);
    this._switch('lfo.destination', 'DEST', cx + 110 * s, y, ['VCO', 'VCF', 'PW'], 60 * s);

    y += rowH;
    // Row 6: VCA + Volume + Seq controls
    this._switch('vca.mode', 'VCA', cx - 100 * s, y, ['ENV', 'ON'], 45 * s);
    this._knob('vca.level', 'VOLUME', cx - 35 * s, y, knobSmR, 0, 1);
    this._knob('seq.tempo', 'TEMPO', cx + 40 * s, y, knobSmR, 40, 300);
    this._knob('seq.gateLength', 'GATE', cx + 100 * s, y, knobSmR * 0.8, 0.05, 0.95);

    y += rowH * 0.7;
    // Sequencer run button
    this._button('seq.running', 'RUN/STOP', cx - 90 * s, y);

    // 16 sequencer steps in 2 rows of 8
    const stepSize = Math.min(22 * s, (w - pad * 4) / 8.5);
    const stepsStartX = cx - stepSize * 3.5;
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 8; i++) {
        const stepIdx = row * 8 + i;
        this.controls.push({
          type: 'seqStep',
          path: `seq.steps.${stepIdx}`,
          index: stepIdx,
          x: stepsStartX + i * stepSize,
          y: y + row * (stepSize + 4 * s),
          size: stepSize * 0.85,
          note: this.synth.state.seq.steps[stepIdx],
        });
      }
    }

    // Keyboard
    y += rowH + stepSize;
    this.kbY = Math.min(y, area.h - 60 * s);
    this.kbH = Math.min(55 * s, area.h - this.kbY - 5 * s);
  }

  _knob(path, label, x, y, r, min, max, scale) {
    this.controls.push({
      type: 'knob', path, label, x, y, r, min, max,
      value: this.synth._getStatePath(path),
      scale: scale || 'linear',
    });
  }

  _switch(path, label, x, y, options, w) {
    const s = this.master.ctx ? 1 : 1;
    const val = this.synth._getStatePath(path);
    let value;
    if (typeof val === 'boolean') {
      value = val ? 1 : 0;
    } else if (typeof val === 'string') {
      const map = {
        'vco.waveform': ['sawtooth', 'square'],
        'vcf.type': ['lowpass', 'highpass'],
        'lfo.waveform': ['triangle', 'square'],
        'lfo.destination': ['vco', 'vcf', 'pw'],
        'vca.mode': ['env', 'on'],
      };
      value = (map[path] || []).indexOf(val);
      if (value < 0) value = 0;
    } else {
      value = val;
    }

    this.controls.push({
      type: 'switch', path, label, x, y, options, value,
      w: w || 50, h: 22 * (w ? w / 50 : 1),
    });
  }

  _button(path, label, x, y) {
    this.controls.push({
      type: 'button', path, label, x, y,
      r: 16, active: this.synth._getStatePath(path),
    });
  }

  // === Rendering ===

  render(ctx, area, s, ui) {
    const { w, h } = area;

    // Title
    ctx.fillStyle = this.color;
    ctx.font = `bold ${13 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'left';
    ctx.fillText('CRAVE', 10 * s, 16 * s);
    ctx.fillStyle = '#888888';
    ctx.font = `${9 * s}px 'Courier New', monospace`;
    ctx.fillText('MONO SYNTH', 10 * s, 28 * s);

    // Waveform
    const wfData = this.master.getWaveformData();
    UIControls.renderWaveform(ctx, {
      x: w / 2 - 80 * s, y: 4 * s, w: 160 * s, h: 28 * s
    }, wfData, this.color, s);

    // Controls
    for (const ctrl of this.controls) {
      if (ctrl.type === 'knob') {
        UIControls.renderKnob(ctx, ctrl, this.color, s);
      } else if (ctrl.type === 'switch') {
        UIControls.renderSwitch(ctx, ctrl, this.color, s);
      } else if (ctrl.type === 'button') {
        UIControls.renderButton(ctx, ctrl, this.color, s);
      } else if (ctrl.type === 'seqStep') {
        const isActive = ui.seqSteps.crave === ctrl.index;
        UIControls.renderSeqStep(ctx, ctrl, isActive, this.color, s);
      }
    }

    // Keyboard
    if (this.kbY > 0 && this.kbH > 0) {
      UIControls.renderKeyboard(ctx, this.kbY, this.kbH, w, this.pad, this.keyboardOctave, s);
    }
  }

  // === Interaction ===

  onPointerDown(x, y, ui) {
    // Check keyboard
    if (this.kbY > 0) {
      const note = UIControls.getKeyAtPosition(x, y, this.kbY, this.kbH, ui.canvas.width, this.pad, this.keyboardOctave);
      if (note !== null) {
        this.synth.triggerNote(note);
        if (ui.network && ui.network.connected) {
          ui.network.broadcastNoteOn('crave', note);
        }
        return;
      }
    }

    // Check controls
    for (const ctrl of this.controls) {
      const hit = this._hitTest(x, y, ctrl);
      if (!hit) continue;

      if (ctrl.type === 'knob') {
        ui.dragging = { panel: this, control: ctrl, startY: y, startValue: ctrl.value };
        return;
      }
      if (ctrl.type === 'switch') {
        ctrl.value = (ctrl.value + 1) % ctrl.options.length;
        this._applySwitch(ctrl, ui);
        return;
      }
      if (ctrl.type === 'button') {
        ctrl.active = !ctrl.active;
        this.synth.setParam(ctrl.path, ctrl.active);
        ui.broadcastParam('crave', ctrl.path, ctrl.active);
        return;
      }
      if (ctrl.type === 'seqStep') {
        ctrl.note = ((ctrl.note - 48 + 1) % 37) + 48;
        this.synth.state.seq.steps[ctrl.index] = ctrl.note;
        this.synth._notify(`seq.steps.${ctrl.index}`, ctrl.note);
        ui.broadcastParam('crave', `seq.steps.${ctrl.index}`, ctrl.note);
        return;
      }
    }
  }

  onPointerMove(x, y, ui) {
    if (!ui.dragging || ui.dragging.panel !== this) return;
    const ctrl = ui.dragging.control;
    if (ctrl.type !== 'knob') return;

    const dy = ui.dragging.startY - y;
    const sensitivity = ctrl.scale === 'log' ? 0.004 : 0.004;
    const startAngle = UIControls.valueToAngle(ui.dragging.startValue, ctrl.min, ctrl.max, ctrl.scale);
    const newAngle = Math.max(-Math.PI * 0.75, Math.min(Math.PI * 0.75, startAngle + dy * sensitivity));
    ctrl.value = UIControls.angleToValue(newAngle, ctrl.min, ctrl.max, ctrl.scale);
    this.synth.setParam(ctrl.path, ctrl.value);
    ui.broadcastParam('crave', ctrl.path, ctrl.value);
  }

  onPointerUp(ui) {
    if (this.synth.noteOn && !this.synth.state.seq.running) {
      this.synth.releaseNote();
      if (ui.network && ui.network.connected) {
        ui.network.broadcastNoteOff('crave');
      }
    }
  }

  onWheel(x, y, deltaY, ui) {
    for (const ctrl of this.controls) {
      if (!this._hitTest(x, y, ctrl)) continue;
      if (ctrl.type === 'knob') {
        const delta = -deltaY * 0.002;
        const angle = UIControls.valueToAngle(ctrl.value, ctrl.min, ctrl.max, ctrl.scale);
        const newAngle = Math.max(-Math.PI * 0.75, Math.min(Math.PI * 0.75, angle + delta));
        ctrl.value = UIControls.angleToValue(newAngle, ctrl.min, ctrl.max, ctrl.scale);
        this.synth.setParam(ctrl.path, ctrl.value);
        ui.broadcastParam('crave', ctrl.path, ctrl.value);
        return;
      }
      if (ctrl.type === 'seqStep') {
        const dir = deltaY < 0 ? 1 : -1;
        ctrl.note = Math.max(36, Math.min(84, ctrl.note + dir));
        this.synth.state.seq.steps[ctrl.index] = ctrl.note;
        this.synth._notify(`seq.steps.${ctrl.index}`, ctrl.note);
        ui.broadcastParam('crave', `seq.steps.${ctrl.index}`, ctrl.note);
        return;
      }
    }
  }

  onKeyDown(e, ui) {
    if (e.key === 'z') { this.keyboardOctave = Math.max(1, this.keyboardOctave - 1); return; }
    if (e.key === 'x') { this.keyboardOctave = Math.min(6, this.keyboardOctave + 1); return; }

    const note = this._keyToNote(e.key);
    if (note !== null) {
      this.master.init().then(() => {
        this.synth.triggerNote(note);
        if (ui.network && ui.network.connected) {
          ui.network.broadcastNoteOn('crave', note);
        }
      });
    }
  }

  onKeyUp(e, ui) {
    const note = this._keyToNote(e.key);
    if (note !== null) {
      this.synth.releaseNote();
      if (ui.network && ui.network.connected) {
        ui.network.broadcastNoteOff('crave');
      }
    }
  }

  _keyToNote(key) {
    const map = {
      'a': 0, 'w': 1, 's': 2, 'e': 3, 'd': 4, 'f': 5, 't': 6,
      'g': 7, 'y': 8, 'h': 9, 'u': 10, 'j': 11, 'k': 12, 'o': 13, 'l': 14,
    };
    if (key in map) return map[key] + (this.keyboardOctave + 1) * 12;
    return null;
  }

  _hitTest(x, y, ctrl) {
    if (ctrl.type === 'knob') return UIControls.hitTestKnob(x, y, ctrl);
    if (ctrl.type === 'switch') return UIControls.hitTestSwitch(x, y, ctrl);
    if (ctrl.type === 'button') return UIControls.hitTestButton(x, y, ctrl);
    if (ctrl.type === 'seqStep') return UIControls.hitTestSeqStep(x, y, ctrl);
    return false;
  }

  _applySwitch(ctrl, ui) {
    const maps = {
      'vco.waveform': ['sawtooth', 'square'],
      'vcf.type': ['lowpass', 'highpass'],
      'lfo.waveform': ['triangle', 'square'],
      'lfo.destination': ['vco', 'vcf', 'pw'],
      'vca.mode': ['env', 'on'],
      'env.sustainOn': [false, true],
    };
    const map = maps[ctrl.path];
    if (map) {
      const val = map[ctrl.value];
      this.synth.setParam(ctrl.path, val);
      ui.broadcastParam('crave', ctrl.path, val);
    }
  }

  syncFromState() {
    const state = this.synth.state;
    for (const ctrl of this.controls) {
      const val = this.synth._getStatePath(ctrl.path);
      if (ctrl.type === 'knob') {
        ctrl.value = val;
      } else if (ctrl.type === 'switch') {
        const maps = {
          'vco.waveform': ['sawtooth', 'square'],
          'vcf.type': ['lowpass', 'highpass'],
          'lfo.waveform': ['triangle', 'square'],
          'lfo.destination': ['vco', 'vcf', 'pw'],
          'vca.mode': ['env', 'on'],
          'env.sustainOn': [false, true],
        };
        const map = maps[ctrl.path];
        if (map) ctrl.value = map.indexOf(val);
      } else if (ctrl.type === 'button') {
        ctrl.active = val;
      } else if (ctrl.type === 'seqStep') {
        ctrl.note = state.seq.steps[ctrl.index];
      }
    }
  }
}
