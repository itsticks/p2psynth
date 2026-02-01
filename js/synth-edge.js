// Edge Synth Engine - Behringer Edge / Moog DFAM clone
// Analog percussion synth: Dual VCOs, FM, 3 decay envelopes, 8-step sequencer

class SynthEdge extends SynthBase {
  constructor() {
    super('edge');
    this.state = this.getDefaultState();
  }

  getDefaultState() {
    return {
      vco1: {
        frequency: 200,
        shape: 'square', // 'square' or 'triangle'
        level: 0.8,
      },
      vco2: {
        frequency: 300,
        shape: 'square',
        level: 0.6,
        hardSync: false,
      },
      fm: {
        amount: 0.0, // VCO1 -> VCO2 FM depth
      },
      noise: {
        type: 'white', // 'white' or 'pink'
        level: 0.0,
      },
      vcf: {
        cutoff: 3000,
        resonance: 0.3,
        type: 'lowpass',
      },
      pitchEg: {
        decay: 0.1,
        amount: 0.5, // bipolar: 0=none, 0.5=center, 1=max positive
      },
      filterEg: {
        decay: 0.3,
        amount: 0.5,
      },
      vcaEg: {
        decay: 0.5,
        fast: true, // true=fast attack (~1ms), false=slow (~100ms)
      },
      seq: {
        tempo: 140,
        pitchSteps: [60, 64, 67, 72, 60, 65, 69, 72],
        velSteps: [1.0, 0.8, 0.6, 0.7, 1.0, 0.5, 0.9, 0.7],
        running: false,
        numSteps: 8,
      },
      volume: 0.7,
    };
  }

  async init() {
    if (this.initialized) return;

    // VCO1
    this.nodes.vco1 = this.ctx.createOscillator();
    this.nodes.vco1.type = this.state.vco1.shape;
    this.nodes.vco1.frequency.value = this.state.vco1.frequency;
    this.nodes.vco1Gain = this.ctx.createGain();
    this.nodes.vco1Gain.gain.value = this.state.vco1.level;

    // VCO2
    this.nodes.vco2 = this.ctx.createOscillator();
    this.nodes.vco2.type = this.state.vco2.shape;
    this.nodes.vco2.frequency.value = this.state.vco2.frequency;
    this.nodes.vco2Gain = this.ctx.createGain();
    this.nodes.vco2Gain.gain.value = this.state.vco2.level;

    // FM: VCO1 -> VCO2 frequency
    this.nodes.fmGain = this.ctx.createGain();
    this.nodes.fmGain.gain.value = this.state.fm.amount * 500;
    this.nodes.vco1.connect(this.nodes.fmGain);
    this.nodes.fmGain.connect(this.nodes.vco2.frequency);

    // Noise
    this.nodes.noise = this.createNoiseNode(this.state.noise.type);
    this.nodes.noiseGain = this.ctx.createGain();
    this.nodes.noiseGain.gain.value = this.state.noise.level;

    // Mixer
    this.nodes.mixer = this.ctx.createGain();
    this.nodes.mixer.gain.value = 1.0;

    // VCF
    this.nodes.vcf = this.createLadderFilter(this.state.vcf.cutoff, this.state.vcf.resonance);
    this.setFilterType(this.nodes.vcf, this.state.vcf.type);

    // VCA (controlled by VCA decay envelope)
    this.nodes.vca = this.ctx.createGain();
    this.nodes.vca.gain.value = 0;

    // Output volume
    this.nodes.level = this.ctx.createGain();
    this.nodes.level.gain.value = this.state.volume;

    // Routing
    this.nodes.vco1.connect(this.nodes.vco1Gain);
    this.nodes.vco2.connect(this.nodes.vco2Gain);
    this.nodes.vco1Gain.connect(this.nodes.mixer);
    this.nodes.vco2Gain.connect(this.nodes.mixer);
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

    // Patch output nodes: pitch EG, seq pitch CV, seq velocity CV
    this.nodes.pitchEgOut = this.ctx.createConstantSource();
    this.nodes.pitchEgOut.offset.value = 0;
    this.nodes.pitchEgOut.start();
    this.nodes.seqPitchCV = this.ctx.createConstantSource();
    this.nodes.seqPitchCV.offset.value = 0;
    this.nodes.seqPitchCV.start();
    this.nodes.seqVelCV = this.ctx.createConstantSource();
    this.nodes.seqVelCV.offset.value = 0;
    this.nodes.seqVelCV.start();

    // Patch input: tempo modulation
    this.nodes.tempoIn = this.ctx.createGain();
    this.nodes.tempoIn.gain.value = 0;
    const tempoSink = this.ctx.createGain();
    tempoSink.gain.value = 0;
    this.nodes.tempoIn.connect(tempoSink);
    tempoSink.connect(this.ctx.destination);

    // Start oscillators
    this.nodes.vco1.start();
    this.nodes.vco2.start();

    this.initialized = true;
  }

