# The Forge

A 10 week solo MMA striking camp in a phone-friendly web app. The coach calls your stations and combos out loud, the timer survives a locked phone, and the whole thing works offline once installed.

This is the engineering port of the original Claude artifact (`forge-camp-v9.html`, kept in the repo for reference). The program, the voice, and the design are unchanged. What changed is the plumbing: real browser APIs instead of the artifact sandbox.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page shell and markup |
| `styles.css` | All styling, original plus safe-area guards so standalone iOS keeps content clear of the notch |
| `data.js` | The program: 10 weeks x 7 days, the 81-move library, all coaching text |
| `app.js` | Timer, voice coach, combo caller, log, quiz, storage |
| `sw.js` | Service worker: cache-first, full offline |
| `manifest.webmanifest` | PWA manifest (install to home screen) |
| `icons/` | App icons, 512 and 180 |
| `test/` | Headless harness, run with `node test/run.js` |

No frameworks, no build step, no dependencies. Persistence is `localStorage` behind a tiny wrapper (`storage` at the top of `app.js`) that keeps the artifact API's call shape, keys `forge:week`, `forge:done`, `forge:opts`, `forge:iq`.

## Run it locally

You need any static file server, because the service worker and wake lock require HTTPS or localhost. If you have Node installed:

```
npx serve .
```

Then open the printed localhost address. Opening `index.html` directly from the file system will run the app but skips the service worker.

## Run the tests

```
node test/run.js
```

The harness simulates all 70 sessions end to end on a virtual clock and checks: every day renders, every timed session reaches Done, no voice line ever says "undefined", the timer resyncs to the exact right spot after a simulated phone lock (the coach announces where you are when rounds were crossed), and the log, streak, quiz score, voice toggles, and week selection survive a full reload.

## Deploy free on GitHub Pages (step by step)

You only do this once. After that, updates are a single upload.

1. **Make a GitHub account** at [github.com](https://github.com) if you do not have one. Free is fine.
2. **Create a repository.** Click the + in the top right, then "New repository". Name it `forge`, leave it Public (Pages is free on public repos), and click "Create repository".
3. **Upload the files.** On the new repo page click "uploading an existing file". Drag in everything in this folder: `index.html`, `styles.css`, `data.js`, `app.js`, `sw.js`, `manifest.webmanifest`, the `icons` folder, and optionally `test` and this README. Click "Commit changes".
   - If drag and drop will not take the `icons` folder, use the folder upload picker, or upload the two PNGs and put them in a folder named `icons` using the file path box.
4. **Turn on Pages.** In the repo, go to Settings, then Pages in the left sidebar. Under "Build and deployment", set Source to "Deploy from a branch", Branch to `main`, folder `/ (root)`, and Save.
5. **Wait a minute, then visit** `https://YOURUSERNAME.github.io/forge/`. That URL is HTTPS, so wake lock, the service worker, and offline all work.

If you prefer the terminal (each command explained):

```
git init                        # start tracking this folder with git
git add .                       # stage every file for the first snapshot
git commit -m "The Forge v1"    # take the snapshot
git branch -M main              # name the branch main (what Pages expects)
git remote add origin https://github.com/YOURUSERNAME/forge.git   # point at your repo
git push -u origin main         # upload
```

Then do step 4 above. Vercel works too (import the repo at vercel.com, no settings needed), but Pages is the simplest free path.

**Shipping an update later:** the app is cached offline-first, so phones keep serving their saved copy. When you change any file, also open `sw.js` and bump the version string at the top (`forge-v1` to `forge-v2`, and so on) before uploading. That one edit makes every phone fetch the new files on its next online visit.

## Put it on the iPhone

1. Open the Pages URL in Safari.
2. Tap the Share button, then "Add to Home Screen". The ember F icon appears like an app.
3. Open it once while online so the service worker caches everything. After that it works in airplane mode.

**Known iOS quirk to check on your phone:** on some iOS versions, speech synthesis is muted or unreliable when launched from the home screen icon (standalone mode) even though it works in a Safari tab. Test both. If the coach is silent from the home screen icon but talks in Safari, use it as a Safari bookmark instead. That is an Apple platform limitation, not a bug.

## Acceptance checklist (run outside, on the actual phone)

- [ ] Screen stays awake for a full session with the phone untouched
- [ ] Lock the phone anyway for 2 minutes mid-round: on unlock the timer is exactly where it should be and the coach tells you where you are
- [ ] Bluetooth speaker connected before tapping Start: voice and bells come out of the speaker
- [ ] Ring/silent switch on silent: coach still audible
- [ ] Airplane mode: app fully loads and runs
- [ ] Log, streak, record, quiz score, and voice toggles survive a full app close and reopen

## Phase 2 (optional, needs a Mac)

A Capacitor iOS wrapper adds the two things the web cannot do: the coach talking over your Spotify (audio ducking) and Siri-quality speech that keeps running with the screen locked. Running it on your own phone through Xcode is free but the install re-signs every 7 days; the $99/year Apple developer account removes that. If you do not have a Mac, stop here: Phase 1 already fixes the screen, timer, speaker routing, offline, and home-screen install. Capacitor docs: https://capacitorjs.com/docs/ios
