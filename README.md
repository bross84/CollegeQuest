# College Quest

A self-hosted study app. Each class is its own space with chapters, practice built from your own uploaded materials, homework help and documents. It runs as one Docker container.

## What it does

- **Classes.** Create a space per course and describe it; the tutor reads that description. Each class opens on a Continue button that walks you through the chapters section by section (a short read, then a few questions), and also has an Exams page for building practice exams, homework and documents.
- **Practice.** Nothing is built in. Upload practice exams, notes and readings; the AI reads the problems out (or writes new ones from the material), files each under its chapter, and you practise them chapter by chapter or as a timed mixed exam. Each question keeps its format: multiple choice stays multiple choice (with clickable options and instant grading), a question with labelled parts (a, b, c) gets one answer box per part, and a generated exam copies the mix and order of the exam it is modelled on. Options and parts are read out of the exam text by a parser first (the AI only fills in what the parser can't tell), an answer key printed at the end of an exam ("Answers: 1) b 2) c") is used, and subscripts or exponents that a PDF split off ("K 2 SO 4", "10 23") are joined back. "Prepare this chapter" also reads the chapter's textbook problems, so its sections practise real ones; once you get them all right, the AI writes new ones like them (labelled AI-written). The section practice sets lean on multiple choice, since seeing the options helps recall.
- **Homework.** Add a problem (typed or photographed). The AI finds the first step that went wrong and names the rule to use, without giving the answer unless you ask.
- **Documents.** Upload photos, PDFs, Word files and text per class. "Find problems" pulls the problems out of them into your homework list, and the tutor searches your own notes when you ask a question.
- **Study guides.** Pick a chapter or notes and the AI reads it in parts (about 8,000 characters at a time) and writes a guide: sections with a summary, key terms and the points to know, plus recall questions. Questions are practised by typing first, with choices after a miss, and come back on a spaced schedule. Guides are kept per class and can be printed. Every class type has this, including "Other". A long chapter takes a few minutes and several AI calls, so on free-tier keys it may pause briefly for the rate limit.
- **Reference tables.** Chemistry classes get a periodic table (open under every practice question), plus a polyatomic ion list, a molecular geometry table and a mole map one button away. Choose them under Class settings.
- **AI tutor.** Ask questions about the problem you are on or the course in general. Uses Groq and/or OpenRouter.

## Run it

```bash
cp .env.example .env     # then edit .env
docker compose up -d --build
```

Open `http://<your-server>:3000`. Data (database and uploads) lives in the `collegequest-data` Docker volume and survives rebuilds.

Set these in `.env`:

| Variable | Purpose |
| --- | --- |
| `APP_PASSWORD` | One shared password for the whole app. Set it: without it, anyone who can reach the page can spend your AI quota. |
| `GROQ_API_KEY`, `OPENROUTER_API_KEY` | Set one or both. With both, `AI_PROVIDER_ORDER` (default `groq,openrouter`) decides who goes first, and the other is the fallback on rate limits or outages. |
| `YOUTUBE_API_KEY` | Optional. A YouTube Data API v3 key lets the app play videos in place (it can also be set under AI settings). Without it, video links are plain YouTube searches. Results are cached for 30 days because each new search costs 100 of the 10,000 daily quota units. |
| `GROQ_MODEL`, `GROQ_QUICK_MODEL`, `GROQ_VISION_MODEL`, `OPENROUTER_MODEL`, ... | Override the models. Model names change often, so check the provider catalogs if a call fails with a model error. Reading photos needs a vision-capable model. |
| `COOKIE_SECURE`, `TRUST_PROXY`, `BIND_ADDRESS` | Behind HTTPS: `COOKIE_SECURE=true`, `TRUST_PROXY=1` (number of proxies in front), and `BIND_ADDRESS=127.0.0.1` if only a local tunnel or proxy should reach it. See below. |
| `PORT`, `MAX_UPLOAD_MB` | Published port and per-file upload limit. |

You can also set keys, provider order and models from the app: class list, **AI settings**. Values saved there are stored in the server's database (plain text, like `.env`), override the environment, apply immediately, and have a **Save and test** button. Editing is only allowed when `APP_PASSWORD` is set.

With no AI keys the app still works for practice; checking, explaining and the tutor are switched off.

### HTTPS and reaching it from elsewhere

The app speaks plain HTTP, so anything outside your home network should go through something that adds HTTPS, such as a Cloudflare Tunnel (`cloudflared`) or a reverse proxy. Point it at `http://localhost:3000` (or your `PORT`), and in `.env` set:

```
APP_PASSWORD=<something long>
COOKIE_SECURE=true
TRUST_PROXY=1
BIND_ADDRESS=127.0.0.1
```

Notes:
- `TRUST_PROXY=1` means "one proxy sits in front of the app". Use the number, not `true`: `true` trusts a header that visitors can fake, which would let them dodge the sign-in attempt limit.
- `BIND_ADDRESS=127.0.0.1` stops the app being reachable on your LAN by IP, so only a proxy or tunnel on the same machine can reach it. If your `cloudflared` runs in a Docker container, `localhost` will not reach the app from inside it; use the server's LAN IP instead and leave `BIND_ADDRESS` at its default.
- For a second lock in front of the password, add a **Cloudflare Access** policy to the hostname (for example, email one-time codes for just your address). It is free for small numbers of users.
- On a college or other shared computer, tick **This is a public or shared computer** when signing in: the sign-in lasts 12 hours at most and ends when the browser closes, and nothing is saved in that browser. Use **Sign out** when you finish; it also clears anything this browser cached.
- Behind Cloudflare, uploads are limited to 100 MB per request on the free plan; the app's own limit is 25 MB per file.

### Backups

```bash
docker run --rm -v collegequest-data:/data -v "$PWD":/backup alpine tar czf /backup/collegequest-backup.tgz -C /data .
```

## Develop

Requires Node 22.13 or newer (it uses the built-in `node:sqlite`).

```bash
npm install
npm run dev      # builds the client, then runs the server with auto-restart on :3000
npm test
```

To click through the app without real AI keys, run the stand-in AI (it answers the app's prompts with canned JSON) and point the server at it:

```bash
node test/mock-ai.js
DATA_DIR=./scratch PORT=3999 GROQ_API_KEY=x GROQ_BASE_URL=http://localhost:3998 YOUTUBE_API_KEY=x YOUTUBE_BASE_URL=http://localhost:3998 node server/index.js
```

Layout:

```
server/          Express API: auth, classes, per-class state, documents, AI proxy
client/engine/   The app shell and shared game logic (plain scripts, concatenated by the build)
client/packs/    One folder per subject: skills, reference screens, wording, meta.json
client/build.js  Bundles everything into public/ (generated, git-ignored)
server/qtext.js  Reading exam text without the AI (options vs parts, answer keys, PDF repair); also built into the client
test/            API and parser tests (node --test), and mock-ai.js
```

### Adding a subject

A subject pack can add generated practice drills for a course. Copy `client/packs/general` (no drills), edit `meta.json` and `pack.js`, add skill files that use `SKILLS.push({ id, zone, name, rule, tip, video, gen() { ... } })`, and add the pack's id to the `PACKS` list in `server/app.js`. The app ships with no drills.

## Notes

- Progress is stored on the server per class and cached in the browser. If you use two devices, changes are merged rather than overwritten.
- Scanned PDFs have no text to read: upload the pages as photos instead.
- iPhone HEIC photos are not readable by every browser; JPEG and PNG always work.
