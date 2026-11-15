# Aura Debt — notes for Claude

Hackathon app: a parody "aura bank". Users confess cringe or ask "should I send?"; an AI auditor returns aura points. One page, no DB.

## Layout
- `main.py` — FastAPI app. `POST /api/aura`, `GET /api/health`, serves `static/`. Prompts (Gen Alpha voice), JSON schema, mock verdicts, and the Anthropic call all live here.
- `static/index.html`, `static/style.css`, `static/app.js` — one screen. Balance + history in `localStorage` (key `aura-debt:v1`), always wrapped in try/catch.

## Run
```bash
python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload        # http://127.0.0.1:8000
```
Without `ANTHROPIC_API_KEY` the app runs in mock mode (`/api/health` reports `mock_mode`). Smoke test:
`curl -X POST localhost:8000/api/aura -H 'content-type: application/json' -d '{"mode":"confess","text":"..."}'`

## Rules that matter
- Model is `claude-haiku-5-5` via the official `anthropic` SDK; JSON enforced with `output_config.format` (json_schema). No `temperature`, no `budget_tokens`, no assistant prefill (all 400 on current models).
- The demo must never break: any model error, refusal, or bad JSON falls back to `mock_verdict()`. Keep it that way.
- API contract (do not change shape without updating `app.js`): `aura_change` int clamped to -10000..5000, `title`, `roast`, `send_verdict` (send mode only), `rewrite` (send mode only), `side_quest` (only when negative), `summary`, plus `source` ("auditor" | "mock").
- Empty text → 418 "Too Delulu". >1000 chars or bad mode → 422.
- Voice: deadpan bank official fluent in Gen Alpha slang; roasts are 8-18 words because they play as captions.
- Tone: roast the situation, never identity. Serious/self-harm input → 0 aura and a kind note.

## Design (chosen by the user, don't regress)
Original chunky game-menu look (user picked "Game menu / Roblox-y" after rejecting 6 other directions as busy or "AI-looking"). Not a copy of any real game.
- Sky-blue baseplate background with subtle studs, white panels with thick navy outline and a thicker bottom edge for depth (no shadows, no gradients), tab labels on panels. Fonts: Lilita One (titles/buttons/numbers, white fill with navy stroke) + Nunito.
- HUD: gold coin + giant aura number (red when negative, green when positive), rank badge coloured by `body[data-tier]`, XP bar to the next rank, "Debuff: Overdrawn / Sent to collections".
- Rizz line is a big gold "Server notice" banner at the top (user loves it).
- "New quest: Confess your fumble" panel: clear instructions, pulsing textarea, quick-pick chips, 3D buttons: Confess (green), Should I send? (blue), LARP check (locked grey until `LARP_API_URL` is set, then gold).
- Verdict overlay: the auditor's NPC dialogue box types letter by letter (tap finishes, readable speed), then the stroked title pops and the amount slams (user likes this), then reward cards (recommendation, rewrite, "Side quest unlocked (repayment plan)"), then CONTINUE.
- Sound effects via Web Audio (no files): typing ticks, button pops, slam + sad trombone on losses, level-up jingle on gains, error buzz; "sound on/off" toggle stored in localStorage.
- History is the "Quest log" modal (Date | Description | Amount | Balance) with "Close account (reset)".
- Avoid AI tells: sparkle/✦ icons, pastel rounded cards, generic friendly fonts, gradients, glow, glassmorphism, purple/indigo, emoji. Must work at 390px.
- Visual check: headless Edge can't go below 504px wide (use a 390px iframe on the same origin) and freezes CSS entrance animations under virtual time, so disable them when screenshotting end states.

## LARP check (teammate's API)
- `POST /api/larp` proxies to `{LARP_API_URL}/api/analyze` with stdlib `urllib` (the installed anthropic SDK doesn't ship `httpx`). Its response shape is undocumented, so `map_larp_verdict()` accepts several field names; per-user `aura.balance` gets clamped to -10000.
- Failures fall back to `MOCK_LARP`. `/api/health` reports `larp_enabled`; the front end unlocks the button from that.
- Test servers: kill them by port (`ss -ltnp`), not `pkill -f`, which matches its own shell command.

## Deployment
Target is **Vercel** (Python runtime, zero-config FastAPI: Vercel detects `app` in `main.py`). Set `ANTHROPIC_API_KEY` in the Vercel project's environment variables. Keep paths relative to `Path(__file__).parent`, keep the app stateless (serverless), and don't write to disk at runtime.

## Working conventions
- Delegate small, cheap tasks (git commits, file moves, simple lookups, smoke-test runs) to a subagent on the `haiku` model; keep design and backend logic in the main session.
- `.env` is gitignored; `.env.example` documents the key.
