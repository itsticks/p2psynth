// Edge Panel - full-screen layout for the Edge percussion synth

class EdgePanel {
  constructor(synth, master) {
    this.synth = synth;
    this.master = master;
    this.controls = [];
    this.color = '#4af0ff';
  }

  buildLayout(area, s) {
    this.controls = [];
    const { w, h } = area;
    const cx = w / 2;
    const knobR = 26 * s;
    const knobSmR = 21 * s;
    const rowH = 60 * s;
    const sp3 = Math.min(105 * s, (w - 20 * s) / 3.2);
    const sp4 = Math.min(78 * s, (w - 20 * s) / 4.5);
    const sp5 = Math.min(60 * s, (w - 20 * s) / 5.5);

    let y = 46 * s;

    // Row 1: VCO1
    this._label('VCO 1');
    this._knob('vco1.frequency', 'FREQ 1', cx - sp3, y, knobR, 20, 5000, 'log');
    this._switch('vco1.shape', 'SHAPE', cx, y, ['SQR', 'TRI'], 52 * s);
    this._knob('vco1.level', 'LEVEL 1', cx + sp3, y, knobSmR, 0, 1);

    y += rowH;
    // Row 2: VCO2
    this._knob('vco2.frequency', 'FREQ 2', cx - sp3, y, knobR, 20, 5000, 'log');
    this._switch('vco2.shape', 'SHAPE', cx, y, ['SQR', 'TRI'], 52 * s);
    this._knob('vco2.level', 'LEVEL 2', cx + sp3, y, knobSmR, 0, 1);

    y += rowH;
    // Row 3: FM, Sync, Noise
    this._knob('fm.amount', 'FM AMT', cx - sp4 * 1.5, y, knobSmR, 0, 1);
    this._switch('vco2.hardSync', 'SYNC', cx - sp4 * 0.5, y, ['OFF', 'ON'], 48 * s);
    this._switch('noise.type', 'NOISE', cx + sp4 * 0.5, y, ['WHT', 'PNK'], 48 * s);
    this._knob('noise.level', 'N.LVL', cx + sp4 * 1.5, y, knobSmR, 0, 1);

    y += rowH;
    // Row 4: Filter
    this._knob('vcf.cutoff', 'CUTOFF', cx - sp3, y, knobR, 20, 18000, 'log');
    this._knob('vcf.resonance', 'RESO', cx, y, knobR, 0, 1);
    this._switch('vcf.type', 'FILT', cx + sp3, y, ['LP', 'HP'], 45 * s);

    y += rowH;
    // Row 5: Envelopes
    this._knob('pitchEg.decay', 'P.DEC', cx - sp5 * 2, y, knobSmR, 0.005, 2, 'log');
    this._knob('pitchEg.amount', 'P.AMT', cx - sp5, y, knobSmR, 0, 1);
    this._knob('filterEg.decay', 'F.DEC', cx, y, knobSmR, 0.01, 3, 'log');
    this._knob('filterEg.amount', 'F.AMT', cx + sp5, y, knobSmR, 0, 1);
    this._knob('vcaEg.decay', 'V.DEC', cx + sp5 * 2, y, knobSmR, 0.01, 5, 'log');

    y += rowH * 0.8;
    // Row 6: VCA fast/slow, Volume, Tempo, Run
    this._switch('vcaEg.fast', 'ATTACK', cx - sp4 * 1.5, y, ['SLOW', 'FAST'], 52 * s);
    this._knob('volume', 'VOLUME', cx - sp4 * 0.5, y, knobSmR, 0, 1);
    this._knob('seq.tempo', 'TEMPO', cx + sp4 * 0.5, y, knobSmR, 40, 500);
    this._button('seq.running', 'RUN', cx + sp4 * 1.5, y);

    y += rowH * 0.8;
    // Sequencer: 8 pitch steps
    const stepSize = Math.min(28 * s, (w - 30 * s) / 8.5);
    const stepsX = cx - stepSize * 3.5;
    for (let i = 0; i < 8; i++) {
      this.controls.push({
        type: 'seqStep',
        path: `seq.pitchSteps.${i}`,
        index: i,
        x: stepsX + i * stepSize,
        y: y,
        size: stepSize * 0.85,
        note: this.synth.state.seq.pitchSteps[i],
        isVel: false,
      });
    }

    // 8 velocity bars below
    y += stepSize + 5 * s;
    const barH = 32 * s;
    const barW = stepSize * 0.6;
    for (let i = 0; i < 8; i++) {
      this.controls.push({
        type: 'velBar',
        path: `seq.velSteps.${i}`,
        index: i,
        x: stepsX + i * stepSize,
        y: y,
        w: barW,
        h: barH,
        value: this.synth.state.seq.velSteps[i],
      });
    }
  }