  // Trigger percussion hit with velocity
  trigger(velocity = 1.0) {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;

    // Pitch envelope (decay-only, applied to both VCOs)
    const pitchAmt = (this.state.pitchEg.amount - 0.5) * 2; // -1 to +1
    const pitchDecay = this.state.pitchEg.decay;
    if (Math.abs(pitchAmt) > 0.01) {
      const pitchOffset = pitchAmt * 2000 * velocity;

      this.nodes.vco1.frequency.cancelScheduledValues(now);
      this.nodes.vco1.frequency.setValueAtTime(
        this.state.vco1.frequency + pitchOffset, now
      );
      this.nodes.vco1.frequency.exponentialRampToValueAtTime(
        Math.max(this.state.vco1.frequency, 20), now + pitchDecay
      );

      this.nodes.vco2.frequency.cancelScheduledValues(now);
      this.nodes.vco2.frequency.setValueAtTime(
        this.state.vco2.frequency + pitchOffset, now
      );
      this.nodes.vco2.frequency.exponentialRampToValueAtTime(
        Math.max(this.state.vco2.frequency, 20), now + pitchDecay
      );
    }

    // Filter envelope (decay-only)
    const filtAmt = (this.state.filterEg.amount - 0.5) * 2;
    const filtDecay = this.state.filterEg.decay;
    const baseCutoff = this.state.vcf.cutoff;
    if (Math.abs(filtAmt) > 0.01) {
      const filtOffset = filtAmt * 8000 * velocity;
      const peakCutoff = Math.max(20, Math.min(18000, baseCutoff + filtOffset));

      for (const f of this.nodes.vcf) {
        f.frequency.cancelScheduledValues(now);
        f.frequency.setValueAtTime(peakCutoff, now);
        f.frequency.exponentialRampToValueAtTime(
          Math.max(baseCutoff, 20), now + filtDecay
        );
      }
    }

    // VCA envelope (decay-only with fast/slow attack)
    const vcaDecay = this.state.vcaEg.decay;
    const attackTime = this.state.vcaEg.fast ? 0.001 : 0.05;
    const vca = this.nodes.vca.gain;
    vca.cancelScheduledValues(now);
    vca.setValueAtTime(0, now);
    vca.linearRampToValueAtTime(velocity, now + attackTime);
    vca.exponentialRampToValueAtTime(0.001, now + attackTime + vcaDecay);
    vca.setValueAtTime(0, now + attackTime + vcaDecay + 0.001);

    // Update pitch EG output for patch bay
    if (this.nodes.pitchEgOut) {
      const pitchAmt = (this.state.pitchEg.amount - 0.5) * 2;
      this.nodes.pitchEgOut.offset.value = pitchAmt * 2000 * velocity;
    }
  }

  // For compatibility - triggerNote uses the pitch to set VCO frequencies
  triggerNote(midiNote) {
    const freq = this.midiToFreq(midiNote);
    this.state.vco1.frequency = freq;
    this.state.vco2.frequency = freq * (this.state.vco2.frequency / this.state.vco1.frequency || 1.5);
    this.trigger(1.0);
  }

  releaseNote() {
    // Edge is percussion - no sustained notes, decay handles everything
  }

  setParam(path, value) {
    this._setStatePath(path, value);
    if (!this.initialized) return;
    this._applyParam(path, value);
  }

  applyParam(path, value) {
    this._setStatePath(path, value, false);
    if (!this.initialized) return;
    this._applyParam(path, value);
  }

