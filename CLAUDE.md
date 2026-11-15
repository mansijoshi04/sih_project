# Aura Debt — notes for Claude

Hackathon app: a parody "aura bank". Users confess cringe or ask "should I send?"; an AI auditor returns aura points. One page, no DB.

## Layout
- `main.py` — FastAPI app. `POST /api/aura`, `GET /api/health`, serves `static/`. Prompts, JSON schema, mock verdicts, and the Anthropic call all live here.
- `static/index.html`, `static/style.css`, `static/app.js` — plain HTML/CSS/vanilla JS. Balance + history in `localStorage` (key `aura-debt:v1`), always wrapped in try/catch.

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
- Tone: roast the situation, never identity. Serious/self-harm input → 0 aura and a kind note.

## Design constraints (don't regress)
Concept: an old paper bank statement that Gen Z vandalised. Paper `#f4f1ea`, ink `#1a1a1a`, red `#a4161a` (negative), green `#2f5d3a` (positive), one loud accent: highlighter `#dcf23a` (marker swipes, stickers, focus rings).
Fonts: Archivo Black (display/buttons/stickers), IBM Plex Mono (all numbers, labels, tables), Libre Caslon Text (official/body voice, italics), Permanent Marker (red margin scribbles only).
Signature bits: black stock ticker band, highlighter swipe on "BANK", rotated sticker labels, chunky square buttons with thick bottom border, CSS-only rotated stamps (OVERDRAWN / SENT TO COLLECTIONS, APPROVED / DECLINED / DEBITED / CREDITED), example "need inspo?" chips.
Avoid: gradients (except textarea ruled lines), glassmorphism, blur, glow, drop shadows, purple/indigo, emoji, pill buttons, Inter, hero+cards layouts, icon sets. Must work at 390px width; respect prefers-reduced-motion.
Visual check: headless Edge can't go below 504px wide, so render mobile inside a 390px iframe.

## Deployment
Target is **Vercel** (Python runtime, zero-config FastAPI: Vercel detects `app` in `main.py`). Set `ANTHROPIC_API_KEY` in the Vercel project's environment variables. Keep paths relative to `Path(__file__).parent`, keep the app stateless (serverless), and don't write to disk at runtime.

## Working conventions
- Delegate small, cheap tasks (git commits, file moves, simple lookups, smoke-test runs) to a subagent on the `haiku` model; keep design and backend logic in the main session.
- `.env` is gitignored; `.env.example` documents the key.
