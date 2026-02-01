// Spice Synth Engine - Behringer Spice / Moog Subharmonicon clone
// Polyrhythmic synth: 2 VCOs + 4 sub-oscillators, dual 4-step sequencers, 4 rhythm dividers

class SynthSpice extends SynthBase {
  constructor() {
    super('spice');
    this.state = this.getDefaultState();
    this.rhythmCounters = [0, 0, 0, 0];
    this.masterTick = 0;
  }

  getDefaultState() {
    return {
      vco1: {
        frequency: 220,
        shape: 'square', // 'square' or 'sawtooth'
        level: 0.7,
      },
      vco2: {
        frequency: 330,
        shape: 'square',
        level: 0.5,
      },
      sub: [
        { division: 2, level: 0.4 }, // sub1 of VCO1
        { division: 4, level: 0.3 }, // sub2 of VCO1
        { division: 3, level: 0.4 }, // sub3 of VCO2
        { division: 5, level: 0.3 }, // sub4 of VCO2
      ],
      vcf: {
        cutoff: 2000,
        resonance: 0.5,
      },
      vcfEg: {
        attack: 0.01,
        decay: 0.3,
        amount: 0.5,
      },
      vcaEg: {
        attack: 0.01,
        decay: 0.5,
      },
      seq1: {
        steps: [60, 64, 67, 72], // 4 notes -> VCO1
        currentStep: 0,
      },
      seq2: {
        steps: [55, 59, 62, 67], // 4 notes -> VCO2
        currentStep: 0,
      },
      rhythm: [
        { division: 1 }, // clocks seq1
        { division: 2 }, // clocks seq1
        { division: 3 }, // clocks seq2
        { division: 4 }, // clocks seq2
      ],
      tempo: 120,
      running: false,
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

    // 4 Sub-oscillators
    this.nodes.subs = [];
    this.nodes.subGains = [];
    for (let i = 0; i < 4; i++) {
      const parentFreq = i < 2 ? this.state.vco1.frequency : this.state.vco2.frequency;
      const sub = this.ctx.createOscillator();
      sub.type = 'sawtooth'; // subs always sawtooth
      sub.frequency.value = parentFreq / this.state.sub[i].division;
      const gain = this.ctx.createGain();
      gain.gain.value = this.state.sub[i].level;
      this.nodes.subs.push(sub);
      this.nodes.subGains.push(gain);
    }

    // Mixer
    this.nodes.mixer = this.ctx.createGain();
    this.nodes.mixer.gain.value = 0.5; // scale down since 6 oscillators

    // VCF
    this.nodes.vcf = this.createLadderFilter(this.state.vcf.cutoff, this.state.vcf.resonance);

    // VCA
    this.nodes.vca = this.ctx.createGain();
    this.nodes.vca.gain.value = 0;

    // Volume
    this.nodes.level = this.ctx.createGain();
    this.nodes.level.gain.value = this.state.volume;

    // Routing
    this.nodes.vco1.connect(this.nodes.vco1Gain);
    this.nodes.vco1Gain.connect(this.nodes.mixer);
    this.nodes.vco2.connect(this.nodes.vco2Gain);
    this.nodes.vco2Gain.connect(this.nodes.mixer);

    for (let i = 0; i < 4; i++) {
      this.nodes.subs[i].connect(this.nodes.subGains[i]);
      this.nodes.subGains[i].connect(this.nodes.mixer);
    }

    let prev = this.nodes.mixer;
    for (const f of this.nodes.vcf) {
      prev.connect(f);
      prev = f;
    }
    prev.connect(this.nodes.vca);
    this.nodes.vca.connect(this.nodes.level);
    this.nodes.level.connect(this.output);

    // Patch output nodes: filter EG, seq1 CV, seq2 CV
    this.nodes.vcfEgOut = this.ctx.createConstantSource();
    this.nodes.vcfEgOut.offset.value = 0;
    this.nodes.vcfEgOut.start();
    this.nodes.seq1CV = this.ctx.createConstantSource();
    this.nodes.seq1CV.offset.value = 0;
    this.nodes.seq1CV.start();
    this.nodes.seq2CV = this.ctx.createConstantSource();
    this.nodes.seq2CV.offset.value = 0;
    this.nodes.seq2CV.start();

    // Patch input: tempo modulation and sub CV
    this.nodes.tempoIn = this.ctx.createGain();
    this.nodes.tempoIn.gain.value = 0;
    const tempoSink = this.ctx.createGain();
    tempoSink.gain.value = 0;
    this.nodes.tempoIn.connect(tempoSink);
    tempoSink.connect(this.ctx.destination);
    // Sub CV: modulates all sub-oscillator frequencies
    this.nodes.subCVIn = this.ctx.createGain();
    this.nodes.subCVIn.gain.value = 1;
    for (let i = 0; i < 4; i++) {
      this.nodes.subCVIn.connect(this.nodes.subs[i].frequency);
    }

    // Start all oscillators
    this.nodes.vco1.start();
    this.nodes.vco2.start();
    for (const sub of this.nodes.subs) sub.start();

    this.initialized = true;
  }

  // Update sub-oscillator frequencies based on parent VCO
  _updateSubFrequencies() {
    if (!this.initialized) return;
    for (let i = 0; i < 4; i++) {
      const parentFreq = i < 2 ? this.state.vco1.frequency : this.state.vco2.frequency;
      const freq = parentFreq / this.state.sub[i].division;
      this.nodes.subs[i].frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.01);
    }
  }

