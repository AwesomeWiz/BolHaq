# BolHaq

**Your wages. Your language.**

BolHaq is a voice-first wage ledger for India’s daily-wage and migrant workers, including construction workers who use affordable Android phones. This is the Scaler × Wispr Flow Round 2 working prototype for the Livelihoods and Small Business theme.

## What you can do

- Add worksites with a daily wage and optional notes. Switch worksites to see each employer’s separate ledger.
- Record work by date and enter a count when logging several days together.
- Record payments and see days worked, total earnings, payments and outstanding wages for the selected worksite. Payments above total earnings appear as an advance.
- Speak a command, type it into BolHaq, or use the quick-action forms. Review, edit or cancel every proposed write before saving.
- Correct a same-date work entry explicitly. Earlier work keeps its saved wage rate when you change the rate.
- Open a wage statement, prepare a payment reminder in another language, or compare balances across worksites.
- Download a JSON backup of the full ledger and preview a backup before replacing the current records.

## Try the demo

Use a fresh browser profile or an isolated origin. These are records entered during the demo.

| Time | Show |
| --- | --- |
| 0:00–0:25 | Select **മലയാളം**. Say **“കലൂർ ജോലിസ്ഥലം ചേർക്കുക, ദിവസക്കൂലി 700 രൂപ.”** and confirm the worksite. |
| 0:25–0:55 | Say **“ഞാൻ ആറ് ദിവസം ജോലി ചെയ്തു.”** and confirm ₹4,200 earned. Say **“എനിക്ക് രണ്ടായിരം രൂപ കിട്ടി.”** and confirm the ₹2,000 payment. |
| 0:55–1:20 | Ask **“എനിക്ക് ഇനി എത്ര രൂപ കിട്ടാനുണ്ട്?”** and show the ₹2,200 balance. Say **“ഈ മാസത്തെ കൂലിയുടെ കണക്ക് കാണിക്കൂ.”** and show the statement and PDF option. |
| 1:20–1:50 | Say **“ബാക്കി കൂലി ചോദിക്കാൻ ഒരു മെസേജ് തയ്യാറാക്കൂ.”** Select **हिंदी** as the message language while the interface stays in Malayalam. Show the editable draft and copy it. |
| 1:50–2:30 | Add **Metro** at ₹500 and record a ₹400 advance. Open the all-worksite overview. It shows ₹2,200 outstanding and ₹400 in advances. |
| 2:30–2:55 | Open **Backup and restore**, download the backup, then select it to show the preview. Cancel the restore to preserve the demo records. |

## Language and voice

The language selector controls labels, examples, feedback, formatting, the recognition locale and the intended speech synthesis language. The parser handles all three command grammars regardless of the selected display language.

| Language | Recognition locale | Example |
| --- | --- | --- |
| Malayalam | `ml-IN` | എനിക്ക് 2000 രൂപ കിട്ടി. |
| Hindi | `hi-IN` | मुझे 2000 रुपये मिले। |
| English | `en-IN` | I received 2000 rupees. |

The deterministic parser handles the built-in examples, Arabic/Malayalam/Devanagari digits, common number words and selected mixed-language commands such as “ഇന്ന് work ചെയ്തു.” Open **What can I say?** for examples in the active language. Complete commands open a confirmation sheet with the recognized values already filled in. Edit the amount or workday count directly, or use **Edit details** for the date. An incomplete command keeps the recognized values and focuses the missing field.

Recognition and playback use the browser’s Web Speech API. Support depends on the browser, microphone permission, available voices, language services and connectivity. Some browsers send microphone audio to their recognition service. BolHaq stores ledger entries in IndexedDB and does not store microphone audio or transcripts. The typed command field and quick actions remain available if speech recognition fails. Playback uses a matching language voice when one is available. [Web Speech API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API)

The timer starts when the recognition session starts listening. The coral waveform moves when that same session reports sound and rests during silence. It indicates sound activity and does not measure amplitude or open a second microphone stream. When sound events are unavailable, the listening indicator and timer still show the session state.

For Malayalam playback, BolHaq primes the voice list and waits briefly for late-loaded voices. It prefers `ml-IN` and can use another Malayalam-tagged voice. The utterance uses `ml-IN` and says amounts with Malayalam currency words, such as “2200 രൂപ”. If a compatible voice is missing or playback fails, the written balance stays visible and BolHaq explains the issue in Malayalam. On-device pronunciation still needs verification. [Browser voice loading](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/voiceschanged_event)

## Statements, reminders and backups

| Tool | English | Hindi | Malayalam |
| --- | --- | --- | --- |
| Wage statement | Show my wage statement for this month. | इस महीने का हिसाब दिखाओ। | ഈ മാസത്തെ കൂലിയുടെ കണക്ക് കാണിക്കൂ. |
| Payment reminder | Prepare a payment reminder. | बाकी मजदूरी के लिए संदेश बनाओ। | ബാക്കി കൂലി ചോദിക്കാൻ ഒരു മെസേജ് തയ്യാറാക്കൂ. |
| All worksites | Show my total outstanding wages. | सभी काम की जगहों का हिसाब दिखाओ। | എല്ലാ ജോലിസ്ഥലങ്ങളിലെയും കണക്ക് കാണിക്കൂ. |

English also supports “Make a report for ABC Construction,” “Show my earnings for November,” and “Prepare a payment reminder for ABC Construction.” A month name without a year selects its most recent occurrence. If a spoken worksite name has zero or multiple matches, choose the intended worksite in the report. Opening a report leaves the active ledger worksite as selected.

