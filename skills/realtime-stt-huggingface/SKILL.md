---
name: realtime-stt-huggingface
description: >
  Real-time / streaming speech-to-text with Hugging Face models — Whisper,
  Distil-Whisper, Faster-Whisper (CTranslate2), NeMo Parakeet, MLX-Whisper.
  Trigger: streaming ASR, VAD (Silero / WebRTC), pyannote diarization, chunked
  audio, partial hypotheses, WebSocket / gRPC ASR server, mic capture, Korean
  STT, latency budget, Metal / CUDA / CPU deployment.
origin: custom
---

# Real-time STT with Hugging Face

Real-time transcription is a chain of small problems: capture → VAD →
chunking → ASR → post-processing → emit. Each link has its own latency budget;
the bottleneck is almost always the ASR model on your hardware. Pick the
model that fits the device, not the leaderboard.

## When to Activate

- Streaming / real-time transcription (mic, telephony, meeting bot)
- Choosing between Whisper variants (openai-whisper, faster-whisper,
  distil-whisper, MLX-Whisper, NeMo Parakeet)
- Adding VAD (Silero, py-webrtcvad)
- Speaker diarization (pyannote.audio)
- Designing a WebSocket / gRPC ASR server
- Korean-language tuning

## Model Selection Matrix

| Model | Engine | Latency (CPU) | Latency (GPU/MPS) | WER (en) | KO support |
|---|---|---|---|---|---|
| `whisper-large-v3-turbo` | transformers | slow | fast | best | excellent |
| `distil-whisper/large-v3` | transformers | medium | fast | near-large | good (en-bias) |
| `faster-whisper large-v3` | CTranslate2 | medium | very fast | best | excellent |
| `mlx-community/whisper-large-v3` | MLX | n/a | very fast (Apple) | best | excellent |
| `nvidia/parakeet-tdt-1.1b` | NeMo | n/a | fastest streaming | best on en | en only |

Rules of thumb:
- **Apple Silicon laptop / dev**: MLX-Whisper (Metal-accelerated, no CUDA) or
  faster-whisper with `compute_type="int8"`.
- **Linux GPU server**: faster-whisper (CTranslate2) — 4× faster than reference
  Whisper, same accuracy. Parakeet-TDT for English-only ultra-low latency.
- **CPU-only**: faster-whisper with `int8`, Distil-Whisper variant. Accept
  worse WER for tractable latency.
- **Korean / multilingual**: stick to Whisper-family (large-v3 / large-v3-turbo).
  Parakeet is English-only.

## Streaming Architecture

```
mic (16kHz mono PCM)
  → ring buffer (e.g. 30 s)
    → VAD (Silero, 30ms frames)
      → speech segments (≥ 200ms, with hangover)
        → ASR worker (chunked, overlapping)
          → partial + final hypotheses
            → post-processing (punctuation, ITN, KR/EN code-switching)
              → emit (WebSocket / gRPC stream)
```

Two principles that keep this sane:
1. **Whisper is not a streaming model.** It's a 30 s offline model. "Streaming"
   means feeding it overlapping windows + stitching results.
2. **VAD-gate everything.** Running ASR on silence wastes 50–80% of compute and
   produces hallucinated text ("Thanks for watching" is the canonical Whisper
   silence hallucination).

## Faster-Whisper Setup

```python
from faster_whisper import WhisperModel

# int8 quantisation — 4× smaller, ~same WER as fp16 for medium/large
model = WhisperModel(
    "large-v3",
    device="cuda",         # or "cpu" or "auto"
    compute_type="int8_float16",  # GPU; "int8" on CPU
)

segments, info = model.transcribe(
    audio_chunk_np,           # numpy float32 @ 16 kHz
    language="ko",            # pin language; auto-detect adds 1–2 s
    vad_filter=True,          # built-in Silero VAD
    vad_parameters={"min_silence_duration_ms": 500},
    beam_size=5,
    word_timestamps=True,     # required for partial-result alignment
    initial_prompt=context,   # bias on prior segment for vocabulary continuity
)
```

`segments` is a generator — yield-and-emit as they come in for streaming UX.

## Silero VAD

```python
import torch
model, utils = torch.hub.load(
    "snakers4/silero-vad", "silero_vad", trust_repo=True
)
(get_speech_timestamps, _, read_audio, _, _) = utils

speech = get_speech_timestamps(
    audio_tensor,           # 16 kHz mono
    model,
    sampling_rate=16000,
    min_speech_duration_ms=200,
    min_silence_duration_ms=300,
    speech_pad_ms=150,      # pad before/after for trailing phonemes
)
```

py-webrtcvad is lighter (10–30 ms frames, pure C) and fine for telephony, but
Silero is dramatically better in noisy environments.

## Chunking and Overlap

The standard pattern for streaming Whisper:
- **Chunk size**: 5–10 s (latency vs accuracy trade-off)
- **Overlap**: 1–2 s (catches words that straddle chunk boundaries)
- **Partial emit**: yield words from the *committed* region (everything before
  the overlap zone of the next chunk).
