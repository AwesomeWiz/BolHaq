# Cloud Speech Fallback (TASK-002D)
# Saaras STT & Bulbul TTS Integration Guide

This document describes the design, implementation, and operations for BolHaq's optional cloud speech fallback using Sarvam AI.

---

## 1. Overview & Architecture

BolHaq is local-first. All core features (typed input, rule-based intent parsing, IndexedDB persistence, manual forms, and native browser speech recognition/synthesis) operate fully client-side without external dependencies.

On devices where browser Web Speech API capabilities are incomplete (such as iPhone Safari failing with `service-not-allowed` on `ml-IN` or silent no-result timeouts on `hi-IN`), BolHaq provides an explicit, opt-in fallback via secure Cloudflare Pages serverless proxy endpoints.

### Recognition Routing:
- **Android & Desktop**: Default to browser `SpeechRecognition`.
- **iOS English (`en-IN`)**: Uses browser `SpeechRecognition`.
- **iOS Hindi (`hi-IN`) & Malayalam (`ml-IN`)**: Cloud transcription is offered immediately, or after browser speech failures (`service-not-allowed`, `speechNoResult`, `timeout`).
- **Worker Choice**: Worker must explicitly tap to start recording, review the captured duration, and confirm "Send for transcription". Audio is never uploaded automatically.

### Wage-Balance Playback Routing:
- **Browser TTS First**: `speechSynthesis` is primed and checked with `voiceschanged`. If a compatible voice is found (e.g. on Android or desktop), it speaks locally.
- **Bulbul Fallback**: If no voice is found or playback fails for Hindi or Malayalam, BolHaq calls the `/api/speech/balance` proxy to generate audio via Sarvam `bulbul:v3` (using `shubh` for Hindi and `pooja` for Malayalam).
- **English**: Uses browser TTS exclusively.

---

## 2. Serverless Endpoints (Cloudflare Pages Functions)

Endpoints are located in `functions/api/speech/`:

### A. `POST /api/speech/transcribe`
- **Method**: Multipart FormData containing `audio` file and `locale` (`hi-IN` | `ml-IN`).
- **Upstream**: Sarvam Saaras v4 (`https://api.sarvam.ai/speech-to-text`) in `transcribe` mode.
- **Constraints**:
  - Maximum audio size: 256 KB (~8 seconds).
  - Allowed MIME types: `audio/mp4`, `audio/aac`, `audio/webm`, `audio/ogg`, `audio/wav`, `audio/mpeg`, `audio/flac`.
  - Rate limiting (when `SPEECH_KV` is bound): 3 requests/minute, 30 requests/day per IP.
  - Returns: `{ "transcript": "..." }` or clean error codes.

### B. `POST /api/speech/balance`
- **Method**: JSON payload: `{ "locale": "hi-IN" | "ml-IN", "paise": number, "balanceType": "outstanding" | "advance" | "settled" }`.
- **Privacy Assurance**: No employer/worksite names, ledger history, or worker identities are sent. The spoken message is built deterministically on the server from validated integer paise.
- **Upstream**: Sarvam Bulbul v3 (`https://api.sarvam.ai/text-to-speech`) using `shubh` (Hindi) and `pooja` (Malayalam).
- **Constraints**:
  - Rate limiting (when `SPEECH_KV` is bound): 10 requests/minute, 60 requests/day per IP.
  - Returns binary `audio/mpeg` with `Cache-Control: no-store`.

---

## 3. Cloudflare Pages Configuration

### Environment Variables & Secrets:
Configure these in the Cloudflare Dashboard under **Workers & Pages > BolHaq > Settings > Environment Variables**:

| Variable | Type | Default | Description |
|---|---|---|---|
| `SARVAM_API_KEY` | **Secret** (Encrypted) | None | Your private Sarvam AI API subscription key. Never commit this key or use `VITE_` prefix. |
| `CLOUD_SPEECH_ENABLED` | Text | `false` | Set to `"true"` to enable cloud proxy endpoints. If missing or `false`, endpoints return HTTP 503 `disabled`. |

### Optional KV Rate Limiting:
To enforce atomic per-IP quotas across serverless edge instances:
1. Create a Cloudflare KV namespace named `BOLHAQ_SPEECH_KV`.
2. Under **Pages > Settings > Functions > KV namespace bindings**, bind `SPEECH_KV` to `BOLHAQ_SPEECH_KV`.

---

## 4. Running Without Secrets

The project builds and runs fully without any secrets or API keys:
```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build
```
When no secret is set, cloud-dependent fallbacks cleanly report localized error messages, and browser-native recognition/playback and typed commands remain 100% operational.

---

## 5. Real-Device Acceptance Checklist

### iPhone Safari / Chrome (iOS):
1. **Hindi Payment Command**:
   - Speak: `ठेकेदार ने कल 500 दिए`
   - Verify cloud transcription returns transcript and opens an editable payment confirmation with ₹500 prefilled.
   - Cancel confirmation: Verify no change in ledger.
2. **Malayalam Payment Command**:
   - Speak: `എനിക്ക് ആയിരം രൂപ കിട്ടി`
   - Verify cloud transcription returns transcript and opens an editable payment confirmation with ₹1,000 prefilled.
   - Confirm and save: Verify ledger reflects payment.
3. **English Speech**:
   - Speak: `I received Rs 300`
   - Verify existing browser recognition path handles the command.
4. **Wage-Balance Playback**:
   - Set up test ledger with ₹2,500 outstanding, ₹0 settled, and ₹1,300 advance.
   - Switch language to Hindi -> Tap speaker icon -> Verify natural spoken balance via Bulbul.
   - Switch language to Malayalam -> Tap speaker icon -> Verify natural spoken balance via Bulbul.
   - Switch language to English -> Tap speaker icon -> Verify browser voice playback.

### Android Chrome & Desktop:
- Default browser `SpeechRecognition` handles English, Hindi, and Malayalam directly.
