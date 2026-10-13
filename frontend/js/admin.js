// Kinetra admin: login, routing, metrics + charts, branches, inquiries.
(function () {
  'use strict';

  var TOKEN_KEY = 'kinetra-admin-token';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');

  // All dynamic content is built with textContent (never innerHTML), so server data cannot inject markup.
  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k]);
    });
    (function add(list) {
      list.forEach(function (c) {
        if (Array.isArray(c)) add(c);
        else if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    })(Array.prototype.slice.call(arguments, 2));
    return el;
  }

  var num = new Intl.NumberFormat('en-IN');
  var dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  function monthLabel(key, long) {
    var p = key.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, 1)).toLocaleDateString('en-IN', {
      month: 'short', year: long ? 'numeric' : '2-digit', timeZone: 'UTC'
    });
  }

  function toast(msg, isError) {
    var t = h('div', { class: 'toast' + (isError ? ' error' : ''), text: msg, role: isError ? 'alert' : 'status' });
    $('#toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, 4500);
  }

  /* ---------- API ---------- */
  function ApiError(status, detail, data) { this.status = status; this.detail = detail; this.data = data; }

  function describe(detail) {
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map(function (d) { return String(d.msg).replace(/^Value error,\s*/, ''); }).join('. ');
    return 'Something went wrong';
  }

  function api(path, opts) {
    opts = opts || {};
    var headers = { Accept: 'application/json' };
    var token = sessionStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = 'Bearer ' + token;
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch(path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (r.status === 401 && token && path !== '/api/auth/login') {
            signOut('Your session has expired. Please sign in again.');
            throw new ApiError(401, 'Session expired', data);
          }
          if (!r.ok) throw new ApiError(r.status, describe(data.detail), data);
          return data;
        });
      });
  }

  /* ---------- Auth ---------- */
  var loginView = $('#login-view'), appView = $('#app-view');
  var loginForm = $('#login-form'), loginError = $('#login-error'), loginBtn = $('#login-btn');
  var started = false;

  function showLogin(msg) {
    appView.hidden = true; loginView.hidden = false;
    document.title = 'Sign in | Kinetra Admin';
    loginError.replaceChildren(msg ? h('p', { class: 'form-status error', text: msg }) : '');
    loginForm.elements.password.value = '';
    (loginForm.elements.username.value ? loginForm.elements.password : loginForm.elements.username).focus();
  }

  function signOut(msg) {
    sessionStorage.removeItem(TOKEN_KEY);
    destroyCharts();
    started = false;
    showLogin(msg);
  }

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var u = loginForm.elements.username.value.trim(), p = loginForm.elements.password.value;
    if (!u || !p) { loginError.replaceChildren(h('p', { class: 'form-status error', text: 'Enter your username and password.' })); return; }
    loginBtn.disabled = true; loginBtn.textContent = 'Signing in…'; loginError.replaceChildren('');
    api('/api/auth/login', { method: 'POST', body: { username: u, password: p } })
      .then(function (d) { sessionStorage.setItem(TOKEN_KEY, d.access_token); loginForm.reset(); startApp(); })
      .catch(function (err) {
        loginForm.elements.password.value = '';
        loginError.replaceChildren(h('p', { class: 'form-status error', text: err.status ? err.detail : 'Could not reach the server.' }));
        loginForm.elements.password.focus();
      })
      .then(function () { loginBtn.disabled = false; loginBtn.textContent = 'Sign in'; });
  });
  $('#logout-btn').addEventListener('click', function () { signOut(); });

  /* ---------- Router ---------- */
  var views = ['overview', 'branch-add', 'branches', 'messages', 'memberships'];
  var aliases = { inquiries: 'messages' };
  var loaded = {};

  function route() {
    var name = (location.hash.replace(/^#\/?/, '') || 'overview');
    name = aliases[name] || name;
    if (views.indexOf(name) < 0) name = 'overview';
    views.forEach(function (v) { $('#view-' + v).hidden = v !== name; });
    $$('.a-nav a').forEach(function (a) {
      if (a.dataset.view === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = $('#view-' + name + ' h1').textContent + ' | Kinetra Admin';
    if (name === 'overview') loadOverview();
    if (name === 'branches') loadBranches();
    if (name === 'messages' && !loaded.messages) loadInquiries(true);
    if (name === 'memberships' && !loaded.memberships) loadMemberships(true);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', function () { if (started) route(); });

  function startApp() {
    started = true; loaded = {};
    loginView.hidden = true; appView.hidden = false;
    if (!location.hash) history.replaceState(null, '', '#/overview');
    api('/api/admin/cities').then(function (c) { cities = c; initBranchForms(); }).catch(function () {});
    route();
    refreshBadges();
  }

  function setBadge(id, n) { var b = $('#badge-' + id); b.textContent = n > 99 ? '99+' : n; b.hidden = !n; b.setAttribute('aria-label', n + ' new'); }
  function refreshBadges() {
    api('/api/admin/inquiries?limit=1').then(function (d) { setBadge('messages', d.counts.new); }).catch(function () {});
    api('/api/admin/memberships?limit=1').then(function (d) { setBadge('memberships', d.counts.new); }).catch(function () {});
  }

  /* ---------- Overview: cards ---------- */
  function countUp(el, to) {
    if (reduce.matches || to === 0) { el.textContent = num.format(to); return; }
    var start = performance.now(), dur = 900;
    (function tick(now) {
      var t = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - t, 3);
      el.textContent = num.format(Math.round(to * e));
      if (t < 1) requestAnimationFrame(tick);
    })(start);
  }

  var metrics = null, charts = [];

  function loadOverview() {
    api('/api/admin/metrics?months=12').then(function (m) {
      metrics = m;
      var t = m.totals;
      countUp($('#s-customers'), t.customers);
      countUp($('#s-inquiries'), t.inquiries);
      countUp($('#s-applications'), t.applications);
      $('#s-customers-sub').textContent = '+' + num.format(t.new_customers_this_month) + ' this month · ' + num.format(t.active_customers) + ' active';
      $('#s-inquiries-sub').textContent = num.format(t.new_inquiries) + ' awaiting a reply';
      $('#s-applications-sub').textContent = num.format(t.new_applications) + ' awaiting review';
      $('#partial-note').textContent = 'The latest month (' + monthLabel(m.customers_by_month[m.customers_by_month.length - 1].month, true) + ') is month-to-date and shown dashed or marked in the tooltip.';
      setBadge('messages', t.new_inquiries); setBadge('memberships', t.new_applications);
      buildCharts();
    }).catch(function (err) { if (err.status === 401) return; console.error(err); toast('Could not load metrics: ' + (err.detail || err.message), true); });
  }

  /* ---------- Overview: charts ---------- */
  function tok(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function destroyCharts() { charts.forEach(function (c) { c.destroy(); }); charts = []; }

  var crosshair = {
    id: 'crosshair',
    afterDatasetsDraw: function (chart) {
      if (chart.config.type !== 'line') return;
      var a = chart.tooltip && chart.tooltip.getActiveElements();
      if (!a || !a.length) return;
      var x = a[0].element.x, ctx = chart.ctx, area = chart.chartArea;
      ctx.save(); ctx.beginPath(); ctx.moveTo(x, area.top); ctx.lineTo(x, area.bottom);
      ctx.lineWidth = 1; ctx.strokeStyle = tok('--muted'); ctx.setLineDash([3, 3]); ctx.stroke(); ctx.restore();
    }
  };

  function baseOptions(multi, yFmt) {
    return {
      responsive: true, maintainAspectRatio: false,
      animation: reduce.matches ? false : { duration: 700 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: multi, align: 'end', labels: { color: tok('--text'), usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 10, boxHeight: 10, font: { family: 'Manrope', weight: '700' } } },
        tooltip: {
          backgroundColor: tok('--surface'), titleColor: tok('--text'), bodyColor: tok('--text'), borderColor: tok('--glass-border'),
          borderWidth: 1, padding: 12, boxPadding: 6, usePointStyle: true, titleFont: { family: 'Manrope', weight: '800' }, bodyFont: { family: 'Manrope', weight: '600' }
        }
      },
      scales: {
        x: { grid: { display: false }, border: { color: tok('--chart-grid') }, ticks: { color: tok('--muted'), maxRotation: 0, autoSkipPadding: 12, font: { family: 'Manrope', weight: '600' } } },
        y: { beginAtZero: true, grid: { color: tok('--chart-grid') }, border: { display: false }, ticks: { color: tok('--muted'), callback: yFmt, maxTicksLimit: 6, font: { family: 'Manrope', weight: '600' } } }
      }
    };
  }

  function areaFill(color) {
    return function (ctx) {
      var area = ctx.chart.chartArea;
      if (!area) return 'transparent';
      var g = ctx.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
      g.addColorStop(0, color + '55'); g.addColorStop(1, color + '00');
      return g;
    };
  }

  function lineChart(canvas, labels, series, opts) {
    var last = labels.length - 1, s = series;
    var o = baseOptions(false, opts.yFmt);
    o.plugins.tooltip.callbacks = {
      title: function (items) { return opts.titles[items[0].dataIndex] + (items[0].dataIndex === last ? ' (month to date)' : ''); },
      label: function (c) { return ' ' + s.label + ': ' + num.format(c.parsed.y); },
      afterBody: opts.afterBody
    };
    return new Chart(canvas, {
      type: 'line', plugins: [crosshair], options: o,
      data: { labels: labels, datasets: [{
        label: s.label, data: s.data, borderColor: s.color, backgroundColor: areaFill(s.color), fill: true, tension: 0.3, borderWidth: 2,
        pointRadius: 0, pointHoverRadius: 6, pointHoverBackgroundColor: s.color, pointHoverBorderColor: tok('--surface'), pointHoverBorderWidth: 2,
        segment: { borderDash: function (c) { return c.p1DataIndex === last ? [5, 4] : undefined; } }
      }] }
    });
  }

  function barChart(canvas, labels, titles, sets) {
    var last = labels.length - 1;
    var o = baseOptions(true, function (v) { return Number.isInteger(v) ? v : ''; });
    o.scales.x.stacked = true; o.scales.y.stacked = true;
    o.plugins.tooltip.callbacks = {
      title: function (items) { return titles[items[0].dataIndex] + (items[0].dataIndex === last ? ' (month to date)' : ''); },
      footer: function (items) { return 'Total: ' + items.reduce(function (a, i) { return a + i.parsed.y; }, 0); }
    };
    return new Chart(canvas, {
      type: 'bar', options: o,
      data: { labels: labels, datasets: sets.map(function (s) {
        return { label: s.label, data: s.data, backgroundColor: s.color, borderColor: tok('--surface'), borderWidth: 2, borderRadius: 4, borderSkipped: false, maxBarThickness: 34 };
      }) }
    });
  }

  function tableFor(caption, headers, rows) {
    return h('div', { class: 'table-box', tabindex: '0', role: 'region', 'aria-label': caption },
      h('table', { class: 'data-table' },
        h('caption', { class: 'sr-only', text: caption }),
        h('thead', null, h('tr', null, headers.map(function (t) { return h('th', { scope: 'col', text: t }); }))),
        h('tbody', null, rows.map(function (r) { return h('tr', null, r.map(function (c, i) { return i === 0 ? h('th', { scope: 'row', text: c }) : h('td', { text: c }); })); }))));
  }

  // One card = header (title, subtitle, Chart/Table switch) + canvas or accessible table.
  function mountCard(card, title, subtitle, makeChart, makeTable) {
    card.replaceChildren();
    var canvas = h('canvas', { role: 'img', 'aria-label': title + ': ' + subtitle });
    var box = h('div', { class: 'canvas-box' }, canvas);
    var tbl = makeTable(); tbl.hidden = true;
    var bChart = h('button', { class: 'seg', type: 'button', 'aria-pressed': 'true', text: 'Chart' });
    var bTable = h('button', { class: 'seg', type: 'button', 'aria-pressed': 'false', text: 'Table' });
    function show(isChart) {
      bChart.setAttribute('aria-pressed', String(isChart)); bTable.setAttribute('aria-pressed', String(!isChart));
      box.hidden = !isChart; tbl.hidden = isChart;
    }
    bChart.addEventListener('click', function () { show(true); });
    bTable.addEventListener('click', function () { show(false); });
    card.appendChild(h('div', { class: 'chart-head' },
      h('div', null, h('h2', { text: title }), h('p', { text: subtitle })),
      h('div', { class: 'seg-group', role: 'group', 'aria-label': title + ' view' }, bChart, bTable)));
    card.appendChild(box); card.appendChild(tbl);
    charts.push(makeChart(canvas));
  }

  function buildCharts() {
    if (!metrics) return;
    destroyCharts();
    var m = metrics, s1 = tok('--s1'), s2 = tok('--s2');
    var keys = m.customers_by_month.map(function (p) { return p.month; });
    var labels = keys.map(function (k) { return monthLabel(k, false); });
    var titles = keys.map(function (k) { return monthLabel(k, true); });
    var last = keys.length - 1;
    function ttl(i) { return titles[i] + (i === last ? ' (to date)' : ''); }

    mountCard($('#card-customers'), 'Customer growth', 'Cumulative customers', function (cv) {
      return lineChart(cv, labels, { label: 'Customers', color: s1, data: m.customers_by_month.map(function (p) { return p.total; }) },
        { titles: titles, yFmt: function (v) { return num.format(v); },
          afterBody: function (items) { return ' New this month: +' + m.customers_by_month[items[0].dataIndex].new; } });
    }, function () {
      return tableFor('Customer growth by month', ['Month', 'New', 'Total'], m.customers_by_month.map(function (p, i) { return [ttl(i), '+' + p.new, num.format(p.total)]; }));
    });

    mountCard($('#card-inquiries'), 'Contact messages by month', 'Handled vs. awaiting reply', function (cv) {
      return barChart(cv, labels, titles, [
        { label: 'Handled', color: s1, data: m.inquiries_by_month.map(function (p) { return p.handled; }) },
        { label: 'Awaiting reply', color: s2, data: m.inquiries_by_month.map(function (p) { return p.new; }) }
      ]);
    }, function () {
      return tableFor('Contact messages by month', ['Month', 'Handled', 'Awaiting', 'Total'], m.inquiries_by_month.map(function (p, i) { return [ttl(i), p.handled, p.new, p.handled + p.new]; }));
    });

    mountCard($('#card-applications'), 'Membership applications by month', 'Reviewed vs. awaiting review', function (cv) {
      return barChart(cv, labels, titles, [
        { label: 'Reviewed', color: s1, data: m.applications_by_month.map(function (p) { return p.reviewed; }) },
        { label: 'Awaiting review', color: s2, data: m.applications_by_month.map(function (p) { return p.new; }) }
      ]);
    }, function () {
      return tableFor('Membership applications by month', ['Month', 'Reviewed', 'Awaiting', 'Total'], m.applications_by_month.map(function (p, i) { return [ttl(i), p.reviewed, p.new, p.reviewed + p.new]; }));
    });
  }
  window.addEventListener('themechange', function () { if (started && metrics && !$('#view-overview').hidden) buildCharts(); });

  /* ---------- Branch form (shared by "Add branch" and the edit dialog) ---------- */
  var cities = [];
  var branchRules = {
    name: function (v) { return v.trim().length < 2 ? 'Enter the branch name' : ''; },
    city: function (v) { return v ? '' : 'Select a city'; },
    address: function (v) { return v.trim().length < 5 ? 'Enter the full address' : ''; },
    contact_name: function (v) { v = v.trim(); return !v ? 'Enter a contact person' : !/^[\p{L} .'\-]+$/u.test(v) ? 'Use letters, spaces and . \' - only' : ''; },
    phone: function (v) { var d = v.replace(/\D/g, ''); return (!/^\+?[0-9][0-9 \-]*$/.test(v.trim()) || d.length < 10 || d.length > 13) ? 'Enter a valid phone number (10–13 digits)' : ''; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a valid email address'; }
  };

  function citySelect(id) {
    var sel = h('select', { class: 'input', id: id, name: 'city', required: '' }, h('option', { value: '', text: 'Select a city…' }));
    var byState = {};
    cities.forEach(function (c) { (byState[c.state] = byState[c.state] || []).push(c.city); });
    Object.keys(byState).sort().forEach(function (st) {
      var g = h('optgroup', { label: st });
      byState[st].forEach(function (c) { g.appendChild(h('option', { value: c, text: c })); });
      sel.appendChild(g);
    });
    return sel;
  }

  // Builds a branch form. opts: { id, submitLabel, onSubmit(body) -> Promise }
  function buildBranchForm(opts) {
    var form = h('form', { id: opts.id, novalidate: '' });
    var fields = [
      ['name', 'Branch name', function (id) { return h('input', { class: 'input', id: id, name: 'name', maxlength: '100', required: '', placeholder: 'Kinetra Salt Lake', autocomplete: 'off' }); }],
      ['city', 'City', function (id) { return citySelect(id); }],
      ['contact_name', 'Contact person', function (id) { return h('input', { class: 'input', id: id, name: 'contact_name', maxlength: '80', required: '', autocomplete: 'off' }); }],
      ['phone', 'Phone', function (id) { return h('input', { class: 'input', id: id, name: 'phone', type: 'tel', maxlength: '25', required: '', placeholder: '+91 98765 43210', autocomplete: 'off' }); }],
      ['email', 'Email', function (id) { return h('input', { class: 'input', id: id, name: 'email', type: 'email', maxlength: '120', required: '', autocomplete: 'off' }); }],
      ['address', 'Address', function (id) { return h('textarea', { class: 'input', id: id, name: 'address', maxlength: '300', rows: '3', required: '', placeholder: 'Street, locality, PIN' }); }]
    ];
    var errs = {};
    var grid = h('div', { class: 'bf-grid' });
    fields.forEach(function (f) {
      var id = opts.id + '-' + f[0], err = h('p', { class: 'field-error', id: id + '-err' }), ctl = f[2](id);
      ctl.setAttribute('aria-describedby', err.id); errs[f[0]] = err;
      grid.appendChild(h('div', { class: 'field bf-' + f[0] }, h('label', { for: id, text: f[1] }), ctl, err));
    });
    var status = h('div', { role: 'status' });
    var btn = h('button', { class: 'btn btn-primary', type: 'submit', text: opts.submitLabel });
    form.appendChild(grid); form.appendChild(status); form.appendChild(btn);

    function setError(f, msg) {
      errs[f].textContent = msg;
      if (msg) form.elements[f].setAttribute('aria-invalid', 'true'); else form.elements[f].removeAttribute('aria-invalid');
    }
    Object.keys(branchRules).forEach(function (f) {
      var el = form.elements[f];
      el.addEventListener('blur', function () { if (el.value) setError(f, branchRules[f](el.value)); });
      ['input', 'change'].forEach(function (ev) { el.addEventListener(ev, function () { if (el.getAttribute('aria-invalid')) setError(f, branchRules[f](el.value)); }); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault(); status.replaceChildren();
      var bad = null, body = {};
      Object.keys(branchRules).forEach(function (f) {
        var msg = branchRules[f](form.elements[f].value);
        setError(f, msg); if (msg && !bad) bad = form.elements[f];
        body[f] = form.elements[f].value.trim();
      });
      if (bad) { bad.focus(); return; }
      btn.disabled = true; btn.textContent = 'Saving…';
      opts.onSubmit(body).catch(function (err) {
        if (err.status === 409) { setError('name', err.detail); form.elements.name.focus(); }
        else if (err.status === 422 && err.data && Array.isArray(err.data.detail)) {
          err.data.detail.forEach(function (d) { var f = d.loc && d.loc[1]; if (branchRules[f]) setError(f, String(d.msg).replace(/^Value error,\s*/, '')); });
          status.replaceChildren(h('p', { class: 'form-status error', text: 'Please fix the highlighted fields.' }));
        } else if (err.status !== 401) status.replaceChildren(h('p', { class: 'form-status error', text: err.detail || 'Could not save the branch.' }));
      }).then(function () { btn.disabled = false; btn.textContent = opts.submitLabel; });
    });

    return {
      form: form,
      set: function (b) { Object.keys(branchRules).forEach(function (f) { form.elements[f].value = b ? b[f] : ''; setError(f, ''); }); status.replaceChildren(); },
      clear: function () { this.set(null); }
    };
  }

  var addForm = null, editForm = null, editingId = null;
  var branchDialog = $('#branch-dialog'), deleteDialog = $('#delete-dialog');

  function initBranchForms() {
    addForm = buildBranchForm({
      id: 'bf-add', submitLabel: 'Add branch',
      onSubmit: function (body) {
        return api('/api/admin/branches', { method: 'POST', body: body }).then(function (b) {
          addForm.clear(); toast('Branch “' + b.name + '” added'); location.hash = '#/branches';
        });
      }
    });
    $('#branch-add-panel').replaceChildren(addForm.form);

    editForm = buildBranchForm({
      id: 'bf-edit', submitLabel: 'Save changes',
      onSubmit: function (body) {
        return api('/api/admin/branches/' + editingId, { method: 'PATCH', body: body }).then(function (b) {
          branchDialog.close(); toast('Branch “' + b.name + '” updated'); loadBranches();
        });
      }
    });
    $('#branch-edit-panel').replaceChildren(editForm.form);
  }

  /* ---------- Dialogs ---------- */
  [branchDialog, deleteDialog].forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
  });

  /* ---------- Manage branches ---------- */
  var branchesCache = [];

  function branchCard(b) {
    var edit = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Edit' });
    var del = h('button', { class: 'btn btn-ghost btn-sm danger-text', type: 'button', text: 'Delete' });
    edit.addEventListener('click', function () {
      editingId = b.id; editForm.set(b); $('#branch-dialog-title').textContent = 'Edit ' + b.name;
      branchDialog.showModal(); editForm.form.elements.name.focus();
    });
    del.addEventListener('click', function () { confirmDelete(b); });
    return h('article', { class: 'branch glass' },
      h('span', { class: 'loc', text: b.city + ', ' + b.state }),
      h('h3', { text: b.name }),
      h('address', { text: b.address }),
      h('dl', null,
        h('dt', { text: 'Contact' }), h('dd', { text: b.contact_name }),
        h('dt', { text: 'Phone' }), h('dd', null, h('a', { href: 'tel:' + b.phone.replace(/[^0-9+]/g, ''), text: b.phone })),
        h('dt', { text: 'Email' }), h('dd', null, h('a', { href: 'mailto:' + b.email, text: b.email }))),
      h('p', { class: 'count' }, h('strong', { text: num.format(b.customer_count) }), 'customers'),
      h('div', { class: 'card-actions' }, edit, del));
  }

  function loadBranches() {
    return api('/api/admin/branches').then(function (list) {
      branchesCache = list;
      $('#branches-sub').textContent = list.length + (list.length === 1 ? ' branch' : ' branches');
      var box = $('#branch-list');
      box.replaceChildren.apply(box, list.length ? list.map(branchCard) : [h('p', { class: 'empty', text: 'No branches yet. Use “Add branch” to create the first one.' })]);
    }).catch(function (err) { if (err.status !== 401) toast('Could not load branches: ' + err.detail, true); });
  }

  function confirmDelete(b) {
    $('#delete-dialog-title').textContent = 'Delete “' + b.name + '”?';
    $('#delete-text').textContent = b.customer_count
      ? 'This branch has ' + num.format(b.customer_count) + ' customers. Deleting it permanently removes the branch and those customer records. This cannot be undone.'
      : 'This permanently removes the branch. This cannot be undone.';
    var btn = $('#delete-confirm'), fresh = btn.cloneNode(true);
    btn.replaceWith(fresh);
    fresh.addEventListener('click', function () {
      fresh.disabled = true;
      api('/api/admin/branches/' + b.id + '?force=true', { method: 'DELETE' })
        .then(function () { deleteDialog.close(); toast('Branch deleted'); loaded = {}; return loadBranches(); })
        .catch(function (err) { if (err.status !== 401) toast(err.detail || 'Could not delete the branch', true); })
        .then(function () { fresh.disabled = false; });
    });
    deleteDialog.showModal();
  }

  /* ---------- Contact messages ---------- */
  var inq = { filter: '', items: [], total: 0 };
  var PAGE = 20;

  function inquiryCard(q) {
    var handled = q.status === 'handled';
    var btn = h('button', { class: 'btn btn-sm ' + (handled ? 'btn-ghost' : 'btn-primary'), type: 'button', text: handled ? 'Reopen' : 'Mark as handled' });
    btn.addEventListener('click', function () {
      btn.disabled = true;
      api('/api/admin/inquiries/' + q.id, { method: 'PATCH', body: { status: handled ? 'new' : 'handled' } })
        .then(function () { toast(handled ? 'Message reopened' : 'Marked as handled'); return loadInquiries(true, Math.max(inq.items.length, PAGE)); })
        .catch(function (err) { btn.disabled = false; if (err.status !== 401) toast(err.detail, true); });
    });
    return h('article', { class: 'inq glass' },
      h('div', { class: 'inq-top' },
        h('h3', { text: q.name }),
        h('span', { class: 'status ' + q.status, text: handled ? 'Handled' : 'New' }),
        h('time', { datetime: q.created_at, text: dateFmt.format(new Date(q.created_at)) })),
      h('div', { class: 'inq-meta' },
        h('a', { href: 'mailto:' + q.email, text: q.email }),
        h('a', { href: 'tel:' + q.phone.replace(/[^0-9+]/g, ''), text: q.phone }),
        h('span', { text: q.city })),
      h('p', { class: 'inq-msg', text: q.message }),
      h('div', { class: 'inq-foot' },
        h('span', { text: handled && q.handled_at ? 'Handled by ' + q.handled_by + ' on ' + dateFmt.format(new Date(q.handled_at)) : 'Awaiting reply' }),
        btn));
  }

  function renderInquiries() {
    var box = $('#inq-list');
    box.replaceChildren.apply(box, inq.items.length ? inq.items.map(inquiryCard)
      : [h('p', { class: 'empty', text: inq.filter ? 'Nothing here.' : 'No messages yet.' })]);
    $('#inq-more').hidden = inq.items.length >= inq.total;
  }

  function loadInquiries(reset, limit) {
    var offset = reset ? 0 : inq.items.length;
    var url = '/api/admin/inquiries?limit=' + (limit || PAGE) + '&offset=' + offset + (inq.filter ? '&status=' + inq.filter : '');
    return api(url).then(function (d) {
      loaded.messages = true;
      inq.items = reset ? d.items : inq.items.concat(d.items);
      inq.total = d.total;
      $('#c-all').textContent = d.counts.all; $('#c-new').textContent = d.counts.new; $('#c-handled').textContent = d.counts.handled;
      setBadge('messages', d.counts.new);
      renderInquiries();
    }).catch(function (err) { if (err.status !== 401) toast('Could not load messages: ' + err.detail, true); });
  }

  $('#inq-filters').addEventListener('click', function (e) {
    var b = e.target.closest('.seg'); if (!b) return;
    inq.filter = b.dataset.filter;
    $$('#inq-filters .seg').forEach(function (s) { s.setAttribute('aria-pressed', String(s === b)); });
    loadInquiries(true);
  });
  $('#inq-more').addEventListener('click', function () { loadInquiries(false); });

  /* ---------- Membership applications ---------- */
  var mem = { filter: '', items: [], total: 0 };
  var STATUS_LABEL = { new: 'New', contacted: 'Contacted', enrolled: 'Enrolled', declined: 'Declined' };
  var dateOnly = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });

  function detail(label, node) { return h('div', null, h('dt', { text: label }), h('dd', null, node)); }

  function memberCard(a) {
    var sel = h('select', { class: 'input status-select', 'aria-label': 'Status for ' + a.name });
    Object.keys(STATUS_LABEL).forEach(function (k) { sel.appendChild(h('option', { value: k, text: STATUS_LABEL[k], selected: k === a.status ? '' : false })); });
    sel.value = a.status;
    sel.addEventListener('change', function () {
      sel.disabled = true;
      api('/api/admin/memberships/' + a.id, { method: 'PATCH', body: { status: sel.value } })
        .then(function () { toast('Status set to ' + STATUS_LABEL[sel.value]); return loadMemberships(true, Math.max(mem.items.length, PAGE)); })
        .catch(function (err) { sel.disabled = false; sel.value = a.status; if (err.status !== 401) toast(err.detail, true); });
    });
    return h('article', { class: 'inq glass' },
      h('div', { class: 'inq-top' },
        h('h3', { text: a.name }),
        h('span', { class: 'status ' + a.status, text: STATUS_LABEL[a.status] }),
        h('span', { class: 'plan-pill', text: a.plan_name + ' plan' }),
        h('time', { datetime: a.created_at, text: dateFmt.format(new Date(a.created_at)) })),
      h('dl', { class: 'detail-grid' },
        detail('Email', h('a', { href: 'mailto:' + a.email, text: a.email })),
        detail('Phone', h('a', { href: 'tel:' + a.phone.replace(/[^0-9+]/g, ''), text: a.phone })),
        detail('City', a.city),
        detail('Branch', a.branch_name || 'Any branch'),
        detail('Wants to start', dateOnly.format(new Date(a.start_date + 'T00:00:00'))),
        detail('Goal', a.goal_label)),
      a.notes ? h('p', { class: 'inq-msg', text: a.notes }) : null,
      h('div', { class: 'inq-foot' },
        h('span', { text: a.updated_at ? 'Updated by ' + a.updated_by + ' on ' + dateFmt.format(new Date(a.updated_at)) : 'Not reviewed yet' }),
        h('label', { class: 'status-wrap' }, h('span', { text: 'Status' }), sel)));
  }

  function renderMembers() {
    var box = $('#mem-list');
    box.replaceChildren.apply(box, mem.items.length ? mem.items.map(memberCard)
      : [h('p', { class: 'empty', text: mem.filter ? 'Nothing here.' : 'No applications yet.' })]);
    $('#mem-more').hidden = mem.items.length >= mem.total;
  }

  function loadMemberships(reset, limit) {
    var offset = reset ? 0 : mem.items.length;
    var url = '/api/admin/memberships?limit=' + (limit || PAGE) + '&offset=' + offset + (mem.filter ? '&status=' + mem.filter : '');
    return api(url).then(function (d) {
      loaded.memberships = true;
      mem.items = reset ? d.items : mem.items.concat(d.items);
      mem.total = d.total;
      ['all', 'new', 'contacted', 'enrolled', 'declined'].forEach(function (k) { $('#m-' + k).textContent = d.counts[k]; });
      setBadge('memberships', d.counts.new);
      renderMembers();
    }).catch(function (err) { if (err.status !== 401) toast('Could not load applications: ' + err.detail, true); });
  }

  $('#mem-filters').addEventListener('click', function (e) {
    var b = e.target.closest('.seg'); if (!b) return;
    mem.filter = b.dataset.filter;
    $$('#mem-filters .seg').forEach(function (s) { s.setAttribute('aria-pressed', String(s === b)); });
    loadMemberships(true);
  });
  $('#mem-more').addEventListener('click', function () { loadMemberships(false); });

  /* ---------- Boot ---------- */
  if (sessionStorage.getItem(TOKEN_KEY)) {
    api('/api/auth/me').then(startApp).catch(function () { if (!started) showLogin(); });
  } else {
    showLogin();
  }
})();
