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
"Aura meter + captions", Gen Alpha. One screen, one thing: a giant aura number centred, tier name under it, a white composer card at the bottom. Nothing busy.
- Page background IS the standing, flat bright colours via `body[data-tier]`: chopped `#ff4130` (<= -10000), crashout `#ff8a00` (-9999..-3000), fumble `#ff66ad` (-2999..-1), npc `#4fd1ff` (0..2999), farmer `#b8ff3c` (3000..9999), sigma `#ffe14a` (>= 10000). Ink `#111`, white surfaces. Font: Rubik.
- After a verdict: the roast plays word-by-word as CapCut-style captions (white, thick black stroke, slang words in yellow), the amount slams in, then the number shakes/bounces and counts, then the verdict sheet slides up. Tap or Esc skips. Reduced motion skips the captions.
- History lives in a "receipts" bottom sheet (Date | Description | Amount | Balance) with "Close account".
- Keep the line "Aura balances are not legal tender and cannot be exchanged for rizz." at the top (user loves it).
- Rejected: neobrutalism, receipt/ATM slip, Wrapped/chat/tabloid/terminal (all "too busy"). Prefer minimal + motion.
- Avoid: gradients, glassmorphism, blur, glow, drop shadows, purple/indigo, emoji, full pill buttons, Inter, icon sets. Must work at 390px.
- Visual check: headless Edge can't go below 504px wide, so render mobile inside a 390px iframe on the same origin.

## Deployment
Target is **Vercel** (Python runtime, zero-config FastAPI: Vercel detects `app` in `main.py`). Set `ANTHROPIC_API_KEY` in the Vercel project's environment variables. Keep paths relative to `Path(__file__).parent`, keep the app stateless (serverless), and don't write to disk at runtime.

## Working conventions
- Delegate small, cheap tasks (git commits, file moves, simple lookups, smoke-test runs) to a subagent on the `haiku` model; keep design and backend logic in the main session.
- `.env` is gitignored; `.env.example` documents the key.
