// Crave Synth Engine - Behringer Crave / Moog Mother-32 clone
// Mono synth: 1 VCO, Moog ladder filter, ADS envelope, LFO, 16-step sequencer

class SynthCrave extends SynthBase {
  constructor() {
    super('crave');
    this.state = this.getDefaultState();
    this.noteOn = false;
    this.currentNote = -1;
  }

  getDefaultState() {
    return {
      vco: {
        frequency: 220,
        waveform: 'sawtooth', // 'sawtooth' or 'square' (pulse)
        pulseWidth: 0.5,
        mix: 1.0, // 1=VCO only, 0=noise only
      },
      vcf: {
        cutoff: 2000,
        resonance: 0.5,
        envAmount: 0.5,
        type: 'lowpass', // 'lowpass' or 'highpass'
      },
      vca: {
        mode: 'env', // 'env' or 'on' (drone)
        level: 0.7,
      },
      env: {
        attack: 0.01,
        decay: 0.3,
        sustain: 0.5,
        sustainOn: true,
      },
      lfo: {
        rate: 2.0,
        waveform: 'triangle', // 'triangle' or 'square'
        destination: 'vcf', // 'vco', 'vcf', 'pw'
        amount: 0.0,
      },
      glide: 0.0,
      seq: {
        tempo: 120,
        steps: [60, 62, 64, 65, 67, 69, 71, 72, 60, 64, 67, 72, 71, 67, 64, 60],
        gates: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        gateLength: 0.5,
        running: false,
        numSteps: 16,
      },
    };
  }

  async init() {
    if (this.initialized) return;

    // VCO
    this.nodes.vco = this.ctx.createOscillator();
    this.nodes.vco.type = this.state.vco.waveform;
    this.nodes.vco.frequency.value = this.state.vco.frequency;

    this.nodes.vcoGain = this.ctx.createGain();
    this.nodes.vcoGain.gain.value = this.state.vco.mix;

    // Noise
    this.nodes.noise = this.createNoiseNode('white');
    this.nodes.noiseGain = this.ctx.createGain();
    this.nodes.noiseGain.gain.value = 1 - this.state.vco.mix;

    // Mixer
    this.nodes.mixer = this.ctx.createGain();
    this.nodes.mixer.gain.value = 1.0;

    // VCF - 4-pole Moog ladder
    this.nodes.vcf = this.createLadderFilter(this.state.vcf.cutoff, this.state.vcf.resonance);
    this.setFilterType(this.nodes.vcf, this.state.vcf.type);

    // VCA
    this.nodes.vca = this.ctx.createGain();
    this.nodes.vca.gain.value = this.state.vca.mode === 'on' ? 1.0 : 0;

    // Output level
    this.nodes.level = this.ctx.createGain();
    this.nodes.level.gain.value = this.state.vca.level;

    // LFO
    this.nodes.lfo = this.ctx.createOscillator();
    this.nodes.lfo.type = this.state.lfo.waveform;
    this.nodes.lfo.frequency.value = this.state.lfo.rate;
    this.nodes.lfoGain = this.ctx.createGain();
    this.nodes.lfoGain.gain.value = 0;

    // Routing: VCO + Noise -> Mixer -> VCF chain -> VCA -> Level -> Output
    this.nodes.vco.connect(this.nodes.vcoGain);
    this.nodes.vcoGain.connect(this.nodes.mixer);
    this.nodes.noise.connect(this.nodes.noiseGain);
    this.nodes.noiseGain.connect(this.nodes.mixer);

    let prev = this.nodes.mixer;
    for (const f of this.nodes.vcf) {
      prev.connect(f);
      prev = f;
    }
    prev.connect(this.nodes.vca);
    this.nodes.vca.connect(this.nodes.level);
    this.nodes.level.connect(this.output);

    // LFO routing
    this.nodes.lfo.connect(this.nodes.lfoGain);
    this._applyLfoRouting();

    // Patch output nodes: seq CV and gate (ConstantSourceNodes updated from JS)
    this.nodes.seqCV = this.ctx.createConstantSource();
    this.nodes.seqCV.offset.value = 0;
    this.nodes.seqCV.start();
    this.nodes.gateOut = this.ctx.createConstantSource();
    this.nodes.gateOut.offset.value = 0;
    this.nodes.gateOut.start();

    // Patch input: tempo modulation
    this.nodes.tempoIn = this.ctx.createGain();
    this.nodes.tempoIn.gain.value = 0;
    // Connect to a silent sink so the audio graph processes it
    const tempoSink = this.ctx.createGain();
    tempoSink.gain.value = 0;
    this.nodes.tempoIn.connect(tempoSink);
    tempoSink.connect(this.ctx.destination);

    // Start oscillators
    this.nodes.vco.start();
    this.nodes.lfo.start();

    this.initialized = true;
  }

