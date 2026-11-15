(() => {
  "use strict";

  const STORE_KEY = "aura-debt:v1";
  const $ = (id) => document.getElementById(id);
  const els = {
    balance: $("balance"), standing: $("standing"), vibe: $("vibe"), stamp: $("stamp"),
    entry: $("entry"), counter: $("counter"), status: $("status"), txCount: $("tx-count"),
    captions: $("captions"), capTyped: $("cap-typed"), caret: $("caret"), capResult: $("cap-result"), capTitle: $("cap-title"), capAmount: $("cap-amount"), capNext: $("cap-next"),
    scrim: $("scrim"), notice: $("notice"), noticeRef: $("notice-ref"), noticeTitle: $("notice-title"),
    noticeAmount: $("notice-amount"), noticeRoast: $("notice-roast"),
    noticeSend: $("notice-send"), noticeRec: $("notice-rec"), noticeRewrite: $("notice-rewrite"), copyRewrite: $("copy-rewrite"),
    noticeQuest: $("notice-quest"), noticeQuestText: $("notice-quest-text"), noticeSrc: $("notice-src"), closeNotice: $("close-notice"),
    receipts: $("receipts"), openReceipts: $("open-receipts"), closeReceipts: $("close-receipts"),
    history: $("history"), empty: $("empty"), reset: $("reset"),
  };
  const actionButtons = Array.from(document.querySelectorAll(".btn[data-mode]"));
  const chips = Array.from(document.querySelectorAll(".chip"));
  const larpBtn = $("larp-btn");
  let larpOn = false;
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- sound effects (synthesised with Web Audio, no files to load) ----------
  const SOUND_KEY = "aura-debt:sound";
  const sfx = (() => {
    let ctx = null;
    let on = true;
    try { on = localStorage.getItem(SOUND_KEY) !== "off"; } catch { /* default on */ }
    const ac = () => {
      if (!on) return null;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === "suspended") ctx.resume();
        return ctx;
      } catch { return null; }
    };
    // one oscillator note with a quick attack and exponential release
    function tone(freq, start, dur, { type = "square", vol = 0.08, slideTo = null } = {}) {
      const c = ac(); if (!c) return;
      const t = c.currentTime + start;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t); o.stop(t + dur + 0.02);
    }
    function noise(start, dur, vol = 0.12, hp = 800) {
      const c = ac(); if (!c) return;
      const t = c.currentTime + start;
      const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = buf; f.type = "highpass"; f.frequency.value = hp; g.gain.value = vol;
      src.connect(f).connect(g).connect(c.destination);
      src.start(t);
    }
    // soft "character talking" blip, one per word, pitched from a cheerful pentatonic scale
    const BLIP_NOTES = [523, 587, 659, 784, 880, 1047];
    let lastBlip = 0;
    return {
      get on() { return on; },
      set on(v) { on = v; try { localStorage.setItem(SOUND_KEY, v ? "on" : "off"); } catch { /* ignore */ } },
      unlock() { ac(); },
      pop() { tone(620, 0, 0.07, { type: "sine", vol: 0.12, slideTo: 900 }); },
      blip() {
        const now = performance.now();
        if (now - lastBlip < 70) return;
        lastBlip = now;
        const f = BLIP_NOTES[Math.floor(Math.random() * BLIP_NOTES.length)];
        tone(f, 0, 0.08, { type: "triangle", vol: 0.05, slideTo: f * 1.12 });
      },
      slam() {
        tone(140, 0, 0.45, { type: "sine", vol: 0.5, slideTo: 38 });
        noise(0, 0.18, 0.25, 200);
      },
      womp() { // sad trombone
        [[392, 370], [370, 349], [349, 330], [330, 220]].forEach(([a, b], i) =>
          tone(a, 0.05 + i * 0.32, i === 3 ? 0.9 : 0.3, { type: "sawtooth", vol: 0.07, slideTo: b }));
      },
      levelUp() {
        [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.05 + i * 0.09, 0.16, { type: "square", vol: 0.06 }));
        tone(1568, 0.45, 0.35, { type: "triangle", vol: 0.08 });
      },
      result(amount) {
        this.slam();
        setTimeout(() => (amount < 0 ? this.womp() : this.levelUp()), 280);
      },
      error() { tone(220, 0, 0.12, { type: "square", vol: 0.06 }); tone(165, 0.13, 0.2, { type: "square", vol: 0.06 }); },
    };
  })();


  // ---------- storage (never trust it to exist) ----------
  function freshState() { return { balance: 0, history: [] }; }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (!s || typeof s.balance !== "number" || !Array.isArray(s.history)) return freshState();
      return { ...freshState(), ...s };
    } catch { return freshState(); }
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* private mode */ } }

  let state = load();
  let displayed = state.balance;

  // ---------- copy ----------
  const nf = new Intl.NumberFormat("en-US");
  const MINUS = "−";
  const fmt = (n) => (n < 0 ? MINUS : "") + nf.format(Math.abs(Math.round(n)));
  const fmtSigned = (n) => (n > 0 ? "+" : n < 0 ? MINUS : "") + nf.format(Math.abs(n));
  const shortDate = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const TIERS = [
    { max: -10000, key: "chopped", name: "Chopped", vibe: "fully cooked. no return." },
    { max: -3000, key: "crashout", name: "Crashout Era", vibe: "a crashout of historic proportions" },
    { max: -1, key: "fumble", name: "Fumble Arc", vibe: "recoverable. barely." },
    { max: 2999, key: "npc", name: "NPC", vibe: "default skin energy" },
    { max: 9999, key: "farmer", name: "Aura Farmer", vibe: "aura farming detected" },
    { max: Infinity, key: "sigma", name: "Sigma", vibe: "unbothered. moisturised. him." },
  ];
  const tier = (b) => TIERS.find((t) => b <= t.max);

  const PLACEHOLDERS = [
    "e.g. i said \"love you\" to my teacher",
    "e.g. i waved at someone who wasn't waving at me",
    "e.g. i walked into a glass door. the door won.",
    "e.g. i laughed at a joke nobody made",
  ];
  const LOADING = [
    "Auditor reviewing your account…",
    "checking the group chat…",
    "consulting the sigma council…",
    "running a vibe check…",
    "calculating fanum tax…",
  ];
  const HOT = /^(aura|cooked|chopped|crashout|sigma|npc|fanum|glazing|rizz|delulu|fumble|fumbled|mewing|him|her|ate|cringe)[.,!?]*$/i;

  // ---------- render ----------
  function paintBalance(value) {
    els.balance.textContent = fmt(value);
  }

  function renderStanding(animate = false) {
    const b = state.balance;
    const t = tier(b);
    document.body.dataset.tier = t.key;
    els.standing.textContent = t.name;
    els.vibe.textContent = t.vibe;
    els.txCount.textContent = state.history.length ? String(state.history.length) : "";

    const wasHidden = els.stamp.hidden;
    if (b < 0) {
      const collections = b <= -10000;
      els.stamp.hidden = false;
      els.stamp.textContent = collections ? "Sent to collections" : "Overdrawn";
      if (animate && (wasHidden || collections)) restartAnim(els.stamp, "pop");
    } else {
      els.stamp.hidden = true;
    }
  }

  function restartAnim(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  let animId = 0;
  function animateTo(target) {
    cancelAnimationFrame(animId);
    const start = displayed;
    const delta = target - start;
    if (!delta || reduceMotion()) { displayed = target; paintBalance(target); return; }
    const dur = Math.min(1300, 500 + Math.abs(delta) / 10);
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      displayed = start + delta * (1 - Math.pow(1 - p, 3));
      paintBalance(displayed);
      if (p < 1) animId = requestAnimationFrame(step);
      else displayed = target;
    };
    animId = requestAnimationFrame(step);
  }

  function renderHistory() {
    els.history.replaceChildren();
    els.empty.hidden = state.history.length > 0;
    for (const tx of state.history) {
      const tr = document.createElement("tr");
      const cells = [
        ["c-date", shortDate(new Date(tx.ts))],
        ["", tx.summary],
        [`amt ${tx.amount < 0 ? "neg" : "pos"}`, fmtSigned(tx.amount)],
        [`amt ${tx.balance < 0 ? "neg" : ""}`, fmt(tx.balance)],
      ];
      for (const [cls, text] of cells) {
        const td = document.createElement("td");
        if (cls) td.className = cls;
        td.textContent = text;
        tr.appendChild(td);
      }
      els.history.appendChild(tr);
    }
  }

  function fillNotice(r, mode) {
    const amt = r.aura_change;
    els.noticeRef.textContent = `#${String(state.history.length).padStart(4, "0")}` +
      (r.larp_score != null ? ` \u00b7 LARP score ${r.larp_score}/100` : "");
    els.noticeTitle.textContent = r.title;
    els.noticeAmount.textContent = `${fmtSigned(amt)}`;
    const unit = document.createElement("small");
    unit.textContent = "AURA";
    els.noticeAmount.append(unit);
    els.noticeAmount.className = `amount ${amt < 0 ? "neg" : "pos"}`;
    els.noticeRoast.textContent = r.roast;

    if (mode === "send" && r.send_verdict) {
      const ok = r.send_verdict === "SEND";
      els.noticeSend.hidden = false;
      els.noticeRec.textContent = `Recommendation: ${r.send_verdict}`;
      els.noticeRec.className = `rec ${ok ? "pos" : "neg"}`;
      els.noticeRewrite.textContent = r.rewrite || "(no rewrite on file)";
      els.copyRewrite.hidden = !r.rewrite;
      els.copyRewrite.textContent = "copy";
    } else {
      els.noticeSend.hidden = true;
    }
    els.noticeQuest.hidden = !(amt < 0 && r.side_quest);
    els.noticeQuestText.textContent = r.side_quest || "";
    els.noticeSrc.textContent = r.source === "mock" ? "Verdict from the backup ledger (offline mode)."
      : r.source === "larp" ? "Verdict from the DeLARP Bureau of Aura Enforcement." : "";
  }

  // ---------- sheets ----------
  let lastFocus = null;
  function openSheet(sheet, focusEl) {
    lastFocus = document.activeElement;
    els.scrim.hidden = false;
    sheet.hidden = false;
    (focusEl || sheet).focus({ preventScroll: true });
  }
  function closeSheets() {
    els.notice.hidden = true;
    els.receipts.hidden = true;
    els.scrim.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  // ---------- full-screen typewriter verdict ----------
  // Tap 1 finishes the typing, tap 2 continues. It also continues on its own after a generous pause.
  let advance = null;
  function tapToAdvance() { return new Promise((res) => { advance = res; }); }
  els.captions.addEventListener("click", () => advance && advance());

  async function typeOut(text) {
    els.capTyped.replaceChildren();
    let interrupted = false;
    const tapped = tapToAdvance().then(() => { interrupted = true; });
    const words = text.split(/(\s+)/);
    for (const w of words) {
      if (interrupted) break;
      if (/^\s+$/.test(w)) { els.capTyped.append(w); continue; }
      const span = document.createElement("span");
      if (HOT.test(w)) span.className = "hot";
      els.capTyped.append(span);
      for (const ch of w) {
        if (interrupted) break;
        if (!span.textContent) sfx.blip();
        span.textContent += ch;
        const pause = /[.!?]/.test(ch) ? 380 : /[,;:]/.test(ch) ? 200 : 48;
        await Promise.race([wait(pause), tapped]);
      }
    }
    // a tap mid-typing shows the whole line at once
    if (interrupted) {
      els.capTyped.replaceChildren();
      text.split(/(\s+)/).forEach((w) => {
        if (/^\s+$/.test(w)) return els.capTyped.append(w);
        const span = document.createElement("span");
        if (HOT.test(w)) span.className = "hot";
        span.textContent = w;
        els.capTyped.append(span);
      });
    }
    return interrupted;
  }

  async function playVerdict(r) {
    if (reduceMotion()) { sfx.result(r.aura_change); return; }
    els.captions.dataset.tier = tier(state.balance).key;
    els.capResult.hidden = true;
    els.caret.hidden = false;
    els.capNext.textContent = "tap to skip";
    els.capNext.classList.remove("ready");
    document.body.classList.add("capping");
    els.captions.hidden = false;

    const wasTapped = await typeOut(r.roast);
    if (!wasTapped) await Promise.race([wait(1400), tapToAdvance()]);

    els.caret.hidden = true;
    els.capTitle.textContent = r.title;
    els.capAmount.textContent = `${fmtSigned(r.aura_change)} aura`;
    els.capResult.hidden = false;
    setTimeout(() => sfx.result(r.aura_change), 250);
    els.capNext.textContent = "tap to continue";
    els.capNext.classList.add("ready");
    await wait(450);
    await Promise.race([wait(6000), tapToAdvance()]);

    advance = null;
    els.captions.hidden = true;
    document.body.classList.remove("capping");
  }

  // ---------- actions ----------
  let loadingTimer = 0;
  function setBusy(busy) {
    actionButtons.forEach((b) => (b.disabled = busy));
    if (larpOn) larpBtn.disabled = busy;
    chips.forEach((c) => (c.disabled = busy));
    els.entry.readOnly = busy;
    clearInterval(loadingTimer);
    els.status.className = busy ? "status busy" : "status";
    if (busy) {
      let i = 0;
      els.status.textContent = LOADING[0];
      loadingTimer = setInterval(() => { i = (i + 1) % LOADING.length; els.status.textContent = LOADING[i]; }, 1400);
    } else {
      els.status.textContent = "";
    }
  }

  async function submit(mode) {
    const text = els.entry.value.trim();
    if (!text) {
      els.status.className = "status err";
      els.status.textContent = "418 Too Delulu: the box is empty. Type what you did first.";
      sfx.error();
      els.entry.focus();
      return;
    }
    setBusy(true);
    let data;
    try {
      const res = await fetch(mode === "larp" ? "/api/larp" : "/api/aura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "larp" ? { text } : { mode, text }),
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Teller error ${res.status}`);
    } catch (err) {
      setBusy(false);
      els.status.className = "status err";
      els.status.textContent = `Transaction declined: ${err.message}`;
      sfx.error();
      return;
    }

    const amount = Math.round(Number(data.aura_change) || 0);
    const verdict = { ...data, aura_change: amount, roast: data.roast || "No comment." };
    state.balance += amount;
    state.history.unshift({ ts: Date.now(), summary: data.summary || "Unlabelled transaction", amount, balance: state.balance });
    state.history = state.history.slice(0, 200);
    save();

    setBusy(false);
    els.entry.value = "";
    updateCounter();
    fillNotice(verdict, mode);
    renderHistory();

    await playVerdict(verdict);

    renderStanding(true);
    animateTo(state.balance);
    restartAnim(els.balance, amount < 0 ? "shake" : "bounce");
    if (!reduceMotion()) await wait(900);
    openSheet(els.notice, els.closeNotice);
  }

  function updateCounter() {
    const len = els.entry.value.length;
    els.counter.textContent = `${len}/1000`;
    els.counter.classList.toggle("warn", len > 900);
  }

  actionButtons.forEach((b) => b.addEventListener("click", () => { sfx.unlock(); sfx.pop(); submit(b.dataset.mode); }));
  chips.forEach((c) => c.addEventListener("click", () => {
    sfx.pop();
    els.entry.value = c.dataset.text;
    updateCounter();
    els.entry.focus();
    els.status.className = "status";
    els.status.textContent = c.dataset.mode === "send" ? "loaded. hit SHOULD I SEND?" : "loaded. hit CONFESS.";
  }));
  els.entry.addEventListener("input", updateCounter);
  els.entry.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit("confess");
  });
  els.copyRewrite.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(els.noticeRewrite.textContent);
      els.copyRewrite.textContent = "copied";
    } catch {
      els.copyRewrite.textContent = "copy failed";
    }
  });
  els.closeNotice.addEventListener("click", () => { sfx.pop(); closeSheets(); });
  const soundBtn = document.getElementById("sound-toggle");
  const paintSound = () => { soundBtn.textContent = sfx.on ? "sound on" : "sound off"; soundBtn.setAttribute("aria-pressed", String(sfx.on)); };
  soundBtn.addEventListener("click", () => { sfx.on = !sfx.on; paintSound(); if (sfx.on) sfx.pop(); });
  paintSound();
  els.scrim.addEventListener("click", closeSheets);
  els.openReceipts.addEventListener("click", () => { renderHistory(); openSheet(els.receipts, els.closeReceipts); });
  els.closeReceipts.addEventListener("click", closeSheets);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (advance) advance();
    else closeSheets();
  });
  els.reset.addEventListener("click", () => {
    if (!confirm("Close this account? All aura history will be deleted.")) return;
    state = freshState();
    save();
    closeSheets();
    renderHistory();
    renderStanding();
    animateTo(0);
  });

  // LARP check unlocks when the server has the teammate's API configured
  larpBtn.addEventListener("click", () => { if (!larpOn) return; sfx.unlock(); sfx.pop(); submit("larp"); });
  fetch("/api/health").then((r) => r.json()).then((h) => {
    if (!h.larp_enabled) return;
    larpOn = true;
    larpBtn.disabled = false;
    larpBtn.classList.add("larp-on");
    $("larp-note").textContent = "paste a post: is it a LARP?";
  }).catch(() => { /* stays locked */ });

  // ---------- init ----------
  els.entry.placeholder = `type here... ${pick(PLACEHOLDERS)}`;
  if (window.matchMedia("(min-width: 700px)").matches) els.entry.focus({ preventScroll: true });
  paintBalance(state.balance);
  renderStanding();
  renderHistory();
  updateCounter();
})();
