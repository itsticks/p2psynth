// Main UI - Tab system, event routing, render loop coordinator

class SynthUI {
  constructor(canvas, master, network) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.master = master;
    this.network = network;
    this.activeTab = 'crave';
    this.dpr = window.devicePixelRatio || 1;

    this.tabs = [
      { id: 'crave', label: 'CRAVE', color: '#ff6b4a' },
      { id: 'edge', label: 'EDGE', color: '#4af0ff' },
      { id: 'spice', label: 'SPICE', color: '#b84aff' },
      { id: 'patchbay', label: 'PATCH', color: '#d4a44c' },
    ];

    this.tabBarH = 52 * this.dpr;
    this.panels = {};
    this.dragging = null;
    this.mousePos = { x: 0, y: 0 };
    this.showHelp = true;

    // Sequencer step tracking per instrument
    this.seqSteps = { crave: -1, edge: -1, spice: { seq1Step: 0, seq2Step: 0, tick: 0 } };

    this._bindEvents();
    setTimeout(() => { this.showHelp = false; }, 6000);
  }

  registerPanel(id, panel) {
    this.panels[id] = panel;
  }

  getContentArea() {
    return {
      x: 0,
      y: 0,
      w: this.canvas.width,
      h: this.canvas.height - this.tabBarH,
    };
  }

  getScale() {
    const area = this.getContentArea();
    return Math.min(area.w / 400, area.h / 700);
  }

  // === Events ===

  _bindEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      this._onPointerDown(e.offsetX * this.dpr, e.offsetY * this.dpr);
    });
    this.canvas.addEventListener('mousemove', (e) => {
      this._onPointerMove(e.offsetX * this.dpr, e.offsetY * this.dpr);
    });
    this.canvas.addEventListener('mouseup', () => this._onPointerUp());
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this._onWheel(e.offsetX * this.dpr, e.offsetY * this.dpr, e.deltaY);
    }, { passive: false });

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this._onPointerDown(
        (t.clientX - rect.left) * this.dpr,
        (t.clientY - rect.top) * this.dpr
      );
    }, { passive: false });
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this._onPointerMove(
        (t.clientX - rect.left) * this.dpr,
        (t.clientY - rect.top) * this.dpr
      );
    }, { passive: false });
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this._onPointerUp();
    }, { passive: false });

    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup', (e) => this._onKeyUp(e));
  }

  _onPointerDown(x, y) {
    this.showHelp = false;
    this.mousePos = { x, y };

    // Check tab bar
    if (y >= this.canvas.height - this.tabBarH) {
      const tabW = this.canvas.width / this.tabs.length;
      const tabIdx = Math.floor(x / tabW);
      if (tabIdx >= 0 && tabIdx < this.tabs.length) {
        this.activeTab = this.tabs[tabIdx].id;
        // Rebuild active panel layout
        const panel = this.panels[this.activeTab];
        if (panel && panel.buildLayout) panel.buildLayout(this.getContentArea(), this.getScale());
      }
      return;
    }

    // Init audio on first interaction
    this.master.init();

    // Delegate to active panel
    const panel = this.panels[this.activeTab];
    if (panel && panel.onPointerDown) {
      panel.onPointerDown(x, y, this);
    }
  }

  _onPointerMove(x, y) {
    this.mousePos = { x, y };
    const panel = this.panels[this.activeTab];
    if (panel && panel.onPointerMove) {
      panel.onPointerMove(x, y, this);
    }
  }

  _onPointerUp() {
    const panel = this.panels[this.activeTab];
    if (panel && panel.onPointerUp) {
      panel.onPointerUp(this);
    }
    this.dragging = null;
  }

  _onWheel(x, y, deltaY) {
    if (y >= this.canvas.height - this.tabBarH) return;
    const panel = this.panels[this.activeTab];
    if (panel && panel.onWheel) {
      panel.onWheel(x, y, deltaY, this);
    }
  }

  _onKeyDown(e) {
    if (e.repeat) return;
    const panel = this.panels[this.activeTab];
    if (panel && panel.onKeyDown) {
      panel.onKeyDown(e, this);
    }
  }

  _onKeyUp(e) {
    const panel = this.panels[this.activeTab];
    if (panel && panel.onKeyUp) {
      panel.onKeyUp(e, this);
    }
  }

  // === Sync ===

  syncFromState() {
    for (const panel of Object.values(this.panels)) {
      if (panel.syncFromState) panel.syncFromState();
    }
  }

  broadcastParam(instrument, path, value) {
    if (this.network && this.network.connected) {
      this.network.broadcastParam(instrument, path, value);
    }
  }

  // === Rendering ===

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(0, 0, w, h);

    // Active panel
    const panel = this.panels[this.activeTab];
    const area = this.getContentArea();
    if (panel && panel.render) {
      panel.render(ctx, area, this.getScale(), this);
    }

    // Tab bar
    this._renderTabBar(ctx, w, h);

    // Status
    this._renderStatus(ctx, w);

    // Help
    if (this.showHelp) {
      this._renderHelp(ctx, w, h);
    }
  }

  _renderTabBar(ctx, w, h) {
    const tabY = h - this.tabBarH;
    const tabW = w / this.tabs.length;
    const s = this.dpr;

    // Background
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, tabY, w, this.tabBarH);

    // Top border
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(0, tabY);
    ctx.lineTo(w, tabY);
    ctx.stroke();

    for (let i = 0; i < this.tabs.length; i++) {
      const tab = this.tabs[i];
      const tx = i * tabW;
      const isActive = tab.id === this.activeTab;

      if (isActive) {
        ctx.fillStyle = tab.color + '20';
        ctx.fillRect(tx, tabY, tabW, this.tabBarH);

        // Active indicator line
        ctx.fillStyle = tab.color;
        ctx.fillRect(tx + 4 * s, tabY, tabW - 8 * s, 3 * s);
      }

      // Dot
      ctx.beginPath();
      ctx.arc(tx + tabW / 2, tabY + 16 * s, 4 * s, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? tab.color : '#444444';
      ctx.fill();

      // Label
      ctx.fillStyle = isActive ? tab.color : '#666666';
      ctx.font = `bold ${10 * s}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(tab.label, tx + tabW / 2, tabY + 35 * s);
    }
  }

  _renderStatus(ctx, w) {
    const s = this.dpr;
    ctx.textAlign = 'right';
    const x = w - 10 * s;

    if (this.network && this.network.connected) {
      ctx.fillStyle = '#44ff88';
      ctx.font = `${9 * s}px 'Courier New', monospace`;
      ctx.fillText(`${this.network.peers.length + 1} ONLINE`, x, 14 * s);
      ctx.fillStyle = '#888888';
      ctx.fillText(`ROOM: ${this.network.roomId}`, x, 26 * s);
    } else {
      ctx.fillStyle = '#555555';
      ctx.font = `${9 * s}px 'Courier New', monospace`;
      ctx.fillText('SOLO', x, 14 * s);
    }
  }

  _renderHelp(ctx, w, h) {
    const s = this.dpr;
    ctx.fillStyle = '#000000bb';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const boxW = Math.min(350 * s, w * 0.9);
    const boxH = 200 * s;

    ctx.fillStyle = '#1a1a1a';
    ctx.strokeStyle = '#d4a44c';
    ctx.lineWidth = 2 * s;
    UIControls.roundRect(ctx, cx - boxW / 2, cy - boxH / 2, boxW, boxH, 10 * s);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#d4a44c';
    ctx.font = `bold ${16 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('P2P SOUND STUDIO', cx, cy - boxH / 2 + 30 * s);

    const lines = [
      'CRAVE: Mono synth with keyboard',
      'EDGE: Percussion synth',
      'SPICE: Polyrhythmic synth',
      'Drag knobs / scroll to fine-tune',
      'PATCH tab to connect instruments',
      'Tap anywhere to start',
    ];

    ctx.fillStyle = '#cccccc';
    ctx.font = `${9 * s}px 'Courier New', monospace`;
    let ly = cy - boxH / 2 + 55 * s;
    for (const line of lines) {
      ctx.fillText(line, cx, ly);
      ly += 20 * s;
    }
  }

  resize() {
    this.dpr = window.devicePixelRatio || 1;
    this.tabBarH = 52 * this.dpr;
    const panel = this.panels[this.activeTab];
    if (panel && panel.buildLayout) {
      panel.buildLayout(this.getContentArea(), this.getScale());
    }
  }
}
