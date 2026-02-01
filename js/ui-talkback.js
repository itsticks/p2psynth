// Talkback Panel - push-to-talk microphone broadcast to peers

class TalkbackPanel {
  constructor(network) {
    this.network = network;
    this.isTalking = false;
    this.buttonArea = { x: 0, y: 0, r: 0 };
    this.analyser = null;
    this.analyserData = null;
  }

  buildLayout(area, s) {
    const { w, h } = area;
    this.buttonArea = {
      x: w / 2,
      y: h * 0.4,
      r: Math.min(80 * s, w * 0.2),
    };
  }

  render(ctx, area, s, ui) {
    const { w, h } = area;
    const btn = this.buttonArea;

    // Title
    ctx.fillStyle = '#44ff88';
    ctx.font = `bold ${13 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'left';
    ctx.fillText('TALKBACK', 10 * s, 16 * s);
    ctx.fillStyle = '#888888';
    ctx.font = `${9 * s}px 'Courier New', monospace`;
    ctx.fillText('PUSH TO TALK', 10 * s, 28 * s);

    // Big circular button
    const pulseR = this.isTalking ? btn.r + Math.sin(Date.now() * 0.01) * 6 * s : btn.r;

    // Outer glow when active
    if (this.isTalking) {
      ctx.beginPath();
      ctx.arc(btn.x, btn.y, pulseR + 15 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#44ff8820';
      ctx.fill();
    }

    // Button background
    ctx.beginPath();
    ctx.arc(btn.x, btn.y, pulseR, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(
      btn.x - btn.r * 0.2, btn.y - btn.r * 0.2, 0,
      btn.x, btn.y, pulseR
    );
    if (this.isTalking) {
      grad.addColorStop(0, '#66ffaa');
      grad.addColorStop(1, '#22cc66');
    } else {
      grad.addColorStop(0, '#555555');
      grad.addColorStop(1, '#333333');
    }
    ctx.fillStyle = grad;
    ctx.fill();

    // Border
    ctx.strokeStyle = this.isTalking ? '#44ff88' : '#666666';
    ctx.lineWidth = 3 * s;
    ctx.stroke();

    // Microphone icon (simplified)
    const iconS = btn.r * 0.35;
    ctx.fillStyle = this.isTalking ? '#0a0a0a' : '#cccccc';

    // Mic body (rounded rect)
    const micW = iconS * 0.5;
    const micH = iconS * 0.8;
    UIControls.roundRect(ctx, btn.x - micW / 2, btn.y - iconS * 0.5, micW, micH, micW * 0.3);
    ctx.fill();

    // Mic stand arc
    ctx.beginPath();
    ctx.arc(btn.x, btn.y + iconS * 0.15, iconS * 0.4, Math.PI * 0.15, Math.PI * 0.85, false);
    ctx.strokeStyle = this.isTalking ? '#0a0a0a' : '#cccccc';
    ctx.lineWidth = 2.5 * s;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Mic stand line
    ctx.beginPath();
    ctx.moveTo(btn.x, btn.y + iconS * 0.5);
    ctx.lineTo(btn.x, btn.y + iconS * 0.7);
    ctx.stroke();

    // Mic base
    ctx.beginPath();
    ctx.moveTo(btn.x - iconS * 0.25, btn.y + iconS * 0.7);
    ctx.lineTo(btn.x + iconS * 0.25, btn.y + iconS * 0.7);
    ctx.stroke();

    // Label below button
    ctx.fillStyle = this.isTalking ? '#44ff88' : '#888888';
    ctx.font = `bold ${12 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(this.isTalking ? 'TRANSMITTING' : 'HOLD TO TALK', btn.x, btn.y + btn.r + 30 * s);

    // Connection status
    ctx.fillStyle = '#555555';
    ctx.font = `${9 * s}px 'Courier New', monospace`;
    if (this.network && this.network.connected) {
      ctx.fillStyle = '#44ff88';
      ctx.fillText(`Connected to ${this.network.connections.length} peer(s)`, btn.x, btn.y + btn.r + 50 * s);
    } else {
      ctx.fillText('Not connected - join a room first', btn.x, btn.y + btn.r + 50 * s);
    }

    // Instructions at bottom
    ctx.fillStyle = '#555555';
    ctx.font = `${8 * s}px 'Courier New', monospace`;
    ctx.fillText('Hold the button or press SPACE to talk', w / 2, h - 20 * s);
  }

  onPointerDown(x, y, ui) {
    const btn = this.buttonArea;
    if (Math.hypot(x - btn.x, y - btn.y) < btn.r * 1.3) {
      this._startTalking();
    }
  }

  onPointerMove(x, y, ui) {}

  onPointerUp(ui) {
    if (this.isTalking) {
      this._stopTalking();
    }
  }

  onWheel(x, y, deltaY, ui) {}

  onKeyDown(e, ui) {
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      this._startTalking();
    }
  }

  onKeyUp(e, ui) {
    if (e.code === 'Space') {
      this._stopTalking();
    }
  }

  _startTalking() {
    if (this.isTalking) return;
    if (!this.network || !this.network.connected) return;
    this.isTalking = true;
    this.network.startTalkback();
  }

  _stopTalking() {
    this.isTalking = false;
    if (this.network) {
      this.network.stopTalkback();
    }
  }

  syncFromState() {}
}
