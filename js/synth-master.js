// Master Bus - shared AudioContext, instrument mixing, cross-instrument patching

class SynthMaster {
  constructor() {
    this.ctx = null;
    this.instruments = {};
    this.nodes = {};
    this.initialized = false;
    this.crossPatches = [];
    this.onParamChange = null; // (instrument, path, value) => {}
  }

  async init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Master bus chain
    this.nodes.masterGain = this.ctx.createGain();
    this.nodes.masterGain.gain.value = 0.8;

    this.nodes.compressor = this.ctx.createDynamicsCompressor();
    this.nodes.compressor.threshold.value = -6;
    this.nodes.compressor.knee.value = 10;
    this.nodes.compressor.ratio.value = 4;

    this.nodes.analyser = this.ctx.createAnalyser();
    this.nodes.analyser.fftSize = 2048;

    this.nodes.masterGain.connect(this.nodes.compressor);
    this.nodes.compressor.connect(this.nodes.analyser);
    this.nodes.analyser.connect(this.ctx.destination);

    // Initialize all registered instruments
    for (const inst of Object.values(this.instruments)) {
      await this._initInstrument(inst);
    }

    this.initialized = true;
  }

  registerInstrument(synth) {
    this.instruments[synth.id] = synth;
    synth.onParamChange = (id, path, value) => {
      if (this.onParamChange) {
        this.onParamChange(id, path, value);
      }
    };
  }

  async _initInstrument(synth) {
    synth.ctx = this.ctx;
    synth.output = this.ctx.createGain();
    synth.output.gain.value = 1.0;
    synth.output.connect(this.nodes.masterGain);
    await synth.init();
  }

  // Cross-instrument patching
  addCrossPatch(sourceInst, sourceId, destInst, destId) {
    const source = this.instruments[sourceInst];
    const dest = this.instruments[destInst];
    if (!source || !dest) return false;

    const sourceNode = source.getPatchOutput(sourceId);
    const destNode = dest.getPatchInput(destId);
    if (!sourceNode || !destNode) return false;

    // Check for existing
    const exists = this.crossPatches.find(
      p => p.sourceInst === sourceInst && p.sourceId === sourceId &&
           p.destInst === destInst && p.destId === destId
    );
    if (exists) return false;

    // Create a gain node to control the patch amount
    const patchGain = this.ctx.createGain();
    patchGain.gain.value = 1.0;
    sourceNode.connect(patchGain);
    patchGain.connect(destNode);

    this.crossPatches.push({
      sourceInst, sourceId, destInst, destId, patchGain
    });
    return true;
  }

  removeCrossPatch(sourceInst, sourceId, destInst, destId) {
    const idx = this.crossPatches.findIndex(
      p => p.sourceInst === sourceInst && p.sourceId === sourceId &&
           p.destInst === destInst && p.destId === destId
    );
    if (idx === -1) return false;

    const patch = this.crossPatches[idx];
    try {
      patch.patchGain.disconnect();
    } catch (e) {}
    this.crossPatches.splice(idx, 1);
    return true;
  }

  clearAllPatches() {
    for (const patch of this.crossPatches) {
      try { patch.patchGain.disconnect(); } catch (e) {}
    }
    this.crossPatches = [];
  }

  // Get waveform data from shared analyser
  getWaveformData() {
    if (!this.nodes.analyser) return null;
    const data = new Uint8Array(this.nodes.analyser.frequencyBinCount);
    this.nodes.analyser.getByteTimeDomainData(data);
    return data;
  }

  // Full state for network sync
  getFullState() {
    const state = {};
    for (const [id, inst] of Object.entries(this.instruments)) {
      state[id] = inst.getFullState();
    }
    state.crossPatches = this.crossPatches.map(p => ({
      sourceInst: p.sourceInst, sourceId: p.sourceId,
      destInst: p.destInst, destId: p.destId,
    }));
    return state;
  }

  applyFullState(fullState) {
    for (const [id, inst] of Object.entries(this.instruments)) {
      if (fullState[id]) {
        inst.applyFullState(fullState[id]);
      }
    }
    // Reapply cross patches
    if (fullState.crossPatches) {
      this.clearAllPatches();
      for (const p of fullState.crossPatches) {
        this.addCrossPatch(p.sourceInst, p.sourceId, p.destInst, p.destId);
      }
    }
  }

  // Apply a single param change from network
  applyParam(instrument, path, value) {
    const inst = this.instruments[instrument];
    if (inst) {
      inst.applyParam(path, value);
    }
  }

  destroy() {
    for (const inst of Object.values(this.instruments)) {
      inst.destroy();
    }
    this.clearAllPatches();
    if (this.ctx) {
      this.ctx.close();
    }
  }
}
