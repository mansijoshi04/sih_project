# Aura Debt — notes for Claude

Hackathon app: a parody "aura bank". Users confess cringe or ask "should I send?"; an AI auditor returns aura points. One page, no DB.

## Layout
- `main.py` — FastAPI app. `POST /api/aura`, `GET /api/health`, serves `static/`. Prompts, JSON schema, mock verdicts, and the Anthropic call all live here.
- `static/index.html` + `static/app.js` — one shared page and script for every design. Balance + history in `localStorage` (key `aura-debt:v1`), always wrapped in try/catch.
- `static/base.css` — reset + the "Design preview" switcher. `static/themes/*.css` — one file per design; the head script picks one before first paint (key `aura-debt:theme`).

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
The user is still choosing a direction, so the page has a design switcher. Themes: `wrapped` (default, story slides, page colour follows standing via `body[data-tier]`), `chat` (auditor texts you), `tabloid` (The Aura Times front page), `terminal` ($AURA trading screen), `receipt` (ATM slip; user disliked it, kept for comparison).
Rejected so far: neobrutalism (chunky borders, stickers, highlighter blocks) and the receipt.
Every theme must keep the line "Aura balances are not legal tender and cannot be exchanged for rizz." at the top (user loves it).
Themes restyle the same markup; hide unused elements with `display:none`, use `order`/grid areas and `:has(#notice[hidden])` for layout. JS exposes `body[data-tier]` (collections|cringe|fumble|mid|farmer|him), `body[data-sign]`, `body.is-busy`, a sparkline (#spark), an analyst rating (#rating) and the user's text (#notice-you).
Avoid: gradients (hard-stop shapes are fine), glassmorphism, blur, glow, drop shadows, purple/indigo, emoji, pill buttons, Inter, hero+cards layouts, icon sets. Must work at 390px; respect prefers-reduced-motion. In CSS `content`, a `\00B7` escape eats one following space, so write two.
Visual check: headless Edge can't go below 504px wide, so render mobile inside a 390px iframe on the same origin.

## Deployment
Target is **Vercel** (Python runtime, zero-config FastAPI: Vercel detects `app` in `main.py`). Set `ANTHROPIC_API_KEY` in the Vercel project's environment variables. Keep paths relative to `Path(__file__).parent`, keep the app stateless (serverless), and don't write to disk at runtime.

## Working conventions
- Delegate small, cheap tasks (git commits, file moves, simple lookups, smoke-test runs) to a subagent on the `haiku` model; keep design and backend logic in the main session.
- `.env` is gitignored; `.env.example` documents the key.