  _applyParam(path, value) {
    switch (path) {
      case 'vco1.frequency':
        this.nodes.vco1.frequency.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        break;
      case 'vco1.shape':
        this.nodes.vco1.type = value;
        break;
      case 'vco1.level':
        this.nodes.vco1Gain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        break;
      case 'vco2.frequency':
        this.nodes.vco2.frequency.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        break;
      case 'vco2.shape':
        this.nodes.vco2.type = value;
        break;
      case 'vco2.level':
        this.nodes.vco2Gain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        break;
      case 'fm.amount':
        this.nodes.fmGain.gain.setTargetAtTime(value * 500, this.ctx.currentTime, 0.01);
        break;
      case 'noise.level':
        this.nodes.noiseGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        break;
      case 'noise.type':
        // Would need to recreate noise node for type change
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
      case 'volume':
        this.nodes.level.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
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

    this.nodes.vco1.type = this.state.vco1.shape;
    this.nodes.vco1.frequency.value = this.state.vco1.frequency;
    this.nodes.vco1Gain.gain.value = this.state.vco1.level;
    this.nodes.vco2.type = this.state.vco2.shape;
    this.nodes.vco2.frequency.value = this.state.vco2.frequency;
    this.nodes.vco2Gain.gain.value = this.state.vco2.level;
    this.nodes.fmGain.gain.value = this.state.fm.amount * 500;
    this.nodes.noiseGain.gain.value = this.state.noise.level;
    this.setFilterCutoff(this.nodes.vcf, this.state.vcf.cutoff);
    this.setFilterResonance(this.nodes.vcf, this.state.vcf.resonance);
    this.setFilterType(this.nodes.vcf, this.state.vcf.type);
    this.nodes.level.gain.value = this.state.volume;

    if (this.state.seq.running && !this.sequencerInterval) {
      this.startSequencer();
    } else if (!this.state.seq.running && this.sequencerInterval) {
      this.stopSequencer();
    }
  }

  // Sequencer - dual row: pitch + velocity
  startSequencer() {
    if (this.sequencerInterval) return;
    this.state.seq.running = true;
    this.sequencerStep = 0;

    const tick = () => {
      const stepTime = (60 / this.state.seq.tempo) * 1000 / 4;
      const step = this.sequencerStep % this.state.seq.numSteps;

      const note = this.state.seq.pitchSteps[step];
      const vel = this.state.seq.velSteps[step];

      // Set frequencies from pitch step
      this.state.vco1.frequency = this.midiToFreq(note);
      this.state.vco2.frequency = this.midiToFreq(note) * 1.5; // default ratio
      if (this.initialized) {
        this.nodes.vco1.frequency.value = this.state.vco1.frequency;
        this.nodes.vco2.frequency.value = this.state.vco2.frequency;
      }

      this.trigger(vel);

      // Update patch output nodes
      if (this.nodes.seqPitchCV) this.nodes.seqPitchCV.offset.value = this.midiToFreq(note);
      if (this.nodes.seqVelCV) this.nodes.seqVelCV.offset.value = vel * 100;

      if (this.onSequencerStep) this.onSequencerStep('edge', step);
      this.sequencerStep++;
      this.sequencerInterval = setTimeout(tick, stepTime);
    };
    tick();
  }

  stopSequencer() {
    this.state.seq.running = false;
    this._stopSequencer();
  }

  // Patch bay
  static PATCH_OUTPUTS = [
    { id: 'vco1', label: 'VCO1' },
    { id: 'vco2', label: 'VCO2' },
    { id: 'noise', label: 'NOISE' },
    { id: 'pitch_eg', label: 'P.EG' },
    { id: 'seq_pitch', label: 'SEQ P' },
    { id: 'seq_vel', label: 'SEQ V' },
  ];

  static PATCH_INPUTS = [
    { id: 'vco1_freq', label: 'VCO1' },
    { id: 'vco2_freq', label: 'VCO2' },
    { id: 'vcf_cutoff', label: 'CUTOFF' },
    { id: 'vca_level', label: 'VCA' },
    { id: 'fm_amt', label: 'FM' },
    { id: 'tempo', label: 'TEMPO' },
  ];

  getPatchOutput(id) {
    if (!this.initialized) return null;
    switch (id) {
      case 'vco1': return this.nodes.vco1Gain;
      case 'vco2': return this.nodes.vco2Gain;
      case 'noise': return this.nodes.noiseGain;
      case 'pitch_eg': return this.nodes.pitchEgOut;
      case 'seq_pitch': return this.nodes.seqPitchCV;
      case 'seq_vel': return this.nodes.seqVelCV;
      default: return null;
    }
  }

  getPatchInput(id) {
    if (!this.initialized) return null;
    switch (id) {
      case 'vco1_freq': return this.nodes.vco1.frequency;
      case 'vco2_freq': return this.nodes.vco2.frequency;
      case 'vcf_cutoff': return this.nodes.vcf[0].frequency;
      case 'vca_level': return this.nodes.level.gain;
      case 'fm_amt': return this.nodes.fmGain.gain;
      case 'tempo': return this.nodes.tempoIn.gain;
      default: return null;
    }
  }
}
