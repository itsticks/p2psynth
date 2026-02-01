// Base Synth Class - shared utilities for all 3 instruments

class SynthBase {
  constructor(id) {
    this.id = id;
    this.ctx = null;
    this.output = null; // GainNode connecting to master bus
    this.initialized = false;
    this.nodes = {};
    this.state = {};
    this.onParamChange = null; // (instrumentId, path, value) => {}
    this.sequencerInterval = null;
    this.sequencerStep = -1;
    this.onSequencerStep = null;
  }

  // Shared: MIDI note to frequency
  midiToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  // Shared: Create 4-pole Moog ladder filter approximation
  createLadderFilter(cutoff, resonance) {
    const filters = [];
    for (let i = 0; i < 4; i++) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      f.Q.value = i === 3 ? resonance * 15 : 0.5;
      filters.push(f);
    }
    return filters;
  }

  // Chain an array of audio nodes in series
  chainNodes(nodes) {
    for (let i = 0; i < nodes.length - 1; i++) {
      nodes[i].connect(nodes[i + 1]);
    }
  }

  // Set ladder filter cutoff
  setFilterCutoff(filters, value, time) {
    const t = time || this.ctx.currentTime;
    for (const f of filters) {
      f.frequency.setTargetAtTime(value, t, 0.01);
    }
  }

  // Set ladder filter resonance (on last stage)
  setFilterResonance(filters, value) {
    if (filters.length > 0) {
      filters[filters.length - 1].Q.value = value * 15;
    }
  }

  // Set ladder filter type (lowpass/highpass)
  setFilterType(filters, type) {
    for (const f of filters) {
      f.type = type;
    }
  }

  // Create white or pink noise buffer source
  createNoiseNode(type = 'white') {
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    if (type === 'pink') {
      // Pink noise using Voss-McCartney algorithm
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else {
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }

    const node = this.ctx.createBufferSource();
    node.buffer = buffer;
    node.loop = true;
    node.start();
    return node;
  }

  // Notify network of parameter change
  _notify(path, value) {
    if (this.onParamChange) {
      this.onParamChange(this.id, path, value);
    }
  }

  // Set a nested state value by dot-path and optionally notify
  _setStatePath(path, value, notify = true) {
    const parts = path.split('.');
    let obj = this.state;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    if (notify) this._notify(path, value);
  }

  // Get a nested state value by dot-path
  _getStatePath(path) {
    const parts = path.split('.');
    let obj = this.state;
    for (const p of parts) {
      obj = obj[p];
    }
    return obj;
  }

  getFullState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  // Stop sequencer
  _stopSequencer() {
    if (this.sequencerInterval) {
      clearTimeout(this.sequencerInterval);
      this.sequencerInterval = null;
    }
    this.sequencerStep = -1;
  }

  destroy() {
    this._stopSequencer();
  }

  // Patch bay interface - override in subclasses
  getPatchOutput(id) { return null; }
  getPatchInput(id) { return null; }

  static PATCH_OUTPUTS = [];
  static PATCH_INPUTS = [];
}
