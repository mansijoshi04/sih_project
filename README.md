# Aura Debt

The Aura Reserve Bank: confess your cringe or ask whether you should send that text, and a deadpan AI auditor credits or debits your aura.
Your balance and statement live in your browser. Collections may be pursued.

## Run it

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then put your ANTHROPIC_API_KEY in .env
uvicorn main:app --reload
```

Open http://127.0.0.1:8000. Requires Python 3.11+.

Optional: set `LARP_API_URL` in `.env` to your teammate's DeLARP API base URL to unlock the **LARP check** button (it proxies to their `POST /api/analyze`).

No key? It still works: the bank runs in **mock mode** and serves canned verdicts from the branch backup ledger. Mock mode also kicks in if the model call fails, so the demo never breaks. `GET /api/health` tells you which mode you're in.

Stack: FastAPI + the official `anthropic` SDK (`claude-haiku-5-5`), plain HTML/CSS/JS, `localStorage` for the ledger.

## Deploy to Vercel

The repo is set up for Vercel's zero-config FastAPI support (it finds `app` in `main.py`; `static/` is bundled with the function).

```bash
npm i -g vercel
vercel                 # first deploy, links the project
vercel env add ANTHROPIC_API_KEY   # or set it in the dashboard
vercel --prod
```

If you skip the key, the deployed bank runs in mock mode.

## API docs (official, regrettably)

### `POST /api/aura`

Submit a transaction for audit.

```json
{ "mode": "confess", "text": "I said 'you too' when the waiter said enjoy your meal." }
```

`mode` is `"confess"` or `"send"`. `text` is 1 to 1000 characters of shame.

**200 OK**

```json
{
  "aura_change": -640,
  "title": "Minor Awkwardness Fee",
  "roast": "A small fee has been applied; the account holder was observed being mid in real time.",
  "send_verdict": null,
  "rewrite": null,
  "side_quest": "Compliment a stranger's shoes with total sincerity.",
  "summary": "Routine awkwardness charge",
  "source": "auditor"
}
```

For `"send"` mode, `send_verdict` is `"SEND"` or `"DO NOT SEND"` and `rewrite` holds a higher-aura version of your message. `side_quest` only appears when you lost aura. `source` is `"mock"` when the backup ledger answered.

### `POST /api/larp`

`{ "text": "<a LinkedIn/X post>", "username"?: "...", "platform"?: "linkedin" | "x" }` returns the same shape as `/api/aura` plus `larp_score`. Forwards to the DeLARP API; falls back to a backup verdict if it's down.

### Error codes

| Code | Name | Meaning |
|------|------|---------|
| 402 | Aura Required | Insufficient aura to complete this request. Reserved for future use, like your rizz. |
| 418 | Too Delulu | You submitted a blank slip. The auditor cannot audit vibes alone. (Real: empty `text`.) |
| 422 | Form Filled Out Wrong | Bad `mode`, or you wrote more than 1000 characters. Please summarise your shame. |
| 429 | Too Much Cringe | The bank has detected an unsustainable rate of fumbles. Go outside. |
| 503 | LARP Not Yet Unlocked | `POST /api/larp` before `LARP_API_URL` is set. Service available Q3. |
| 500 | Auditor Has Left The Chat | Should never happen: failures fall back to mock mode. |
