// Spice Panel - full-screen layout for the Spice polyrhythmic synth

class SpicePanel {
  constructor(synth, master) {
    this.synth = synth;
    this.master = master;
    this.controls = [];
    this.color = '#b84aff';
  }

  buildLayout(area, s) {
    this.controls = [];
    const { w, h } = area;
    const cx = w / 2;
    const knobR = 26 * s;
    const knobSmR = 21 * s;
    const rowH = 58 * s;
    const sp3 = Math.min(105 * s, (w - 20 * s) / 3.2);
    const sp4 = Math.min(78 * s, (w - 20 * s) / 4.5);
    const sp5 = Math.min(60 * s, (w - 20 * s) / 5.5);

    let y = 46 * s;

    // Row 1: VCO1 - Freq, Shape, Level
    this._knob('vco1.frequency', 'VCO1 FRQ', cx - sp3, y, knobR, 20, 2000, 'log');
    this._switch('vco1.shape', 'SHAPE', cx, y, ['SQR', 'SAW'], 50 * s);
    this._knob('vco1.level', 'VCO1 LVL', cx + sp3, y, knobSmR, 0, 1);

    y += rowH;
    // Row 2: Sub 1A, Sub 1B (VCO1's subs)
    this._stepped('sub.0.division', 'SUB 1A', cx - sp4 * 1.5, y, 18 * s, 1, 16);
    this._knob('sub.0.level', 'S1A LVL', cx - sp4 * 0.5, y, knobSmR * 0.85, 0, 1);
    this._stepped('sub.1.division', 'SUB 1B', cx + sp4 * 0.5, y, 18 * s, 1, 16);
    this._knob('sub.1.level', 'S1B LVL', cx + sp4 * 1.5, y, knobSmR * 0.85, 0, 1);

    y += rowH;
    // Row 3: VCO2 - Freq, Shape, Level
    this._knob('vco2.frequency', 'VCO2 FRQ', cx - sp3, y, knobR, 20, 2000, 'log');
    this._switch('vco2.shape', 'SHAPE', cx, y, ['SQR', 'SAW'], 50 * s);
    this._knob('vco2.level', 'VCO2 LVL', cx + sp3, y, knobSmR, 0, 1);

    y += rowH;
    // Row 4: Sub 2A, Sub 2B (VCO2's subs)
    this._stepped('sub.2.division', 'SUB 2A', cx - sp4 * 1.5, y, 18 * s, 1, 16);
    this._knob('sub.2.level', 'S2A LVL', cx - sp4 * 0.5, y, knobSmR * 0.85, 0, 1);
    this._stepped('sub.3.division', 'SUB 2B', cx + sp4 * 0.5, y, 18 * s, 1, 16);
    this._knob('sub.3.level', 'S2B LVL', cx + sp4 * 1.5, y, knobSmR * 0.85, 0, 1);

    y += rowH;
    // Row 5: Filter + Filter EG
    this._knob('vcf.cutoff', 'CUTOFF', cx - sp5 * 2, y, knobR, 20, 18000, 'log');
    this._knob('vcf.resonance', 'RESO', cx - sp5, y, knobSmR, 0, 1);
    this._knob('vcfEg.attack', 'F.ATK', cx, y, knobSmR * 0.85, 0.001, 2, 'log');
    this._knob('vcfEg.decay', 'F.DEC', cx + sp5, y, knobSmR * 0.85, 0.01, 3, 'log');
    this._knob('vcfEg.amount', 'F.AMT', cx + sp5 * 2, y, knobSmR * 0.85, 0, 1);

    y += rowH;
    // Row 6: VCA EG + Volume + Tempo
    this._knob('vcaEg.attack', 'V.ATK', cx - sp5 * 2, y, knobSmR * 0.85, 0.001, 2, 'log');
    this._knob('vcaEg.decay', 'V.DEC', cx - sp5, y, knobSmR * 0.85, 0.01, 3, 'log');
    this._knob('volume', 'VOLUME', cx, y, knobSmR, 0, 1);
    this._knob('tempo', 'TEMPO', cx + sp5, y, knobSmR, 40, 300);
    this._button('running', 'RUN', cx + sp5 * 2, y);

    y += rowH * 0.8;
    // Sequencer 1: 4 steps
    const stepSize = Math.min(30 * s, (w - 40 * s) / 9);
    const seq1X = cx - stepSize * 3;
    for (let i = 0; i < 4; i++) {
      this.controls.push({
        type: 'seqStep',
        path: `seq1.steps.${i}`,
        index: i, seq: 1,
        x: seq1X + i * stepSize,
        y: y,
        size: stepSize * 0.85,
        note: this.synth.state.seq1.steps[i],
      });
    }

    // Sequencer 2: 4 steps
    const seq2X = cx + stepSize * 0.5;
    for (let i = 0; i < 4; i++) {
      this.controls.push({
        type: 'seqStep',
        path: `seq2.steps.${i}`,
        index: i, seq: 2,
        x: seq2X + i * stepSize,
        y: y,
        size: stepSize * 0.85,
        note: this.synth.state.seq2.steps[i],
      });
    }

    y += stepSize + 8 * s;
    // Rhythm dividers: 4 stepped selectors
    const rSpacing = Math.min(stepSize * 1.5, (w - 60 * s) / 4);
    const rX = cx - rSpacing * 1.5;
    for (let i = 0; i < 4; i++) {
      this._stepped(`rhythm.${i}.division`, `R${i + 1}`, rX + i * rSpacing, y, 16 * s, 1, 16);
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
    const maps = {
      'vco1.shape': ['square', 'sawtooth'],
      'vco2.shape': ['square', 'sawtooth'],
    };
    let value = (maps[path] || []).indexOf(val);
    if (value < 0) value = 0;
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

  _stepped(path, label, x, y, r, min, max) {
    this.controls.push({
      type: 'stepped', path, label, x, y, r, min, max,
      value: this.synth._getStatePath(path),
    });
  }

  render(ctx, area, s, ui) {
    const { w } = area;

    // Title
    ctx.fillStyle = this.color;
    ctx.font = `bold ${13 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'left';
    ctx.fillText('SPICE', 10 * s, 16 * s);
    ctx.fillStyle = '#888888';
    ctx.font = `${9 * s}px 'Courier New', monospace`;
    ctx.fillText('POLYRHYTHMIC SYNTH', 10 * s, 28 * s);

    // Waveform
    UIControls.renderWaveform(ctx, {
      x: w / 2 - 80 * s, y: 4 * s, w: 160 * s, h: 28 * s
    }, this.master.getWaveformData(), this.color, s);

    // Seq labels
    const seqSteps = ui.seqSteps.spice;

    for (const ctrl of this.controls) {
      if (ctrl.type === 'knob') {
        UIControls.renderKnob(ctx, ctrl, this.color, s);
      } else if (ctrl.type === 'switch') {
        UIControls.renderSwitch(ctx, ctrl, this.color, s);
      } else if (ctrl.type === 'button') {
        UIControls.renderButton(ctx, ctrl, this.color, s);
      } else if (ctrl.type === 'stepped') {
        UIControls.renderStepped(ctx, ctrl, this.color, s);
      } else if (ctrl.type === 'seqStep') {
        let isActive = false;
        if (ctrl.seq === 1) isActive = (seqSteps.seq1Step === ctrl.index);
        if (ctrl.seq === 2) isActive = (seqSteps.seq2Step === ctrl.index);
        UIControls.renderSeqStep(ctx, ctrl, isActive, this.color, s);
      }
    }

    // Seq section labels
    ctx.fillStyle = this.color + '60';
    ctx.font = `${7 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    // Find first seq step to position labels
    const firstSeq1 = this.controls.find(c => c.type === 'seqStep' && c.seq === 1);
    const firstSeq2 = this.controls.find(c => c.type === 'seqStep' && c.seq === 2);
    if (firstSeq1) ctx.fillText('SEQ 1 → VCO1', firstSeq1.x + 40 * s, firstSeq1.y - 14 * s);
    if (firstSeq2) ctx.fillText('SEQ 2 → VCO2', firstSeq2.x + 40 * s, firstSeq2.y - 14 * s);
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
        ui.broadcastParam('spice', ctrl.path, ctrl.active);
        return;
      }
      if (ctrl.type === 'stepped') {
        // Cycle up
        ctrl.value = ctrl.value >= ctrl.max ? ctrl.min : ctrl.value + 1;
        this.synth.setParam(ctrl.path, ctrl.value);
        ui.broadcastParam('spice', ctrl.path, ctrl.value);
        return;
      }
      if (ctrl.type === 'seqStep') {
        ctrl.note = ((ctrl.note - 48 + 1) % 37) + 48;
        const seqKey = ctrl.seq === 1 ? 'seq1' : 'seq2';
        this.synth.state[seqKey].steps[ctrl.index] = ctrl.note;
        this.synth._notify(`${seqKey}.steps.${ctrl.index}`, ctrl.note);
        ui.broadcastParam('spice', `${seqKey}.steps.${ctrl.index}`, ctrl.note);
        return;
      }
    }
  }

  onPointerMove(x, y, ui) {
    if (!ui.dragging || ui.dragging.panel !== this) return;
    const ctrl = ui.dragging.control;
    if (ctrl.type !== 'knob') return;

    const dy = ui.dragging.startY - y;
    const startAngle = UIControls.valueToAngle(ui.dragging.startValue, ctrl.min, ctrl.max, ctrl.scale);
    const newAngle = Math.max(-Math.PI * 0.75, Math.min(Math.PI * 0.75, startAngle + dy * 0.004));
    ctrl.value = UIControls.angleToValue(newAngle, ctrl.min, ctrl.max, ctrl.scale);
    this.synth.setParam(ctrl.path, ctrl.value);
    ui.broadcastParam('spice', ctrl.path, ctrl.value);
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
        ui.broadcastParam('spice', ctrl.path, ctrl.value);
        return;
      }
      if (ctrl.type === 'stepped') {
        const dir = deltaY < 0 ? 1 : -1;
        ctrl.value = Math.max(ctrl.min, Math.min(ctrl.max, ctrl.value + dir));
        this.synth.setParam(ctrl.path, ctrl.value);
        ui.broadcastParam('spice', ctrl.path, ctrl.value);
        return;
      }
      if (ctrl.type === 'seqStep') {
        const dir = deltaY < 0 ? 1 : -1;
        ctrl.note = Math.max(36, Math.min(84, ctrl.note + dir));
        const seqKey = ctrl.seq === 1 ? 'seq1' : 'seq2';
        this.synth.state[seqKey].steps[ctrl.index] = ctrl.note;
        this.synth._notify(`${seqKey}.steps.${ctrl.index}`, ctrl.note);
        ui.broadcastParam('spice', `${seqKey}.steps.${ctrl.index}`, ctrl.note);
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
    if (ctrl.type === 'stepped') return UIControls.hitTestStepped(x, y, ctrl);
    if (ctrl.type === 'seqStep') return UIControls.hitTestSeqStep(x, y, ctrl);
    return false;
  }

  _applySwitch(ctrl, ui) {
    const maps = {
      'vco1.shape': ['square', 'sawtooth'],
      'vco2.shape': ['square', 'sawtooth'],
    };
    const map = maps[ctrl.path];
    if (map) {
      const val = map[ctrl.value];
      this.synth.setParam(ctrl.path, val);
      ui.broadcastParam('spice', ctrl.path, val);
    }
  }

  syncFromState() {
    for (const ctrl of this.controls) {
      if (ctrl.type === 'knob') {
        ctrl.value = this.synth._getStatePath(ctrl.path);
      } else if (ctrl.type === 'stepped') {
        ctrl.value = this.synth._getStatePath(ctrl.path);
      } else if (ctrl.type === 'seqStep') {
        const seqKey = ctrl.seq === 1 ? 'seq1' : 'seq2';
        ctrl.note = this.synth.state[seqKey].steps[ctrl.index];
      } else if (ctrl.type === 'button') {
        ctrl.active = this.synth._getStatePath(ctrl.path);
      } else if (ctrl.type === 'switch') {
        const val = this.synth._getStatePath(ctrl.path);
        const maps = { 'vco1.shape': ['square', 'sawtooth'], 'vco2.shape': ['square', 'sawtooth'] };
        const map = maps[ctrl.path];
        if (map) ctrl.value = map.indexOf(val);
      }
    }
  }
}
