// Patch Bay Panel - cross-instrument patching interface

class PatchBayPanel {
  constructor(master) {
    this.master = master;
    this.patchPoints = [];
    this.activePatchStart = null;
    this.mousePos = { x: 0, y: 0 };

    this.instruments = [
      { id: 'crave', label: 'CRAVE', color: '#ff6b4a', synth: SynthCrave },
      { id: 'edge', label: 'EDGE', color: '#4af0ff', synth: SynthEdge },
      { id: 'spice', label: 'SPICE', color: '#b84aff', synth: SynthSpice },
    ];

    this.cableColors = ['#ff4444', '#44ff44', '#4488ff', '#ffaa00', '#ff44ff', '#44ffff'];
  }

  buildLayout(area, s) {
    this.patchPoints = [];
    const { w, h } = area;
    const pad = 12 * s;

    // Layout: 3 instrument sections, each with OUT row and IN row
    const sectionH = (h - pad * 2) / 3;
    const patchR = 14 * s; // bigger for easier touch targets

    for (let instIdx = 0; instIdx < this.instruments.length; instIdx++) {
      const inst = this.instruments[instIdx];
      const synthClass = inst.synth;
      const sectionY = pad + instIdx * sectionH;

      const outputs = synthClass.PATCH_OUTPUTS;
      const inputs = synthClass.PATCH_INPUTS;
      const totalPoints = Math.max(outputs.length, inputs.length);
      const spacing = Math.min(55 * s, (w - pad * 4) / (totalPoints + 1));
      const startX = pad + spacing;

      // Output row
      const outY = sectionY + 38 * s;
      for (let i = 0; i < outputs.length; i++) {
        this.patchPoints.push({
          type: 'source',
          instrument: inst.id,
          id: outputs[i].id,
          label: outputs[i].label,
          color: inst.color,
          x: startX + i * spacing,
          y: outY,
          r: patchR,
        });
      }

      // Input row
      const inY = sectionY + sectionH - 28 * s;
      for (let i = 0; i < inputs.length; i++) {
        this.patchPoints.push({
          type: 'dest',
          instrument: inst.id,
          id: inputs[i].id,
          label: inputs[i].label,
          color: inst.color,
          x: startX + i * spacing,
          y: inY,
          r: patchR,
        });
      }
    }
  }

  render(ctx, area, s, ui) {
    const { w, h } = area;
    const pad = 15 * s;

    // Title
    ctx.fillStyle = '#d4a44c';
    ctx.font = `bold ${13 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'left';
    ctx.fillText('PATCH BAY', 10 * s, 16 * s);
    ctx.fillStyle = '#888888';
    ctx.font = `${9 * s}px 'Courier New', monospace`;
    ctx.fillText('CROSS-INSTRUMENT ROUTING', 10 * s, 28 * s);

    // Instrument sections
    const sectionH = (h - pad * 2) / 3;
    for (let i = 0; i < this.instruments.length; i++) {
      const inst = this.instruments[i];
      const sectionY = pad + i * sectionH;

      // Section background
      ctx.fillStyle = '#1a1a1a';
      ctx.strokeStyle = inst.color + '30';
      ctx.lineWidth = 1 * s;
      UIControls.roundRect(ctx, pad, sectionY, w - pad * 2, sectionH - 8 * s, 6 * s);
      ctx.fill();
      ctx.stroke();

      // Instrument label
      ctx.fillStyle = inst.color;
      ctx.font = `bold ${10 * s}px 'Courier New', monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(inst.label, pad + 8 * s, sectionY + 16 * s);

      // OUT / IN labels
      ctx.fillStyle = '#666666';
      ctx.font = `${7 * s}px 'Courier New', monospace`;
      ctx.fillText('OUT ▸', pad + 8 * s, sectionY + 34 * s);
      ctx.fillText('IN ▸', pad + 8 * s, sectionY + sectionH - 36 * s);
    }

    // Patch points
    for (const pp of this.patchPoints) {
      const isSource = pp.type === 'source';

      // Ring
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, pp.r + 2 * s, 0, Math.PI * 2);
      ctx.fillStyle = isSource ? '#2a2a1a' : '#1a2a2a';
      ctx.fill();
      ctx.strokeStyle = pp.color + '80';
      ctx.lineWidth = 1.5 * s;
      ctx.stroke();

      // Hole
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, pp.r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0a';
      ctx.fill();

