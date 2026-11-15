(() => {
  "use strict";

  const STORE_KEY = "aura-debt:v1";
  const $ = (id) => document.getElementById(id);

  const els = {
    acctNo: $("acct-no"), stmtDate: $("stmt-date"),
    balance: $("balance"), standing: $("standing"), stamp: $("stamp"),
    entry: $("entry"), counter: $("counter"), status: $("status"),
    notice: $("notice"), noticeRef: $("notice-ref"), noticeTitle: $("notice-title"),
    noticeAmount: $("notice-amount"), noticeRoast: $("notice-roast"),
    noticeSend: $("notice-send"), noticeRec: $("notice-rec"), noticeRewrite: $("notice-rewrite"),
    noticeQuest: $("notice-quest"), noticeQuestText: $("notice-quest-text"), noticeSrc: $("notice-src"),
    history: $("history"), empty: $("empty"), reset: $("reset"),
  };
  const buttons = Array.from(document.querySelectorAll("button[data-mode]"));

  // ---------- storage (never trust it to exist) ----------
  function freshState() {
    const n = () => String(Math.floor(1000 + Math.random() * 9000));
    return { balance: 0, history: [], account: `ARB-${n()}-${n()}-${n().slice(0, 2)}` };
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return freshState();
      const s = JSON.parse(raw);
      if (typeof s.balance !== "number" || !Array.isArray(s.history)) return freshState();
      return { ...freshState(), ...s };
    } catch { return freshState(); }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* private mode: live with it */ }
  }

  let state = load();
  let displayed = state.balance;

  // ---------- formatting ----------
  const nf = new Intl.NumberFormat("en-US");
  const MINUS = "−";
  const fmt = (n) => (n < 0 ? MINUS : "") + nf.format(Math.abs(Math.round(n)));
  const fmtSigned = (n) => (n > 0 ? "+" : n < 0 ? MINUS : "") + nf.format(Math.abs(n));
  const shortDate = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).toUpperCase();

  function standing(b) {
    if (b <= -10000) return "In Collections";
    if (b <= -3000) return "Generational Cringe";
    if (b < 0) return "Minor Fumble Era";
    if (b < 3000) return "Mid";
    if (b < 10000) return "Aura Farmer";
    return "Him/Her";
  }

  function paintBalance(value) {
    els.balance.textContent = `${fmt(value)} AURA`;
    els.balance.classList.toggle("neg", value < 0);
    els.balance.classList.toggle("pos", value > 0);
  }

  function renderStanding() {
    const b = state.balance;
    els.standing.textContent = standing(b);
    if (b < 0) {
      els.stamp.hidden = false;
      const collections = b <= -10000;
      els.stamp.textContent = collections ? "Sent to Collections" : "Overdrawn";
      els.stamp.classList.toggle("big", collections);
    } else {
      els.stamp.hidden = true;
    }
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
      const eased = 1 - Math.pow(1 - p, 3);
      displayed = start + delta * eased;
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
        [`mono ${tx.amount < 0 ? "neg" : "pos"}`, fmtSigned(tx.amount)],
        [`mono ${tx.balance < 0 ? "neg" : ""}`, fmt(tx.balance)],
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

  function renderNotice(r, mode) {
    const amt = r.aura_change;
    els.noticeRef.textContent = `Ref. ${String(state.history.length).padStart(4, "0")}`;
    els.noticeTitle.textContent = r.title;
    els.noticeAmount.textContent = `${fmtSigned(amt)} AURA`;
    els.noticeAmount.className = `amount mono ${amt < 0 ? "neg" : "pos"}`;
    els.noticeRoast.textContent = r.roast;

    if (mode === "send" && r.send_verdict) {
      els.noticeSend.hidden = false;
      els.noticeRec.textContent = `RECOMMENDATION: ${r.send_verdict}`;
      els.noticeRec.className = `rec mono ${r.send_verdict === "SEND" ? "pos" : "neg"}`;
      els.noticeRewrite.textContent = r.rewrite || "(no rewrite on file)";
    } else {
      els.noticeSend.hidden = true;
    }

    if (amt < 0 && r.side_quest) {
      els.noticeQuest.hidden = false;
      els.noticeQuestText.textContent = r.side_quest;
    } else {
      els.noticeQuest.hidden = true;
    }
    els.noticeSrc.textContent = r.source === "mock" ? "[branch backup ledger]" : "";
    els.notice.hidden = false;
  }

  // ---------- actions ----------
  function setBusy(busy) {
    buttons.forEach((b) => (b.disabled = busy));
    els.entry.readOnly = busy;
    els.status.className = busy ? "status loading" : "status";
    els.status.textContent = busy ? "Auditor reviewing your account…" : "";
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
      renderNotice({ ...data, aura_change: amount }, mode);
      renderHistory();
      renderStanding();
      animateTo(state.balance);
      els.entry.value = "";
      updateCounter();
    } catch (err) {
      setBusy(false);
      els.status.className = "status err";
      els.status.textContent = `Transaction declined: ${err.message}`;
    }
  }

  function updateCounter() {
    els.counter.textContent = `${els.entry.value.length} / 1000`;
  }

  buttons.forEach((b) => b.addEventListener("click", () => submit(b.dataset.mode)));
  els.entry.addEventListener("input", updateCounter);
  els.entry.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit("confess");
  });
  els.reset.addEventListener("click", () => {
    if (!confirm("Close this account? All aura history will be shredded.")) return;
    state = freshState();
    save();
    els.notice.hidden = true;
    els.acctNo.textContent = state.account;
    renderHistory();
    renderStanding();
    animateTo(0);
  });

  // ---------- init ----------
  els.acctNo.textContent = state.account;
  els.stmtDate.textContent = shortDate(new Date());
  save();
  paintBalance(state.balance);
  renderStanding();
  renderHistory();
  updateCounter();
})();
