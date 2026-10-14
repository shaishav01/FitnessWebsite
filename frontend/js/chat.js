// Kinetra Coach: floating chat widget. Talks to POST /api/public/chat (Gemini on the server).
(function () {
  'use strict';
  var KEY = 'kinetra-chat-v1';
  var MAX_SEND = 12;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var SUGGESTIONS = ['Which plan suits me?', 'What’s included in Apex?', 'Tell me about Zumba classes', 'How do I apply?', 'Beginner workout tips'];
  var GREETING = 'Hey! I’m **Kinetra Coach**. Ask me about our plans, classes, branches, or get a quick workout or nutrition tip. What are you aiming for?';

  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') el.className = attrs[k]; else if (k === 'text') el.textContent = attrs[k]; else el.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return el;
  }

  /* ---- safe mini-markdown: **bold**, [text](#anchor), "- " bullets. Never uses innerHTML. ---- */
  var INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((#[a-z-]+)\)/g;
  function inline(text, into) {
    var last = 0, m;
    INLINE.lastIndex = 0;
    while ((m = INLINE.exec(text))) {
      if (m.index > last) into.appendChild(document.createTextNode(text.slice(last, m.index)));
      if (m[1]) into.appendChild(h('strong', { text: m[1] }));
      else into.appendChild(h('a', { href: m[3], text: m[2] }));
      last = INLINE.lastIndex;
    }
    if (last < text.length) into.appendChild(document.createTextNode(text.slice(last)));
  }
  function render(text, box) {
    var list = null;
    text.split('\n').forEach(function (line) {
      var b = line.match(/^\s*[-*•]\s+(.*)$/);
      if (b) {
        if (!list) { list = h('ul'); box.appendChild(list); }
        var li = h('li'); inline(b[1], li); list.appendChild(li);
      } else {
        list = null;
        if (line.trim()) { var p = h('p'); inline(line.trim(), p); box.appendChild(p); }
      }
    });
  }

  /* ---- state ---- */
  var history = [];
  try { history = JSON.parse(sessionStorage.getItem(KEY) || '[]').filter(function (m) { return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'; }); } catch (e) {}
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(history.slice(-30))); } catch (e) {} }

  /* ---- DOM ---- */
  var fab = h('button', { class: 'chat-fab', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'chat-panel' },
    h('img', { src: '/assets/logo.svg', alt: '', width: '42', height: '42' }), h('span', { text: 'Ask Coach' }));
  var log = h('div', { class: 'chat-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation' });
  var chips = h('div', { class: 'chat-chips' });
  var input = h('textarea', { id: 'chat-input', rows: '1', maxlength: '1000', placeholder: 'Ask about plans or workouts…', 'aria-label': 'Your message' });
  var send = h('button', { type: 'submit', 'aria-label': 'Send message' });
  send.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>'; // static markup, no user data
  var clear = h('button', { type: 'button', 'aria-label': 'Start a new chat', title: 'New chat' });
  clear.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/></svg>';
  var close = h('button', { type: 'button', 'aria-label': 'Close chat', text: '×' });
  var form = h('form', { class: 'chat-form' }, input, send);
  var panel = h('section', { class: 'chat-panel', id: 'chat-panel', role: 'dialog', 'aria-label': 'Kinetra Coach chat', hidden: '' },
    h('div', { class: 'chat-head' }, h('img', { src: '/assets/logo.svg', alt: '', width: '40', height: '40' }),
      h('div', null, h('strong', { text: 'Kinetra Coach' }), h('span', { text: 'AI assistant · fitness & Kinetra help' })), clear, close),
    log, chips, form,
    h('p', { class: 'chat-note', text: 'AI can make mistakes. Not medical advice.' }));
  document.body.appendChild(fab); document.body.appendChild(panel);

  function scroll() { log.scrollTop = log.scrollHeight; }
  function bubble(kind, text) {
    var b = h('div', { class: 'msg ' + kind });
    if (kind === 'bot') render(text, b); else b.textContent = text;
    log.appendChild(b); scroll(); return b;
  }
  function renderAll() {
    log.replaceChildren();
    bubble('bot', GREETING);
    history.forEach(function (m) { bubble(m.role === 'user' ? 'user' : 'bot', m.content); });
    showChips();
  }
  function showChips() {
    chips.replaceChildren();
    if (history.length) return;
    SUGGESTIONS.forEach(function (s) { chips.appendChild(h('button', { type: 'button', text: s })); });
  }

  /* ---- open / close ---- */
  function open() {
    panel.hidden = false; fab.setAttribute('aria-expanded', 'true'); document.body.classList.add('chat-open');
    scroll(); setTimeout(function () { input.focus({ preventScroll: true }); }, reduce.matches ? 0 : 150);
  }
  function shut(returnFocus) {
    panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); document.body.classList.remove('chat-open');
    if (returnFocus) fab.focus();
  }
  fab.addEventListener('click', open);
  close.addEventListener('click', function () { shut(true); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) shut(true); });
  log.addEventListener('click', function (e) { if (e.target.closest('a') && matchMedia('(max-width: 520px)').matches) shut(false); });
  clear.addEventListener('click', function () { history = []; save(); renderAll(); input.focus(); });
  chips.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) ask(b.textContent); });

  /* ---- input ---- */
  function grow() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; }
  input.addEventListener('input', grow);
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener('submit', function (e) { e.preventDefault(); var t = input.value.trim(); if (t) ask(t); });

  var busy = false;
  function ask(text) {
    if (busy) return;
    text = text.slice(0, 1000);
    busy = true; send.disabled = true; input.value = ''; grow(); chips.replaceChildren();
    history.push({ role: 'user', content: text }); save(); bubble('user', text);
    var typing = h('div', { class: 'msg bot typing', 'aria-label': 'Kinetra Coach is typing' }, h('i'), h('i'), h('i'));
    log.appendChild(typing); scroll();

    fetch('/api/public/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-MAX_SEND).map(function (m) { return { role: m.role, content: m.content }; }) })
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); })
      .then(function (res) {
        typing.remove();
        if (res.ok && res.data.reply) { history.push({ role: 'assistant', content: res.data.reply }); save(); bubble('bot', res.data.reply); return; }
        history.pop(); save(); // let the visitor retry the same question
        var msg = res.status === 429 ? 'You’re chatting faster than a sprint finish! Give me a few minutes and try again.'
          : typeof res.data.detail === 'string' ? res.data.detail : 'Something went wrong. Please try again.';
        bubble('err', msg); input.value = text; grow();
      })
      .catch(function () { typing.remove(); history.pop(); save(); bubble('err', 'I couldn’t reach the server. Check your connection and try again.'); input.value = text; grow(); })
      .then(function () { busy = false; send.disabled = false; if (!panel.hidden) input.focus({ preventScroll: true }); });
  }

  renderAll();
})();
