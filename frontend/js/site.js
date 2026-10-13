// Kinetra public site: nav, scroll motion, 3D tilt/parallax, pricing, inquiry form.
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var narrow = matchMedia('(max-width: 720px)');
  var canIO = 'IntersectionObserver' in window;

  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    (function add(list) {
      list.forEach(function (c) {
        if (Array.isArray(c)) add(c);
        else if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    })(Array.prototype.slice.call(arguments, 2));
    return el;
  }

  /* ---------- Header + mobile nav ---------- */
  var header = $('.site-header');
  var nav = $('#site-nav');
  var toggle = $('#menu-toggle');

  function onScrollHeader() { header.classList.toggle('scrolled', window.scrollY > 12); }
  window.addEventListener('scroll', onScrollHeader, { passive: true });
  onScrollHeader();

  function setMenu(open) {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('menu-open', open);
  }
  toggle.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); toggle.focus(); }
  });
  document.addEventListener('click', function (e) {
    if (nav.classList.contains('open') && !e.target.closest('#site-nav, #menu-toggle')) setMenu(false);
  });
  matchMedia('(min-width: 1001px)').addEventListener('change', function (m) { if (m.matches) setMenu(false); });

  // Light text over the hero photo, theme colours once it has scrolled away.
  var heroEl = $('.hero');
  if (heroEl && canIO) {
    new IntersectionObserver(function (en) { header.classList.toggle('on-hero', en[0].isIntersecting); },
      { rootMargin: '-72px 0px 0px 0px' }).observe(heroEl);
  }

  /* ---------- Reveal on scroll ---------- */
  var revealIO = canIO ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }) : null;

  function initReveal(root) {
    $$('.reveal:not([data-seen])', root).forEach(function (el) {
      el.setAttribute('data-seen', '');
      var sibs = Array.prototype.filter.call(el.parentElement.children, function (c) { return c.classList.contains('reveal'); });
      el.style.setProperty('--i', Math.min(sibs.indexOf(el), 6));
      if (revealIO) revealIO.observe(el); else el.classList.add('in');
    });
  }
  initReveal(document);

  /* ---------- 3D tilt (pointer-driven, rAF-throttled, mouse only) ---------- */
  var tiltEl = null, tiltEvt = null, tiltRaf = 0;

  function applyTilt() {
    tiltRaf = 0;
    if (!tiltEl || !tiltEvt) return;
    var r = tiltEl.getBoundingClientRect();
    var px = Math.min(1, Math.max(0, (tiltEvt.clientX - r.left) / r.width));
    var py = Math.min(1, Math.max(0, (tiltEvt.clientY - r.top) / r.height));
    var max = parseFloat(tiltEl.dataset.tiltMax) || 7;
    tiltEl.classList.add('is-tilting');
    tiltEl.style.setProperty('--ry', ((px - 0.5) * 2 * max).toFixed(2) + 'deg');
    tiltEl.style.setProperty('--rx', (-(py - 0.5) * 2 * max).toFixed(2) + 'deg');
    tiltEl.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
    tiltEl.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
  }
  function releaseTilt() {
    if (!tiltEl) return;
    tiltEl.classList.remove('is-tilting');
    tiltEl.style.setProperty('--rx', '0deg');
    tiltEl.style.setProperty('--ry', '0deg');
    tiltEl = null;
  }
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || reduce.matches) return;
    var el = e.target.closest ? e.target.closest('[data-tilt]') : null;
    if (tiltEl && tiltEl !== el) releaseTilt();
    if (!el) return;
    tiltEl = el; tiltEvt = e;
    if (!tiltRaf) tiltRaf = requestAnimationFrame(applyTilt);
  }, { passive: true });
  document.addEventListener('pointerleave', releaseTilt);
  window.addEventListener('blur', releaseTilt);

  /* ---------- Parallax: scroll layers + hero scene pointer depth ---------- */
  var parallaxEls = [];
  var visibleParallax = new Set();
  var scrollRaf = 0;

  function runParallax() {
    scrollRaf = 0;
    if (reduce.matches || narrow.matches) return;
    var mid = window.innerHeight / 2;
    var writes = [];
    visibleParallax.forEach(function (el) {
      // Measure the (untransformed) parent so our own transform never feeds back.
      var r = el.parentElement.getBoundingClientRect();
      writes.push([el, (r.top + r.height / 2 - mid) * parseFloat(el.dataset.parallax)]);
    });
    writes.forEach(function (w) { w[0].style.transform = 'translate3d(0,' + w[1].toFixed(1) + 'px,0)'; });
  }
  function clearParallax() { parallaxEls.forEach(function (el) { el.style.transform = ''; }); }

  if (canIO) {
    parallaxEls = $$('[data-parallax]');
    var parIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.isIntersecting ? visibleParallax.add(en.target) : visibleParallax.delete(en.target); });
      if (!scrollRaf) scrollRaf = requestAnimationFrame(runParallax);
    }, { rootMargin: '10% 0px' });
    parallaxEls.forEach(function (el) { parIO.observe(el); });
    window.addEventListener('scroll', function () { if (!scrollRaf) scrollRaf = requestAnimationFrame(runParallax); }, { passive: true });
    window.addEventListener('resize', function () { if (!scrollRaf) scrollRaf = requestAnimationFrame(runParallax); });
    var onMotionChange = function () { if (reduce.matches || narrow.matches) clearParallax(); else runParallax(); };
    reduce.addEventListener('change', onMotionChange);
    narrow.addEventListener('change', onMotionChange);
  }

  var stage = $('.stage');
  var hero = $('.hero');
  if (stage && hero && canIO) {
    var tx = 0, ty = 0, cx = 0, cy = 0, looping = false, heroVisible = true;
    var step = function () {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      stage.style.setProperty('--px', cx.toFixed(3));
      stage.style.setProperty('--py', cy.toFixed(3));
      if (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) requestAnimationFrame(step); else looping = false;
    };
    new IntersectionObserver(function (en) { heroVisible = en[0].isIntersecting; }).observe(hero);
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || reduce.matches || !heroVisible) return;
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
      if (!looping) { looping = true; requestAnimationFrame(step); }
    }, { passive: true });
  }

  /* ---------- Active nav link ---------- */
  if (canIO) {
    var links = {};
    $$('.nav a[href^="#"]').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var groups = [['services', '.bento-sec, .service'], ['gear', '.gear'], ['coaching', '.coaching'], ['pricing', '.pricing, .apply'], ['locations', '.stories, .locations, .faq'], ['contact', '.contact']];
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        Object.keys(links).forEach(function (k) { links[k].classList.toggle('active', k === en.target.dataset.group); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    groups.forEach(function (g) { $$(g[1]).forEach(function (el) { el.dataset.group = g[0]; navIO.observe(el); }); });
  }

  /* ---------- Image fallback ---------- */
  function imgFailed(img) { var p = img.closest('.photo'); if (p) p.classList.add('img-fallback'); }
  document.addEventListener('error', function (e) {
    if (e.target.tagName === 'IMG' && e.target.hasAttribute('data-fallback')) imgFailed(e.target);
  }, true);
  $$('img[data-fallback]').forEach(function (img) { if (img.complete && img.naturalWidth === 0 && img.currentSrc) imgFailed(img); });

  /* ---------- Catalog: pricing, plan summary, form options ---------- */
  var plansEl = $('#plans');
  var money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  var catalog = null;

  function renderPlans(data) {
    plansEl.replaceChildren();
    data.plans.forEach(function (plan) {
      var list = h('ul', { class: 'cover' });
      data.services.forEach(function (svc) {
        var note = plan.services[svc.id];
        list.appendChild(h('li', { class: note ? 'yes' : 'no' },
          h('span', { class: 'mark', 'aria-hidden': 'true', text: note ? '✓' : '✕' }),
          h('span', null,
            h('span', { class: 'svc', text: svc.name }),
            h('span', { class: 'sr-only', text: note ? ' included: ' : ' not included' }),
            note ? h('span', { class: 'note', text: note }) : null)));
      });
      plansEl.appendChild(h('article', { class: 'plan glass reveal' + (plan.highlight ? ' featured' : ''), 'data-tilt': '', 'data-tilt-max': '6' },
        plan.highlight ? h('span', { class: 'flag', text: 'Most popular' }) : null,
        h('h3', { text: plan.name }),
        h('p', { class: 'tag', text: plan.tagline }),
        h('p', { class: 'price' }, h('strong', { text: money.format(plan.price_inr) }), h('span', { text: '/ ' + plan.period })),
        h('p', { class: 'cover-title', text: 'What’s covered' }),
        list,
        h('a', { class: 'btn ' + (plan.highlight ? 'btn-primary' : 'btn-ghost'), href: '#apply', 'data-plan': plan.id, text: 'Apply for ' + plan.name })));
    });
    initReveal(plansEl);
  }

  function fillSelect(sel, items, placeholder, valueOf, labelOf) {
    sel.replaceChildren(h('option', { value: '', text: placeholder }));
    items.forEach(function (it) { sel.appendChild(h('option', { value: valueOf(it), text: labelOf(it) })); });
  }

  var mForm = $('#membership-form');
  var summary = $('#plan-summary');

  function renderSummary() {
    var id = mForm.elements.plan.value;
    var plan = catalog && catalog.plans.filter(function (p) { return p.id === id; })[0];
    if (!plan) { summary.replaceChildren(h('p', { class: 'ps-empty', text: 'Choose a plan to see exactly what it covers.' })); return; }
    var names = {};
    catalog.services.forEach(function (sv) { names[sv.id] = sv.name; });
    var items = Object.keys(plan.services).map(function (k) { return h('li', null, h('span', null, h('strong', { text: names[k] }), ' – ' + plan.services[k])); });
    summary.replaceChildren(
      h('div', { class: 'ps-head' }, h('h3', { text: plan.name + ' plan' }), h('span', { class: 'ps-price', text: money.format(plan.price_inr) + ' / ' + plan.period })),
      h('ul', null, items));
  }

  fetch('/api/public/catalog')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      catalog = data;
      renderPlans(data);
      fillSelect(mForm.elements.plan, data.plans, 'Select a plan…', function (p) { return p.id; }, function (p) { return p.name + ' – ' + money.format(p.price_inr) + '/mo'; });
      fillSelect(mForm.elements.goal, data.goals, 'Select your main goal…', function (g) { return g.id; }, function (g) { return g.label; });
      var wanted = (location.hash.match(/plan=(\w+)/) || [])[1];
      if (wanted) mForm.elements.plan.value = wanted;
      renderSummary();
    })
    .catch(function () {
      plansEl.replaceChildren(h('p', { class: 'plans-status', text: 'Pricing is temporarily unavailable. Please get in touch and we’ll share the latest plans.' }));
      renderSummary();
    });

  mForm.elements.plan.addEventListener('change', renderSummary);
  plansEl.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-plan]'); if (!a) return;
    mForm.elements.plan.value = a.dataset.plan; renderSummary();
    mForm.elements.plan.dispatchEvent(new Event('input'));
  });

  /* ---------- Branches: locations grid + application form option ---------- */
  fetch('/api/public/branches')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (branches) {
      var grid = $('#loc-grid');
      if (!branches.length) { grid.replaceChildren(h('p', { class: 'plans-status', text: 'Branch details coming soon.' })); return; }
      grid.replaceChildren();
      branches.forEach(function (b) {
        var btn = h('a', { class: 'btn btn-ghost btn-sm', href: '#apply', text: 'Apply at this branch' });
        btn.addEventListener('click', function () { mForm.elements.branch_id.value = String(b.id); });
        grid.appendChild(h('article', { class: 'loc glass reveal' },
          h('span', { class: 'pill-s', text: b.city + ', ' + b.state }),
          h('h3', { text: b.name }),
          h('address', { text: b.address }),
          h('a', { class: 'tel', href: 'tel:' + b.phone.replace(/[^0-9+]/g, ''), text: b.phone }),
          btn));
      });
      initReveal(grid);
      fillSelect(mForm.elements.branch_id, branches, 'Any branch', function (b) { return b.id; }, function (b) { return b.name + ' – ' + b.city; });
    })
    .catch(function () { $('#loc-grid').replaceChildren(h('p', { class: 'plans-status', text: 'Branch list is temporarily unavailable.' })); });

  /* ---------- Forms (shared validation + submit) ---------- */
  var cities = ['Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Pune', 'Ahmedabad', 'Chennai', 'Kolkata', 'Jaipur', 'Lucknow', 'Surat', 'Kochi', 'Chandigarh', 'Indore', 'Nagpur', 'Noida', 'Gurugram'];
  var dl = $('#city-list');
  cities.forEach(function (c) { dl.appendChild(h('option', { value: c })); });

  var nameRe = /^[\p{L} .'\-]+$/u;
  var common = {
    name: function (v) {
      v = v.trim();
      if (!v) return 'Please enter your name';
      if (v.length < 2) return 'Name is too short';
      if (!nameRe.test(v)) return 'Use letters, spaces and . \' - only';
      return '';
    },
    email: function (v) {
      v = v.trim();
      if (!v) return 'Please enter your email';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Enter a valid email address';
      return '';
    },
    phone: function (v) {
      v = v.trim();
      if (!v) return 'Please enter your phone number';
      var digits = v.replace(/\D/g, '');
      if (!/^\+?[0-9][0-9 \-]*$/.test(v) || digits.length < 10 || digits.length > 13) return 'Enter a valid phone number (10–13 digits)';
      return '';
    },
    city: function (v) {
      v = v.trim();
      if (!v) return 'Please enter your city';
      if (v.length < 2) return 'City name is too short';
      if (!nameRe.test(v)) return 'Use letters and spaces only';
      return '';
    }
  };

  function isoDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  function bindForm(form, o) {
    var slot = $('.form-status-slot', form), btn = $('.submit', form), fields = Object.keys(o.rules);

    function setError(f, msg) {
      var el = form.elements[f], err = el.closest('.field').querySelector('.field-error');
      err.textContent = msg;
      if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    }
    function check(f) { var m = o.rules[f](form.elements[f].value); setError(f, m); return !m; }
    function status(kind, msg) { slot.replaceChildren(msg ? h('p', { class: 'form-status ' + kind, text: msg }) : ''); }

    fields.forEach(function (f) {
      var el = form.elements[f], err = el.closest('.field').querySelector('.field-error');
      err.id = form.id + '-e-' + f; el.setAttribute('aria-describedby', err.id);
      el.addEventListener('blur', function () { if (el.value || el.dataset.touched) { el.dataset.touched = '1'; check(f); } });
      ['input', 'change'].forEach(function (ev) { el.addEventListener(ev, function () { if (el.dataset.touched) check(f); }); });
    });

    function thanks(msg) {
      var panel = h('div', { class: 'thanks', role: 'status' },
        h('div', { class: 'tick', 'aria-hidden': 'true', text: '✓' }),
        h('h3', { text: o.thanksTitle }),
        h('p', { class: 'lead center', text: msg }),
        h('button', { class: 'btn btn-ghost', type: 'button', text: o.again }));
      panel.lastChild.addEventListener('click', function () {
        form.reset(); fields.forEach(function (f) { delete form.elements[f].dataset.touched; });
        if (o.onReset) o.onReset();
        panel.replaceWith(form); status('', ''); form.elements[fields[0]].focus();
      });
      form.replaceWith(panel);
      panel.querySelector('button').focus({ preventScroll: true });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault(); status('', '');
      var firstBad = null;
      fields.forEach(function (f) { form.elements[f].dataset.touched = '1'; if (!check(f) && !firstBad) firstBad = form.elements[f]; });
      if (firstBad) { firstBad.focus(); return; }

      btn.disabled = true; var label = btn.textContent; btn.textContent = 'Sending…';
      fetch(o.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o.body(form)) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); })
        .then(function (res) {
          if (res.ok) return thanks(res.data.message || 'Thanks! We’ll be in touch soon.');
          if (res.status === 422 && Array.isArray(res.data.detail)) {
            var focused = false;
            res.data.detail.forEach(function (d) {
              var f = d.loc && d.loc[1];
              if (form.elements[f] && o.rules[f]) { setError(f, String(d.msg).replace(/^Value error,\s*/, '')); if (!focused) { form.elements[f].focus(); focused = true; } }
            });
            return status('error', 'Please fix the highlighted fields.');
          }
          status('error', typeof res.data.detail === 'string' ? res.data.detail : 'Something went wrong. Please try again.');
        })
        .catch(function () { status('error', 'Could not reach the server. Check your connection and try again.'); })
        .then(function () { btn.disabled = false; btn.textContent = label; });
    });
  }

  bindForm($('#inquiry-form'), {
    endpoint: '/api/public/inquiries', thanksTitle: 'Message received!', again: 'Send another message',
    rules: {
      name: common.name, email: common.email, phone: common.phone, city: common.city,
      message: function (v) {
        v = v.trim();
        if (!v) return 'Please write a short message';
        if (v.length < 10) return 'Please add a little more detail (10+ characters)';
        if (v.length > 1000) return 'Message must be under 1000 characters';
        return '';
      }
    },
    body: function (f) {
      var b = {}; ['name', 'email', 'phone', 'city', 'message', 'website'].forEach(function (k) { b[k] = f.elements[k].value; }); return b;
    }
  });

  var startInput = mForm.elements.start_date;
  var today = new Date(), maxDate = new Date(); maxDate.setDate(maxDate.getDate() + 180);
  startInput.min = isoDate(today); startInput.max = isoDate(maxDate);
  var soon = new Date(); soon.setDate(soon.getDate() + 2); startInput.value = isoDate(soon);

  bindForm(mForm, {
    endpoint: '/api/public/memberships', thanksTitle: 'Application received!', again: 'Submit another application',
    onReset: function () { startInput.value = isoDate(soon); renderSummary(); },
    rules: {
      name: common.name, email: common.email, phone: common.phone, city: common.city,
      plan: function (v) { return v ? '' : 'Choose a membership plan'; },
      start_date: function (v) {
        if (!v) return 'Pick a start date';
        if (v < startInput.min || v > startInput.max) return 'Pick a date within the next 6 months';
        return '';
      },
      goal: function (v) { return v ? '' : 'Choose your main goal'; }
    },
    body: function (f) {
      var e = f.elements;
      return {
        name: e.name.value, email: e.email.value, phone: e.phone.value, city: e.city.value, plan: e.plan.value,
        branch_id: e.branch_id.value ? Number(e.branch_id.value) : null, start_date: e.start_date.value,
        goal: e.goal.value, notes: e.notes.value, website: e.website.value
      };
    }
  });

  $('#year').textContent = new Date().getFullYear();
})();
