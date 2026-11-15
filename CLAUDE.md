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
"The Court of Aura", agreed with the user through Q&A + a mockup before building (2026-11-15). Presented on a 16:9 projector in a 60-second demo, so it must fit one 1280x720 screen in every state and stay calm (user said earlier versions were "busy").
- Layout: top = only the rizz line ("Aura balances are not legal tender and cannot be exchanged for rizz.", user loves it) + small "sound on / receipts" buttons; left 42% = Hon. Judge Aura; right = the desk (your aura number, rank tag, vibe line, overdrawn tag, lime-bordered textarea, try-me chips, Confess / Should I send? / LARP check). No national-debt counter, no feed (user removed them).
- Look: charcoal stage `#141418`, neons lime `#c6ff3d` (gains, main buttons) and pink `#ff4fa3` (losses, chopped). Permanent Marker for headings/buttons, Atkinson Hyperlegible for numbers and body (projector legibility).
- Judge: original SVG (tiny judge, huge curly wig, gavel, wooden bench with lime "HON. JUDGE AURA" plate). States via `#judge[data-face|data-mouth|data-arm]`: idle (blink, wig bob, gavel tap), typing (side-eye, faster gavel tap, sweat when >160 chars, bubble lines change with length), talking (mouth flaps on each word blip), shock (loss) / proud (gain) with gavel slammed + court shake.
- Verdict flow (user loves it, keep): verdict replaces the desk on the right; the roast types letter by letter in a speech bubble pointing at the judge ("the court finds..."), tap finishes, then BANG: title scrawled in marker + amount slams, then sentence (side quest) and for "should I send" the recommendation + rewrite (`.verdict.has-send` shrinks sizes to keep CONTINUE on screen), then CONTINUE returns to the desk and the number counts.
- Sounds (Web Audio, no files): soft pentatonic blip per word (user rejected the per-letter tick as eerie), pops, slam + sad trombone on loss, level-up jingle on gain, error buzz; sound toggle in localStorage.
- Rejected before this: game-menu/Roblox-y, candy pastel whimsical ("looks AI", sparkles), bright aura meter, Wrapped/chat/tabloid/terminal, receipt, neobrutalism. Avoid sparkle icons, pastel rounded cards, gradients, glow, purple/indigo, emoji.
- Visual check: headless Edge can't go below 504px wide (render phones in a 390px iframe on the same origin) and freezes CSS entrance animations under virtual time, so disable animations when screenshotting end states.

## LARP check (teammate's API)
- `POST /api/larp` proxies to `{LARP_API_URL}/api/analyze` with stdlib `urllib` (the installed anthropic SDK doesn't ship `httpx`). Its response shape is undocumented, so `map_larp_verdict()` accepts several field names; per-user `aura.balance` gets clamped to -10000.
- Failures fall back to `MOCK_LARP`. `/api/health` reports `larp_enabled`; the front end unlocks the button from that.
- Test servers: kill them by port (`ss -ltnp`), not `pkill -f`, which matches its own shell command.

## Deployment
Target is **Vercel** (Python runtime, zero-config FastAPI: Vercel detects `app` in `main.py`). Set `ANTHROPIC_API_KEY` in the Vercel project's environment variables. Keep paths relative to `Path(__file__).parent`, keep the app stateless (serverless), and don't write to disk at runtime.

## Working conventions
- Delegate small, cheap tasks (git commits, file moves, simple lookups, smoke-test runs) to a subagent on the `haiku` model; keep design and backend logic in the main session.
- `.env` is gitignored; `.env.example` documents the key.
