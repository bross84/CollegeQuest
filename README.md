# College Quest

A self-hosted study app. Each class is its own space with its own practice, homework help and uploaded documents. It combines the earlier ChemQuest and AlgebraQuest apps, and runs as one Docker container.

## What it does

- **Classes.** Create a space per course. Pick a subject (Chemistry, College Algebra, or Other) and describe the class; the tutor reads that description.
- **Practice.** Chemistry and Algebra come with generated problem sets by skill. In chemistry, the periodic table (or the ion list) stays open under the problems that need it. A daily practice set, per-skill mastery, a coach that reads your history, and a suggested study plan. Progress, rank and streak are shown quietly at the top of each class.
- **Homework.** Add a problem (typed or photographed). The AI finds the first step that went wrong and names the rule to use, without giving the answer unless you ask.
- **Documents.** Upload photos, PDFs, Word files and text per class. "Find problems" pulls the problems out of them into your homework list, and the tutor searches your own notes when you ask a question.
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
| `GROQ_MODEL`, `GROQ_QUICK_MODEL`, `GROQ_VISION_MODEL`, `OPENROUTER_MODEL`, ... | Override the models. Model names change often, so check the provider catalogs if a call fails with a model error. Reading photos needs a vision-capable model. |
| `COOKIE_SECURE`, `TRUST_PROXY` | Set both to `true` when serving over HTTPS behind a reverse proxy. |
| `PORT`, `MAX_UPLOAD_MB` | Published port and per-file upload limit. |

You can also set keys, provider order and models from the app: class list, **AI settings**. Values saved there are stored in the server's database (plain text, like `.env`), override the environment, apply immediately, and have a **Save and test** button. Editing is only allowed when `APP_PASSWORD` is set.

With no AI keys the app still works for practice; checking, explaining and the tutor are switched off.

### HTTPS

The app speaks plain HTTP. If it is reachable beyond your home network, put it behind a reverse proxy (Caddy, Traefik, nginx) that terminates HTTPS, and set `COOKIE_SECURE=true` and `TRUST_PROXY=true`.

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

Layout:

```
server/          Express API: auth, classes, per-class state, documents, AI proxy
client/engine/   The app shell and shared game logic (plain scripts, concatenated by the build)
client/packs/    One folder per subject: skills, reference screens, wording, meta.json
client/build.js  Bundles everything into public/ (generated, git-ignored)
test/            API tests (node --test)
```

### Adding a subject

Copy `client/packs/general` (no practice skills) or `client/packs/algebra` (with skills), edit `meta.json` and `pack.js`, and add the pack's id to the `PACKS` list in `server/app.js`. Skill files follow the `SKILLS.push({ id, zone, name, rule, tip, video, gen() { ... } })` shape used in the existing packs.

## Notes

- Progress is stored on the server per class and cached in the browser. If you use two devices, changes are merged rather than overwritten.
- Scanned PDFs have no text to read: upload the pages as photos instead.
- iPhone HEIC photos are not readable by every browser; JPEG and PNG always work.
