# BolHaq

**Your wages. Your language.**

BolHaq is a voice-first wage ledger for India’s daily-wage and migrant workers, including construction workers who use affordable Android phones. This is the Scaler × Wispr Flow Round 2 working prototype for the Livelihoods and Small Business theme.

## What you can do

- Add worksites with a daily wage and optional notes. Switch worksites to see each employer’s separate ledger.
- Record work by date and enter a count when logging several days together.
- Record payments and see days worked, total earnings, payments and outstanding wages for the selected worksite. Payments above total earnings appear as an advance.
- Speak a command, type it into BolHaq, or use the quick-action forms. Review, edit or cancel every proposed write before saving.
- Correct a same-date work entry explicitly. Earlier work keeps its saved wage rate when you change the rate.

## Try the demo

1. Add **ABC Construction** at **₹700** per day and confirm.
2. Say or type **“I worked six days.”** Review the count, date and ₹4,200 earned, then confirm.
3. Say or type **“I received 2000 rupees.”** Review the employer, amount and date, then confirm.
4. Ask **“How much money am I owed?”** The selected worksite shows **₹2,200** outstanding. Use the speaker button to hear the balance when a matching voice is available.
5. Refresh to check persistence. Add another worksite and switch between the two balances.

To create the worksite by command, say or type **“Add worksite ABC Construction at 700 rupees per day.”** The examples menu includes worksite commands in all three languages.

## Language and voice

The language selector controls labels, examples, feedback, formatting, the recognition locale and the intended speech synthesis language. The parser handles all three command grammars regardless of the selected display language.

| Language | Recognition locale | Example |
| --- | --- | --- |
| Malayalam | `ml-IN` | എനിക്ക് 2000 രൂപ കിട്ടി. |
| Hindi | `hi-IN` | मुझे 2000 रुपये मिले। |
| English | `en-IN` | I received 2000 rupees. |

The deterministic parser handles the built-in examples, Arabic/Malayalam/Devanagari digits, common number words and selected mixed-language commands such as “ഇന്ന് work ചെയ്തു.” Open **What can I say?** for examples in the active language. Incomplete or ambiguous commands open an editable form when the action can be identified. Check the recognized transcript and all values before confirming.

Recognition and playback use the browser’s Web Speech API. Support depends on the browser, microphone permission, available voices, language services and connectivity. Some browsers send microphone audio to their recognition service. BolHaq stores ledger entries in IndexedDB and does not store microphone audio or transcripts. The typed command field and quick actions remain available if speech recognition fails. Playback uses a matching language voice when one is available. [Web Speech API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API)

## Development

Use Node.js 24 LTS with npm. The app needs no API keys, database or account.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. On Windows, use `npm.cmd` in PowerShell if its execution policy blocks `npm.ps1`.

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run preview
```

## Docker and GitHub Actions

On a machine with Docker and Compose, start the production build with one command.

```bash
docker compose up --build
```

Open `http://localhost:8080`. Stop it with `docker compose down`. The multi-stage image builds the Vite app with Node and serves its static files with Nginx. npm development on Windows works independently of Docker.

The [Verify BolHaq workflow](.github/workflows/verify.yml) runs on GitHub-hosted Ubuntu for pushes, pull requests and manual dispatch. It installs the locked dependencies, runs tests, type-checking, lint and the production build, starts Compose, and checks both the HTML and JavaScript over HTTP. It prints Compose logs on failure and always attempts cleanup. The workflow requires no repository secrets. Docker runtime verification is pending until the workflow passes on GitHub.

## Data and architecture

| Area | Implementation |
| --- | --- |
| UI | React, TypeScript, Vite, Tailwind CSS and self-hosted Inter and Noto fonts |
| `src/domain/` | Money and date validation, wage calculations, confirmation-gated writes and multilingual parsing |
| `src/services/` | Browser speech adapters and IndexedDB storage through idb |
| `src/features/proposals.ts` | Converts parsed commands and form drafts into validated, reviewable proposals |
| `src/locales/` | English, Malayalam and Hindi strings, examples and formatters |
| `src/components/` and `src/styles/` | Mobile-first app shell, voice controls, ledger cards and accessible confirmation dialogs |
| `src/tests/` | Vitest unit tests and an IndexedDB integration test using fake-indexeddb |

The interface uses KhataJi’s teal accent, warm worksite surface and compact spacing. Wispr Flow informs the flat panels, whitespace and prominence of the microphone. [KhataJi design reference](references/KhataJi-DESIGN.md) · [Wispr Flow design reference](references/wisprflow.ai-DESIGN.md)

Guest data is specific to this browser profile, device and origin. Development and Docker use different ports, so each has its own ledger. Clearing site storage, ending a private browsing session or losing the device can remove the data. Money is stored as integer paise. Confirmed work stores its wage rate, and the app calculates balances from saved work and payments. A new backdated work entry uses the current agreement shown in its review. Correcting a saved work entry keeps that entry’s original rate.

## Manual Android speech checklist

1. Open BolHaq in Chrome on an Android phone using an HTTPS origin. Record the Android/browser versions and network status.
2. Check the 360–430px layout. Verify script rendering, large touch targets and visible focus with the software keyboard open.
3. Select Malayalam, Hindi and English in turn. For each language, create or select a worksite and speak each example aloud. Compare the transcript and proposals with the expected action, employer, date and amount.
4. Confirm one write, edit one misheard value and cancel another. Refresh and verify that only confirmed entries persist. Retry a same-date work entry and review its correction.
5. Try silence, a denied microphone, an ambiguous amount and an unsupported browser. Verify the correct feedback and complete the same journey with typed commands or forms.
6. Test speaking a balance using an available matching voice. Try a device without one and verify the on-screen balance still appears.

Automated tests exercise the parser and ledger independently of a real microphone. Record device speech results separately.

## Known limitations and TASK-002

- Recognition and playback depend on the browser and OS. Malayalam, Hindi and mixed-language recognition need real-device testing.
- The parser supports a finite set of commands and number phrases. Worksite naming through speech also depends on how the browser transcribes the name.
- A multi-day work entry stores a count under one reporting date. The duplicate rule applies to the reporting date per worksite.
- The local guest ledger has no synchronization or backup. Repeated payments on the same date are allowed because separate instalments can occur.
- For TASK-002, prioritize Android speech trials in all three languages, expand number and command coverage from those trials, and add ledger export and restore.
