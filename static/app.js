(() => {
  "use strict";

  const STORE_KEY = "aura-debt:v1";
  const $ = (id) => document.getElementById(id);
  const els = {
    balance: $("balance"), standing: $("standing"), vibe: $("vibe"), stamp: $("stamp"),
    entry: $("entry"), counter: $("counter"), status: $("status"), txCount: $("tx-count"),
    captions: $("captions"), capLine: $("cap-line"), capAmount: $("cap-amount"),
    scrim: $("scrim"), notice: $("notice"), noticeRef: $("notice-ref"), noticeTitle: $("notice-title"),
    noticeAmount: $("notice-amount"), noticeRoast: $("notice-roast"),
    noticeSend: $("notice-send"), noticeRec: $("notice-rec"), noticeRewrite: $("notice-rewrite"), copyRewrite: $("copy-rewrite"),
    noticeQuest: $("notice-quest"), noticeQuestText: $("notice-quest-text"), noticeSrc: $("notice-src"), closeNotice: $("close-notice"),
    receipts: $("receipts"), openReceipts: $("open-receipts"), closeReceipts: $("close-receipts"),
    history: $("history"), empty: $("empty"), reset: $("reset"),
  };
  const actionButtons = Array.from(document.querySelectorAll(".btn[data-mode]"));
  const chips = Array.from(document.querySelectorAll(".chip"));
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
    "spill it. what did you do?",
    "i said \"love you\" to my teacher...",
    "paste the text you're about to send",
    "i walked into a glass door. the door won.",
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
    els.noticeRef.textContent = `#${String(state.history.length).padStart(4, "0")}`;
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
    els.noticeSrc.textContent = r.source === "mock" ? "Verdict from the backup ledger (offline mode)." : "";
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

  // ---------- captions ----------
  function chunk(text) {
    const words = text.trim().split(/\s+/);
    const out = [];
    let cur = [];
    for (const w of words) {
      cur.push(w);
      if (cur.length === 3 || cur.join(" ").length > 15 || /[.!?;:]$/.test(w)) { out.push(cur); cur = []; }
    }
    if (cur.length) out.push(cur);
    return out;
  }
  function showChunk(words) {
    els.capLine.replaceChildren();
    words.forEach((w, i) => {
      const span = document.createElement("span");
      span.textContent = w;
      if (HOT.test(w)) span.className = "hot";
      els.capLine.append(span);
      if (i < words.length - 1) els.capLine.append(" ");
    });
    restartAnim(els.capLine, "pop");
  }

  let skip = null;
  async function playCaptions(r) {
    if (reduceMotion()) return;
    let skipped = false;
    const skipped$ = new Promise((res) => { skip = () => { skipped = true; res(); }; });
    const step = (ms) => Promise.race([wait(ms), skipped$]);

    els.capAmount.textContent = "";
    document.body.classList.add("capping");
    els.captions.hidden = false;
    for (const words of chunk(r.roast)) {
      if (skipped) break;
      showChunk(words);
      await step(300 + words.length * 140);
    }
    if (!skipped) {
      els.capLine.textContent = "";
      els.capAmount.textContent = `${fmtSigned(r.aura_change)} aura`;
      restartAnim(els.capAmount, "slam");
      await step(1100);
    }
    els.captions.hidden = true;
    document.body.classList.remove("capping");
    skip = null;
  }
  els.captions.addEventListener("click", () => skip && skip());

  // ---------- actions ----------
  let loadingTimer = 0;
  function setBusy(busy) {
    actionButtons.forEach((b) => (b.disabled = busy));
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
      els.status.textContent = "418 Too Delulu: the slip is blank. The auditor cannot audit vibes alone.";
      els.entry.focus();
      return;
    }
    setBusy(true);
    let data;
    try {
      const res = await fetch("/api/aura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, text }),
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Teller error ${res.status}`);
    } catch (err) {
      setBusy(false);
      els.status.className = "status err";
      els.status.textContent = `Transaction declined: ${err.message}`;
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

    await playCaptions(verdict);

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

  actionButtons.forEach((b) => b.addEventListener("click", () => submit(b.dataset.mode)));
  chips.forEach((c) => c.addEventListener("click", () => {
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
  els.closeNotice.addEventListener("click", closeSheets);
  els.scrim.addEventListener("click", closeSheets);
  els.openReceipts.addEventListener("click", () => { renderHistory(); openSheet(els.receipts, els.closeReceipts); });
  els.closeReceipts.addEventListener("click", closeSheets);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (skip) skip();
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

  // ---------- init ----------
  els.entry.placeholder = pick(PLACEHOLDERS);
  paintBalance(state.balance);
  renderStanding();
  renderHistory();
  updateCounter();
})();
