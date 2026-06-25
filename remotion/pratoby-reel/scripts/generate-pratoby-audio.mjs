import fs from "node:fs";
import path from "node:path";

const sampleRate = 48000;
const outDir = path.resolve("public/audio");

fs.mkdirSync(outDir, { recursive: true });

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (a, b, t) => a + (b - a) * t;
const expDecay = (t, speed) => Math.exp(-t * speed);
const sine = (frequency, t) => Math.sin(2 * Math.PI * frequency * t);
const triangle = (frequency, t) => (2 / Math.PI) * Math.asin(sine(frequency, t));

let seed = 1337;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 0xffffffff) * 2 - 1;
};

const makeSmoothNoise = (smoothing = 0.94) => {
  let state = 0;

  return () => {
    state = state * smoothing + noise() * (1 - smoothing);
    return state;
  };
};

const envelope = (t, duration, attack = 0.01, release = 0.1) => {
  const fadeIn = clamp(t / attack, 0, 1);
  const fadeOut = clamp((duration - t) / release, 0, 1);
  return Math.min(fadeIn, fadeOut);
};

const writeWav = (filename, duration, renderer) => {
  const frames = Math.ceil(duration * sampleRate);
  const channels = 2;
  const bytesPerSample = 2;
  const dataSize = frames * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bytesPerSample * 8, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  const samples = new Float32Array(frames * channels);
  let peak = 0;

  for (let i = 0; i < frames; i += 1) {
    const t = i / sampleRate;
    const [left, right] = renderer(t, duration);
    const l = clamp(left, -1, 1);
    const r = clamp(right, -1, 1);
    samples[i * 2] = l;
    samples[i * 2 + 1] = r;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
  }

  const gain = peak > 0 ? Math.min(0.92 / peak, 1) : 1;

  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.round(clamp(samples[i] * gain, -1, 1) * 32767);
    buffer.writeInt16LE(value, 44 + i * 2);
  }

  fs.writeFileSync(path.join(outDir, filename), buffer);
  console.log(`${filename} ${duration.toFixed(2)}s`);
};

const stereo = (value, pan = 0) => {
  const left = value * Math.sqrt((1 - pan) / 2);
  const right = value * Math.sqrt((1 + pan) / 2);
  return [left, right];
};

const makeWhooshRenderer = ({
  startFrequency,
  endFrequency,
  duration,
  air = 0.14,
  tone = 0.12,
  low = 0.12,
  attack = 0.03,
  release = 0.26,
  curve = 1,
  panFrom = -0.12,
  panTo = 0.12,
  reverse = false,
  shimmer = 0.02,
}) => {
  const filteredNoise = makeSmoothNoise(0.965);
  const secondNoise = makeSmoothNoise(0.985);

  return (t) => {
    const rawProgress = clamp(t / duration, 0, 1);
    const progress = reverse ? 1 - rawProgress : rawProgress;
    const shaped = Math.pow(progress, curve);
    const swell = Math.sin(Math.PI * rawProgress);
    const tail = expDecay(Math.max(0, t - duration * 0.55), 4.2);
    const sweepFrequency = lerp(startFrequency, endFrequency, shaped);
    const harmonicFrequency = lerp(startFrequency * 1.8, endFrequency * 1.25, shaped);
    const airLayer = filteredNoise() * swell * air;
    const softLayer = secondNoise() * Math.pow(swell, 1.6) * air * 0.42;
    const tonalSweep =
      sine(sweepFrequency, t) * swell * tone +
      triangle(harmonicFrequency, t) * Math.pow(swell, 1.4) * tone * 0.18;
    const lowLift = sine(lerp(52, 86, shaped), t) * tail * low * (rawProgress > 0.28 ? 1 : rawProgress / 0.28);
    const highShimmer = sine(lerp(2600, 4100, shaped), t) * Math.pow(swell, 2.2) * shimmer;
    const pan = lerp(panFrom, panTo, rawProgress);

    return stereo(
      (airLayer + softLayer + tonalSweep + lowLift + highShimmer) *
        envelope(t, duration, attack, release),
      pan,
    );
  };
};

writeWav("sfx-cut.wav", 0.11, (t, duration) => {
  const click = noise() * expDecay(t, 90) * 0.52;
  const tick = sine(1800, t) * expDecay(t, 55) * 0.3;
  const body = sine(180, t) * expDecay(t, 38) * 0.15;
  return stereo((click + tick + body) * envelope(t, duration, 0.001, 0.055));
});

writeWav("sfx-pop.wav", 0.22, (t, duration) => {
  const pitch = lerp(720, 430, clamp(t / duration, 0, 1));
  const tone = (sine(pitch, t) + triangle(pitch * 1.5, t) * 0.34) * expDecay(t, 15);
  const snap = noise() * expDecay(t, 65) * 0.08;
  return stereo((tone * 0.62 + snap) * envelope(t, duration, 0.003, 0.12), 0.06);
});

writeWav(
  "sfx-whoosh.wav",
  0.66,
  makeWhooshRenderer({
    startFrequency: 260,
    endFrequency: 980,
    duration: 0.66,
    air: 0.1,
    tone: 0.13,
    low: 0.08,
    curve: 0.88,
    panFrom: -0.08,
    panTo: 0.1,
    shimmer: 0.018,
  }),
);

