// Moog Mother Synth Engine - Web Audio API
// Emulates: VCO, VCF (Moog ladder), VCA, LFO, Envelope Generator, Sequencer

class MoogSynth {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.nodes = {};
    this.state = this.getDefaultState();
    this.sequencerInterval = null;
    this.sequencerStep = 0;
    this.noteOn = false;
    this.patches = []; // patch bay connections
  }

  getDefaultState() {
    return {
      // VCO
      vco: {
        frequency: 220,
        waveform: 'sawtooth', // sawtooth, square, triangle
        pulseWidth: 0.5,
        subOscLevel: 0.0,
        noiseLevel: 0.0,
        glide: 0.0,
      },
      // VCF
      vcf: {
        cutoff: 2000,
        resonance: 1.0,
        envAmount: 0.5,
        keyTrack: 0.0,
        type: 'lowpass',
      },
      // VCA
      vca: {
        level: 0.7,
        mode: 'env', // 'env' or 'on'
      },
      // LFO
      lfo: {
        rate: 2.0,
        waveform: 'triangle', // triangle, square, saw, random
        amount: 0.0,
      },
      // Envelope
      env: {
        attack: 0.01,
        decay: 0.3,
        sustain: 0.5,
        release: 0.3,
      },
      // Sequencer
      seq: {
        tempo: 120,
        steps: [60, 62, 64, 65, 67, 69, 71, 72], // MIDI notes
        gateLength: 0.5,
        running: false,
        numSteps: 8,
      },
      // Patch bay connections
      patches: [],
    };
  }

  async init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // === VCO ===
    this.nodes.vco = this.ctx.createOscillator();
    this.nodes.vco.type = this.state.vco.waveform;
    this.nodes.vco.frequency.value = this.state.vco.frequency;

    // Sub oscillator (one octave below)
    this.nodes.subOsc = this.ctx.createOscillator();
    this.nodes.subOsc.type = 'square';
    this.nodes.subOsc.frequency.value = this.state.vco.frequency / 2;
    this.nodes.subGain = this.ctx.createGain();
    this.nodes.subGain.gain.value = this.state.vco.subOscLevel;

    // Noise generator
    this.nodes.noiseGain = this.ctx.createGain();
    this.nodes.noiseGain.gain.value = this.state.vco.noiseLevel;
    this._createNoiseNode();

    // VCO mix
    this.nodes.vcoGain = this.ctx.createGain();
    this.nodes.vcoGain.gain.value = 1.0;

    // === VCF (Moog-style) ===
    // We chain 4 biquad filters to approximate the 4-pole Moog ladder
    this.nodes.vcf = [];
    for (let i = 0; i < 4; i++) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = this.state.vcf.cutoff;
      f.Q.value = i === 3 ? this.state.vcf.resonance * 15 : 0.5;
      this.nodes.vcf.push(f);
    }

    // === VCA ===
    this.nodes.vca = this.ctx.createGain();
    this.nodes.vca.gain.value = 0;

    // Master output
    this.nodes.master = this.ctx.createGain();
    this.nodes.master.gain.value = this.state.vca.level;

    // Compressor to prevent clipping
    this.nodes.compressor = this.ctx.createDynamicsCompressor();
    this.nodes.compressor.threshold.value = -6;
    this.nodes.compressor.knee.value = 10;
    this.nodes.compressor.ratio.value = 4;

    // Analyser for visualization
    this.nodes.analyser = this.ctx.createAnalyser();
    this.nodes.analyser.fftSize = 2048;

    // === LFO ===
    this.nodes.lfo = this.ctx.createOscillator();
    this.nodes.lfo.type = this.state.lfo.waveform;
    this.nodes.lfo.frequency.value = this.state.lfo.rate;
    this.nodes.lfoGain = this.ctx.createGain();
    this.nodes.lfoGain.gain.value = 0; // modulation amount

    // === Routing ===
    // VCO -> VCF chain -> VCA -> compressor -> analyser -> output
    this.nodes.vco.connect(this.nodes.vcoGain);
    this.nodes.subOsc.connect(this.nodes.subGain);
    this.nodes.subGain.connect(this.nodes.vcoGain);
    this.nodes.noise.connect(this.nodes.noiseGain);
    this.nodes.noiseGain.connect(this.nodes.vcoGain);

    let prev = this.nodes.vcoGain;
    for (const f of this.nodes.vcf) {
      prev.connect(f);
      prev = f;
    }
    prev.connect(this.nodes.vca);
    this.nodes.vca.connect(this.nodes.master);
    this.nodes.master.connect(this.nodes.compressor);
    this.nodes.compressor.connect(this.nodes.analyser);
    this.nodes.analyser.connect(this.ctx.destination);

    // LFO default routing: LFO -> VCF cutoff
    this.nodes.lfo.connect(this.nodes.lfoGain);

    // Start oscillators
    this.nodes.vco.start();
    this.nodes.subOsc.start();
    this.nodes.lfo.start();

    this.initialized = true;
    this._applyPatches();
  }

  _createNoiseNode() {
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.nodes.noise = this.ctx.createBufferSource();
    this.nodes.noise.buffer = buffer;
    this.nodes.noise.loop = true;
    this.nodes.noise.start();
  }

  // Convert MIDI note to frequency
  midiToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  // Trigger a note
  triggerNote(midiNote) {
    if (!this.initialized) return;
    const freq = this.midiToFreq(midiNote);
    const now = this.ctx.currentTime;
    const glide = this.state.vco.glide;

    // Set VCO frequency with glide
    this.nodes.vco.frequency.cancelScheduledValues(now);
    this.nodes.vco.frequency.setValueAtTime(this.nodes.vco.frequency.value, now);
    this.nodes.vco.frequency.linearRampToValueAtTime(freq, now + glide);

    this.nodes.subOsc.frequency.cancelScheduledValues(now);
    this.nodes.subOsc.frequency.setValueAtTime(this.nodes.subOsc.frequency.value, now);
    this.nodes.subOsc.frequency.linearRampToValueAtTime(freq / 2, now + glide);

    // Key tracking for filter
    if (this.state.vcf.keyTrack > 0) {
      const trackAmount = freq * this.state.vcf.keyTrack;
      for (const f of this.nodes.vcf) {
        f.frequency.setValueAtTime(this.state.vcf.cutoff + trackAmount, now);
      }
    }

    // Trigger envelope -> VCA
    this._triggerEnvelope(now);

    // Trigger envelope -> VCF if envAmount > 0
    this._triggerFilterEnvelope(now);

    this.noteOn = true;
    this.state.vco.frequency = freq;
  }

  _triggerEnvelope(now) {
    const env = this.state.env;
    const vca = this.nodes.vca.gain;

    vca.cancelScheduledValues(now);
    vca.setValueAtTime(0, now);
    vca.linearRampToValueAtTime(1.0, now + env.attack);
    vca.linearRampToValueAtTime(env.sustain, now + env.attack + env.decay);
  }

  _triggerFilterEnvelope(now) {
    const env = this.state.env;
    const amt = this.state.vcf.envAmount;
    if (amt <= 0) return;

    const baseFreq = this.state.vcf.cutoff;
    const peakFreq = Math.min(baseFreq + amt * 8000, 18000);

    for (const f of this.nodes.vcf) {
      f.frequency.cancelScheduledValues(now);
      f.frequency.setValueAtTime(baseFreq, now);
      f.frequency.linearRampToValueAtTime(peakFreq, now + env.attack);
      f.frequency.linearRampToValueAtTime(
        baseFreq + (peakFreq - baseFreq) * env.sustain,
        now + env.attack + env.decay
      );
    }
  }

  releaseNote() {
    if (!this.initialized || !this.noteOn) return;
    const now = this.ctx.currentTime;
    const env = this.state.env;

    this.nodes.vca.gain.cancelScheduledValues(now);
    this.nodes.vca.gain.setValueAtTime(this.nodes.vca.gain.value, now);
    this.nodes.vca.gain.linearRampToValueAtTime(0, now + env.release);

    // Release filter envelope
    const baseFreq = this.state.vcf.cutoff;
    for (const f of this.nodes.vcf) {
      f.frequency.cancelScheduledValues(now);
      f.frequency.setValueAtTime(f.frequency.value, now);
      f.frequency.linearRampToValueAtTime(baseFreq, now + env.release);
    }

    this.noteOn = false;
  }

  // === Parameter setters ===

  setVCO(param, value) {
    this.state.vco[param] = value;
    if (!this.initialized) return;
    switch (param) {
      case 'waveform':
        this.nodes.vco.type = value;
        break;
      case 'frequency':
        this.nodes.vco.frequency.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        this.nodes.subOsc.frequency.setTargetAtTime(value / 2, this.ctx.currentTime, 0.01);
        break;
      case 'subOscLevel':
        this.nodes.subGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        break;
      case 'noiseLevel':
        this.nodes.noiseGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        break;
    }
  }

  setVCF(param, value) {
    this.state.vcf[param] = value;
    if (!this.initialized) return;
    switch (param) {
      case 'cutoff':
        for (const f of this.nodes.vcf) {
          f.frequency.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        }
        break;
      case 'resonance':
        this.nodes.vcf[3].Q.value = value * 15;
        break;
    }
  }

  setVCA(param, value) {
    this.state.vca[param] = value;
    if (!this.initialized) return;
    if (param === 'level') {
      this.nodes.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
    }
  }

  setLFO(param, value) {
    this.state.lfo[param] = value;
    if (!this.initialized) return;
    switch (param) {
      case 'rate':
        this.nodes.lfo.frequency.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        break;
      case 'waveform':
        this.nodes.lfo.type = value;
        break;
      case 'amount':
        this.nodes.lfoGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        break;
    }
  }

  setEnv(param, value) {
    this.state.env[param] = value;
  }

  setSeq(param, value) {
    this.state.seq[param] = value;
    if (param === 'running') {
      if (value) this.startSequencer();
      else this.stopSequencer();
    }
  }

  // === Sequencer ===

  startSequencer() {
    if (this.sequencerInterval) return;
    this.state.seq.running = true;
    this.sequencerStep = 0;
    const stepTime = () => (60 / this.state.seq.tempo) * 1000 / 2; // 16th notes

    const tick = () => {
      const step = this.sequencerStep % this.state.seq.numSteps;
      const note = this.state.seq.steps[step];

      this.triggerNote(note);
      setTimeout(() => {
        this.releaseNote();
      }, stepTime() * this.state.seq.gateLength);

      this.sequencerStep++;
      this.sequencerInterval = setTimeout(tick, stepTime());

      // Callback for UI
      if (this.onSequencerStep) {
        this.onSequencerStep(step);
      }
    };
    tick();
  }

  stopSequencer() {
    this.state.seq.running = false;
    if (this.sequencerInterval) {
      clearTimeout(this.sequencerInterval);
      this.sequencerInterval = null;
    }
    this.releaseNote();
  }

  // === Patch Bay ===

  // Patch sources and destinations
  static PATCH_SOURCES = [
    'lfo', 'eg', 'noise', 'vco', 'kb_cv', 'seq_cv', 'gate'
  ];
  static PATCH_DESTS = [
    'vco_freq', 'vco_pw', 'vcf_cutoff', 'vcf_res', 'vca_level', 'lfo_rate', 'ext'
  ];

  addPatch(source, dest) {
    if (this.state.patches.find(p => p.source === source && p.dest === dest)) return;
    this.state.patches.push({ source, dest });
    if (this.initialized) this._applyPatches();
  }

  removePatch(source, dest) {
    this.state.patches = this.state.patches.filter(
      p => !(p.source === source && p.dest === dest)
    );
    if (this.initialized) this._applyPatches();
  }

  _applyPatches() {
    if (!this.initialized) return;

    // Disconnect LFO from all destinations first
    try { this.nodes.lfoGain.disconnect(); } catch (e) {}

    // Default: LFO is not connected unless patched
    let lfoConnected = false;

    for (const patch of this.state.patches) {
      const modAmount = this.state.lfo.amount || 100;

      switch (`${patch.source}->${patch.dest}`) {
        case 'lfo->vco_freq':
          this.nodes.lfoGain.gain.value = modAmount * 10;
          this.nodes.lfoGain.connect(this.nodes.vco.frequency);
          lfoConnected = true;
          break;
        case 'lfo->vcf_cutoff':
          this.nodes.lfoGain.gain.value = modAmount * 30;
          this.nodes.lfoGain.connect(this.nodes.vcf[0].frequency);
          lfoConnected = true;
          break;
        case 'lfo->vca_level':
          this.nodes.lfoGain.gain.value = modAmount / 200;
          this.nodes.lfoGain.connect(this.nodes.vca.gain);
          lfoConnected = true;
          break;
        case 'lfo->lfo_rate':
          this.nodes.lfoGain.gain.value = modAmount / 10;
          this.nodes.lfoGain.connect(this.nodes.lfo.frequency);
          lfoConnected = true;
          break;
      }
    }

    // Default patch: if no LFO patches, connect to filter
    if (!lfoConnected && this.state.lfo.amount > 0) {
      this.nodes.lfoGain.gain.value = this.state.lfo.amount * 500;
      this.nodes.lfoGain.connect(this.nodes.vcf[0].frequency);
    }
  }

  // Get full state for network sync
  getFullState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  // Apply full state from network
  applyFullState(newState) {
    this.state = JSON.parse(JSON.stringify(newState));
    if (!this.initialized) return;

    // Apply all parameters
    this.setVCO('waveform', this.state.vco.waveform);
    this.setVCO('frequency', this.state.vco.frequency);
    this.setVCO('subOscLevel', this.state.vco.subOscLevel);
    this.setVCO('noiseLevel', this.state.vco.noiseLevel);
    this.setVCF('cutoff', this.state.vcf.cutoff);
    this.setVCF('resonance', this.state.vcf.resonance);
    this.setLFO('rate', this.state.lfo.rate);
    this.setLFO('waveform', this.state.lfo.waveform);
    this.setLFO('amount', this.state.lfo.amount);
    this.setVCA('level', this.state.vca.level);
    this._applyPatches();
  }

  // Get analyser data for waveform display
  getWaveformData() {
    if (!this.nodes.analyser) return null;
    const data = new Uint8Array(this.nodes.analyser.frequencyBinCount);
    this.nodes.analyser.getByteTimeDomainData(data);
    return data;
  }

  getFrequencyData() {
    if (!this.nodes.analyser) return null;
    const data = new Uint8Array(this.nodes.analyser.frequencyBinCount);
    this.nodes.analyser.getByteFrequencyData(data);
    return data;
  }

  destroy() {
    this.stopSequencer();
    if (this.ctx) {
      this.ctx.close();
    }
  }
}
