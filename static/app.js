(() => {
  "use strict";

  const STORE_KEY = "aura-debt:v1";
  const $ = (id) => document.getElementById(id);
  const els = {
    judge: $("judge"), judgeLine: $("judge-line"), stage: $("stage"), flash: $("flash"),
    desk: $("desk"), verdict: $("verdict"),
    balance: $("balance"), standing: $("standing"), vibe: $("vibe"), sheetRank: $("sheet-rank"),
    entry: $("entry"), counter: $("counter"), txCount: $("tx-count"), soundBtn: $("sound-toggle"),
    larpBtn: $("larp-btn"), larpNote: $("larp-note"),
    vBubble: $("v-bubble"), capTyped: $("cap-typed"), caret: $("caret"),
    capResult: $("cap-result"), capTitle: $("cap-title"), capAmount: $("cap-amount"), capNext: $("cap-next"),
    noticeRef: $("notice-ref"), noticeSend: $("notice-send"), noticeRec: $("notice-rec"), replies: $("replies"),
    noticeQuest: $("notice-quest"), noticeQuestText: $("notice-quest-text"), noticeSrc: $("notice-src"),
    scrim: $("scrim"), receipts: $("receipts"), openReceipts: $("open-receipts"), closeReceipts: $("close-receipts"),
    history: $("history"), empty: $("empty"), reset: $("reset"),
    attach: $("attach"), shot: $("shot"), shotImg: $("shot-img"), shotX: $("shot-x"), shotFile: $("shot-file"),
    handle: $("handle"), plat: $("plat"), dossier: $("dossier"),
    wanted: $("wanted"), openWanted: $("open-wanted"), closeWanted: $("close-wanted"),
    demo: $("demo"), demoVideo: $("demo-video"), openDemo: $("open-demo"), closeDemo: $("close-demo"),
    natDebt: $("nat-debt"), natCeiling: $("nat-ceiling"), posters: $("posters"), wantedSrc: $("wanted-src"),
  };
  const actionButtons = Array.from(document.querySelectorAll(".btn[data-mode]"));
  const chips = Array.from(document.querySelectorAll(".chip"));
  const rings = document.querySelector(".rings");
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
      deal() { noise(0, 0.06, 0.06, 2500); }, // a card flicked onto the desk
      stamp() { tone(180, 0, 0.12, { type: "sine", vol: 0.25, slideTo: 70 }); noise(0, 0.05, 0.1, 400); },
      copy(risky) { // two quick rising notes; the risky one ends on a wobble
        tone(784, 0, 0.07, { type: "triangle", vol: 0.07 });
        tone(risky ? 1109 : 1175, 0.07, 0.14, { type: "triangle", vol: 0.07, slideTo: risky ? 990 : 1320 });
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

  // ---------- copy ----------
  const nf = new Intl.NumberFormat("en-US");
  const MINUS = "−";
  const fmt = (n) => (n < 0 ? MINUS : "") + nf.format(Math.abs(Math.round(n)));
  const fmtSigned = (n) => (n > 0 ? "+" : n < 0 ? MINUS : "") + nf.format(Math.abs(n));
  const shortDate = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const TIERS = [
    { max: -10000, key: "chopped", name: "Chopped", vibe: "fully cooked. no return." },
    { max: -3000, key: "crashout", name: "Crashout Era", vibe: "ur grandkids will feel this" },
    { max: -1, key: "fumble", name: "Fumble Arc", vibe: "recoverable. barely." },
    { max: 2999, key: "npc", name: "NPC", vibe: "default skin energy" },
    { max: 9999, key: "farmer", name: "Aura Farmer", vibe: "aura farming detected" },
    { max: Infinity, key: "sigma", name: "Sigma", vibe: "unbothered. moisturised. him." },
  ];
  const tier = (b) => TIERS.find((t) => b <= t.max);

  // typed into the empty box one after another
  const EXAMPLES = [
    "i said \"you too\" when the waiter told me to enjoy my meal",
    "i waved back at someone who was waving at the person behind me",
    "i called my teacher mom. in front of everyone.",
    "i walked into a glass door. the door won.",
  ];
  const LOADING = [
    "the court is deliberating…",
    "checking the group chat…",
    "calculating fanum tax…",
    "consulting the elders…",
  ];
  const HOT = /^(aura|cooked|chopped|crashout|sigma|npc|fanum|glazing|rizz|delulu|fumble|fumbled|mewing|him|her|ate|cringe)[.,!?]*$/i;

  // ---------- the judge ----------
  let mouthTimer = 0;
  function setJudge(face, mouth = face === "shock" ? "shock" : face === "proud" ? "smile" : "idle", arm = "up") {
    clearTimeout(mouthTimer); // a pending "stop talking" flap must not undo this face
    delete els.judge.dataset.fidget;
    els.judge.dataset.face = face;
    els.judge.dataset.mouth = mouth;
    els.judge.dataset.arm = arm;
  }
  // the home-screen bubble only appears when the judge has something to say, then goes away
  let bubbleTimer = 0;
  function judgeSays(text, ms = 3200) {
    clearTimeout(bubbleTimer);
    els.judgeLine.textContent = text;
    els.judgeLine.classList.add("show");
    if (ms) bubbleTimer = setTimeout(hush, ms);
  }
  function hush() { clearTimeout(bubbleTimer); els.judgeLine.classList.remove("show"); }
  function flapMouth() {
    els.judge.dataset.mouth = "talk";
    clearTimeout(mouthTimer);
    mouthTimer = setTimeout(() => { els.judge.dataset.mouth = "idle"; }, 110);
  }

  // eyes: follow the pointer, read along while you type, or get pointed somewhere on purpose
  let lookLock = false;
  let lastKey = 0;
  function look(x, y) {
    els.judge.style.setProperty("--px", `${x.toFixed(1)}px`);
    els.judge.style.setProperty("--py", `${y.toFixed(1)}px`);
  }
  document.addEventListener("pointermove", (e) => {
    if (lookLock || performance.now() - lastKey < 1500) return;
    const r = els.judge.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * 0.45);
    const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 260);
    look((dx / d) * 6 * k, (dy / d) * 4.5 * k);
  });
  function reactToTyping() {
    if (busy || !els.verdict.hidden) return;
    const len = els.entry.value.trim().length;
    document.body.classList.toggle("long-text", len > 160);
    if (!len) { setJudge("idle"); look(0, 0); return; }
    lastKey = performance.now();
    if (els.judge.dataset.face !== "typing") setJudge("typing");
    look(((len % 24) / 24 - 0.5) * 9, 4.5);
  }

  // small things the judge does when nobody is confessing
  function fidget() {
    if (reduceMotion() || document.hidden || busy || lookLock || !els.verdict.hidden) return;
    if (els.judge.dataset.face !== "idle" || els.judge.dataset.fidget || els.entry.value) return;
    const f = pick(["glance", "glance", "yawn", "wig", "tap"]);
    if (f === "glance") {
      lookLock = true;
      look(-6, 0);
      setTimeout(() => look(6, 0), 600);
      setTimeout(() => { look(0, 0); lookLock = false; }, 1200);
      return;
    }
    els.judge.dataset.fidget = f;
    if (f === "yawn") els.judge.dataset.mouth = "shock";
    setTimeout(() => {
      if (els.judge.dataset.fidget !== f) return;
      delete els.judge.dataset.fidget;
      if (f === "yawn") els.judge.dataset.mouth = "idle";
    }, 1600);
  }

  // line boil: reseed the wobble filters a few times a second so the drawing never sits still
  const turbs = document.querySelectorAll(".boil-turb");
  let boilSeed = 1;
  function boil() {
    if (document.hidden || reduceMotion()) return;
    boilSeed = (boilSeed % 5) + 1;
    turbs.forEach((t) => t.setAttribute("seed", String(boilSeed)));
  }

  // aura rings spin up while the court deliberates
  function ringSpeed(rate) {
    try { els.judge.querySelectorAll(".ring").forEach((g) => g.getAnimations().forEach((a) => { a.playbackRate = rate; })); } catch { /* cosmetic */ }
  }

  // ---------- render ----------
  // the balance is an odometer: every digit is a strip of 0-9 that rolls to its value
  function setBalance(value) {
    const str = fmt(value);
    els.balance.setAttribute("aria-label", `${str} aura`);
    const shape = str.replace(/\d/g, "0");
    if (els.balance.dataset.shape !== shape) { // digit count or comma positions changed: rebuild the strips
      els.balance.dataset.shape = shape;
      els.balance.replaceChildren();
      for (const ch of str) {
        const cell = document.createElement("span");
        cell.setAttribute("aria-hidden", "true");
        if (/\d/.test(ch)) {
          cell.className = "od";
          const strip = document.createElement("span");
          strip.className = "strip";
          for (let d = 0; d < 10; d++) { const i = document.createElement("i"); i.textContent = d; strip.append(i); }
          cell.append(strip);
        } else {
          cell.className = "oc";
          cell.textContent = ch;
        }
        els.balance.append(cell);
      }
      void els.balance.offsetWidth; // new strips start at 0 and roll from there
    }
    Array.from(els.balance.children).forEach((cell, idx) => {
      if (cell.className !== "od") return;
      cell.firstChild.style.setProperty("--d", str[idx]);
      cell.firstChild.style.setProperty("--i", String(str.length - 1 - idx));
    });
  }

  let rankTimer = 0;
  function renderStanding(announce = false) {
    const b = state.balance;
    const t = tier(b);
    document.body.dataset.tier = t.key;
    document.body.dataset.sign = b < 0 ? "neg" : b > 0 ? "pos" : "zero";
    const name = b <= -10000 ? "Sent to collections" : t.name;
    els.standing.textContent = name;
    els.sheetRank.textContent = name;
    els.vibe.textContent = t.vibe;
    els.txCount.textContent = state.history.length ? String(state.history.length) : "";
    if (announce) {
      clearTimeout(rankTimer);
      els.standing.classList.add("show");
      rankTimer = setTimeout(() => els.standing.classList.remove("show"), 4500);
    }
  }

  function restartAnim(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
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

  function fillResult(r, mode) {
    const amt = r.aura_change;
    const sign = amt < 0 ? "neg" : "pos";
    const words = String(r.title).split(/\s+/).filter(Boolean);
    els.capTitle.replaceChildren(...words.map((w, i) => {
      const span = document.createElement("span");
      span.className = "w";
      span.style.setProperty("--i", String(i));
      span.textContent = w;
      return span;
    }));
    els.capTitle.setAttribute("aria-label", r.title);
    els.capTitle.className = `chopped ${sign}`;
    els.capResult.style.setProperty("--d", `${words.length * 120 + 80}ms`);
    els.capAmount.textContent = fmtSigned(amt);
    const unit = document.createElement("small");
    unit.textContent = "AURA";
    els.capAmount.append(unit);
    els.capAmount.className = `v-amount ${sign}`;
    els.noticeRef.textContent = `case #${String(state.history.length).padStart(4, "0")}` +
      (r.larp_score != null ? ` · LARP score ${r.larp_score}/100` : "");

    els.verdict.classList.toggle("has-send", mode === "send" && !!r.send_verdict);
    if (mode === "send" && r.send_verdict) {
      const ok = r.send_verdict === "SEND";
      els.noticeSend.hidden = false;
      els.noticeRec.textContent = ok ? "Recommendation: SEND" : "Recommendation: DO NOT SEND";
      els.noticeRec.className = `rec ${ok ? "pos" : "neg"}`;
      renderReplies(r.replies || (r.rewrite ? { balanced: r.rewrite } : {}));
    } else {
      els.replies.replaceChildren();
      els.noticeSend.hidden = true;
    }
    renderDossier(r.dossier);
    els.noticeQuest.hidden = !(amt < 0 && r.side_quest);
    els.noticeQuestText.textContent = r.side_quest || "";
    els.noticeSrc.textContent = r.source === "mock" ? "Verdict from the backup ledger (offline mode)."
      : r.source === "larp" ? "Verdict from the DeLARP Bureau of Aura Enforcement." : "";
  }

  // ---------- "should I send?": three ready-to-send replies, from safe to reckless ----------
  const RISKS = [
    { key: "safe", name: "Safe play", stakes: [["+200", "pos"]] },
    { key: "balanced", name: "Balanced", stakes: [["+800", "pos"]] },
    { key: "bold", name: "High risk", stakes: [["+3,000", "pos"], ["or", ""], [MINUS + "5,000", "neg"]] },
  ];
  function renderReplies(replies) {
    els.replies.replaceChildren(...RISKS.filter((k) => replies[k.key]).map((k, i) => {
      const li = document.createElement("li");
      li.className = `reply r-${k.key}`;
      li.style.setProperty("--k", String(i));
      const tag = document.createElement("span");
      tag.className = "tag";
      const name = document.createElement("b");
      name.textContent = k.name;
      const stakes = document.createElement("span");
      stakes.className = "stakes";
      for (const [txt, cls] of k.stakes) {
        const s = document.createElement("span");
        if (cls) s.className = cls;
        s.textContent = txt;
        stakes.append(s, " ");
      }
      tag.append(name, stakes);
      const text = document.createElement("p");
      text.className = "r-text";
      text.textContent = replies[k.key];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mini copy";
      btn.textContent = "copy";
      btn.setAttribute("aria-label", `Copy the ${k.name.toLowerCase()} reply`);
      btn.addEventListener("click", () => copyReply(li));
      li.append(tag, text, btn);
      return li;
    }));
  }
  async function copyReply(li) {
    const btn = li.querySelector(".copy");
    const text = li.querySelector(".r-text").textContent;
    let ok = true;
    try { await navigator.clipboard.writeText(text); } catch { ok = fallbackCopy(text); }
    els.replies.querySelectorAll(".reply.copied").forEach((x) => { if (x !== li) { x.classList.remove("copied"); x.querySelector(".copy").textContent = "copy"; } });
    btn.textContent = ok ? "copied" : "select it";
    if (ok) { restartAnim(li, "copied"); sfx.copy(li.classList.contains("r-bold")); }
    else sfx.error();
  }
  // clipboard API needs https or localhost; this keeps copy working on a LAN demo too
  function fallbackCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.append(ta); ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch { return false; }
  }

  // ---------- LARP check: the suspect's debt statement, printed line by line ----------
  function renderDossier(d) {
    const rows = [];
    if (d) {
      if (d.username) {
        const who = ["@" + d.username, d.platform, d.offenses ? `offense #${d.offenses}` : ""].filter(Boolean).join(" · ");
        rows.push(["suspect", who]);
      }
      if (d.claim) rows.push(["claim check", d.claim]);
      if (d.buzzword) rows.push(["translation", d.buzzword]);
      if (d.debt) rows.push(["aura owed", fmt(d.debt)]);
      if (d.credit_rating) rows.push(["credit rating", d.credit_rating]);
      if (d.apr) rows.push(["APR", d.apr]);
      if (d.collections_agent) rows.push(["collections", d.collections_agent]);
      const vibes = [d.hustle_ratio && `hustle to output ${d.hustle_ratio}`, d.buzzwords != null && `${d.buzzwords} buzzwords per post`].filter(Boolean);
      if (vibes.length) rows.push(["vibes", vibes.join(" · ")]);
    }
    els.dossier.replaceChildren();
    rows.slice(0, 5).forEach(([k, v], i) => {
      const dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = k; dd.textContent = v;
      dt.style.setProperty("--k", String(i)); dd.style.setProperty("--k", String(i));
      if ((k === "credit rating" && /^F/.test(v)) || (k === "claim check" && /(debunked|pure vibes)$/.test(v))) dd.className = "neg";
      els.dossier.append(dt, dd);
    });
    els.dossier.hidden = !rows.length;
    els.verdict.classList.toggle("has-dossier", rows.length > 0);
  }

  // ---------- LARP check: screenshots (attach, paste or drop) ----------
  let shot = null; // downscaled data URL
  function shrinkImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1400 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const g = c.getContext("2d");
        g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("not an image")); };
      img.src = url;
    });
  }
  async function attachShot(file) {
    if (busy || !els.verdict.hidden || !file || !/^image\//.test(file.type)) return;
    try { shot = await shrinkImage(file); } catch { judgeSays("that file is not a picture. the Bureau only reads pictures."); sfx.error(); return; }
    els.shotImg.src = shot;
    els.shot.hidden = false;
    els.attach.hidden = true;
    document.body.classList.add("has-shot");
    restartAnim(els.shot, "in");
    sfx.pop();
    setJudge("typing");
    look(4, 5);
    judgeSays(larpOn ? "screenshot received. confess, send or LARP check?" : "screenshot received. confess it or ask if you should send?");
  }
  function clearShot() {
    shot = null;
    els.shot.hidden = true;
    els.shotImg.removeAttribute("src");
    els.attach.hidden = false;
    els.shotFile.value = "";
    document.body.classList.remove("has-shot");
  }
  els.attach.addEventListener("click", () => els.shotFile.click());
  els.shotFile.addEventListener("change", () => attachShot(els.shotFile.files[0]));
  els.shotX.addEventListener("click", () => { clearShot(); reactToTyping(); els.entry.focus(); });
  document.addEventListener("paste", (e) => {
    const item = Array.from(e.clipboardData?.items || []).find((i) => i.kind === "file" && i.type.startsWith("image/"));
    if (item) { e.preventDefault(); attachShot(item.getAsFile()); }
  });
  els.desk.addEventListener("dragover", (e) => { e.preventDefault(); els.desk.classList.add("drop"); });
  els.desk.addEventListener("dragleave", () => els.desk.classList.remove("drop"));
  els.desk.addEventListener("drop", (e) => {
    els.desk.classList.remove("drop");
    const f = e.dataTransfer?.files?.[0];
    if (f) { e.preventDefault(); attachShot(f); }
  });
  els.plat.addEventListener("click", () => {
    const x = els.plat.dataset.p === "linkedin";
    els.plat.dataset.p = x ? "x" : "linkedin";
    els.plat.textContent = x ? "x" : "in";
    els.plat.setAttribute("aria-label", `Platform: ${x ? "X" : "LinkedIn"}`);
    sfx.pop();
  });

  // ---------- Most Wanted: the Bureau's board of repeat LARPers ----------
  async function openWanted() {
    els.scrim.hidden = false;
    els.wanted.hidden = false;
    els.closeWanted.focus({ preventScroll: true });
    els.natDebt.textContent = "…";
    els.natCeiling.textContent = "";
    els.wantedSrc.textContent = "";
    els.posters.replaceChildren(Object.assign(document.createElement("p"), { className: "empty", textContent: "pulling the files…" }));
    let data;
    try {
      const res = await fetch("/api/most-wanted");
      data = await res.json();
      if (!res.ok) throw new Error();
    } catch {
      els.posters.replaceChildren(Object.assign(document.createElement("p"), { className: "empty", textContent: "The Bureau's filing cabinet is jammed. Try again." }));
      return;
    }
    if (els.wanted.hidden) return;
    countUp(els.natDebt, data.national_aura_debt);
    els.natCeiling.textContent = data.debt_ceiling ? `· debt ceiling: ${data.debt_ceiling}` : "";
    els.wantedSrc.textContent = data.source === "mock" ? "Bureau offline: showing the last records on file." : "Live from the DeLARP Bureau of Aura Enforcement.";
    const seen = new Set();
    const list = (data.most_wanted || []).filter((w) => {
      const key = `${w.username}|${w.platform}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => (b.debt || 0) - (a.debt || 0));
    if (!list.length) {
      els.posters.replaceChildren(Object.assign(document.createElement("p"), { className: "empty", textContent: "Nobody wanted. Suspiciously humble internet." }));
      return;
    }
    els.posters.replaceChildren(...list.map((w, i) => {
      const card = document.createElement("article");
      card.className = "poster";
      card.style.setProperty("--k", String(i));
      const line = (cls, text) => { const p = document.createElement("p"); p.className = cls; p.textContent = text; card.append(p); return p; };
      line("p-wanted", "Wanted");
      line("p-for", `for LARPing${w.platform ? " on " + (w.platform === "x" ? "X" : w.platform === "linkedin" ? "LinkedIn" : w.platform) : ""}`);
      line("p-user", "@" + w.username);
      const debt = line("p-debt", w.debt != null ? fmt(w.debt) : "?");
      debt.append(Object.assign(document.createElement("small"), { textContent: " aura owed" }));
      const meta = [w.larp_score != null && `LARP score ${w.larp_score}`, w.offenses && `${w.offenses} offense${w.offenses === 1 ? "" : "s"}`, w.credit_rating].filter(Boolean);
      if (meta.length) line("p-meta", meta.join(" · "));
      if (w.last_known_verdict) line("p-last", `“${w.last_known_verdict}”`);
      if (w.minimum_payment) line("p-pay", `minimum payment: ${w.minimum_payment}`);
      return card;
    }));
  }
  // the national debt ticks up in chunky steps, like a cheap LED counter
  function countUp(el, target) {
    if (target == null) { el.textContent = "unknown"; return; }
    if (reduceMotion()) { el.textContent = fmt(target); return; }
    const steps = 14;
    let i = 0;
    const tick = () => {
      i++;
      el.textContent = fmt(Math.round(target * (1 - Math.pow(1 - i / steps, 3))));
      if (i < steps && !els.wanted.hidden) setTimeout(tick, 55); else el.textContent = fmt(target);
    };
    tick();
  }
  function closeWanted() {
    els.scrim.hidden = true;
    els.wanted.hidden = true;
    els.openWanted.focus({ preventScroll: true });
  }
  els.openWanted.addEventListener("click", () => { sfx.pop(); openWanted(); });

  // ---------- the demo video ----------
  function openDemo() {
    els.scrim.hidden = false;
    els.demo.hidden = false;
    els.closeDemo.focus({ preventScroll: true });
    try { const p = els.demoVideo.play(); if (p) p.catch(() => {}); } catch { /* user can press play */ }
  }
  function closeDemo() {
    try { els.demoVideo.pause(); } catch { /* ignore */ }
    els.scrim.hidden = true;
    els.demo.hidden = true;
    els.openDemo.focus({ preventScroll: true });
  }
  els.openDemo.addEventListener("click", () => { sfx.pop(); openDemo(); });
  els.closeDemo.addEventListener("click", closeDemo);
  els.closeWanted.addEventListener("click", closeWanted);

  // ---------- the verdict: the judge speaks, then BANG ----------
  // A tap while typing finishes the line; a tap after that continues.
  let advance = null;
  const tapToAdvance = () => new Promise((res) => { advance = res; });
  els.vBubble.addEventListener("click", () => advance && advance());
  els.capNext.addEventListener("click", () => { sfx.pop(); if (advance) advance(); });

  function writeWords(text, target) {
    target.replaceChildren();
    text.split(/(\s+)/).forEach((w) => {
      if (/^\s+$/.test(w)) return target.append(w);
      const span = document.createElement("span");
      if (HOT.test(w)) span.className = "hot";
      span.textContent = w;
      target.append(span);
    });
  }

  async function typeOut(text) {
    els.capTyped.replaceChildren();
    let interrupted = false;
    const tapped = tapToAdvance().then(() => { interrupted = true; });
    for (const w of text.split(/(\s+)/)) {
      if (interrupted) break;
      if (/^\s+$/.test(w)) { els.capTyped.append(w); continue; }
      const span = document.createElement("span");
      if (HOT.test(w)) span.className = "hot";
      els.capTyped.append(span);
      for (const ch of w) {
        if (interrupted) break;
        if (!span.textContent) { sfx.blip(); flapMouth(); }
        span.textContent += ch;
        const pause = /[.!?]/.test(ch) ? 380 : /[,;:]/.test(ch) ? 200 : 45;
        await Promise.race([wait(pause), tapped]);
      }
    }
    if (interrupted) writeWords(text, els.capTyped);
    return interrupted;
  }

  async function playVerdict(r, mode) {
    const still = reduceMotion();
    fillResult(r, mode);
    hush();
    // scene change: the desk drops away, the judge moves over, the verdict comes in from the right
    document.body.classList.add("in-verdict");
    document.body.classList.remove("long-text");
    els.desk.inert = true;
    els.verdict.classList.remove("leaving");
    els.verdict.hidden = false;
    els.capResult.hidden = true;
    els.capTyped.replaceChildren();
    els.caret.hidden = false;
    els.capNext.textContent = "skip";
    els.capNext.classList.remove("ready");
    setJudge("idle");
    lookLock = true;
    look(6, 1);

    if (still) writeWords(r.roast, els.capTyped);
    else {
      await wait(750);
      const wasTapped = await typeOut(r.roast);
      if (!wasTapped) await Promise.race([wait(700), tapToAdvance()]);
    }

    // wind up... BANG
    advance = null;
    els.caret.hidden = true;
    if (!still) { els.judge.dataset.arm = "wind"; await wait(170); }
    look(0, 0);
    setJudge(r.aura_change < 0 ? "shock" : "proud", undefined, "down");
    els.flash.classList.toggle("pos", r.aura_change >= 0);
    restartAnim(els.flash, "go");
    restartAnim(els.stage, "bang");
    restartAnim(rings, "burst");
    sfx.result(r.aura_change);
    els.capResult.hidden = false;
    if (!still && !els.noticeSend.hidden) { // time the stamp and the dealt cards with their CSS delays
      const d = parseFloat(els.capResult.style.getPropertyValue("--d")) || 200;
      setTimeout(() => sfx.stamp(), d + 380);
      Array.from(els.replies.children).forEach((_, k) => setTimeout(() => sfx.deal(), d + 600 + k * 140));
    }
    els.capNext.textContent = "continue";
    els.capNext.classList.add("ready");
    els.capNext.focus({ preventScroll: true });
    await tapToAdvance();

    advance = null;
    if (!still) { els.verdict.classList.add("leaving"); await wait(200); }
    els.verdict.hidden = true;
    els.verdict.classList.remove("leaving");
    els.desk.inert = false;
    document.body.classList.remove("in-verdict");
    lookLock = false;
    if (!still) await wait(450); // let the judge get back to the bench before the number moves
  }

  // ---------- receipts ----------
  function openLog() {
    renderHistory();
    els.scrim.hidden = false;
    els.receipts.hidden = false;
    els.closeReceipts.focus({ preventScroll: true });
  }
  function closeLog() {
    els.scrim.hidden = true;
    els.receipts.hidden = true;
    els.openReceipts.focus({ preventScroll: true });
  }

  // ---------- actions ----------
  let busy = false;
  let loadingTimer = 0;
  function setBusy(on) {
    busy = on;
    actionButtons.forEach((b) => (b.disabled = on));
    chips.forEach((c) => (c.disabled = on));
    if (larpOn) els.larpBtn.disabled = on;
    els.entry.readOnly = on;
    [els.handle, els.plat, els.attach, els.shotX].forEach((x) => (x.disabled = on));
    clearInterval(loadingTimer);
    document.body.classList.toggle("deliberating", on);
    ringSpeed(on ? 14 : 1);
    if (on) {
      let i = 0;
      setJudge("think");
      lookLock = true;
      look(5, -5);
      judgeSays(LOADING[0], 0);
      loadingTimer = setInterval(() => { i = (i + 1) % LOADING.length; judgeSays(LOADING[i], 0); }, 1400);
    } else {
      lookLock = false;
      hush();
    }
  }

  async function submit(mode) {
    const text = els.entry.value.trim();
    if (!text && !shot) {
      judgeSays(mode === "larp" ? "418 Too Delulu. paste the post or drop a screenshot." : "418 Too Delulu. type what you did, or paste a screenshot.");
      restartAnim(els.entry, "nope");
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
        body: JSON.stringify(mode === "larp"
          ? { text, image: shot || undefined, username: els.handle.value.trim().replace(/^@/, "") || undefined, platform: els.plat.dataset.p }
          : { mode, text, image: shot || undefined }),
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Teller error ${res.status}`);
    } catch (err) {
      setBusy(false);
      setJudge("idle");
      look(0, 0);
      judgeSays(`case dismissed: ${err.message}`, 5000);
      sfx.error();
      return;
    }

    const amount = Math.round(Number(data.aura_change) || 0);
    const verdict = { ...data, aura_change: amount, roast: data.roast || "No comment.", title: data.title || "Case closed" };
    state.balance += amount;
    state.history.unshift({ ts: Date.now(), summary: data.summary || "Unlabelled case", amount, balance: state.balance });
    state.history = state.history.slice(0, 200);
    save();

    setBusy(false);
    els.entry.value = "";
    clearShot();
    if (mode === "larp") els.handle.value = "";
    updateCounter();
    renderHistory();

    await playVerdict(verdict, mode);

    renderStanding(true);
    setBalance(state.balance);
    restartAnim(els.balance, amount < 0 ? "shake" : "bounce");
    if (window.matchMedia("(min-width: 821px)").matches) els.entry.focus({ preventScroll: true });
    setTimeout(() => { if (!busy && els.verdict.hidden && !els.entry.value) setJudge("idle"); }, 2200);
  }

  function updateCounter() {
    const len = els.entry.value.length;
    els.counter.hidden = len <= 900; // only shows up when you are about to hit the limit
    els.counter.textContent = `${len}/1000`;
  }

  actionButtons.forEach((b) => b.addEventListener("click", () => { sfx.unlock(); sfx.pop(); submit(b.dataset.mode); }));
  chips.forEach((c) => c.addEventListener("click", () => {
    sfx.pop();
    els.entry.value = c.dataset.text;
    if (c.dataset.handle) els.handle.value = "@" + c.dataset.handle;
    updateCounter();
    reactToTyping();
    els.entry.focus();
    judgeSays(c.dataset.mode === "larp" ? "loaded. now hit LARP CHECK." : c.dataset.mode === "send" ? "loaded. now hit SHOULD I SEND?" : "loaded. now hit CONFESS.");
  }));
  els.entry.addEventListener("input", () => { updateCounter(); reactToTyping(); });
  els.entry.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit("confess");
  });
  els.openReceipts.addEventListener("click", () => { sfx.pop(); openLog(); });
  els.closeReceipts.addEventListener("click", closeLog);
  els.scrim.addEventListener("click", () => (!els.demo.hidden ? closeDemo() : !els.wanted.hidden ? closeWanted() : closeLog()));
  document.addEventListener("keydown", (e) => {
    // 1 / 2 / 3 copy a reply while a "should I send?" verdict is up
    if (/^[123]$/.test(e.key) && !els.capResult.hidden && !els.verdict.hidden && !e.metaKey && !e.ctrlKey) {
      const li = els.replies.children[Number(e.key) - 1];
      if (li && !els.noticeSend.hidden) { e.preventDefault(); copyReply(li); }
      return;
    }
    if (e.key !== "Escape") return;
    if (advance) advance();
    else if (!els.receipts.hidden) closeLog();
    else if (!els.wanted.hidden) closeWanted();
    else if (!els.demo.hidden) closeDemo();
  });
  els.reset.addEventListener("click", () => {
    if (!confirm("Close this account? All aura history will be deleted.")) return;
    state = freshState();
    save();
    closeLog();
    renderHistory();
    renderStanding();
    setBalance(0);
    setJudge("idle");
  });
  const paintSound = () => {
    els.soundBtn.setAttribute("aria-pressed", String(sfx.on));
    els.soundBtn.title = sfx.on ? "Sound on" : "Sound off";
  };
  els.soundBtn.addEventListener("click", () => { sfx.on = !sfx.on; paintSound(); if (sfx.on) sfx.pop(); });

  // LARP check unlocks when the server has the teammate's API configured
  let larpOn = false;
  els.larpBtn.addEventListener("click", () => { if (!larpOn) return; sfx.unlock(); sfx.pop(); submit("larp"); });
  fetch("/api/health").then((r) => r.json()).then((h) => {
    if (!h.larp_enabled) return;
    larpOn = true;
    els.larpBtn.disabled = false;
    els.larpBtn.classList.add("on");
    els.larpNote.textContent = "";
    els.larpBtn.title = "Is this post a LARP? (paste text or a screenshot)";
    document.querySelectorAll(".larp-only").forEach((x) => { x.hidden = false; });
    document.body.classList.add("larp-on");
  }).catch(() => { /* stays locked */ });

  // the empty box types out example confessions, one after another
  let exampleIdx = 0;
  async function runPlaceholder() {
    const lead = "what did you do?  e.g. ";
    if (reduceMotion()) { els.entry.placeholder = lead + EXAMPLES[0]; return; }
    for (;;) {
      const ex = EXAMPLES[exampleIdx];
      for (let n = 0; n <= ex.length; n++) { els.entry.placeholder = lead + ex.slice(0, n); await wait(42); }
      await wait(2400);
      for (let n = ex.length; n >= 0; n -= 3) { els.entry.placeholder = lead + ex.slice(0, n); await wait(18); }
      exampleIdx = (exampleIdx + 1) % EXAMPLES.length;
    }
  }

  // ---------- init ----------
  paintSound();
  setBalance(state.balance);
  renderStanding();
  renderHistory();
  updateCounter();
  runPlaceholder();
  setInterval(boil, 150);
  setInterval(fidget, 5200);
  if (window.matchMedia("(min-width: 821px)").matches) els.entry.focus({ preventScroll: true });
})();
