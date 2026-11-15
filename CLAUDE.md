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
- API contract (do not change shape without updating `app.js`): `aura_change` int clamped to -10000..5000, `title`, `roast`, `send_verdict` (send mode only), `rewrite` (send mode only), `replies` (send mode only: `{safe, balanced, bold}` ready-to-send strings, always all three via `clean_replies()`), `side_quest` (only when negative), `summary`, plus `source` ("auditor" | "mock").
- House rule: any text containing both "stupid" and "hack" (loose on purpose, typed live; checked in `/api/aura` and `/api/larp`) returns a fixed +10,000 (`hackathon_verdict()`, no model call). It is the only verdict above the +5000 clamp.
- Mock mode is keyword-aware (`kw` regexes in `MOCK_CONFESS` / `MOCK_SEND`) so backup verdicts react to the text; the user complained when every answer looked the same.
- Empty text → 418 "Too Delulu". >1000 chars or bad mode → 422.
- Voice: deadpan bank official fluent in Gen Alpha slang; roasts are 8-18 words because they play as captions.
- Tone: roast the situation, never identity. Serious/self-harm input → 0 aura and a kind note.

## Design (chosen by the user, don't regress)
"The Court of Aura", agreed with the user through Q&A + a mockup before building (2026-11-15). Presented on a 16:9 projector in a 60-second demo, so it must fit one 1280x720 screen in every state and stay calm (user said earlier versions were "busy").
- Stripped back on 2026-11-15 (user: "too crowded", "AI'd"; the clean vector judge and big text were the AI tells). Gone from home: rank/vibe/overdrawn tags, the idle speech bubble, status line, text buttons in the top bar. The user asked for the try-me chips and the LARP check button back the same day ("no bueno"), so those stay.
- Layout: top = the rizz line, small ("Aura balances are not legal tender and cannot be exchanged for rizz.", user loves it) + two icon buttons (sound, receipts). Stage = Hon. Judge Aura centre, `.score` (label + odometer number, nothing else) to the right, `.desk` under the bench (lime-bordered textarea, try-me chips, Confess / Should I send? / LARP check, which is always visible: dashed and locked "(Q3)" until `larp_enabled`, pink when on). All absolutely positioned inside `.stage`; `--desk-h` reserves the desk height.
- Look: charcoal stage `#141418`, neons lime `#c6ff3d` (gains, main buttons) and pink `#ff4fa3` (losses, chopped). Permanent Marker for headings/buttons, Atkinson Hyperlegible for numbers and body. Type is deliberately modest (home number ~54px, verdict title ~50px); don't scale it back up.
- Judge: original SVG drawn rough on purpose: hand-plotted paths, fills offset from the outlines (`<use>` twice), hatch marks, and a "line boil" (`#boil` / `#boil-s` displacement filters reseeded every 150ms in `app.js`). All judge animation uses `steps()` so it moves like a flipbook and repaints rarely; keep it stepped. States via `#judge[data-face|data-mouth|data-arm|data-fidget]`: idle (blink, bob, breathing, gavel tap, random fidgets: glance/yawn/wig slip/double tap), typing (leans in, one eyebrow up, eyes read along, sweat >160 chars), think (while the API call runs, rings spin fast, loading lines in the bubble), talking (mouth flaps per word blip), wind then shock (loss) / proud (gain). Pupils follow the pointer through `--px/--py`.
- Background motion: three wobbly "aura rings" behind the judge, tinted by `body[data-sign]`, burst on the verdict. Keep it low contrast.
- The small `.bubble` by the judge shows only for errors (empty box, failed call) and while deliberating.
- Verdict flow (user loves it, keep): scene change (desk drops, judge slides left and grows, verdict slides in on the right); the roast types letter by letter in a speech bubble pointing at the judge ("the court finds..."), tap finishes, then gavel wind-up and BANG (flash, shake, ring burst): title words slam one at a time + amount slams, then sentence (side quest) and for "should I send" the recommendation lands like a rubber stamp, then three reply cards are dealt in (Safe play +200 / Balanced +800 / High risk +3,000 or −5,000; stakes are fixed labels in `RISKS` in app.js, not model output), each with a copy button (keys 1/2/3 also copy, a COPIED stamp pops; `fallbackCopy()` covers non-https LAN demos) (`.verdict.has-send` shrinks sizes to keep CONTINUE on screen), then CONTINUE returns to the desk, the odometer rolls and the rank tag pops for a few seconds.
- The placeholder types example confessions. Rank + vibe live in the receipts sheet.
- The bench and its name plate sit in a separate `.bench` group outside the boil filter: the user could not read the plate when it wobbled. Keep it still.
- Sounds (Web Audio, no files): soft pentatonic blip per word (user rejected the per-letter tick as eerie), pops, slam + sad trombone on loss, level-up jingle on gain, error buzz; sound toggle in localStorage.
- Rejected before this: game-menu/Roblox-y, candy pastel whimsical ("looks AI", sparkles), bright aura meter, Wrapped/chat/tabloid/terminal, receipt, neobrutalism. Avoid sparkle icons, pastel rounded cards, gradients, glow, purple/indigo, emoji.
- Visual check: `playwright-core` (npm, in a scratch dir) driving the cached `~/.cache/ms-playwright/chromium_headless_shell-*` binary works for 1280x720 and 390px shots with real timing. Run the server without `ANTHROPIC_API_KEY` for mock verdicts.