- **Final emit**: flush at end-of-utterance (VAD-detected silence > 700 ms).

`whisper-streaming` (https://github.com/ufal/whisper_streaming) implements
LocalAgreement-2, which is the practical reference.

## Diarization

pyannote.audio handles diarization (who-spoke-when) but is not real-time —
plan for ~0.05 RTF on GPU.

```python
from pyannote.audio import Pipeline

pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-3.1",
    use_auth_token=HF_TOKEN,
)
diarization = pipeline(audio_path, num_speakers=2)
# RTTM-style segments: speaker, start, end
```

For real-time: run diarization on a buffered window (e.g. last 30 s) every
3–5 s and reconcile with ASR timestamps. Or use online diarization via
pyannote's `OnlinePipeline` (lower quality, real-time).

## Server Skeleton (WebSocket)

```python
from fastapi import FastAPI, WebSocket
import numpy as np

app = FastAPI()

@app.websocket("/asr")
async def asr(ws: WebSocket):
    await ws.accept()
    buf = bytearray()
    try:
        while True:
            data = await ws.receive_bytes()  # PCM16 @ 16 kHz
            buf.extend(data)
            if len(buf) >= CHUNK_BYTES:
                audio = np.frombuffer(buf, dtype=np.int16).astype(np.float32) / 32768.0
                buf = bytearray()
                # run VAD + faster-whisper, emit partial / final
                async for segment in transcribe_stream(audio):
                    await ws.send_json({"type": segment.kind, "text": segment.text})
    except Exception:
        await ws.close()
```

Two practical choices:
- **One model instance per worker process**, not per connection — model load
  is ~5 s.
- **GPU concurrency**: serialize requests on a single GPU (queue + single
  worker), or shard across GPUs. Concurrent transcribe calls on one GPU
  thrash and reduce throughput.

## Latency Budget (target: <500 ms partial, <1.5 s final)

| Stage | Budget |
|---|---|
| Mic → ring buffer | <50 ms |
| VAD decision | <30 ms |
| Network (browser → server) | 50–150 ms |
| Faster-whisper large-v3 (GPU, 5 s chunk) | 200–400 ms |
| Punctuation / ITN | 20–50 ms |
| Server → client | 50–150 ms |

If you blow 500 ms partial latency on CPU: drop to Distil-Whisper or
`tiny`/`base` model, accept worse WER for interactivity. There's no free
lunch with Whisper-large on CPU.

## Korean-Language Tuning

- **Always pin `language="ko"`** — auto-detect costs 1–2 s and occasionally
  flips to Japanese on short utterances.
- **Use `initial_prompt`** with domain vocabulary (proper nouns, brand names)
  separated by spaces. Whisper biases on it.
- Whisper-large-v3 outputs **spaced Korean** ("안녕 하세요") — post-process to
  natural spacing using KoNLPy or `soynlp`.
- **Numbers / units**: Whisper transcribes "삼만 원" as "3만원" or "30000원"
  inconsistently. Add an ITN (inverse text normalisation) post-step if
  consistency matters.
- **Code-switching (Korean + English)**: Whisper-large handles it well;
  smaller variants drop English mid-sentence. Test on actual data.
- **Common Korean dataset references**: KsponSpeech (call center), Zeroth-Korean
  (read speech), AI-Hub conversational. KsponSpeech is closest to real-time
  conversational tone.

## Deployment Targets

| Target | When |
|---|---|
| **Local Mac (MLX)** | Dev, demos, single user. Silent + free. |
| **Modal / RunPod** | Bursty workloads, no DevOps. Pay-per-second GPU. |
| **HF Inference Endpoints** | Teams already on HF, autoscaling needed. |
| **Self-hosted GPU (Triton + faster-whisper)** | Steady high-RPS production. |
| **NVIDIA Riva** | Enterprise, Parakeet, real-time at scale. |

## Common Pitfalls

- **Hallucinated silence transcription** — VAD is mandatory. Never feed silence
  to Whisper.
- **Mismatched sample rate** — Whisper expects 16 kHz mono float32 in [-1, 1].
  Browsers default to 48 kHz; resample on capture.
- **Auto language detect on every chunk** — slow, unstable. Detect once, reuse.
- **Large-v3 on CPU** — unusable for streaming (~3× real-time). Drop to int8
  small or distil-whisper.
- **Single-worker GPU + concurrent calls** — Python GIL doesn't matter, GPU
  contention does. Use a request queue.
- **Emitting unstable partials** — partials should grow monotonically; use
  LocalAgreement (compare two consecutive hypotheses, emit common prefix).

## Related

- `[skills/python-data-analysis]` — for evaluation pipelines (WER, RTF metrics)
- `[skills/aws-bedrock]` — when the LLM post-processing step lives on Bedrock
- `[skills/fastapi-backend-best-practices]` — for the streaming server scaffold
