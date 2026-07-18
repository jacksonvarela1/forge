# The Forge: turn this into a real app

## What this is
`forge-camp-v9.html` is a complete, working 10-week solo MMA striking training app in a single file. It was built and battle-tested inside a Claude.ai artifact. The program content, the coaching voice lines, the timer logic, and all the data are final. This is an engineering port, not a redesign. Do not rewrite the program, the move library, the voice personality, or the visual design.

Everything lives inline in that one file: data (10 weeks x 7 days, 81-move library with aliases), a clock-anchored interval timer with 30-second station support, a speech-synthesis voice coach and combo caller with week-gated vocabulary, a focus mode with progress ring, a training log with record/streak/rank, a Fight IQ quiz gated to weeks reached, and a gear tab.

## Why we are porting
The Claude artifact iframe is sandboxed. It blocks or breaks: Screen Wake Lock, autoplay of the wake video, the media-session audio route claim, and background execution. On the user's iPhone this meant: screen sleeps mid-session, timer freezes, voice dies, and TTS routes to the handset instead of the connected Bluetooth speaker. None of that is a logic bug. The same code in a normal browser context gets the real APIs.

## The user
- iPhone. Trains outside in a yard, phone on the ground or in grass, Bluetooth speaker nearby.
- Budget matters. Free hosting, free tooling, no paid services unless truly necessary.
- Beginner-friendly steps. Assume he has never deployed a site from a terminal before. Explain each command the first time.

## Phase 1: PWA (do this first, it is the big win)
1. Create a clean repo. Either keep the single-file structure or split into `index.html`, `styles.css`, `data.js`, `app.js`. Preserve behavior exactly. No frameworks, no build step, no dependencies.
2. CRITICAL STORAGE MIGRATION: the artifact used `window.storage` (a Claude-only API with an async `{value}` envelope). It does not exist outside artifacts, and without this change the app silently loses all persistence. Replace with a wrapper that keeps the exact same call shape so no call sites change:
   ```js
   const storage = window.storage ?? {
     get: async k => { const v = localStorage.getItem(k); return v == null ? null : { value: v }; },
     set: async (k, v) => { localStorage.setItem(k, v); return {}; },
   };
   ```
   Then replace every `window.storage.` call site with `storage.`. Keys in use: `forge:week`, `forge:done`, `forge:opts`, `forge:iq`.
3. Wake: use the real Screen Wake Lock API first (`navigator.wakeLock.request('screen')`, re-request on visibilitychange), keep the existing base64 wake-video as the fallback. Requires HTTPS or localhost.
4. Keep the clock-anchored timer and the `resync()` fast-forward exactly as-is. It is already correct and tested.
5. PWA shell: `manifest.webmanifest` (name The Forge, standalone display, dark theme colors matching `--bg: #0F1319` and `--ember: #EA8C3A`), a simple cache-first service worker for full offline use, apple-touch-icon (generate a 512 and 180 icon: dark background, ember F, matching the app aesthetic).
6. Deploy free on GitHub Pages or Vercel (HTTPS required for wake lock and service worker). Walk the user through it step by step.
7. iOS quirk to verify on-device: test speechSynthesis both in a Safari tab and installed to the home screen (standalone). If standalone mode mutes or breaks TTS on his iOS version, tell him to run it as a Safari bookmark instead and note it. Do not silently ship a broken standalone.

### Phase 1 acceptance criteria (test on the actual iPhone, outside)
- Screen stays awake for a full session with the phone untouched.
- Lock the phone anyway for 2 minutes mid-round: on unlock the timer is exactly where it should be and the coach announces where you are (the resync path).
- With a Bluetooth speaker connected BEFORE tapping Start: voice and bells come out of the speaker.
- Ring/silent switch on silent: coach still audible.
- Airplane mode: app fully loads and runs (service worker).
- Log, streak, record, quiz score, and voice toggles survive a full app close and reopen (storage migration proof).

## Phase 2: native wrapper (only after Phase 1 passes, and only if he has a Mac)
Capacitor iOS wrapper around the same web app. This phase exists for exactly two things the web cannot do:
1. Talk over his Spotify. Configure AVAudioSession so speech ducks other audio and restores it: category `.playback`, activate around utterances with option `.duckOthers`, deactivate with `.notifyOthersOnDeactivation`. Add `UIBackgroundModes: audio` to Info.plist so the timer and voice keep running with the screen locked.
2. Reliable, higher-quality speech. Web speech inside WKWebView is flaky. Write a tiny Capacitor plugin (roughly 20 lines of Swift) exposing `Coach.speak(text)` backed by `AVSpeechSynthesizer`, and have the web `say()` function call the native bridge when it exists, falling back to web speech otherwise. This also gets Siri-quality voices.

Cost truth for the user: running it on his own phone via Xcode is free but re-signs every 7 days; the $99/year Apple developer account removes that and enables TestFlight. Capacitor docs: https://capacitorjs.com/docs/ios. If he has no Mac, stop at Phase 1 and say so plainly; Phase 1 already fixes screen, timer, routing, offline, and install-to-home-screen.

## Non-negotiables
- Program data, coaching lines, week gating, and visual design are final. Port, do not redesign.
- No em dashes anywhere in any text or UI copy.
- Zero regressions: every one of the 70 sessions must run end to end. Recreate a headless test harness (the original was tested by simulating all 70 sessions and asserting no errors, no undefined lines in speech, and correct lock-recovery behavior). Keep that harness in the repo as `test/`.
- Keep it dependency-free. If a dependency feels necessary, justify it first.

## Working style
Work in small verified steps. After each step, state what changed and how it was verified. When something is an iOS platform limitation rather than a bug, say so directly instead of working around it silently.
