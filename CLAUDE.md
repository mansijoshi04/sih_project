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
"Aura meter + typewriter verdict", Gen Alpha and whimsical. One screen, one thing: giant aura number centred, tier as a dark tilted tag, white composer card at the bottom. Nothing busy.
- Page background follows standing via `body[data-tier]`, soft candy colours (NO red background, user rejected it): chopped `#ffbf69` tangerine, crashout `#ffc6de` strawberry milk, fumble `#fff28a` lemon, npc `#ade6ff` sky, farmer `#c6f5a3` pistachio, sigma `#9ff0dd` mint. Ink `#1b1530`, white surfaces, floating SVG sparkles. Font: Fredoka.
- Rizz line "Aura balances are not legal tender and cannot be exchanged for rizz." is a big white tilted banner at the top (user loves it, wanted it bigger).
- Composer must make the call to action obvious: numbered steps ("1 Type what you did", "2 Get audited"), a pulsing dashed textarea while empty, "type here..." placeholder, example chips.
- Verdict: full-screen card in the new tier colour; the roast TYPES OUT letter by letter (readable speed, pauses on punctuation; user said word-chunks were too fast), white text with thick ink stroke, slang words in yellow. Then title pops + amount slams (user likes this "fully chopped" moment). Tap 1 finishes typing, tap 2 continues; auto-continues after 6s. Then the number shakes/bounces and the verdict sheet slides up ("bet" closes it).
- History lives in a "receipts" bottom sheet (Date | Description | Amount | Balance) with "Close account".
- Rejected: neobrutalism, receipt/ATM slip, Wrapped/chat/tabloid/terminal (all "too busy"), red backgrounds, fast word-chunk captions.
- Avoid: gradients, glassmorphism, blur, glow, drop shadows, purple/indigo, emoji, full pill buttons, Inter, icon sets. Must work at 390px; reduced motion skips the verdict animation.
- Visual check: headless Edge can't go below 504px wide (use a 390px iframe on the same origin), and it freezes CSS entrance animations under virtual time, so disable them when screenshotting end states.

## Deployment
Target is **Vercel** (Python runtime, zero-config FastAPI: Vercel detects `app` in `main.py`). Set `ANTHROPIC_API_KEY` in the Vercel project's environment variables. Keep paths relative to `Path(__file__).parent`, keep the app stateless (serverless), and don't write to disk at runtime.

## Working conventions
- Delegate small, cheap tasks (git commits, file moves, simple lookups, smoke-test runs) to a subagent on the `haiku` model; keep design and backend logic in the main session.
- `.env` is gitignored; `.env.example` documents the key.