  // Trigger with AD envelopes
  _triggerEnvelopes() {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;

    // VCA AD envelope
    const vcaAtk = this.state.vcaEg.attack;
    const vcaDec = this.state.vcaEg.decay;
    const vca = this.nodes.vca.gain;
    vca.cancelScheduledValues(now);
    vca.setValueAtTime(0, now);
    vca.linearRampToValueAtTime(1.0, now + vcaAtk);
    vca.exponentialRampToValueAtTime(0.001, now + vcaAtk + vcaDec);

    // VCF AD envelope
    const vcfAtk = this.state.vcfEg.attack;
    const vcfDec = this.state.vcfEg.decay;
    const vcfAmt = this.state.vcfEg.amount;
    const baseCutoff = this.state.vcf.cutoff;
    const peakCutoff = Math.min(baseCutoff + vcfAmt * 8000, 18000);

    for (const f of this.nodes.vcf) {
      f.frequency.cancelScheduledValues(now);
      f.frequency.setValueAtTime(baseCutoff, now);
      f.frequency.linearRampToValueAtTime(peakCutoff, now + vcfAtk);
      f.frequency.exponentialRampToValueAtTime(Math.max(baseCutoff, 20), now + vcfAtk + vcfDec);
    }

    // Update filter EG output for patch bay
    if (this.nodes.vcfEgOut) {
      this.nodes.vcfEgOut.offset.value = vcfAmt * (peakCutoff - baseCutoff);
    }
  }

