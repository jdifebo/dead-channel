import type { MissionEvent } from '../game/mission.ts';

export class MissionAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private room?: GainNode;
  private noise?: AudioBuffer;
  enabled = true;

  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.context) this.create();
      void this.context?.resume().catch(() => undefined);
    } catch { this.enabled = false; }
  }

  private create() {
    const ctx = new AudioContext();
    this.context = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = .65;
    this.master.connect(ctx.destination);
    this.room = ctx.createGain();
    this.room.gain.value = 0;
    this.room.connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const motor = ctx.createBufferSource();
    motor.buffer = this.noise;
    motor.loop = true;
    const muffler = ctx.createBiquadFilter();
    muffler.type = 'lowpass';
    muffler.frequency.value = 155;
    motor.connect(muffler).connect(this.room);
    motor.start();
    for (const frequency of [48, 51.3, 97]) {
      const hum = ctx.createOscillator();
      const level = ctx.createGain();
      hum.frequency.value = frequency;
      level.gain.value = .19;
      hum.connect(level).connect(this.room);
      hum.start();
    }
  }

  mix(active: boolean, alarm: boolean) {
    const ctx = this.context;
    if (!ctx) return;
    this.master!.gain.setTargetAtTime(this.enabled ? .65 : 0, ctx.currentTime, .04);
    this.room!.gain.setTargetAtTime(active ? (alarm ? .16 : .095) : 0, ctx.currentTime, .22);
  }

  private tone(frequency: number, to: number, time: number, volume: number, delay = 0, type: OscillatorType = 'sine') {
    const ctx = this.context!;
    const start = ctx.currentTime + delay;
    const node = ctx.createOscillator(), gain = ctx.createGain();
    node.type = type;
    node.frequency.setValueAtTime(frequency, start);
    node.frequency.exponentialRampToValueAtTime(to, start + time);
    gain.gain.setValueAtTime(.001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(.026, time / 3));
    gain.gain.exponentialRampToValueAtTime(.001, start + time);
    node.connect(gain).connect(this.master!);
    node.start(start);
    node.stop(start + time + .02);
  }

  private tick(frequency: number, duration: number, volume: number) {
    const ctx = this.context!;
    const node = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    node.buffer = this.noise!;
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = .85;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
    node.connect(filter).connect(gain).connect(this.master!);
    node.start(0, Math.random() * 2, duration);
  }

  play(event: MissionEvent, hidden: boolean) {
    if (!this.context || !this.enabled) return;
    switch (event.kind) {
      case 'step': this.tick(event.heavy ? 180 : 330, .085, event.heavy ? .23 : hidden ? .032 : .12); break;
      case 'throw': this.tick(1250, .13, .09); break;
      case 'impact': this.tick(2550, .17, .27); this.tone(995, 820, .24, .13, 0, 'triangle'); break;
      case 'suspicion': this.tone(455, 615, .25, .12); break;
      case 'alarm':
        for (let i = 0; i < 3; i++) this.tone(340, 530, .32, .22, i * .40, 'triangle');
        break;
      case 'power': this.tone(420, 170, .36, .17, 0, 'triangle'); break;
      case 'recording': this.tone(310, 440, .23, .15); this.tone(620, 680, .35, .13, .17); break;
      case 'escaped': [261, 330, 392, 524].forEach((note, i) => this.tone(note, note, .62, .15, i * .115)); break;
      case 'caught': this.tone(163, 47, .72, .35, 0, 'triangle'); break;
    }
  }
}