  _applyLfoRouting() {
    try { this.nodes.lfoGain.disconnect(); } catch (e) {}
    const amt = this.state.lfo.amount;
    if (amt <= 0) return;

    switch (this.state.lfo.destination) {
      case 'vco':
        this.nodes.lfoGain.gain.value = amt * 50;
        this.nodes.lfoGain.connect(this.nodes.vco.frequency);
        break;
      case 'vcf':
        this.nodes.lfoGain.gain.value = amt * 2000;
        this.nodes.lfoGain.connect(this.nodes.vcf[0].frequency);
        break;
      case 'pw':
        // Pulse width modulation would need custom oscillator
        // For now route to VCO frequency as subtle vibrato
        this.nodes.lfoGain.gain.value = amt * 20;
        this.nodes.lfoGain.connect(this.nodes.vco.frequency);
        break;
    }
  }

  triggerNote(midiNote) {
    if (!this.initialized) return;
    const freq = this.midiToFreq(midiNote);
    const now = this.ctx.currentTime;
    const glide = this.state.glide * 0.5;

    // VCO frequency
    this.nodes.vco.frequency.cancelScheduledValues(now);
    this.nodes.vco.frequency.setValueAtTime(this.nodes.vco.frequency.value, now);
    this.nodes.vco.frequency.linearRampToValueAtTime(freq, now + glide);

    // Envelope -> VCA
    if (this.state.vca.mode === 'env') {
      const env = this.state.env;
      const vca = this.nodes.vca.gain;
      vca.cancelScheduledValues(now);
      vca.setValueAtTime(0, now);
      vca.linearRampToValueAtTime(1.0, now + env.attack);
      if (env.sustainOn) {
        vca.linearRampToValueAtTime(env.sustain, now + env.attack + env.decay);
      } else {
        vca.linearRampToValueAtTime(0, now + env.attack + env.decay);
      }
    }

    // Filter envelope
    const envAmt = this.state.vcf.envAmount;
    if (envAmt > 0) {
      const env = this.state.env;
      const baseCutoff = this.state.vcf.cutoff;
      const peakCutoff = Math.min(baseCutoff + envAmt * 8000, 18000);
      const sustainCutoff = baseCutoff + (peakCutoff - baseCutoff) * (env.sustainOn ? env.sustain : 0);

      for (const f of this.nodes.vcf) {
        f.frequency.cancelScheduledValues(now);
        f.frequency.setValueAtTime(baseCutoff, now);
        f.frequency.linearRampToValueAtTime(peakCutoff, now + env.attack);
        f.frequency.linearRampToValueAtTime(sustainCutoff, now + env.attack + env.decay);
      }
    }

    this.noteOn = true;
    this.currentNote = midiNote;
    this.state.vco.frequency = freq;
    if (this.nodes.gateOut) this.nodes.gateOut.offset.value = 1;
    if (this.nodes.seqCV) this.nodes.seqCV.offset.value = freq;
  }