  triggerNote(midiNote) {
    if (!this.initialized) return;
    const freq = this.midiToFreq(midiNote);
    this.state.vco1.frequency = freq;
    this.nodes.vco1.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.01);
    this._updateSubFrequencies();
    this._triggerEnvelopes();
  }

  releaseNote() {
    // AD envelope - no sustained notes
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
    // Handle sub-oscillator array params: sub.0.division, sub.0.level, etc.
    const subMatch = path.match(/^sub\.(\d+)\.(division|level)$/);
    if (subMatch) {
      const idx = parseInt(subMatch[1]);
      if (subMatch[2] === 'level') {
        this.nodes.subGains[idx].gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
      } else if (subMatch[2] === 'division') {
        this._updateSubFrequencies();
      }
      return;
    }

    const rhythmMatch = path.match(/^rhythm\.(\d+)\.division$/);
    if (rhythmMatch) return; // rhythm divisions just stored in state

    const seqMatch = path.match(/^seq[12]\.steps\.(\d+)$/);
    if (seqMatch) return; // step values just stored in state

    switch (path) {
      case 'vco1.frequency':
        this.nodes.vco1.frequency.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        this._updateSubFrequencies();
        break;
      case 'vco1.shape':
        this.nodes.vco1.type = value;
        break;
      case 'vco1.level':
        this.nodes.vco1Gain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        break;
      case 'vco2.frequency':
        this.nodes.vco2.frequency.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        this._updateSubFrequencies();
        break;
      case 'vco2.shape':
        this.nodes.vco2.type = value;
        break;
      case 'vco2.level':
        this.nodes.vco2Gain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        break;
      case 'vcf.cutoff':
        this.setFilterCutoff(this.nodes.vcf, value);
        break;
      case 'vcf.resonance':
        this.setFilterResonance(this.nodes.vcf, value);
        break;
      case 'volume':
        this.nodes.level.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        break;
      case 'running':
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

    for (let i = 0; i < 4; i++) {
      this.nodes.subGains[i].gain.value = this.state.sub[i].level;
    }
    this._updateSubFrequencies();

    this.setFilterCutoff(this.nodes.vcf, this.state.vcf.cutoff);
    this.setFilterResonance(this.nodes.vcf, this.state.vcf.resonance);
    this.nodes.level.gain.value = this.state.volume;

    if (this.state.running && !this.sequencerInterval) {
      this.startSequencer();
    } else if (!this.state.running && this.sequencerInterval) {
      this.stopSequencer();
    }
  }

  // Polyrhythmic sequencer
  startSequencer() {
    if (this.sequencerInterval) return;
    this.state.running = true;
    this.masterTick = 0;
    this.rhythmCounters = [0, 0, 0, 0];
    this.state.seq1.currentStep = 0;
    this.state.seq2.currentStep = 0;

    const tick = () => {
      const stepTime = (60 / this.state.tempo) * 1000 / 4; // base clock = 16th notes
      let seq1Advanced = false;
      let seq2Advanced = false;

      // Check each rhythm divider
      for (let r = 0; r < 4; r++) {
        const div = this.state.rhythm[r].division;
        if (this.masterTick % div === 0) {
          if (r < 2) {
            // Rhythm 1&2 clock seq1
            if (!seq1Advanced) {
              const step = this.state.seq1.currentStep % 4;
              const note = this.state.seq1.steps[step];
              const freq = this.midiToFreq(note);

              this.state.vco1.frequency = freq;
              if (this.initialized) {
                this.nodes.vco1.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.005);
                if (this.nodes.seq1CV) this.nodes.seq1CV.offset.value = freq;
              }
              this._updateSubFrequencies();
              this._triggerEnvelopes();

              this.state.seq1.currentStep = (step + 1) % 4;
              seq1Advanced = true;
            }
          } else {
            // Rhythm 3&4 clock seq2
            if (!seq2Advanced) {
              const step = this.state.seq2.currentStep % 4;
              const note = this.state.seq2.steps[step];
              const freq = this.midiToFreq(note);

              this.state.vco2.frequency = freq;
              if (this.initialized) {
                this.nodes.vco2.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.005);
                if (this.nodes.seq2CV) this.nodes.seq2CV.offset.value = freq;
              }
              this._updateSubFrequencies();
              // Only trigger envelopes if seq1 didn't already
              if (!seq1Advanced) this._triggerEnvelopes();

              this.state.seq2.currentStep = (step + 1) % 4;
              seq2Advanced = true;
            }
          }
        }
      }

      if (this.onSequencerStep) {
        this.onSequencerStep('spice', {
          seq1Step: this.state.seq1.currentStep,
          seq2Step: this.state.seq2.currentStep,
          tick: this.masterTick,
        });
      }

      this.masterTick++;
      this.sequencerInterval = setTimeout(tick, stepTime);
    };
    tick();
  }

  stopSequencer() {
    this.state.running = false;
    this._stopSequencer();
  }

  // Patch bay
  static PATCH_OUTPUTS = [
    { id: 'vco1', label: 'VCO1' },
    { id: 'vco2', label: 'VCO2' },
    { id: 'sub_mix', label: 'SUBS' },
    { id: 'vcf_eg', label: 'F.EG' },
    { id: 'seq1', label: 'SEQ1' },
    { id: 'seq2', label: 'SEQ2' },
  ];

  static PATCH_INPUTS = [
    { id: 'vco1_freq', label: 'VCO1' },
    { id: 'vco2_freq', label: 'VCO2' },
    { id: 'vcf_cutoff', label: 'CUTOFF' },
    { id: 'vca_level', label: 'VCA' },
    { id: 'sub_cv', label: 'SUB CV' },
    { id: 'tempo', label: 'TEMPO' },
  ];

  getPatchOutput(id) {
    if (!this.initialized) return null;
    switch (id) {
      case 'vco1': return this.nodes.vco1Gain;
      case 'vco2': return this.nodes.vco2Gain;
      case 'sub_mix': return this.nodes.mixer;
      case 'vcf_eg': return this.nodes.vcfEgOut;
      case 'seq1': return this.nodes.seq1CV;
      case 'seq2': return this.nodes.seq2CV;
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
      case 'sub_cv': return this.nodes.subCVIn.gain;
      case 'tempo': return this.nodes.tempoIn.gain;
      default: return null;
    }
  }
}