- **Wage statement.** Choose a worksite, month or custom date range. Net change covers only that period. The final balance includes earlier records through its end date. Use **Print or save PDF** for a full statement or share its text. Each statement identifies its source as worker-entered records and includes an employer-verification disclaimer.
- **Payment reminder.** Choose English, Hindi or Malayalam independently of the interface language, then review and edit the draft. The selected period controls earnings and payments displayed in the draft. The amount requested is the worksite’s current outstanding balance. Settled worksites and advances show their status. Copy and native share require an explicit click. **Open WhatsApp** opens the edited draft for review and recipient selection before the user sends it.
- **All worksites.** Earned and received amounts follow the selected period. Outstanding wages and advances are current balances. An advance at one worksite never reduces a different worksite’s outstanding wages.
- **Backup and restore.** Download a local `BolHaq-Backup-YYYY-MM-DD.json` file. It contains every worksite, agreement and historical rate, workday, payment, and the active worksite. Keep it private. To restore, select a BolHaq v1 JSON file up to 10 MB, check its date and record counts, and confirm replacement. Export the current records first if you want to keep them. A failed or cancelled restore preserves the existing ledger.

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

## Cloudflare Pages

For a manual release, create a Pages project in **Workers & Pages** and connect the GitHub repository after the intended release commit is on the branch you choose. Set **Production branch** to `main`, **Build command** to `npm run build`, and **Build output directory** to `dist`. Use Node.js 24 as in CI and keep the project root at the repository root. The output is a static Vite bundle, and the app requires no backend, bindings, or secrets. Test the assigned HTTPS URL and use HTTPS on any custom domain for microphone access, clipboard support, and native sharing. [Cloudflare Pages build settings](https://developers.cloudflare.com/pages/configuration/build-configuration/)

The Pages HTTPS address has its own IndexedDB storage. Export a backup from the old origin and restore it on the new origin if you need the same records there.

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
| UI | React, TypeScript, Vite, Tailwind CSS and self-hosted Sora, Manrope and Noto fonts |
| `src/domain/` | Money and date validation, report calculations, versioned backup validation, confirmation-gated writes and multilingual parsing |
| `src/services/` | Browser speech adapters and IndexedDB storage through idb |
| `src/features/proposals.ts` | Converts parsed commands and form drafts into validated, reviewable proposals |
| `src/locales/` | English, Malayalam and Hindi strings, examples and formatters |
| `src/components/` and `src/styles/` | Mobile-first app shell, voice controls, ledger cards and accessible confirmation dialogs |
| `src/tests/` | Vitest tests for the ledger, parser, IndexedDB, reporting, sharing, restore rollback, onboarding, and voice UI |

The interface pairs Cobalt controls with Midnight Ink typography and a dark recording surface. Coral indicates active recording, and Receipt Green marks payments received. Sora is used for display numbers and English headings, Manrope for English body text and controls, and Noto Sans Malayalam and Noto Sans Devanagari for regional scripts. [KhataJi design reference](references/KhataJi-DESIGN.md) · [Wispr Flow design reference](references/wisprflow.ai-DESIGN.md)

Guest data is specific to this browser profile, device and origin. Development and Docker use different ports, so each has its own ledger. Clearing site storage, ending a private browsing session or losing the device can remove the data. Money is stored as integer paise. Confirmed work stores its wage rate, and the app calculates balances from saved work and payments. A new backdated work entry uses the current agreement shown in its review. Correcting a saved work entry keeps that entry’s original rate.

## Manual Android speech checklist

1. Open BolHaq in Chrome on an Android phone using an HTTPS origin. Record the Android/browser versions and network status.
2. Check the 360–430px layout. Verify script rendering, large touch targets and visible focus with the software keyboard open.
3. Select Malayalam, Hindi and English in turn. For each language, create or select a worksite and speak each example aloud. Check that the timer advances while listening, the waveform reacts when sound events are available, and the transcript and prefilled values match the command.
4. Confirm one write, edit one misheard value and cancel another. Refresh and verify that only confirmed entries persist. Retry a same-date work entry and review its correction.
5. Try silence, a denied microphone, an ambiguous amount, and an unsupported browser. Try rapid taps, cancel, switching tabs while listening, and restarting after an interruption. Check that interrupted sessions leave no pending write and that the typed fallback still works.
6. Try Malayalam read-aloud with ₹700, ₹2,000, ₹2,200 and ₹4,200. Record the installed voice and whether it pronounces the amount correctly. Try a device without a Malayalam voice and verify the localized message and written balance.
7. Check Malayalam and Hindi statement text in Print or Save as PDF. Open the Android share sheet and verify that WhatsApp opens an editable draft for the chosen recipient. Use only test data.
8. In an isolated profile, download a backup, cancel a restore, then confirm a restore and reload. Check worksite switching, historical rates, the active worksite and outstanding amounts.

Automated tests exercise the parser and ledger independently of a real microphone. Record device speech results separately.

## Known limitations

- Recognition and playback depend on the browser and OS. Verify the updated recording controls and Malayalam pronunciation on the devices used for the demo.
- The parser supports a finite set of commands and number phrases. Worksite naming through speech also depends on how the browser transcribes the name.
- A multi-day work entry stores a count under one reporting date. The duplicate rule applies to the reporting date per worksite.
- The local guest ledger has no cross-device synchronization. The portable backup is plain JSON and restore replaces the ledger. Repeated payments on the same date are allowed because separate instalments can occur.
- Native share, clipboard access and PDF export depend on the device. If sharing or programmatic copy is unavailable, BolHaq provides selectable text for manual copy.