      // Active highlight
      if (this.activePatchStart === pp) {
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, pp.r + 5 * s, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * s;
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = pp.color;
      ctx.font = `${7 * s}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      const labelY = isSource ? pp.y + pp.r + 11 * s : pp.y - pp.r - 5 * s;
      ctx.fillText(pp.label, pp.x, labelY);
    }

    // Draw existing cables
    for (let i = 0; i < this.master.crossPatches.length; i++) {
      const patch = this.master.crossPatches[i];
      const srcPt = this.patchPoints.find(
        p => p.type === 'source' && p.instrument === patch.sourceInst && p.id === patch.sourceId
      );
      const dstPt = this.patchPoints.find(
        p => p.type === 'dest' && p.instrument === patch.destInst && p.id === patch.destId
      );
      if (srcPt && dstPt) {
        this._renderCable(ctx, srcPt, dstPt, this.cableColors[i % this.cableColors.length], s);
      }
    }

    // In-progress cable
    if (this.activePatchStart) {
      ctx.beginPath();
      ctx.moveTo(this.activePatchStart.x, this.activePatchStart.y);
      const mx = this.mousePos.x;
      const my = this.mousePos.y;
      const midX = (this.activePatchStart.x + mx) / 2;
      const sag = Math.abs(mx - this.activePatchStart.x) * 0.15 + 20 * s;
      const midY = Math.max(this.activePatchStart.y, my) + sag;
      ctx.quadraticCurveTo(midX, midY, mx, my);
      ctx.strokeStyle = '#ffffff80';
      ctx.lineWidth = 3 * s;
      ctx.stroke();
    }

    // Instructions
    if (this.master.crossPatches.length === 0 && !this.activePatchStart) {
      ctx.fillStyle = '#555555';
      ctx.font = `${9 * s}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('Tap an OUT point, then tap an IN point to connect', w / 2, h - 20 * s);
    }
  }

  _renderCable(ctx, src, dst, color, s) {
    const midX = (src.x + dst.x) / 2;
    const sag = Math.abs(dst.x - src.x) * 0.15 + 20 * s;
    const midY = Math.max(src.y, dst.y) + sag;

    // Shadow
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.quadraticCurveTo(midX, midY + 2 * s, dst.x, dst.y);
    ctx.strokeStyle = '#00000060';
    ctx.lineWidth = 5 * s;
    ctx.stroke();

    // Cable
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.quadraticCurveTo(midX, midY, dst.x, dst.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5 * s;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Plugs
    ctx.beginPath();
    ctx.arc(src.x, src.y, 5 * s, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dst.x, dst.y, 5 * s, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  onPointerDown(x, y, ui) {
    // Find closest patch point - use generous touch target
    let closestPP = null;
    let closestDist = Infinity;
    for (const pp of this.patchPoints) {
      const dist = Math.hypot(x - pp.x, y - pp.y);
      if (dist < pp.r * 2.5 && dist < closestDist) {
        closestDist = dist;
        closestPP = pp;
      }
    }

    if (closestPP) {
      const pp = closestPP;
      if (!this.activePatchStart) {
        this.activePatchStart = pp;
      } else if (this.activePatchStart === pp) {
        // Tapped same point - deselect
        this.activePatchStart = null;
      } else if (this.activePatchStart.type !== pp.type) {
        // Complete the cable (source→dest or dest→source)
        const source = this.activePatchStart.type === 'source' ? this.activePatchStart : pp;
        const dest = this.activePatchStart.type === 'dest' ? this.activePatchStart : pp;

        // Check if patch already exists - if so, remove it
        const existing = this.master.crossPatches.find(
          p => p.sourceInst === source.instrument && p.sourceId === source.id &&
               p.destInst === dest.instrument && p.destId === dest.id
        );
        if (existing) {
          this.master.removeCrossPatch(source.instrument, source.id, dest.instrument, dest.id);
          if (ui.network && ui.network.connected) {
            ui.network.broadcastPatchChange('remove', source.instrument, source.id, dest.instrument, dest.id);
          }
        } else {
          this.master.addCrossPatch(source.instrument, source.id, dest.instrument, dest.id);
          if (ui.network && ui.network.connected) {
            ui.network.broadcastPatchChange('add', source.instrument, source.id, dest.instrument, dest.id);
          }
        }
        this.activePatchStart = null;
      } else {
        // Same type - restart with new point
        this.activePatchStart = pp;
      }
      return;
    }
    // Clicked empty space - cancel selection
    this.activePatchStart = null;
  }

  onPointerMove(x, y, ui) {
    this.mousePos = { x, y };
  }

  onPointerUp(ui) {}
  onWheel(x, y, deltaY, ui) {}
  onKeyDown(e, ui) {}
  onKeyUp(e, ui) {}
  syncFromState() {}
}