## LARP check (teammate's API)
- DeLARP Stupid API endpoints: `POST /api/analyze {text?, image? (data URL), username?, platform?}`, `GET /api/stupid` (national_aura_debt, debt_ceiling, stats, most_wanted[]), `GET /api/stupid/aura-debt?username=&platform=linkedin|x` (one person's statement: offenses, aura{debt, apr, credit_rating, collections_agent, minimum_payment}, vibes{hustle_to_output_ratio, buzzwords_per_post}), `GET /api/larp-list`, `POST /api/fart` (unused so far). All calls go through `bureau()` (stdlib `urllib`; the installed anthropic SDK doesn't ship `httpx`).
- `POST /api/larp {text?, image?, username?, platform?}`: text or a screenshot. With a username it also fetches their aura-debt statement and returns it as `dossier` (printed under the verdict). `map_larp_verdict()` still accepts several field names; per-user `aura.balance` gets clamped to -10000. Images are downscaled in the browser (max 1400px JPEG), server cap `MAX_IMAGE` (Vercel body limit is 4.5 MB).
- `GET /api/most-wanted` proxies `/api/stupid` for the Most Wanted sheet (top-bar poster icon, paper "WANTED" posters, national debt counts up); falls back to `MOCK_STUPID`.
- Screenshots always work, in every mode: paperclip in the textarea, paste anywhere, or drop on the desk (downscaled to a 1400px JPEG in the browser). `/api/aura` takes `image` too and our auditor reads it (`image_block()` turns the data URL into an Anthropic image block, `SCREENSHOT_NOTE` / `SEND_SCREENSHOT_NOTE` explain chats); screenshot-only + offline → `MOCK_SHOT`.
- LARP fallback chain: teammate API → our auditor with `LARP_PROMPT` / `LARP_SCHEMA` (adds `larp_score`) → `MOCK_LARP`. The button itself still stays locked "(Q3)" until `LARP_API_URL` is set (user's design).
- Front end when `larp_enabled`: "the founder" try-chip and an `@who posted it?` field + in/x toggle in the chips row; hidden when LARP is off.
- Failures fall back to `MOCK_LARP`. `/api/health` reports `larp_enabled`; the front end unlocks the button from that.
- Test servers: kill them by port (`ss -ltnp`), not `pkill -f`, which matches its own shell command.

## Deployment
Target is **Vercel** (Python runtime, zero-config FastAPI: Vercel detects `app` in `main.py`). Set `ANTHROPIC_API_KEY` in the Vercel project's environment variables. Keep paths relative to `Path(__file__).parent`, keep the app stateless (serverless), and don't write to disk at runtime.

## Working conventions
- Delegate small, cheap tasks (git commits, file moves, simple lookups, smoke-test runs) to a subagent on the `haiku` model; keep design and backend logic in the main session.
- `.env` is gitignored; `.env.example` documents the key.
