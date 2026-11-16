// Synthesised sound effects with WebAudio: no audio files are shipped, so the
// game stays fully offline. Everything is a short oscillator or noise burst.
// Audio starts only after the player's first gesture, as browsers require.

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context === null) {
      try {
        const Ctor = window.AudioContext ?? window.webkitAudioContext;
        context = new Ctor();
      } catch {
        context = null;
      }
    }
    if (context !== null && context.state === 'suspended') context.resume();
    return context;
  }

  function tone(freq, dur, type, gain, slideTo) {
    if (muted) return;
    const ctx = ensure();
    if (ctx === null) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  function noise(dur, gain, lowpass) {
    if (muted) return;
    const ctx = ensure();
    if (ctx === null) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const amp = ctx.createGain();
    amp.gain.value = gain;
    src.connect(filter).connect(amp).connect(ctx.destination);
    src.start();
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
    shoot() { tone(720, 0.08, 'square', 0.05, 340); },
    hit() { noise(0.09, 0.12, 1800); },
    kill() { tone(520, 0.14, 'triangle', 0.1, 180); },
    hurt() { tone(180, 0.25, 'sawtooth', 0.14, 70); },
    lanternHit() { tone(240, 0.3, 'sawtooth', 0.12, 90); },
    waveClear() { tone(523, 0.12, 'sine', 0.1); tone(659, 0.12, 'sine', 0.1); tone(784, 0.2, 'sine', 0.1); },
    upgrade() { tone(440, 0.1, 'sine', 0.1, 880); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sine', 0.1), i * 130)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.1), i * 150)); },
  };
}