  _knob(path, label, x, y, r, min, max, scale) {
    this.controls.push({
      type: 'knob', path, label, x, y, r, min, max,
      value: this.synth._getStatePath(path),
      scale: scale || 'linear',
    });
  }

  _switch(path, label, x, y, options, w) {
    const val = this.synth._getStatePath(path);
    let value;
    if (typeof val === 'boolean') {
      value = val ? 1 : 0;
    } else if (typeof val === 'string') {
      const maps = {
        'vco1.shape': ['square', 'triangle'],
        'vco2.shape': ['square', 'triangle'],
        'noise.type': ['white', 'pink'],
        'vcf.type': ['lowpass', 'highpass'],
      };
      value = (maps[path] || []).indexOf(val);
      if (value < 0) value = 0;
    } else {
      value = val;
    }
    this.controls.push({
      type: 'switch', path, label, x, y, options, value,
      w: w || 50, h: 22,
    });
  }

  _button(path, label, x, y) {
    this.controls.push({
      type: 'button', path, label, x, y,
      r: 15, active: this.synth._getStatePath(path),
    });
  }

  _label(text) { /* Used for section headers - rendered inline */ }

  render(ctx, area, s, ui) {
    const { w } = area;

    // Title
    ctx.fillStyle = this.color;
    ctx.font = `bold ${13 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'left';
    ctx.fillText('EDGE', 10 * s, 16 * s);
    ctx.fillStyle = '#888888';
    ctx.font = `${9 * s}px 'Courier New', monospace`;
    ctx.fillText('PERCUSSION SYNTH', 10 * s, 28 * s);

    // Waveform
    UIControls.renderWaveform(ctx, {
      x: w / 2 - 80 * s, y: 4 * s, w: 160 * s, h: 28 * s
    }, this.master.getWaveformData(), this.color, s);

    // Controls
    for (const ctrl of this.controls) {
      if (ctrl.type === 'knob') {
        UIControls.renderKnob(ctx, ctrl, this.color, s);
      } else if (ctrl.type === 'switch') {
        UIControls.renderSwitch(ctx, ctrl, this.color, s);
      } else if (ctrl.type === 'button') {
        UIControls.renderButton(ctx, ctrl, this.color, s);
      } else if (ctrl.type === 'seqStep') {
        const isActive = ui.seqSteps.edge === ctrl.index;
        UIControls.renderSeqStep(ctx, ctrl, isActive, this.color, s);
      } else if (ctrl.type === 'velBar') {
        UIControls.renderVelBar(ctx, ctrl, this.color, s);
      }
    }

    // Section divider labels
    ctx.fillStyle = this.color + '60';
    ctx.font = `${7 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'left';
    ctx.fillText('VCO 1', 10 * s, 44 * s);
  }

  onPointerDown(x, y, ui) {
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
        ui.broadcastParam('edge', ctrl.path, ctrl.active);
        return;
      }
      if (ctrl.type === 'seqStep') {
        ctrl.note = ((ctrl.note - 36 + 1) % 49) + 36;
        this.synth.state.seq.pitchSteps[ctrl.index] = ctrl.note;
        this.synth._notify(`seq.pitchSteps.${ctrl.index}`, ctrl.note);
        ui.broadcastParam('edge', `seq.pitchSteps.${ctrl.index}`, ctrl.note);
        return;
      }
      if (ctrl.type === 'velBar') {
        // Set velocity based on click position within bar
        const relY = (ctrl.y + ctrl.h / 2 - y) / ctrl.h;
        ctrl.value = Math.max(0, Math.min(1, relY));
        this.synth.state.seq.velSteps[ctrl.index] = ctrl.value;
        this.synth._notify(`seq.velSteps.${ctrl.index}`, ctrl.value);
        ui.broadcastParam('edge', `seq.velSteps.${ctrl.index}`, ctrl.value);
        ui.dragging = { panel: this, control: ctrl, startY: y, isVelBar: true };
        return;
      }
    }
  }

  onPointerMove(x, y, ui) {
    if (!ui.dragging || ui.dragging.panel !== this) return;
    const ctrl = ui.dragging.control;

    if (ctrl.type === 'knob') {
      const dy = ui.dragging.startY - y;
      const startAngle = UIControls.valueToAngle(ui.dragging.startValue, ctrl.min, ctrl.max, ctrl.scale);
      const newAngle = Math.max(-Math.PI * 0.75, Math.min(Math.PI * 0.75, startAngle + dy * 0.004));
      ctrl.value = UIControls.angleToValue(newAngle, ctrl.min, ctrl.max, ctrl.scale);
      this.synth.setParam(ctrl.path, ctrl.value);
      ui.broadcastParam('edge', ctrl.path, ctrl.value);
    }

    if (ui.dragging.isVelBar) {
      const relY = (ctrl.y + ctrl.h / 2 - y) / ctrl.h;
      ctrl.value = Math.max(0, Math.min(1, relY));
      this.synth.state.seq.velSteps[ctrl.index] = ctrl.value;
      this.synth._notify(`seq.velSteps.${ctrl.index}`, ctrl.value);
      ui.broadcastParam('edge', `seq.velSteps.${ctrl.index}`, ctrl.value);
    }
  }

  onPointerUp(ui) {}

  onWheel(x, y, deltaY, ui) {
    for (const ctrl of this.controls) {
      if (!this._hitTest(x, y, ctrl)) continue;
      if (ctrl.type === 'knob') {
        const delta = -deltaY * 0.002;
        const angle = UIControls.valueToAngle(ctrl.value, ctrl.min, ctrl.max, ctrl.scale);
        const newAngle = Math.max(-Math.PI * 0.75, Math.min(Math.PI * 0.75, angle + delta));
        ctrl.value = UIControls.angleToValue(newAngle, ctrl.min, ctrl.max, ctrl.scale);
        this.synth.setParam(ctrl.path, ctrl.value);
        ui.broadcastParam('edge', ctrl.path, ctrl.value);
        return;
      }
      if (ctrl.type === 'seqStep') {
        const dir = deltaY < 0 ? 1 : -1;
        ctrl.note = Math.max(24, Math.min(96, ctrl.note + dir));
        this.synth.state.seq.pitchSteps[ctrl.index] = ctrl.note;
        this.synth._notify(`seq.pitchSteps.${ctrl.index}`, ctrl.note);
        ui.broadcastParam('edge', `seq.pitchSteps.${ctrl.index}`, ctrl.note);
        return;
      }
    }
  }

  onKeyDown(e, ui) {}
  onKeyUp(e, ui) {}

  _hitTest(x, y, ctrl) {
    if (ctrl.type === 'knob') return UIControls.hitTestKnob(x, y, ctrl);
    if (ctrl.type === 'switch') return UIControls.hitTestSwitch(x, y, ctrl);
    if (ctrl.type === 'button') return UIControls.hitTestButton(x, y, ctrl);
    if (ctrl.type === 'seqStep') return UIControls.hitTestSeqStep(x, y, ctrl);
    if (ctrl.type === 'velBar') return UIControls.hitTestVelBar(x, y, ctrl);
    return false;
  }

  _applySwitch(ctrl, ui) {
    const maps = {
      'vco1.shape': ['square', 'triangle'],
      'vco2.shape': ['square', 'triangle'],
      'noise.type': ['white', 'pink'],
      'vcf.type': ['lowpass', 'highpass'],
      'vco2.hardSync': [false, true],
      'vcaEg.fast': [false, true],
    };
    const map = maps[ctrl.path];
    if (map) {
      const val = map[ctrl.value];
      this.synth.setParam(ctrl.path, val);
      ui.broadcastParam('edge', ctrl.path, val);
    }
  }

  syncFromState() {
    for (const ctrl of this.controls) {
      if (ctrl.type === 'knob') {
        ctrl.value = this.synth._getStatePath(ctrl.path);
      } else if (ctrl.type === 'seqStep') {
        ctrl.note = this.synth.state.seq.pitchSteps[ctrl.index];
      } else if (ctrl.type === 'velBar') {
        ctrl.value = this.synth.state.seq.velSteps[ctrl.index];
      } else if (ctrl.type === 'button') {
        ctrl.active = this.synth._getStatePath(ctrl.path);
      } else if (ctrl.type === 'switch') {
        const val = this.synth._getStatePath(ctrl.path);
        const maps = {
          'vco1.shape': ['square', 'triangle'],
          'vco2.shape': ['square', 'triangle'],
          'noise.type': ['white', 'pink'],
          'vcf.type': ['lowpass', 'highpass'],
          'vco2.hardSync': [false, true],
          'vcaEg.fast': [false, true],
        };
        const map = maps[ctrl.path];
        if (map) ctrl.value = map.indexOf(val);
      }
    }
  }
}
