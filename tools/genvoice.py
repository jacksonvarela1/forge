# Generates the coach's voice clips from tools/vocab.json using edge-tts.
# Run: python tools/genvoice.py
# Writes forge/audio/<sha1_12>.mp3 per fragment plus audio/manifest.js.
import asyncio
import hashlib
import json
import os
import sys

import edge_tts

VOICE = "en-US-ChristopherNeural"
RATE = "+8%"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, "audio")
CONCURRENCY = 6


def fname(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:12] + ".mp3"


async def gen_one(sem, text, path, tries=4):
    async with sem:
        for attempt in range(tries):
            try:
                tts = edge_tts.Communicate(text, VOICE, rate=RATE)
                await tts.save(path)
                if os.path.getsize(path) > 400:
                    return True
            except Exception:
                await asyncio.sleep(1.5 * (attempt + 1))
        return False


async def main():
    with open(os.path.join(ROOT, "tools", "vocab.json"), encoding="utf-8") as f:
        vocab = json.load(f)
    os.makedirs(AUDIO, exist_ok=True)
    sem = asyncio.Semaphore(CONCURRENCY)
    jobs, mapping = [], {}
    for text in vocab:
        f = fname(text)
        mapping[text] = f
        path = os.path.join(AUDIO, f)
        if not (os.path.exists(path) and os.path.getsize(path) > 400):
            jobs.append((text, path))
    print(f"{len(vocab)} fragments, {len(jobs)} to generate")
    results = await asyncio.gather(*(gen_one(sem, t, p) for t, p in jobs))
    failed = [jobs[i][0] for i, ok in enumerate(results) if not ok]
    if failed:
        print("FAILED " + str(len(failed)) + ":")
        for t in failed[:10]:
            print("  " + t)
        sys.exit(1)
    files = sorted(set(mapping.values()))
    manifest = (
        "self.AUDIO_MANIFEST={voice:" + json.dumps(VOICE) + ",map:"
        + json.dumps(mapping, ensure_ascii=False, sort_keys=True)
        + ",files:" + json.dumps(files) + "};\n"
    )
    with open(os.path.join(AUDIO, "manifest.js"), "w", encoding="utf-8") as f:
        f.write(manifest)
    total = sum(os.path.getsize(os.path.join(AUDIO, f)) for f in files)
    print(f"done: {len(files)} clips, {total // 1024} KB, manifest written")


asyncio.run(main())
