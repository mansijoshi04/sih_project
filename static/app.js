(() => {
  "use strict";

  const STORE_KEY = "aura-debt:v1";
  const THEME_KEY = "aura-debt:theme";
  const $ = (id) => document.getElementById(id);

  const els = {
    acctNo: $("acct-no"), stmtDate: $("stmt-date"),
    balance: $("balance"), delta: $("delta"), sparkLine: $("spark-line"), sparkZero: $("spark-zero"),
    standing: $("standing"), rating: $("rating"), vibe: $("vibe"), stamp: $("stamp"),
    entry: $("entry"), counter: $("counter"), status: $("status"),
    notice: $("notice"), noticeRef: $("notice-ref"), noticeYou: $("notice-you"), noticeStamp: $("notice-stamp"),
    noticeTitle: $("notice-title"), noticeAmount: $("notice-amount"), noticeRoast: $("notice-roast"),
    noticeSend: $("notice-send"), noticeRec: $("notice-rec"), noticeRewrite: $("notice-rewrite"), copyRewrite: $("copy-rewrite"),
    noticeQuest: $("notice-quest"), noticeQuestText: $("notice-quest-text"), noticeSrc: $("notice-src"),
    history: $("history"), empty: $("empty"), reset: $("reset"), barcode: $("barcode"),
  };
  const actionButtons = Array.from(document.querySelectorAll(".btn[data-mode]"));
  const chips = Array.from(document.querySelectorAll(".chip"));
  const themeTabs = Array.from(document.querySelectorAll("[data-theme-name]"));

  // ---------- storage (never trust it to exist) ----------
  const tryGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const trySet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

  function freshState() {
    const n = () => String(Math.floor(1000 + Math.random() * 9000));
    return { balance: 0, history: [], account: `ARB-${n()}-${n()}-${n().slice(0, 2)}` };
  }
  function load() {
    try {
      const s = JSON.parse(tryGet(STORE_KEY) || "null");
      if (!s || typeof s.balance !== "number" || !Array.isArray(s.history)) return freshState();
      return { ...freshState(), ...s };
    } catch { return freshState(); }
  }
  const save = () => trySet(STORE_KEY, JSON.stringify(state));

  let state = load();
  let displayed = state.balance;

  // ---------- formatting ----------
  const nf = new Intl.NumberFormat("en-US");
  const MINUS = "−";
  const fmt = (n) => (n < 0 ? MINUS : "") + nf.format(Math.abs(Math.round(n)));
  const fmtSigned = (n) => (n > 0 ? "+" : n < 0 ? MINUS : "") + nf.format(Math.abs(n));
  const shortDate = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).toUpperCase();
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const maskAcct = (a) => a.replace(/^ARB-\d{4}-\d{4}/, "****-****");

  const TIERS = [
    { max: -10000, key: "collections", name: "In Collections", rating: "Delisted", vibe: "they know where u live" },
    { max: -3000, key: "cringe", name: "Generational Cringe", rating: "Strong sell", vibe: "ur grandkids will feel this" },
    { max: -1, key: "fumble", name: "Minor Fumble Era", rating: "Sell", vibe: "recoverable. barely." },
    { max: 2999, key: "mid", name: "Mid", rating: "Hold", vibe: "neither seen nor perceived" },
    { max: 9999, key: "farmer", name: "Aura Farmer", rating: "Buy", vibe: "lowkey ate" },
    { max: Infinity, key: "him", name: "Him/Her", rating: "Strong buy", vibe: "main character, certified" },
  ];
  const tier = (b) => TIERS.find((t) => b <= t.max);

  const PLACEHOLDERS = [
    "e.g. I said \"love you\" to my manager at the end of a Teams call.",
    "e.g. I liked her post from 2019 at 3am. While deep-scrolling. On main.",
    "e.g. paste the text you're about to send and let the bank decide.",
    "e.g. I walked into a glass door at the open day. The door won.",
  ];
  const LOADING = [
    "Auditor reviewing your account…",
    "Consulting the group chat…",
    "Checking the receipts…",
    "Running a background vibe check…",
    "Escalating to the council…",
  ];

  // ---------- theme switcher ----------
  function applyTheme(name) {
    const link = $("theme-css");
    if (link) link.href = `/static/themes/${name}.css`;
    document.documentElement.dataset.theme = name;
    themeTabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.themeName === name)));
    trySet(THEME_KEY, name);
  }
  themeTabs.forEach((t) => t.addEventListener("click", () => applyTheme(t.dataset.themeName)));
  themeTabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.themeName === document.documentElement.dataset.theme)));

  // ---------- render ----------
  function paintBalance(value) {
    els.balance.textContent = fmt(value);
    const unit = document.createElement("small");
    unit.textContent = "AURA";
    els.balance.append(unit);
    els.balance.classList.toggle("neg", value < 0);
    els.balance.classList.toggle("pos", value > 0);
  }

  function renderStanding(animate = false) {
    const b = state.balance;
    const t = tier(b);
    document.body.dataset.tier = t.key;
    document.body.dataset.sign = b < 0 ? "neg" : b > 0 ? "pos" : "zero";
    els.standing.textContent = t.name;
    els.standing.className = `standing${b < 0 ? " neg" : b >= 3000 ? " pos" : ""}`;
    els.rating.textContent = t.rating;
    els.rating.className = `rating${b < 0 ? " neg" : b >= 3000 ? " pos" : ""}`;
    els.vibe.textContent = t.vibe;

    const last = state.history[0];
    els.delta.textContent = last ? `${fmtSigned(last.amount)} last txn` : "no trades yet";
    els.delta.className = `delta${last ? (last.amount < 0 ? " neg" : " pos") : ""}`;

    const wasHidden = els.stamp.hidden;
    if (b < 0) {
      const collections = b <= -10000;
      els.stamp.hidden = false;
      els.stamp.textContent = collections ? "Sent to Collections" : "Overdrawn";
      els.stamp.classList.toggle("big", collections);
      if (animate && (wasHidden || collections)) restartAnim(els.stamp, "pop");
    } else {
      els.stamp.hidden = true;
    }
    drawSpark();
  }

  function drawSpark() {
    const points = [0, ...state.history.slice().reverse().map((t) => t.balance)];
    const min = Math.min(0, ...points), max = Math.max(0, ...points);
    const span = max - min || 1;
    const y = (v) => (32 - ((v - min) / span) * 28 - 2).toFixed(2);
    const step = points.length > 1 ? 100 / (points.length - 1) : 100;
    const pts = points.length > 1 ? points.map((v, i) => `${(i * step).toFixed(2)},${y(v)}`) : [`0,${y(0)}`, `100,${y(0)}`];
    els.sparkLine.setAttribute("points", pts.join(" "));
    els.sparkZero.setAttribute("y1", y(0));
    els.sparkZero.setAttribute("y2", y(0));
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
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!delta || reduce) { displayed = target; paintBalance(target); return; }
    const dur = Math.min(1400, 500 + Math.abs(delta) / 10);
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
      tr.className = tx.amount < 0 ? "row-neg" : "row-pos";
      const cells = [
        ["c-date", shortDate(new Date(tx.ts))],
        ["c-desc", tx.summary],
        [`amt ${tx.amount < 0 ? "neg" : "pos"}`, fmtSigned(tx.amount)],
        [`amt c-bal ${tx.balance < 0 ? "neg" : ""}`, fmt(tx.balance)],
      ];
      for (const [cls, text] of cells) {
        const td = document.createElement("td");
        td.className = cls;
        td.textContent = text;
        tr.appendChild(td);
      }
      els.history.appendChild(tr);
    }
  }

  function renderNotice(r, mode, text) {
    const amt = r.aura_change;
    els.noticeRef.textContent = `Ref. ${String(state.history.length).padStart(4, "0")}`;
    els.noticeYou.textContent = text.length > 240 ? `${text.slice(0, 240)}…` : text;
    els.noticeTitle.textContent = r.title;
    els.noticeAmount.textContent = fmtSigned(amt);
    const unit = document.createElement("small");
    unit.textContent = "AURA";
    els.noticeAmount.append(unit);
    els.noticeAmount.className = `amount ${amt < 0 ? "neg" : "pos"}`;
    els.noticeRoast.textContent = r.roast;
    els.notice.dataset.sign = amt < 0 ? "neg" : "pos";

    let stampText;
    if (mode === "send" && r.send_verdict) {
      const ok = r.send_verdict === "SEND";
      stampText = ok ? "Approved" : "Declined";
      els.noticeSend.hidden = false;
      els.noticeRec.textContent = `Recommendation: ${r.send_verdict}`;
      els.noticeRec.className = `rec ${ok ? "pos" : "neg"}`;
      els.noticeRewrite.textContent = r.rewrite || "(no rewrite on file)";
      els.copyRewrite.hidden = !r.rewrite;
      els.copyRewrite.textContent = "copy";
    } else {
      stampText = amt < 0 ? "Debited" : "Credited";
      els.noticeSend.hidden = true;
    }
    els.noticeStamp.textContent = stampText;
    els.noticeStamp.classList.toggle("ok", stampText === "Approved" || stampText === "Credited");

    els.noticeQuest.hidden = !(amt < 0 && r.side_quest);
    els.noticeQuestText.textContent = r.side_quest || "";
    els.noticeSrc.textContent = r.source === "mock" ? "[backup ledger]" : "";
    els.notice.hidden = false;
    restartAnim(els.notice, "enter");
    restartAnim(els.noticeStamp, "pop");
  }

  function drawBarcode() {
    let seed = 0;
    for (const ch of state.account) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    els.barcode.replaceChildren();
    for (let i = 0; i < 46; i++) {
      const bar = document.createElement("span");
      bar.style.width = `${1 + Math.floor(rand() * 3)}px`;
      bar.style.marginRight = `${1 + Math.floor(rand() * 3)}px`;
      els.barcode.appendChild(bar);
    }
  }

  // ---------- actions ----------
  let loadingTimer = 0;
  function setBusy(busy) {
    actionButtons.forEach((b) => (b.disabled = busy));
    chips.forEach((c) => (c.disabled = busy));
    els.entry.readOnly = busy;
    document.body.classList.toggle("is-busy", busy);
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
    try {
      const res = await fetch("/api/aura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Teller error ${res.status}`);

      const amount = Math.round(Number(data.aura_change) || 0);
      state.balance += amount;
      state.history.unshift({ ts: Date.now(), summary: data.summary || "Unlabelled transaction", amount, balance: state.balance });
      state.history = state.history.slice(0, 200);
      save();

      setBusy(false);
      renderNotice({ ...data, aura_change: amount }, mode, text);
      renderHistory();
      renderStanding(true);
      animateTo(state.balance);
      els.entry.value = "";
      updateCounter();
      els.notice.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      setBusy(false);
      els.status.className = "status err";
      els.status.textContent = `Transaction declined: ${err.message}`;
    }
  }

  function updateCounter() {
    const len = els.entry.value.length;
    els.counter.textContent = `${len} / 1000`;
    els.counter.classList.toggle("warn", len > 900);
  }

  actionButtons.forEach((b) => b.addEventListener("click", () => submit(b.dataset.mode)));
  chips.forEach((c) => c.addEventListener("click", () => {
    els.entry.value = c.dataset.text;
    updateCounter();
    els.entry.focus();
    els.status.className = "status";
    els.status.textContent = c.dataset.mode === "send" ? "Loaded. Hit SHOULD I SEND?" : "Loaded. Hit CONFESS.";
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
  els.reset.addEventListener("click", () => {
    if (!confirm("Close this account? All aura history will be shredded.")) return;
    state = freshState();
    save();
    els.notice.hidden = true;
    els.acctNo.textContent = maskAcct(state.account);
    drawBarcode();
    renderHistory();
    renderStanding();
    animateTo(0);
  });

  // ---------- init ----------
  els.acctNo.textContent = maskAcct(state.account);
  const now = new Date();
  els.stmtDate.textContent = `${shortDate(now)} ${now.toTimeString().slice(0, 5)}`;
  els.entry.placeholder = pick(PLACEHOLDERS);
  drawBarcode();
  save();
  paintBalance(state.balance);
  renderStanding();
  renderHistory();
  updateCounter();
})();