writeWav(
  "sfx-whoosh-soft.wav",
  0.78,
  makeWhooshRenderer({
    startFrequency: 180,
    endFrequency: 720,
    duration: 0.78,
    air: 0.075,
    tone: 0.085,
    low: 0.035,
    attack: 0.05,
    release: 0.34,
    curve: 1.15,
    panFrom: -0.05,
    panTo: 0.07,
    shimmer: 0.014,
  }),
);

writeWav(
  "sfx-whoosh-fast.wav",
  0.38,
  makeWhooshRenderer({
    startFrequency: 420,
    endFrequency: 1500,
    duration: 0.38,
    air: 0.08,
    tone: 0.15,
    low: 0.045,
    attack: 0.01,
    release: 0.16,
    curve: 0.7,
    panFrom: 0.1,
    panTo: -0.08,
    shimmer: 0.026,
  }),
);

writeWav(
  "sfx-whoosh-deep.wav",
  0.88,
  makeWhooshRenderer({
    startFrequency: 120,
    endFrequency: 620,
    duration: 0.88,
    air: 0.09,
    tone: 0.1,
    low: 0.18,
    attack: 0.04,
    release: 0.38,
    curve: 1,
    panFrom: -0.14,
    panTo: 0.14,
    shimmer: 0.01,
  }),
);

writeWav("sfx-cash.wav", 0.78, (t, duration) => {
  const hits = [0.02, 0.14, 0.27, 0.42];
  let sparkle = 0;

  for (const [index, hit] of hits.entries()) {
    const local = Math.max(0, t - hit);
    const active = t >= hit ? 1 : 0;
    const freq = [1420, 1850, 2240, 1680][index];
    sparkle += active * sine(freq, local) * expDecay(local, 18) * 0.26;
    sparkle += active * sine(freq * 1.5, local) * expDecay(local, 24) * 0.09;
  }

  const coin = sine(640, t) * expDecay(Math.max(0, t - 0.08), 8) * 0.18;
  return stereo((sparkle + coin) * envelope(t, duration, 0.003, 0.22), -0.04);
});

writeWav("sfx-ding.wav", 0.82, (t, duration) => {
  const first = sine(880, t) * expDecay(t, 6) * 0.42;
  const secondStart = Math.max(0, t - 0.08);
  const second = (t >= 0.08 ? sine(1320, secondStart) * expDecay(secondStart, 6.8) : 0) * 0.32;
  const shimmer = sine(2640, t) * expDecay(t, 10) * 0.08;
  return stereo((first + second + shimmer) * envelope(t, duration, 0.004, 0.3), 0.03);
});

writeWav("sfx-chime.wav", 1.38, (t, duration) => {
  const notes = [
    { at: 0, frequency: 523.25, pan: -0.12 },
    { at: 0.1, frequency: 659.25, pan: 0.12 },
    { at: 0.2, frequency: 783.99, pan: -0.04 },
    { at: 0.38, frequency: 1046.5, pan: 0.08 },
  ];

  let left = 0;
  let right = 0;

  for (const note of notes) {
    if (t < note.at) continue;
    const local = t - note.at;
    const value =
      (sine(note.frequency, local) * 0.36 +
        sine(note.frequency * 2, local) * 0.08 +
        triangle(note.frequency * 0.5, local) * 0.05) *
      expDecay(local, 3.2);
    const [l, r] = stereo(value, note.pan);
    left += l;
    right += r;
  }

  const lift = sine(210, t) * expDecay(Math.max(0, t - 0.18), 2.6) * 0.08;
  return [left + lift, right + lift];
});

writeWav("pratoby-bed.wav", 20, (t, duration) => {
  const bpm = 96;
  const beat = 60 / bpm;
  const bar = beat * 4;
  const barPhase = (t % bar) / bar;
  const progress = t / duration;
  const master = envelope(t, duration, 0.6, 1.2);

  const chords = [
    [174.61, 261.63, 329.63],
    [196.0, 293.66, 392.0],
    [220.0, 329.63, 440.0],
    [164.81, 246.94, 329.63],
  ];
  const chord = chords[Math.floor((t / bar) % chords.length)];

  let pad = 0;
  for (const frequency of chord) {
    pad += sine(frequency, t) * 0.032;
    pad += triangle(frequency * 0.5, t) * 0.018;
  }

  const pulse = Math.pow(Math.sin(Math.PI * barPhase), 2) * 0.055;
  const arpIndex = Math.floor((t / (beat / 2)) % chord.length);
  const arpLocal = t % (beat / 2);
  const arp = sine(chord[arpIndex] * 2, arpLocal) * expDecay(arpLocal, 8) * 0.045;
  const kickLocal = t % (beat * 2);
  const kick = sine(56, kickLocal) * expDecay(kickLocal, 18) * 0.08;
  const hatLocal = t % (beat / 2);
  const hat = noise() * expDecay(hatLocal, 58) * 0.012;
  const lift = sine(440 + progress * 160, t) * 0.01 * Math.sin(Math.PI * progress);
  const texture = noise() * 0.005;

  const value = (pad + pulse + arp + kick + hat + lift + texture) * master;
  return stereo(value, Math.sin(t * 0.45) * 0.08);
});
