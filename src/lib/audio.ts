// Procedurally generated ambient drone + birth chime — no assets needed.

let ctx: AudioContext | null = null;
let droneNodes: { stop: () => void } | null = null;
let masterGain: GainNode | null = null;
let muted = true;

function getCtx(): AudioContext {
  if (!ctx) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 0.18;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

export function startDrone() {
  const c = getCtx();
  if (droneNodes) return;
  if (c.state === "suspended") c.resume();

  // Three slowly detuned sine oscillators + lowpassed pink-noise wash
  const oscFreqs = [55, 82.5, 110.5];
  const oscs: OscillatorNode[] = [];
  const gains: GainNode[] = [];

  oscFreqs.forEach((f) => {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.value = 0.0;
    g.gain.linearRampToValueAtTime(0.4, c.currentTime + 6);

    // Slow LFO on gain for breathing
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.05 + Math.random() * 0.08;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.15;
    lfo.connect(lfoGain).connect(g.gain);
    lfo.start();

    o.connect(g).connect(masterGain!);
    o.start();
    oscs.push(o);
    gains.push(g);
  });

  // Filtered noise wash
  const bufferSize = 2 * c.sampleRate;
  const noiseBuf = c.createBuffer(1, bufferSize, c.sampleRate);
  const out = noiseBuf.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    out[i] = (lastOut + 0.02 * white) / 1.02;
    lastOut = out[i];
    out[i] *= 3.5;
  }
  const noise = c.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const noiseFilter = c.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 380;
  const noiseGain = c.createGain();
  noiseGain.gain.value = 0;
  noiseGain.gain.linearRampToValueAtTime(0.12, c.currentTime + 8);
  noise.connect(noiseFilter).connect(noiseGain).connect(masterGain!);
  noise.start();

  droneNodes = {
    stop: () => {
      oscs.forEach((o) => o.stop());
      noise.stop();
      droneNodes = null;
    },
  };
}

export function chime() {
  const c = getCtx();
  if (c.state === "suspended") c.resume();
  const now = c.currentTime;
  // soft bell: stack of partials
  const partials = [880, 1320, 1760, 2640];
  partials.forEach((f, i) => {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const g = c.createGain();
    const peak = 0.18 / (i + 1);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4 + i * 0.3);
    o.connect(g).connect(masterGain!);
    o.start(now);
    o.stop(now + 3);
  });
}

export function setMuted(m: boolean) {
  muted = m;
  if (masterGain && ctx) {
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(m ? 0 : 0.18, ctx.currentTime + 0.6);
  }
}

export function isMuted() {
  return muted;
}
