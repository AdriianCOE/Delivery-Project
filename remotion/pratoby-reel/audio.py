"""
PratoBy Reel — gerador de áudio procedural melhorado
----------------------------------------------------
Gera os 6 arquivos que o PratoByReel.tsx espera em /public/audio:

  - pratoby-bed.wav   trilha ambiente comercial de 20s
  - sfx-whoosh.wav    transição de mockup/cena
  - sfx-pop.wav       confirmação curta de UI
  - sfx-cash.wav      acento sonoro para "sem comissão"
  - sfx-ding.wav      notificação de novo pedido
  - sfx-chime.wav     assinatura sonora final da marca

Tudo é sintetizado do zero com matemática: osciladores, ruído filtrado,
envelopes, delay estéreo e reverberação simples. Nenhum sample externo.

Uso:
  py -m pip install numpy scipy
  py audio_improved.py

Por padrão, salva em public/audio. Para escolher outra pasta:
  py audio_improved.py --out public/audio
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy import signal

SR = 48_000
RNG = np.random.default_rng(42)

# Escala principal: C maior com coloracao moderna / SaaS amigavel
C3 = 130.81
E3 = 164.81
G3 = 196.00
B3 = 246.94
C4 = 261.63
E4 = 329.63
G4 = 392.00
A4 = 440.00
B4 = 493.88
C5 = 523.25
E5 = 659.25
G5 = 783.99
B5 = 987.77
C6 = 1046.50
E6 = 1318.51


def db_to_amp(db: float) -> float:
    return 10 ** (db / 20)


def normalize(x: np.ndarray, peak: float = 0.92) -> np.ndarray:
    m = float(np.max(np.abs(x))) if x.size else 1.0
    if m <= 1e-9:
        return x
    return (x / m) * peak


def soft_limiter(x: np.ndarray, drive: float = 1.25, ceiling: float = 0.96) -> np.ndarray:
    y = np.tanh(x * drive) / np.tanh(drive)
    return np.clip(y, -ceiling, ceiling)


def to_int16(x: np.ndarray) -> np.ndarray:
    return np.clip(x * 32767, -32768, 32767).astype(np.int16)


def seconds(value: float) -> int:
    return int(round(value * SR))


def mono_time(duration: float) -> np.ndarray:
    return np.arange(seconds(duration)) / SR


def sine(freq: float, n: int, phase: float = 0.0) -> np.ndarray:
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * t + phase)


def chirp(f0: float, f1: float, duration: float, method: str = "quadratic") -> np.ndarray:
    t = mono_time(duration)
    return signal.chirp(t, f0=f0, f1=f1, t1=duration, method=method)


def env_adsr(n: int, attack: float, decay: float, sustain: float, release: float) -> np.ndarray:
    a = max(1, seconds(attack))
    d = max(1, seconds(decay))
    r = max(1, seconds(release))
    s = max(0, n - a - d - r)

    env = np.concatenate([
        np.linspace(0, 1, a, endpoint=False) ** 0.7,
        np.linspace(1, sustain, d, endpoint=False) ** 1.25,
        np.full(s, sustain),
        np.linspace(sustain, 0, r, endpoint=True) ** 1.6,
    ])

    if len(env) < n:
        env = np.pad(env, (0, n - len(env)))
    return env[:n]


def env_ad(n: int, attack: float, decay: float, curve: float = 1.7) -> np.ndarray:
    t = np.arange(n)
    a = np.clip(t / max(seconds(attack), 1), 0, 1) ** (1 / curve)
    d = np.clip((n - t) / max(seconds(decay), 1), 0, 1) ** curve
    return np.minimum(a, d)


def fade_edges(x: np.ndarray, fade_in: float = 0.006, fade_out: float = 0.018) -> np.ndarray:
    y = x.copy()
    n = y.shape[0]
    fi = min(seconds(fade_in), n // 2)
    fo = min(seconds(fade_out), n // 2)
    if fi > 0:
        y[:fi] *= np.linspace(0, 1, fi)[:, None] if y.ndim == 2 else np.linspace(0, 1, fi)
    if fo > 0:
        y[-fo:] *= np.linspace(1, 0, fo)[:, None] if y.ndim == 2 else np.linspace(1, 0, fo)
    return y


def butter_filter(x: np.ndarray, cutoff, btype: str, order: int = 3) -> np.ndarray:
    sos = signal.butter(order, cutoff, btype=btype, fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lowpass(x: np.ndarray, cutoff: float, order: int = 3) -> np.ndarray:
    return butter_filter(x, cutoff, "lowpass", order)


def highpass(x: np.ndarray, cutoff: float, order: int = 3) -> np.ndarray:
    return butter_filter(x, cutoff, "highpass", order)


def bandpass(x: np.ndarray, low: float, high: float, order: int = 2) -> np.ndarray:
    return butter_filter(x, [low, high], "bandpass", order)


def pan_mono(x: np.ndarray, pan: float = 0.0) -> np.ndarray:
    """pan -1 esquerda, 0 centro, 1 direita, equal-power."""
    pan = float(np.clip(pan, -1, 1))
    angle = (pan + 1) * np.pi / 4
    left = np.cos(angle)
    right = np.sin(angle)
    return np.stack([x * left, x * right], axis=1)


def stereo_delay(x: np.ndarray, left_ms: float = 0.0, right_ms: float = 24.0, feedback: float = 0.18) -> np.ndarray:
    if x.ndim == 1:
        st = pan_mono(x, 0)
    else:
        st = x.copy()

    n = st.shape[0]
    out = st.copy()
    for ch, delay_ms in enumerate([left_ms, right_ms]):
        d = seconds(delay_ms / 1000.0)
        if d > 0 and d < n:
            out[d:, ch] += st[:-d, ch] * feedback
    return out


def simple_reverb(stereo: np.ndarray, mix: float = 0.12) -> np.ndarray:
    if stereo.ndim == 1:
        stereo = pan_mono(stereo, 0)

    delays = [0.031, 0.047, 0.071, 0.109, 0.149]
    gains = [0.30, 0.23, 0.18, 0.13, 0.09]
    out = stereo.copy()
    wet = np.zeros_like(stereo)
    for i, (d_s, gain) in enumerate(zip(delays, gains)):
        d = seconds(d_s)
        if d >= len(stereo):
            continue
        # alterna reflexoes esquerda/direita para abrir o estéreo
        wet[d:, i % 2] += stereo[:-d, 0] * gain
        wet[d:, (i + 1) % 2] += stereo[:-d, 1] * gain * 0.88
    return out * (1 - mix) + wet * mix


def save_wav(path: str | Path, audio: np.ndarray, peak: float = 0.92) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    if audio.ndim == 1:
        audio = pan_mono(audio, 0)

    audio = np.nan_to_num(audio)
    audio = highpass(audio, 24, order=2) if audio.ndim == 1 else np.column_stack([
        highpass(audio[:, 0], 24, order=2),
        highpass(audio[:, 1], 24, order=2),
    ])
    audio = soft_limiter(normalize(audio, peak=peak), drive=1.15, ceiling=0.98)
    audio = fade_edges(audio)
    wavfile.write(path, SR, to_int16(audio))
    print(f"escrito: {path} ({audio.shape[0] / SR:.2f}s, {SR} Hz)")


def pluck(freq: float, duration: float, pan: float = 0.0, amp: float = 1.0) -> np.ndarray:
    n = seconds(duration)
    t = np.arange(n) / SR
    detune = 1.003
    tone = (
        np.sin(2 * np.pi * freq * t)
        + 0.45 * np.sin(2 * np.pi * freq * detune * t + 0.3)
        + 0.22 * np.sin(2 * np.pi * freq * 2.0 * t)
        + 0.08 * np.sin(2 * np.pi * freq * 3.01 * t)
    )
    click = lowpass(RNG.normal(0, 1, n), 5200) * env_ad(n, 0.001, 0.035) * 0.05
    env = env_adsr(n, 0.003, 0.16, 0.05, duration * 0.58)
    return pan_mono((tone + click) * env * amp, pan)


# ---------------------------------------------------------------------------
# SFX
# ---------------------------------------------------------------------------

def make_pop() -> np.ndarray:
    n = seconds(0.145)
    tonal = chirp(780, 1160, 0.055, "linear") * env_ad(seconds(0.055), 0.0015, 0.045)
    body = sine(520, n) * env_ad(n, 0.002, 0.115) * 0.38
    click = highpass(RNG.normal(0, 1, n), 3200) * env_ad(n, 0.0005, 0.018) * 0.05
    x = np.zeros(n)
    x[: len(tonal)] += tonal * 0.65
    x += body + click
    st = stereo_delay(pan_mono(x, 0.04), left_ms=0, right_ms=13, feedback=0.10)
    return simple_reverb(st, mix=0.08)


def make_cash() -> np.ndarray:
    duration = 0.56
    n = seconds(duration)
    out = np.zeros((n, 2))

    # duas notas brilhantes, menos caricato que caixa registradora tradicional
    starts = [0.00, 0.115]
    freqs = [B5, E6]
    pans = [-0.16, 0.18]
    for start, f, p in zip(starts, freqs, pans):
        s = seconds(start)
        note = pluck(f, 0.34, pan=p, amp=0.86)
        out[s : s + len(note)] += note[: max(0, min(len(note), n - s))]

    # textura curta de moeda, bem baixa
    coin_n = seconds(0.23)
    noise = bandpass(RNG.normal(0, 1, coin_n), 3500, 9000) * env_ad(coin_n, 0.001, 0.19) * 0.035
    coin = pan_mono(noise, 0.10)
    out[seconds(0.05) : seconds(0.05) + coin_n] += coin[: min(coin_n, n - seconds(0.05))]

    return simple_reverb(out, mix=0.18)


def make_ding() -> np.ndarray:
    duration = 0.62
    n = seconds(duration)
    out = np.zeros((n, 2))
    for start, f, p, amp in [(0.00, E6, -0.10, 0.70), (0.08, C6, 0.12, 0.52)]:
        s = seconds(start)
        note = pluck(f, 0.50, pan=p, amp=amp)
        out[s : s + len(note)] += note[: min(len(note), n - s)]
    return simple_reverb(out, mix=0.16)


def make_whoosh() -> np.ndarray:
    duration = 0.42
    n = seconds(duration)
    t = np.arange(n) / SR

    noise = RNG.normal(0, 1, n)
    sweep = bandpass(noise, 380, 7200, order=2)
    env = np.sin(np.linspace(0, np.pi, n)) ** 1.65

    # componente tonal muito discreto subindo, ajuda a parecer transicao premium
    tone = chirp(180, 620, duration, "quadratic") * np.sin(np.linspace(0, np.pi, n)) ** 2 * 0.10
    x = (sweep * 0.32 + tone) * env

    # panorama atravessando da esquerda para a direita
    left = x * np.cos((t / duration) * np.pi / 2)
    right = x * np.sin((t / duration) * np.pi / 2)
    return simple_reverb(np.stack([left, right], axis=1), mix=0.10)


def make_chime() -> np.ndarray:
    duration = 1.08
    n = seconds(duration)
    out = np.zeros((n, 2))
    notes = [(0.00, E5, -0.18), (0.11, G5, 0.10), (0.23, B5, 0.18), (0.37, C6, 0.0)]
    for start, f, p in notes:
        s = seconds(start)
        note = pluck(f, 0.70, pan=p, amp=0.64)
        out[s : s + len(note)] += note[: min(len(note), n - s)]

    low = sine(C4, n) * env_adsr(n, 0.02, 0.18, 0.26, 0.72) * 0.12
    out += pan_mono(low, 0)
    return simple_reverb(out, mix=0.22)


# ---------------------------------------------------------------------------
# Trilha de fundo — 20s, pensada para Reel de 600 frames @ 30fps
# ---------------------------------------------------------------------------

def make_bed(duration: float = 20.0) -> np.ndarray:
    n = seconds(duration)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))

    # Pad quente. Frequencias quantizadas para reduzir batimentos estranhos.
    for idx, f in enumerate([C3, E3, G3, B3, E4]):
        detune = [0.998, 1.000, 1.002][idx % 3]
        phase = idx * 0.67
        tone = (
            np.sin(2 * np.pi * f * detune * t + phase)
            + 0.23 * np.sin(2 * np.pi * f * 2.001 * t + phase * 0.5)
        )
        tone = lowpass(tone, 1800)
        lfo = 0.76 + 0.24 * np.sin(2 * np.pi * (0.05 + idx * 0.008) * t + phase)
        pan = [-0.26, 0.18, -0.08, 0.24, 0.0][idx]
        out += pan_mono(tone * lfo * 0.07, pan)

    # Pulso grave discreto, dá movimento sem parecer música pronta demais.
    beat_times = np.arange(0.0, duration, 1.0)
    for bt in beat_times:
        s = seconds(bt)
        length = seconds(0.40)
        if s + length > n:
            continue
        env = env_ad(length, 0.006, 0.36, curve=1.8)
        kick = sine(C3 / 2, length) * env * 0.055
        out[s : s + length] += pan_mono(kick, 0)

    # Arpejo leve a cada 2s. Melhora bastante a sensação comercial.
    arp = [C5, E5, G5, B5, G5, E5, A4, G5]
    step = 0.25
    for i, bt in enumerate(np.arange(0.50, duration - 0.45, step)):
        # deixa respiros para não competir com narração/texto
        if 8.0 < bt < 9.0 or 14.0 < bt < 15.0:
            continue
        f = arp[i % len(arp)]
        s = seconds(float(bt))
        note = pluck(f, 0.28, pan=-0.18 if i % 2 == 0 else 0.18, amp=0.11)
        out[s : s + len(note)] += note[: min(len(note), n - s)]

    # Hats/ruído orgânico quase imperceptível para dar acabamento.
    for bt in np.arange(0.75, duration, 0.5):
        s = seconds(float(bt))
        length = seconds(0.055)
        if s + length > n:
            continue
        hat = highpass(RNG.normal(0, 1, length), 6000) * env_ad(length, 0.001, 0.045) * 0.010
        out[s : s + length] += pan_mono(hat, -0.25 if int(bt * 2) % 2 == 0 else 0.25)

    # Intro/outro musical, não no arquivo inteiro: o Remotion já faz fade geral.
    master_env = np.ones(n)
    master_env[: seconds(0.20)] *= np.linspace(0, 1, seconds(0.20))
    master_env[-seconds(0.25) :] *= np.linspace(1, 0, seconds(0.25))
    out *= master_env[:, None]

    out = simple_reverb(out, mix=0.10)
    return normalize(out, peak=0.55)


def generate_all(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    save_wav(out_dir / "sfx-pop.wav", make_pop(), peak=0.84)
    save_wav(out_dir / "sfx-cash.wav", make_cash(), peak=0.82)
    save_wav(out_dir / "sfx-ding.wav", make_ding(), peak=0.82)
    save_wav(out_dir / "sfx-whoosh.wav", make_whoosh(), peak=0.58)
    save_wav(out_dir / "sfx-chime.wav", make_chime(), peak=0.82)
    save_wav(out_dir / "pratoby-bed.wav", make_bed(), peak=0.56)


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera áudios procedurais para o PratoBy Reel.")
    parser.add_argument("--out", default="public/audio", help="Pasta de saída. Padrão: public/audio")
    args = parser.parse_args()

    generate_all(Path(args.out))


if __name__ == "__main__":
    main()