  releaseNote() {
    if (!this.initialized || !this.noteOn) return;
    const now = this.ctx.currentTime;
    const releaseTime = 0.15; // Fixed short release

    if (this.state.vca.mode === 'env') {
      this.nodes.vca.gain.cancelScheduledValues(now);
      this.nodes.vca.gain.setValueAtTime(this.nodes.vca.gain.value, now);
      this.nodes.vca.gain.linearRampToValueAtTime(0, now + releaseTime);
    }

    // Release filter
    const baseCutoff = this.state.vcf.cutoff;
    for (const f of this.nodes.vcf) {
      f.frequency.cancelScheduledValues(now);
      f.frequency.setValueAtTime(f.frequency.value, now);
      f.frequency.linearRampToValueAtTime(baseCutoff, now + releaseTime);
    }

    this.noteOn = false;
  }

  // Parameter setters
  setParam(path, value) {
    this._setStatePath(path, value);
    if (!this.initialized) return;

    switch (path) {
      case 'vco.waveform':
        this.nodes.vco.type = value;
        break;
      case 'vco.frequency':
        this.nodes.vco.frequency.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        break;
      case 'vco.mix':
        this.nodes.vcoGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        this.nodes.noiseGain.gain.setTargetAtTime(1 - value, this.ctx.currentTime, 0.01);
        break;
      case 'vcf.cutoff':
        this.setFilterCutoff(this.nodes.vcf, value);
        break;
      case 'vcf.resonance':
        this.setFilterResonance(this.nodes.vcf, value);
        break;
      case 'vcf.type':
        this.setFilterType(this.nodes.vcf, value);
        break;
      case 'vca.level':
        this.nodes.level.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        break;
      case 'vca.mode':
        if (value === 'on') {
          this.nodes.vca.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.01);
        }
        break;
      case 'lfo.rate':
        this.nodes.lfo.frequency.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        break;
      case 'lfo.waveform':
        this.nodes.lfo.type = value;
        break;
      case 'lfo.amount':
      case 'lfo.destination':
        this._applyLfoRouting();
        break;
      case 'seq.running':
        if (value) this.startSequencer();
        else this.stopSequencer();
        break;
    }
  }

  // Apply a param from network (no notification back)
  applyParam(path, value) {
    this._setStatePath(path, value, false);
    if (!this.initialized) return;

    // Same switch as setParam but without notify
    switch (path) {
      case 'vco.waveform': this.nodes.vco.type = value; break;
      case 'vco.frequency': this.nodes.vco.frequency.setTargetAtTime(value, this.ctx.currentTime, 0.01); break;
      case 'vco.mix':
        this.nodes.vcoGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        this.nodes.noiseGain.gain.setTargetAtTime(1 - value, this.ctx.currentTime, 0.01);
        break;
      case 'vcf.cutoff': this.setFilterCutoff(this.nodes.vcf, value); break;
      case 'vcf.resonance': this.setFilterResonance(this.nodes.vcf, value); break;
      case 'vcf.type': this.setFilterType(this.nodes.vcf, value); break;
      case 'vca.level': this.nodes.level.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01); break;
      case 'vca.mode':
        if (value === 'on') this.nodes.vca.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.01);
        break;
      case 'lfo.rate': this.nodes.lfo.frequency.setTargetAtTime(value, this.ctx.currentTime, 0.01); break;
      case 'lfo.waveform': this.nodes.lfo.type = value; break;
      case 'lfo.amount':
      case 'lfo.destination':
        this._applyLfoRouting();
        break;
      case 'seq.running':
        if (value) this.startSequencer();
        else this.stopSequencer();
        break;
    }
  }

  applyFullState(newState) {
    this.state = JSON.parse(JSON.stringify(newState));
    if (!this.initialized) return;

    this.nodes.vco.type = this.state.vco.waveform;
    this.nodes.vco.frequency.value = this.state.vco.frequency;
    this.nodes.vcoGain.gain.value = this.state.vco.mix;
    this.nodes.noiseGain.gain.value = 1 - this.state.vco.mix;
    this.setFilterCutoff(this.nodes.vcf, this.state.vcf.cutoff);
    this.setFilterResonance(this.nodes.vcf, this.state.vcf.resonance);
    this.setFilterType(this.nodes.vcf, this.state.vcf.type);
    this.nodes.level.gain.value = this.state.vca.level;
    this.nodes.lfo.frequency.value = this.state.lfo.rate;
    this.nodes.lfo.type = this.state.lfo.waveform;
    this._applyLfoRouting();

    if (this.state.vca.mode === 'on') {
      this.nodes.vca.gain.value = 1.0;
    }
    if (this.state.seq.running && !this.sequencerInterval) {
      this.startSequencer();
    } else if (!this.state.seq.running && this.sequencerInterval) {
      this.stopSequencer();
    }
  }

  // Sequencer
  startSequencer() {
    if (this.sequencerInterval) return;
    this.state.seq.running = true;
    this.sequencerStep = 0;

    const tick = () => {
      const stepTime = (60 / this.state.seq.tempo) * 1000 / 4; // 16th notes
      const step = this.sequencerStep % this.state.seq.numSteps;

      if (this.state.seq.gates[step]) {
        const note = this.state.seq.steps[step];
        this.triggerNote(note);
        // Update patch output nodes
        if (this.nodes.seqCV) this.nodes.seqCV.offset.value = this.midiToFreq(note);
        if (this.nodes.gateOut) this.nodes.gateOut.offset.value = 1;
        setTimeout(() => {
          this.releaseNote();
          if (this.nodes.gateOut) this.nodes.gateOut.offset.value = 0;
        }, stepTime * this.state.seq.gateLength);
      }

      if (this.onSequencerStep) this.onSequencerStep('crave', step);
      this.sequencerStep++;
      this.sequencerInterval = setTimeout(tick, stepTime);
    };
    tick();
  }

  stopSequencer() {
    this.state.seq.running = false;
    this._stopSequencer();
    this.releaseNote();
  }

  // Patch bay interface
  static PATCH_OUTPUTS = [
    { id: 'lfo', label: 'LFO' },
    { id: 'env', label: 'ENV' },
    { id: 'noise', label: 'NOISE' },
    { id: 'vco', label: 'VCO' },
    { id: 'seq_cv', label: 'SEQ CV' },
    { id: 'gate', label: 'GATE' },
  ];

  static PATCH_INPUTS = [
    { id: 'vco_freq', label: 'VCO' },
    { id: 'vcf_cutoff', label: 'CUTOFF' },
    { id: 'vcf_res', label: 'RES' },
    { id: 'vca_level', label: 'VCA' },
    { id: 'lfo_rate', label: 'LFO RT' },
    { id: 'tempo', label: 'TEMPO' },
  ];

  getPatchOutput(id) {
    if (!this.initialized) return null;
    switch (id) {
      case 'lfo': return this.nodes.lfoGain;
      case 'env': return this.nodes.vca;
      case 'noise': return this.nodes.noiseGain;
      case 'vco': return this.nodes.vcoGain;
      case 'seq_cv': return this.nodes.seqCV;
      case 'gate': return this.nodes.gateOut;
      default: return null;
    }
  }

  getPatchInput(id) {
    if (!this.initialized) return null;
    switch (id) {
      case 'vco_freq': return this.nodes.vco.frequency;
      case 'vcf_cutoff': return this.nodes.vcf[0].frequency;
      case 'vcf_res': return this.nodes.vcf[3].Q;
      case 'vca_level': return this.nodes.level.gain;
      case 'lfo_rate': return this.nodes.lfo.frequency;
      case 'tempo': return this.nodes.tempoIn.gain;
      default: return null;
    }
  }
}
