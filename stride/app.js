/* Stride — app: routing, views, charts, maps. */
(function () {
  'use strict';

  var state = window.StrideData.load();
  var haversine = window.StrideData.haversine;

  var viewEl = document.getElementById('view');
  var tooltipEl = document.getElementById('tooltip');

  /* When a view is torn down we must drop resize listeners and Leaflet maps. */
  var cleanupFns = [];
  function onCleanup(fn) { cleanupFns.push(fn); }
  function runCleanup() {
    cleanupFns.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
    cleanupFns = [];
    hideTip();
  }

  /* ---------------- formatting ---------------- */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function fmtClock(sec) {
    sec = Math.round(sec);
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h > 0 ? h + ':' + pad2(m) + ':' + pad2(s) : m + ':' + pad2(s);
  }

  function fmtDist(m, type) {
    if (type === 'swim') return Math.round(m) + ' m';
    var km = m / 1000;
    return (km >= 100 ? km.toFixed(1) : km.toFixed(2)) + ' km';
  }

  function fmtKm1(m) { return (m / 1000).toFixed(1); }

  function fmtPaceSec(secPerKm) {
    if (!isFinite(secPerKm) || secPerKm <= 0) return '—';
    var m = Math.floor(secPerKm / 60), s = Math.round(secPerKm % 60);
    if (s === 60) { m += 1; s = 0; }
    return m + ':' + pad2(s);
  }

  /* Primary tempo metric per sport: pace for foot sports, speed for rides. */
  function tempoOf(act) {
    if (!act.distance || !act.movingTime) return { value: '—', label: 'Pace' };
    if (act.type === 'ride') {
      var kmh = (act.distance / 1000) / (act.movingTime / 3600);
      return { value: kmh.toFixed(1), unit: 'km/h', label: 'Avg Speed' };
    }
    if (act.type === 'swim') {
      var per100 = act.movingTime / (act.distance / 100);
      return { value: fmtPaceSec(per100), unit: '/100m', label: 'Avg Pace' };
    }
    var perKm = act.movingTime / (act.distance / 1000);
    return { value: fmtPaceSec(perKm), unit: '/km', label: 'Avg Pace' };
  }

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  var MONTHS_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function fmtTimeOfDay(d) {
    var h = d.getHours(), m = pad2(d.getMinutes());
    var ap = h >= 12 ? 'PM' : 'AM';
    var hh = h % 12; if (hh === 0) hh = 12;
    return hh + ':' + m + ' ' + ap;
  }

  function fmtWhen(iso) {
    var d = new Date(iso), now = new Date();
    var midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var dayDiff = Math.floor((midnight - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
    var t = fmtTimeOfDay(d);
    if (dayDiff === 0) return 'Today at ' + t;
    if (dayDiff === 1) return 'Yesterday at ' + t;
    var s = MONTHS[d.getMonth()] + ' ' + d.getDate();
    if (d.getFullYear() !== now.getFullYear()) s += ', ' + d.getFullYear();
    return s + ' at ' + t;
  }

  function fmtHoursMin(sec) {
    var h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    return h > 0 ? h + 'h ' + pad2(m) + 'm' : m + 'm';
  }

  /* ---------------- model helpers ---------------- */

  var TYPES = {
    run: { label: 'Run', verb: 'Run' },
    ride: { label: 'Ride', verb: 'Ride' },
    hike: { label: 'Hike', verb: 'Hike' },
    walk: { label: 'Walk', verb: 'Walk' },
    swim: { label: 'Swim', verb: 'Swim' }
  };

  function athlete(id) {
    for (var i = 0; i < state.athletes.length; i++) {
      if (state.athletes[i].id === id) return state.athletes[i];
    }
    return { id: id, name: 'Athlete', initials: '?', color: '#898781' };
  }

  function activityById(id) {
    for (var i = 0; i < state.activities.length; i++) {
      if (state.activities[i].id === id) return state.activities[i];
    }
    return null;
  }

  function sortedActivities() {
    return state.activities.slice().sort(function (a, b) {
      return a.date < b.date ? 1 : -1;
    });
  }

  function myActivities() {
    return sortedActivities().filter(function (a) { return a.athleteId === state.me; });
  }

  /* cumulative distance stream (meters) alongside points */
  function cumDist(points) {
    var out = [0];
    for (var i = 1; i < points.length; i++) {
      out.push(out[i - 1] + haversine(points[i - 1], points[i]));
    }
    return out;
  }

  function computeSplits(act) {
    if (!act.points || act.points.length < 2) return [];
    var pts = act.points, dists = cumDist(pts);
    var total = dists[dists.length - 1];
    var splits = [];
    var target = 1000, prevT = 0, prevD = 0, prevEle = pts[0][2];
    for (var i = 1; i < pts.length; i++) {
      while (dists[i] >= target) {
        // interpolate time and elevation at the km boundary
        var f = (target - dists[i - 1]) / (dists[i] - dists[i - 1] || 1);
        var tAt = pts[i - 1][3] + f * (pts[i][3] - pts[i - 1][3]);
        var eAt = pts[i - 1][2] + f * (pts[i][2] - pts[i - 1][2]);
        splits.push({
          km: splits.length + 1, dist: target - prevD,
          secs: tAt - prevT, dEle: Math.round(eAt - prevEle), partial: false
        });
        prevT = tAt; prevD = target; prevEle = eAt;
        target += 1000;
      }
    }
    var lastT = pts[pts.length - 1][3];
    if (total - prevD > 60) { // ignore tails under 60m
      splits.push({
        km: splits.length + 1, dist: total - prevD,
        secs: lastT - prevT, dEle: Math.round(pts[pts.length - 1][2] - prevEle), partial: true
      });
    }
    return splits;
  }

  function weekStart(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var day = (x.getDay() + 6) % 7; // Monday = 0
    x.setDate(x.getDate() - day);
    return x;
  }

  function weekBuckets(acts, nWeeks) {
    var thisWeek = weekStart(new Date());
    var buckets = [];
    for (var i = nWeeks - 1; i >= 0; i--) {
      var start = new Date(thisWeek); start.setDate(start.getDate() - i * 7);
      var end = new Date(start); end.setDate(end.getDate() + 7);
      buckets.push({
        start: start, end: end, meters: 0, secs: 0, ele: 0, count: 0,
        label: MONTHS_S[start.getMonth()] + ' ' + start.getDate(),
        isCurrent: i === 0
      });
    }
    acts.forEach(function (a) {
      var d = new Date(a.date);
      for (var j = 0; j < buckets.length; j++) {
        if (d >= buckets[j].start && d < buckets[j].end) {
          buckets[j].meters += a.distance;
          buckets[j].secs += a.movingTime;
          buckets[j].ele += a.elevGain;
          buckets[j].count += 1;
          break;
        }
      }
    });
    return buckets;
  }

  function rangeLabel(b) {
    var e = new Date(b.end); e.setDate(e.getDate() - 1);
    var s = MONTHS_S[b.start.getMonth()] + ' ' + b.start.getDate() + ' – ';
    s += (e.getMonth() === b.start.getMonth() ? '' : MONTHS_S[e.getMonth()] + ' ') + e.getDate();
    return s;
  }

  /* ---------------- icons ---------------- */

  function typeIcon(type, size) {
    size = size || 15;
    var body = {
      run: '<circle cx="13.6" cy="3.4" r="2" fill="currentColor" stroke="none"/>' +
        '<path d="M13 7.4 9 10l1.7 3.7L7.4 20.6M13 7.4l3.3 2.4 3.2-.8M10.7 13.7l3.5 1.8.6 5.1"/>',
      ride: '<circle cx="5" cy="16.7" r="3.2"/><circle cx="19" cy="16.7" r="3.2"/>' +
        '<path d="M5 16.7 9.6 9h5.6l3.8 7.7M9.6 9 8.2 5.4h3"/>',
      hike: '<path d="M2.5 20.5 9 8.5l4.4 7.6 3-4.6 5.1 9z" fill="currentColor" stroke="none"/>',
      walk: '<circle cx="12.5" cy="3.4" r="2" fill="currentColor" stroke="none"/>' +
        '<path d="M12.3 7.3v5.3l-2.7 7.9M12.3 12.6l2.9 7.3M12.3 8.5 9.4 11.1M12.3 8.5l3.1 2.1"/>',
      swim: '<circle cx="15.5" cy="6.5" r="2" fill="currentColor" stroke="none"/>' +
        '<path d="M3.5 11.5l6.5-3 3.6 3M2 15.7c1.9-1.7 3.7-1.7 5.6 0s3.7 1.7 5.6 0 3.7-1.7 5.6 0 2.1 1.1 3.2.6M2 20c1.9-1.7 3.7-1.7 5.6 0s3.7 1.7 5.6 0 3.7-1.7 5.6 0 2.1 1.1 3.2.6"/>'
    }[type] || '';
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true">' + body + '</svg>';
  }

  var ICONS = {
    kudos: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10.5v9.5H4a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1zM7 10.5l4.2-7.3c1.4 0 2.4 1.1 2.4 2.4L13 9.5h5.8c1.1 0 1.9 1 1.7 2l-1.3 6.7A2 2 0 0 1 17.2 20H7"/></svg>',
    kudosFill: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M7 10.5v9.5H4a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1zM7 10.5l4.2-7.3c1.4 0 2.4 1.1 2.4 2.4L13 9.5h5.8c1.1 0 1.9 1 1.7 2l-1.3 6.7A2 2 0 0 1 17.2 20H7"/></svg>',
    comment: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5h16v10.5H9.5L4 20.5z"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0zM7 5H4a3 3 0 0 0 3 4M17 5h3a3 3 0 0 1-3 4M12 14v3M8.5 20.5h7M12 17c-1.2 0-2 .8-2.4 1.7L9 20.5h6l-.6-1.8C14 17.8 13.2 17 12 17z"/></svg>',
    mountain: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M3 19 9.5 7l4 7 2.5-4 5 9z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 5 13.5h6L10.5 22 19 10h-6z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>',
    sunrise: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 18h16M7 14a5 5 0 0 1 10 0M12 3v3M4.5 8.5l2 2M19.5 8.5l-2 2"/></svg>',
    flame: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 3-4 5-4 10a4.5 4.5 0 0 0 9 0c0-2-1-3.5-2-5-.5 1.5-1.5 2-2.5 2C13.5 8 14 5 12 3z"/></svg>'
  };

  /* ---------------- tooltip (values via textContent — never innerHTML) ---------------- */

  function showTip(clientX, clientY, rows) {
    tooltipEl.textContent = '';
    rows.forEach(function (row) {
      var v = document.createElement('div');
      v.className = row.strong ? 'tip-value' : 'tip-label';
      v.textContent = row.text;
      tooltipEl.appendChild(v);
    });
    tooltipEl.hidden = false;
    var r = tooltipEl.getBoundingClientRect();
    var x = clientX + 14, y = clientY + 14;
    if (x + r.width > window.innerWidth - 8) x = clientX - r.width - 12;
    if (y + r.height > window.innerHeight - 8) y = clientY - r.height - 12;
    tooltipEl.style.left = x + 'px';
    tooltipEl.style.top = y + 'px';
  }

  function hideTip() { tooltipEl.hidden = true; }

  /* ---------------- SVG helpers ---------------- */

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function S(tag, attrs, parent) {
    var el = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }

  function niceStep(rough) {
    var pow = Math.pow(10, Math.floor(Math.log(rough) / Math.LN10));
    var frac = rough / pow;
    var mult = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
    return mult * pow;
  }

  /* project lat/lng points into a w×h box (equirectangular, aspect-preserving) */
  function projectPoints(points, w, h, padPx) {
    var minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    points.forEach(function (p) {
      if (p[0] < minLat) minLat = p[0];
      if (p[0] > maxLat) maxLat = p[0];
      if (p[1] < minLng) minLng = p[1];
      if (p[1] > maxLng) maxLng = p[1];
    });
    var midLat = (minLat + maxLat) / 2;
    var kx = Math.cos(midLat * Math.PI / 180);
    var spanX = (maxLng - minLng) * kx || 1e-6;
    var spanY = (maxLat - minLat) || 1e-6;
    var scale = Math.min((w - padPx * 2) / spanX, (h - padPx * 2) / spanY);
    var ox = (w - spanX * scale) / 2, oy = (h - spanY * scale) / 2;
    return points.map(function (p) {
      return [
        ox + (p[1] - minLng) * kx * scale,
        h - oy - (p[0] - minLat) * scale
      ];
    });
  }

  function routeThumbSVG(points, w, h) {
    var xy = projectPoints(points, w, h, 18);
    var d = '';
    var step = Math.max(1, Math.floor(xy.length / 260));
    for (var i = 0; i < xy.length; i += step) {
      d += (d ? 'L' : 'M') + xy[i][0].toFixed(1) + ' ' + xy[i][1].toFixed(1);
    }
    var last = xy[xy.length - 1];
    d += 'L' + last[0].toFixed(1) + ' ' + last[1].toFixed(1);
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Route map">' +
      '<path d="' + d + '" fill="none" stroke="#eb6834" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + xy[0][0] + '" cy="' + xy[0][1] + '" r="4.5" fill="#1b8f66" stroke="#fff" stroke-width="2"/>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="4.5" fill="#0b0b0b" stroke="#fff" stroke-width="2"/>' +
      '</svg>';
  }

  /* ---------------- weekly bar chart ---------------- */

  function renderWeeklyChart(container, buckets, opts) {
    container.textContent = '';
    var w = Math.max(320, container.clientWidth);
    var h = 230;
    var m = { top: 22, right: 10, bottom: 26, left: 38 };
    var iw = w - m.left - m.right, ih = h - m.top - m.bottom;

    var maxVal = 0;
    buckets.forEach(function (b) { maxVal = Math.max(maxVal, b.meters / 1000); });
    var step = niceStep((maxVal || 10) / 3.2);
    var yMax = Math.max(step, Math.ceil((maxVal || 1) / step) * step);

    var svg = S('svg', {
      width: w, height: h, viewBox: '0 0 ' + w + ' ' + h,
      role: 'img', 'aria-label': 'Weekly distance, last ' + buckets.length + ' weeks, in kilometres'
    }, container);

    // gridlines + y ticks (clean numbers)
    for (var v = 0; v <= yMax + 1e-9; v += step) {
      var y = m.top + ih - (v / yMax) * ih;
      if (v > 0) S('line', { x1: m.left, x2: w - m.right, y1: y, y2: y, 'class': 'grid' }, svg);
      var t = S('text', { x: m.left - 8, y: y + 4, 'text-anchor': 'end' }, svg);
      t.textContent = step < 1 ? v.toFixed(1) : String(Math.round(v));
    }
    S('line', { x1: m.left, x2: w - m.right, y1: m.top + ih, y2: m.top + ih, 'class': 'axis-base' }, svg);

    var band = iw / buckets.length;
    var barW = Math.min(24, Math.max(6, band - 8));
    var maxIdx = -1, maxSeen = -1;
    buckets.forEach(function (b, i) { if (b.meters > maxSeen) { maxSeen = b.meters; maxIdx = i; } });

    buckets.forEach(function (b, i) {
      var km = b.meters / 1000;
      var x = m.left + band * i + (band - barW) / 2;
      var bh = (km / yMax) * ih;
      var y = m.top + ih - bh;
      var r = Math.min(4, bh, barW / 2);

      var bar = null;
      if (bh > 0.5) {
        // rounded data-end at the top, square at the baseline
        var d = 'M' + x + ' ' + (m.top + ih) +
          'L' + x + ' ' + (y + r) +
          'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y +
          'L' + (x + barW - r) + ' ' + y +
          'Q' + (x + barW) + ' ' + y + ' ' + (x + barW) + ' ' + (y + r) +
          'L' + (x + barW) + ' ' + (m.top + ih) + 'Z';
        bar = S('path', { d: d, fill: '#eb6834' }, svg);
      }

      // x labels: every 3rd week + the current one
      if ((buckets.length - 1 - i) % 3 === 0 && !b.isCurrent && i < buckets.length - 2 || b.isCurrent) {
        var lbl = S('text', {
          x: x + barW / 2, y: m.top + ih + 17, 'text-anchor': 'middle'
        }, svg);
        lbl.textContent = b.isCurrent ? 'This wk' : b.label;
      }

      // selective direct label: the biggest week only
      if (i === maxIdx && b.meters > 0) {
        var dl = S('text', {
          x: x + barW / 2, y: y - 6, 'text-anchor': 'middle', 'class': 'direct-label'
        }, svg);
        dl.textContent = km.toFixed(1);
      }

      // hover/focus hit target: the whole band, not just the painted bar
      var hit = S('rect', {
        x: m.left + band * i, y: m.top, width: band, height: ih,
        fill: 'transparent', tabindex: '0', role: 'img',
        'aria-label': rangeLabel(b) + ': ' + km.toFixed(1) + ' km, ' + b.count +
          (b.count === 1 ? ' activity' : ' activities')
      }, svg);

      function over(ev) {
        if (bar) bar.setAttribute('fill', '#f0906a');
        var rect = hit.getBoundingClientRect();
        var cx = ev && ev.clientX != null ? ev.clientX : rect.left + rect.width / 2;
        var cy = ev && ev.clientY != null ? ev.clientY : rect.top + 30;
        showTip(cx, cy, [
          { text: km.toFixed(1) + ' km', strong: true },
          { text: rangeLabel(b) + ' · ' + b.count + (b.count === 1 ? ' activity' : ' activities') },
          { text: fmtHoursMin(b.secs) + ' · ' + Math.round(b.ele) + ' m elev' }
        ]);
      }
      function out() {
        if (bar) bar.setAttribute('fill', '#eb6834');
        hideTip();
      }
      hit.addEventListener('pointermove', over);
      hit.addEventListener('pointerleave', out);
      hit.addEventListener('focus', function () { over(null); });
      hit.addEventListener('blur', out);
    });
  }

  /* ---------------- elevation profile chart ---------------- */

  function renderElevationChart(container, act, onHoverPoint) {
    container.textContent = '';
    var pts = act.points;
    var dists = cumDist(pts);
    var total = dists[dists.length - 1];

    // downsample to ~150 samples
    var n = Math.min(150, pts.length);
    var samples = [];
    for (var i = 0; i < n; i++) {
      var idx = Math.round(i * (pts.length - 1) / (n - 1));
      samples.push({ d: dists[idx], ele: pts[idx][2], t: pts[idx][3], idx: idx });
    }

    var w = Math.max(300, container.clientWidth);
    var h = 190;
    var m = { top: 14, right: 10, bottom: 24, left: 40 };
    var iw = w - m.left - m.right, ih = h - m.top - m.bottom;

    var minE = Infinity, maxE = -Infinity;
    samples.forEach(function (s) {
      if (s.ele < minE) minE = s.ele;
      if (s.ele > maxE) maxE = s.ele;
    });
    var padE = Math.max(4, (maxE - minE) * 0.15);
    var e0 = Math.floor((minE - padE) / 5) * 5;
    var e1 = Math.ceil((maxE + padE) / 5) * 5;
    if (e1 - e0 < 10) e1 = e0 + 10;

    function X(d) { return m.left + (d / total) * iw; }
    function Y(e) { return m.top + ih - ((e - e0) / (e1 - e0)) * ih; }

    var svg = S('svg', {
      width: w, height: h, viewBox: '0 0 ' + w + ' ' + h, tabindex: '0', role: 'img',
      'aria-label': 'Elevation profile: from ' + Math.round(minE) + ' to ' + Math.round(maxE) +
        ' metres over ' + fmtDist(total, act.type) + '. Use arrow keys to explore.'
    }, container);

    // y grid: 3 lines with clean elevations
    var eStep = niceStep((e1 - e0) / 3);
    for (var ev = Math.ceil(e0 / eStep) * eStep; ev <= e1; ev += eStep) {
      var gy = Y(ev);
      S('line', { x1: m.left, x2: w - m.right, y1: gy, y2: gy, 'class': 'grid' }, svg);
      var yt = S('text', { x: m.left - 8, y: gy + 4, 'text-anchor': 'end' }, svg);
      yt.textContent = Math.round(ev) + '';
    }

    // x ticks in km
    var kmStep = niceStep(total / 1000 / 5);
    for (var kv = kmStep; kv * 1000 < total; kv += kmStep) {
      var tx = S('text', { x: X(kv * 1000), y: m.top + ih + 17, 'text-anchor': 'middle' }, svg);
      tx.textContent = (kmStep < 1 ? kv.toFixed(1) : Math.round(kv)) + ' km';
    }
    S('line', { x1: m.left, x2: w - m.right, y1: m.top + ih, y2: m.top + ih, 'class': 'axis-base' }, svg);

    // area (10% wash) + 2px line
    var lineD = '', areaD = '';
    samples.forEach(function (s, si) {
      var cmd = (si === 0 ? 'M' : 'L') + X(s.d).toFixed(1) + ' ' + Y(s.ele).toFixed(1);
      lineD += cmd; areaD += cmd;
    });
    areaD += 'L' + X(total).toFixed(1) + ' ' + (m.top + ih) + 'L' + m.left + ' ' + (m.top + ih) + 'Z';
    S('path', { d: areaD, fill: '#eb6834', 'fill-opacity': '0.1' }, svg);
    S('path', {
      d: lineD, fill: 'none', stroke: '#eb6834', 'stroke-width': '2',
      'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }, svg);

    // crosshair + marker dot (2px surface ring)
    var cross = S('line', { y1: m.top, y2: m.top + ih, 'class': 'grid', visibility: 'hidden' }, svg);
    cross.setAttribute('stroke', '#b7b5ad');
    var dot = S('circle', {
      r: 5, fill: '#eb6834', stroke: '#fff', 'stroke-width': '2', visibility: 'hidden'
    }, svg);

    var curIdx = -1;

    function paceAround(si) {
      // local tempo over a ±2-sample window
      var a = samples[Math.max(0, si - 2)], b = samples[Math.min(samples.length - 1, si + 2)];
      var dd = b.d - a.d, dt = b.t - a.t;
      if (dd < 20 || dt <= 0) return null;
      if (act.type === 'ride') return ((dd / dt) * 3.6).toFixed(1) + ' km/h';
      return fmtPaceSec(dt / (dd / 1000)) + ' /km';
    }

    function focusSample(si, clientX, clientY) {
      var s = samples[si];
      curIdx = si;
      var x = X(s.d), y = Y(s.ele);
      cross.setAttribute('x1', x); cross.setAttribute('x2', x);
      cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', x); dot.setAttribute('cy', y);
      dot.setAttribute('visibility', 'visible');
      var pace = paceAround(si);
      var rows = [
        { text: Math.round(s.ele) + ' m', strong: true },
        { text: 'at ' + (s.d / 1000).toFixed(2) + ' km' + (pace ? ' · ' + pace : '') }
      ];
      var box = svg.getBoundingClientRect();
      showTip(clientX != null ? clientX : box.left + x, clientY != null ? clientY : box.top + y, rows);
      if (onHoverPoint) onHoverPoint(pts[s.idx]);
    }

    function clear() {
      curIdx = -1;
      cross.setAttribute('visibility', 'hidden');
      dot.setAttribute('visibility', 'hidden');
      hideTip();
      if (onHoverPoint) onHoverPoint(null);
    }

    svg.addEventListener('pointermove', function (ev) {
      var box = svg.getBoundingClientRect();
      var px = (ev.clientX - box.left) * (w / box.width);
      var d = ((px - m.left) / iw) * total;
      d = Math.max(0, Math.min(total, d));
      // nearest sample by distance
      var lo = 0, hi = samples.length - 1;
      while (hi - lo > 1) {
        var mid = (lo + hi) >> 1;
        if (samples[mid].d < d) lo = mid; else hi = mid;
      }
      var si = (d - samples[lo].d < samples[hi].d - d) ? lo : hi;
      focusSample(si, ev.clientX, ev.clientY);
    });
    svg.addEventListener('pointerleave', clear);
    svg.addEventListener('focus', function () { focusSample(Math.floor(samples.length / 2)); });
    svg.addEventListener('blur', clear);
    svg.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        ev.preventDefault();
        var next = curIdx < 0 ? Math.floor(samples.length / 2)
          : Math.max(0, Math.min(samples.length - 1, curIdx + (ev.key === 'ArrowRight' ? 2 : -2)));
        focusSample(next);
      }
    });
  }

  /* ---------------- leaflet ---------------- */

  function makeMap(el, opts) {
    if (typeof L === 'undefined') return null;
    var map = L.map(el, Object.assign({ scrollWheelZoom: false, zoomControl: true }, opts || {}));
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    onCleanup(function () { map.remove(); });
    return map;
  }

  function drawRouteOnMap(map, points) {
    var latlngs = points.map(function (p) { return [p[0], p[1]]; });
    var line = L.polyline(latlngs, { color: '#eb6834', weight: 4, opacity: 0.92 }).addTo(map);
    L.circleMarker(latlngs[0], {
      radius: 6, color: '#fff', weight: 2, fillColor: '#1b8f66', fillOpacity: 1
    }).addTo(map).bindTooltip('Start');
    L.circleMarker(latlngs[latlngs.length - 1], {
      radius: 6, color: '#fff', weight: 2, fillColor: '#0b0b0b', fillOpacity: 1
    }).addTo(map).bindTooltip('Finish');
    map.fitBounds(line.getBounds(), { padding: [28, 28] });
    return line;
  }

  /* ---------------- shared partials ---------------- */

  function avatarHTML(a, cls) {
    return '<span class="avatar ' + (cls || '') + '" style="background:' + esc(a.color) + '" aria-hidden="true">' +
      esc(a.initials) + '</span>';
  }

  function statHTML(label, valueHTML) {
    return '<div class="stat"><div class="stat-label">' + label + '</div>' +
      '<div class="stat-value">' + valueHTML + '</div></div>';
  }

  function statsRowHTML(act) {
    var t = tempoOf(act);
    var html = statHTML('Distance', esc(fmtDist(act.distance, act.type)));
    html += statHTML(t.label, esc(t.value) + (t.unit ? ' <small>' + esc(t.unit) + '</small>' : ''));
    html += statHTML('Time', esc(fmtClock(act.movingTime)));
    if (act.elevGain > 0) html += statHTML('Elev Gain', esc(String(act.elevGain)) + ' <small>m</small>');
    return html;
  }

  /* ---------------- feed ---------------- */

  function activityCardHTML(act) {
    var a = athlete(act.athleteId);
    var mine = act.athleteId === state.me;
    var gave = act.kudos.indexOf(state.me) >= 0;
    var thumb = act.points && act.points.length > 1
      ? '<a class="route-thumb" href="#/activity/' + act.id + '" aria-label="Open activity map">' +
        routeThumbSVG(act.points, 560, 168) + '</a>'
      : '';
    return '<article class="card activity-card" data-id="' + act.id + '">' +
      '<div class="activity-head">' + avatarHTML(a) +
      '<div class="activity-who"><div class="activity-athlete">' + esc(a.name) + '</div>' +
      '<div class="activity-meta"><span class="type-chip">' + typeIcon(act.type) + ' ' +
      esc(TYPES[act.type] ? TYPES[act.type].label : act.type) + '</span> · ' + esc(fmtWhen(act.date)) + '</div></div></div>' +
      '<a class="activity-name-link" href="#/activity/' + act.id + '">' + esc(act.name) + '</a>' +
      '<div class="stats-row">' + statsRowHTML(act) + '</div>' +
      thumb +
      '<div class="card-actions">' +
      '<button type="button" class="kudos-btn' + (gave ? ' given' : '') + '" data-kudos="' + act.id + '"' +
      (mine ? ' disabled title="Your own activity"' : '') + ' aria-label="Give kudos">' +
      (gave ? ICONS.kudosFill : ICONS.kudos) + '<span>' + act.kudos.length + ' kudos</span></button>' +
      '<a class="comment-btn" href="#/activity/' + act.id + '">' + ICONS.comment +
      '<span>' + act.comments.length + (act.comments.length === 1 ? ' comment' : ' comments') + '</span></a>' +
      '</div></article>';
  }

  function renderFeed() {
    var acts = sortedActivities();
    var html = '<div class="col-narrow">';
    if (!acts.length) {
      html += '<div class="card empty-note">No activities yet — hit <strong>Record</strong> to log your first one.</div>';
    } else {
      html += acts.map(activityCardHTML).join('');
    }
    html += '</div>';
    viewEl.innerHTML = html;

    viewEl.querySelectorAll('[data-kudos]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var act = activityById(btn.getAttribute('data-kudos'));
        if (!act || act.athleteId === state.me) return;
        var i = act.kudos.indexOf(state.me);
        if (i >= 0) act.kudos.splice(i, 1); else act.kudos.push(state.me);
        window.StrideData.save(state);
        var gave = i < 0;
        btn.classList.toggle('given', gave);
        btn.innerHTML = (gave ? ICONS.kudosFill : ICONS.kudos) +
          '<span>' + act.kudos.length + ' kudos</span>';
      });
    });
  }

  /* ---------------- activity detail ---------------- */

  function renderActivity(id) {
    var act = activityById(id);
    if (!act) { location.hash = '#/feed'; return; }
    var a = athlete(act.athleteId);
    var mine = act.athleteId === state.me;
    var hasRoute = act.points && act.points.length > 1;
    var splits = computeSplits(act);

    var html = '<div class="col-wide">' +
      '<a class="back-link" href="#/feed">← Back to feed</a>' +
      '<div class="card">' +
      '<div class="detail-head">' +
      '<div class="activity-head" style="padding:0">' + avatarHTML(a) +
      '<div class="activity-who"><div class="activity-athlete">' + esc(a.name) + '</div>' +
      '<div class="activity-meta"><span class="type-chip">' + typeIcon(act.type) + ' ' +
      esc(TYPES[act.type] ? TYPES[act.type].label : act.type) + '</span> · ' + esc(fmtWhen(act.date)) + '</div></div>' +
      (mine ? '<button type="button" class="btn btn-ghost btn-danger" id="delete-act" style="margin-left:auto">Delete</button>' : '') +
      '</div>' +
      '<h1 class="detail-title">' + esc(act.name) + '</h1>' +
      '</div>' +
      (hasRoute ? '<div class="detail-map" id="detail-map"></div>' : '') +
      '<div class="detail-stats">' + statsRowHTML(act) +
      statHTML('Kudos', String(act.kudos.length)) +
      '</div></div>';

    html += '<div class="detail-grid">';
    if (splits.length) {
      html += '<div class="card panel"><h3>Splits<span class="sub">' +
        (act.type === 'ride' ? 'km · speed' : 'km · pace') + '</span></h3>' +
        '<table class="splits"><thead><tr><th>Km</th><th></th><th>' +
        (act.type === 'ride' ? 'Speed' : 'Pace') + '</th><th style="text-align:right">Elev</th></tr></thead><tbody>' +
        splitsRowsHTML(act, splits) + '</tbody></table></div>';
    }
    if (hasRoute) {
      html += '<div class="card panel"><h3>Elevation<span class="sub">' +
        act.elevGain + ' m gain</span></h3><div class="viz-root" id="ele-chart"></div></div>';
    }
    html += '<div class="card panel"' + (splits.length || hasRoute ? '' : ' style="grid-column:1/-1"') + '>' +
      '<h3>Comments<span class="sub">' + act.comments.length + '</span></h3>' +
      '<div class="comments-list" id="comments-list"></div>' +
      '<form class="comment-form" id="comment-form">' +
      '<input type="text" name="text" placeholder="Add a comment…" maxlength="280" autocomplete="off">' +
      '<button class="btn" type="submit">Post</button></form></div>';
    html += '</div></div>';

    viewEl.innerHTML = html;

    // comments (user text → textContent)
    var listEl = document.getElementById('comments-list');
    function renderComments() {
      listEl.textContent = '';
      if (!act.comments.length) {
        var none = document.createElement('div');
        none.className = 'activity-meta';
        none.textContent = 'No comments yet.';
        listEl.appendChild(none);
        return;
      }
      act.comments.forEach(function (c) {
        var ca = athlete(c.athleteId);
        var row = document.createElement('div');
        row.className = 'comment';
        row.innerHTML = avatarHTML(ca, 'sm') + '<div class="comment-body"><div class="who"></div><div class="text"></div></div>';
        row.querySelector('.who').textContent = ca.name;
        row.querySelector('.text').textContent = c.text;
        listEl.appendChild(row);
      });
    }
    renderComments();

    document.getElementById('comment-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var input = ev.target.querySelector('input');
      var text = input.value.trim();
      if (!text) return;
      act.comments.push({ athleteId: state.me, text: text });
      window.StrideData.save(state);
      input.value = '';
      renderComments();
    });

    var deleteBtn = document.getElementById('delete-act');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        if (!window.confirm('Delete “' + act.name + '”? This can’t be undone.')) return;
        state.activities = state.activities.filter(function (x) { return x.id !== act.id; });
        window.StrideData.save(state);
        location.hash = '#/feed';
      });
    }

    if (hasRoute) {
      var mapEl = document.getElementById('detail-map');
      var map = makeMap(mapEl);
      var hoverMarker = null;
      if (map) {
        drawRouteOnMap(map, act.points);
      } else {
        mapEl.innerHTML = '<div class="fallback-route">' + routeThumbSVG(act.points, 900, 400) + '</div>';
      }
      var chartEl = document.getElementById('ele-chart');
      var drawChart = function () {
        renderElevationChart(chartEl, act, function (pt) {
          if (!map) return;
          if (!pt) {
            if (hoverMarker) { map.removeLayer(hoverMarker); hoverMarker = null; }
            return;
          }
          if (!hoverMarker) {
            hoverMarker = L.circleMarker([pt[0], pt[1]], {
              radius: 7, color: '#fff', weight: 2, fillColor: '#eb6834', fillOpacity: 1
            }).addTo(map);
          } else {
            hoverMarker.setLatLng([pt[0], pt[1]]);
          }
        });
      };
      drawChart();
      var onResize = debounce(drawChart, 150);
      window.addEventListener('resize', onResize);
      onCleanup(function () { window.removeEventListener('resize', onResize); });
    }
  }

  function splitsRowsHTML(act, splits) {
    // bar length ∝ speed, so the fastest split is the longest bar
    var maxSpeed = 0;
    splits.forEach(function (s) { maxSpeed = Math.max(maxSpeed, s.dist / s.secs); });
    return splits.map(function (s) {
      var speed = s.dist / s.secs;
      var width = Math.max(4, Math.round((speed / maxSpeed) * 100));
      var tempoStr = act.type === 'ride'
        ? (speed * 3.6).toFixed(1)
        : fmtPaceSec(s.secs / (s.dist / 1000));
      var kmLabel = s.partial ? (s.dist / 1000).toFixed(2) : String(s.km);
      return '<tr><td class="num">' + kmLabel + '</td>' +
        '<td class="bar-cell"><div class="split-bar' + (s.partial ? ' partial' : '') +
        '" style="width:' + width + '%"></div></td>' +
        '<td class="pace-cell">' + tempoStr + '</td>' +
        '<td class="ele-cell">' + (s.dEle > 0 ? '+' : '') + s.dEle + ' m</td></tr>';
    }).join('');
  }

  /* ---------------- progress ---------------- */

  var progressFilter = 'all';

  function filterActs(acts, filter) {
    if (filter === 'all') return acts;
    if (filter === 'other') {
      return acts.filter(function (a) { return a.type !== 'run' && a.type !== 'ride'; });
    }
    return acts.filter(function (a) { return a.type === filter; });
  }

  function renderProgress() {
    var html = '<div class="col-wide"><h1 class="page-title">Your progress</h1>' +
      '<div class="filter-row" role="group" aria-label="Filter by sport">' +
      [['all', 'All sports'], ['run', 'Runs'], ['ride', 'Rides'], ['other', 'Other']].map(function (f) {
        return '<button type="button" class="chip' + (progressFilter === f[0] ? ' selected' : '') +
          '" data-filter="' + f[0] + '">' + f[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="tiles" id="tiles"></div>' +
      '<div class="card panel"><h3>Weekly distance<span class="sub">last 12 weeks · km</span></h3>' +
      '<div class="viz-root" id="weekly-chart"></div>' +
      '<details class="chart-table-toggle"><summary>View as table</summary>' +
      '<div id="weekly-table"></div></details></div>' +
      '<div class="section-label">Personal records</div>' +
      '<div class="card panel"><div class="pr-list" id="pr-list"></div></div>' +
      '</div>';
    viewEl.innerHTML = html;

    function update() {
      var acts = filterActs(myActivities(), progressFilter);
      var buckets = weekBuckets(acts, 12);
      var cur = buckets[buckets.length - 1], prev = buckets[buckets.length - 2];

      // stat tiles: this week vs last week
      var tiles = [
        {
          label: 'Distance this week',
          value: fmtKm1(cur.meters), unit: 'km',
          delta: cur.meters - prev.meters,
          fmt: function (v) { return (v >= 0 ? '+' : '−') + fmtKm1(Math.abs(v)) + ' km'; }
        },
        {
          label: 'Time this week',
          value: fmtHoursMin(cur.secs), unit: '',
          delta: cur.secs - prev.secs,
          fmt: function (v) { return (v >= 0 ? '+' : '−') + fmtHoursMin(Math.abs(v)); }
        },
        {
          label: 'Elevation this week',
          value: String(Math.round(cur.ele)), unit: 'm',
          delta: cur.ele - prev.ele,
          fmt: function (v) { return (v >= 0 ? '+' : '−') + Math.round(Math.abs(v)) + ' m'; }
        },
        {
          label: 'Activities this week',
          value: String(cur.count), unit: '',
          delta: cur.count - prev.count,
          fmt: function (v) { return (v >= 0 ? '+' : '−') + Math.abs(v); }
        }
      ];
      document.getElementById('tiles').innerHTML = tiles.map(function (t) {
        var dir = t.delta >= 0 ? 'up' : 'down';
        return '<div class="card tile"><div class="tile-label">' + t.label + '</div>' +
          '<div class="tile-value">' + t.value + (t.unit ? ' <small>' + t.unit + '</small>' : '') + '</div>' +
          '<div class="tile-delta ' + dir + '">' + t.fmt(t.delta) + ' vs last week</div></div>';
      }).join('');

      var chartEl = document.getElementById('weekly-chart');
      renderWeeklyChart(chartEl, buckets);

      // accessible table view of the same data
      document.getElementById('weekly-table').innerHTML =
        '<table><thead><tr><th>Week</th><th>Distance</th><th>Time</th><th>Elev</th><th>Activities</th></tr></thead><tbody>' +
        buckets.slice().reverse().map(function (b) {
          return '<tr><td>' + rangeLabel(b) + '</td><td>' + fmtKm1(b.meters) + ' km</td><td>' +
            fmtHoursMin(b.secs) + '</td><td>' + Math.round(b.ele) + ' m</td><td>' + b.count + '</td></tr>';
        }).join('') + '</tbody></table>';

      renderPRs(acts);
    }

    function renderPRs(acts) {
      var withDist = acts.filter(function (a) { return a.distance > 0; });
      var prs = [];
      function best(label, icon, pick, fmt) {
        var top = null;
        withDist.forEach(function (a) {
          if (!top || pick(a) > pick(top)) top = a;
        });
        if (top && pick(top) > 0) prs.push({ label: label, icon: icon, act: top, value: fmt(top) });
      }
      best('Longest distance', ICONS.trophy,
        function (a) { return a.distance; },
        function (a) { return fmtDist(a.distance, a.type); });
      best('Biggest climb', ICONS.mountain,
        function (a) { return a.elevGain; },
        function (a) { return a.elevGain + ' m'; });
      best('Fastest average', ICONS.bolt,
        function (a) { return a.movingTime ? a.distance / a.movingTime : 0; },
        function (a) {
          var t = tempoOf(a);
          return t.value + (t.unit ? ' ' + t.unit : '');
        });
      best('Longest time out', ICONS.clock,
        function (a) { return a.movingTime; },
        function (a) { return fmtClock(a.movingTime); });

      var el = document.getElementById('pr-list');
      if (!prs.length) {
        el.innerHTML = '<div class="empty-note">No activities in this filter yet.</div>';
        return;
      }
      el.innerHTML = prs.map(function (p) {
        return '<a class="pr-row" href="#/activity/' + p.act.id + '">' +
          '<span class="pr-ico">' + p.icon + '</span>' +
          '<span class="pr-what"><span class="pr-name">' + p.label + ' — ' + esc(p.act.name) + '</span><br>' +
          '<span class="pr-when">' + esc(fmtWhen(p.act.date)) + '</span></span>' +
          '<span class="pr-value" style="color:var(--ink)">' + esc(p.value) + '</span></a>';
      }).join('');
    }

    viewEl.querySelectorAll('[data-filter]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        progressFilter = chip.getAttribute('data-filter');
        viewEl.querySelectorAll('[data-filter]').forEach(function (c) {
          c.classList.toggle('selected', c === chip);
        });
        update();
      });
    });

    update();
    var onResize = debounce(update, 150);
    window.addEventListener('resize', onResize);
    onCleanup(function () { window.removeEventListener('resize', onResize); });
  }

  /* ---------------- record ---------------- */

  function toLocalInputValue(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function defaultName(type, d) {
    var h = d.getHours();
    var part = h < 11 ? 'Morning' : h < 14 ? 'Lunch' : h < 17 ? 'Afternoon' : 'Evening';
    return part + ' ' + (TYPES[type] ? TYPES[type].verb : 'Activity');
  }

  function renderRecord() {
    var recType = 'run';
    var mode = 'manual';
    var drawnPoints = []; // [lat,lng]
    var drawnDist = 0;

    var typeButtons = Object.keys(TYPES).map(function (t) {
      return '<button type="button" data-type="' + t + '"' + (t === recType ? ' class="selected"' : '') + '>' +
        typeIcon(t) + ' ' + TYPES[t].label + '</button>';
    }).join('');

    viewEl.innerHTML = '<div class="col-narrow"><h1 class="page-title">Record an activity</h1>' +
      '<div class="card panel">' +
      '<div class="mode-switch" role="group" aria-label="Entry mode">' +
      '<button type="button" class="chip selected" data-mode="manual">Manual entry</button>' +
      '<button type="button" class="chip" data-mode="draw">Draw route</button>' +
      '</div>' +
      '<form id="record-form">' +
      '<div class="field"><label>Sport</label><div class="type-seg" id="type-seg">' + typeButtons + '</div></div>' +
      '<div class="field"><label for="rec-name">Title</label>' +
      '<input id="rec-name" type="text" maxlength="80" placeholder="' + esc(defaultName(recType, new Date())) + '"></div>' +
      '<div class="field"><label for="rec-date">Date &amp; time</label>' +
      '<input id="rec-date" type="datetime-local" value="' + toLocalInputValue(new Date()) + '"></div>' +
      '<div id="draw-wrap" hidden>' +
      '<div class="draw-map" id="draw-map"></div>' +
      '<div class="draw-toolbar">' +
      '<button type="button" class="btn" id="draw-undo">Undo point</button>' +
      '<button type="button" class="btn" id="draw-clear">Clear</button>' +
      '<span class="draw-dist" id="draw-dist">0.00 km</span></div>' +
      '<p class="hint">Click the map to drop route points — distance is measured along your line.</p>' +
      '</div>' +
      '<div class="field-row" id="dist-row"><div class="field"><label for="rec-dist">Distance (km)</label>' +
      '<input id="rec-dist" type="number" min="0" step="0.01" placeholder="5.00"></div>' +
      '<div class="field"><label for="rec-elev">Elev gain (m, optional)</label>' +
      '<input id="rec-elev" type="number" min="0" step="1" placeholder="0"></div></div>' +
      '<div class="field"><label>Duration</label><div class="field-row">' +
      '<div class="field"><input id="rec-h" type="number" min="0" max="99" placeholder="hh" aria-label="Hours"></div>' +
      '<div class="field"><input id="rec-m" type="number" min="0" max="59" placeholder="mm" aria-label="Minutes"></div>' +
      '<div class="field"><input id="rec-s" type="number" min="0" max="59" placeholder="ss" aria-label="Seconds"></div>' +
      '</div></div>' +
      '<div class="form-error" id="rec-error" hidden></div>' +
      '<button class="btn btn-accent" type="submit" style="width:100%;justify-content:center;padding:11px">Save activity</button>' +
      '</form></div></div>';

    var nameInput = document.getElementById('rec-name');
    var distInput = document.getElementById('rec-dist');
    var errEl = document.getElementById('rec-error');
    var drawMap = null, drawLine = null, drawMarkers = [];

    function setType(t) {
      recType = t;
      viewEl.querySelectorAll('#type-seg button').forEach(function (b) {
        b.classList.toggle('selected', b.getAttribute('data-type') === t);
      });
      nameInput.placeholder = defaultName(t, new Date());
    }

    viewEl.querySelectorAll('#type-seg button').forEach(function (b) {
      b.addEventListener('click', function () { setType(b.getAttribute('data-type')); });
    });

    function refreshDrawUI() {
      document.getElementById('draw-dist').textContent = (drawnDist / 1000).toFixed(2) + ' km';
      if (mode === 'draw') {
        distInput.value = (drawnDist / 1000).toFixed(2);
        distInput.disabled = true;
      } else {
        distInput.disabled = false;
      }
    }

    function recalcDrawn() {
      drawnDist = 0;
      for (var i = 1; i < drawnPoints.length; i++) {
        drawnDist += haversine(drawnPoints[i - 1], drawnPoints[i]);
      }
      if (drawMap) {
        if (drawLine) { drawMap.removeLayer(drawLine); drawLine = null; }
        if (drawnPoints.length > 1) {
          drawLine = L.polyline(drawnPoints, { color: '#eb6834', weight: 4 }).addTo(drawMap);
        }
      }
      refreshDrawUI();
    }

    function setMode(m) {
      mode = m;
      viewEl.querySelectorAll('[data-mode]').forEach(function (c) {
        c.classList.toggle('selected', c.getAttribute('data-mode') === m);
      });
      document.getElementById('draw-wrap').hidden = m !== 'draw';
      refreshDrawUI();
      if (m === 'draw' && !drawMap) {
        drawMap = makeMap(document.getElementById('draw-map'), { scrollWheelZoom: true });
        if (drawMap) {
          drawMap.setView([37.7749, -122.4394], 13);
          drawMap.on('click', function (ev) {
            drawnPoints.push([ev.latlng.lat, ev.latlng.lng]);
            var mk = L.circleMarker(ev.latlng, {
              radius: 4, color: '#fff', weight: 1.5, fillColor: '#cf4514', fillOpacity: 1
            }).addTo(drawMap);
            drawMarkers.push(mk);
            recalcDrawn();
          });
        } else {
          document.getElementById('draw-map').innerHTML =
            '<div class="empty-note">Map unavailable (offline) — use manual entry.</div>';
        }
      }
      if (m === 'draw' && drawMap) {
        setTimeout(function () { drawMap.invalidateSize(); }, 0);
      }
    }

    viewEl.querySelectorAll('[data-mode]').forEach(function (c) {
      c.addEventListener('click', function () { setMode(c.getAttribute('data-mode')); });
    });

    document.getElementById('draw-undo').addEventListener('click', function () {
      drawnPoints.pop();
      var mk = drawMarkers.pop();
      if (mk && drawMap) drawMap.removeLayer(mk);
      recalcDrawn();
    });

    document.getElementById('draw-clear').addEventListener('click', function () {
      drawnPoints = [];
      if (drawMap) drawMarkers.forEach(function (mk) { drawMap.removeLayer(mk); });
      drawMarkers = [];
      recalcDrawn();
    });

    document.getElementById('record-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var h = parseInt(document.getElementById('rec-h').value, 10) || 0;
      var m = parseInt(document.getElementById('rec-m').value, 10) || 0;
      var s = parseInt(document.getElementById('rec-s').value, 10) || 0;
      var secs = h * 3600 + m * 60 + s;
      var km = mode === 'draw' ? drawnDist / 1000 : parseFloat(distInput.value) || 0;
      var elev = parseInt(document.getElementById('rec-elev').value, 10) || 0;
      var when = new Date(document.getElementById('rec-date').value || Date.now());

      function fail(msg) { errEl.textContent = msg; errEl.hidden = false; }
      errEl.hidden = true;
      if (km <= 0) return fail(mode === 'draw'
        ? 'Draw at least two points on the map to measure a distance.'
        : 'Enter a distance greater than zero.');
      if (secs <= 0) return fail('Enter a duration.');
      if (isNaN(when.getTime())) return fail('Enter a valid date.');

      var points = null;
      if (mode === 'draw' && drawnPoints.length > 1) {
        var dists = [0];
        for (var i = 1; i < drawnPoints.length; i++) {
          dists.push(dists[i - 1] + haversine(drawnPoints[i - 1], drawnPoints[i]));
        }
        var total = dists[dists.length - 1];
        points = drawnPoints.map(function (p, pi) {
          return [+p[0].toFixed(5), +p[1].toFixed(5), 0, Math.round(secs * (dists[pi] / total))];
        });
      }

      var name = nameInput.value.trim() || defaultName(recType, when);
      var act = {
        id: 'a' + Date.now().toString(36),
        athleteId: state.me,
        type: recType,
        name: name,
        date: when.toISOString(),
        points: points,
        distance: Math.round(km * 1000),
        movingTime: secs,
        elevGain: elev,
        kudos: [],
        comments: []
      };
      state.activities.unshift(act);
      window.StrideData.save(state);
      location.hash = '#/activity/' + act.id;
    });
  }

  /* ---------------- profile ---------------- */

  function renderProfile() {
    var me = athlete(state.me);
    var mine = myActivities();
    var totDist = 0, totTime = 0, totEle = 0, kudosGot = 0;
    mine.forEach(function (a) {
      totDist += a.distance; totTime += a.movingTime; totEle += a.elevGain;
      kudosGot += a.kudos.length;
    });

    // achievements, derived from the data
    var weeksActive = {};
    mine.forEach(function (a) { weeksActive[weekStart(new Date(a.date)).getTime()] = true; });
    var weekKeys = Object.keys(weeksActive).map(Number).sort(function (x, y) { return x - y; });
    var bestStreak = 0, cur = 0;
    for (var i = 0; i < weekKeys.length; i++) {
      cur = (i > 0 && weekKeys[i] - weekKeys[i - 1] === 7 * 86400000) ? cur + 1 : 1;
      bestStreak = Math.max(bestStreak, cur);
    }
    var badges = [
      {
        name: '10K Finisher', desc: 'Run 10 km in one go', icon: ICONS.trophy,
        got: mine.some(function (a) { return a.type === 'run' && a.distance >= 9900; })
      },
      {
        name: 'Summit Seeker', desc: '250 m of climbing in one activity', icon: ICONS.mountain,
        got: mine.some(function (a) { return a.elevGain >= 250; })
      },
      {
        name: 'Early Bird', desc: 'Start before 7:00 AM', icon: ICONS.sunrise,
        got: mine.some(function (a) { return new Date(a.date).getHours() < 7; })
      },
      {
        name: 'Streak Keeper', desc: 'Active 4 weeks in a row', icon: ICONS.flame,
        got: bestStreak >= 4
      },
      {
        name: 'Century Club', desc: '100 km lifetime distance', icon: ICONS.bolt,
        got: totDist >= 100000
      },
      {
        name: 'Kudos Magnet', desc: 'Collect 15 kudos', icon: ICONS.kudosFill,
        got: kudosGot >= 15
      }
    ];

    viewEl.innerHTML = '<div class="col-wide">' +
      '<div class="card"><div class="profile-head">' + avatarHTML(me, 'lg') +
      '<div><div class="profile-name">' + esc(me.name) + '</div>' +
      '<div class="profile-loc">' + esc(me.location || '') + '</div>' +
      '<div class="profile-bio">' + esc(me.bio || '') + '</div></div></div>' +
      '<div class="totals-grid">' +
      statHTML('Activities', String(mine.length)) +
      statHTML('Distance', esc(fmtKm1(totDist)) + ' <small>km</small>') +
      statHTML('Time', esc(fmtHoursMin(totTime))) +
      statHTML('Elev Gain', esc(String(Math.round(totEle))) + ' <small>m</small>') +
      statHTML('Kudos received', String(kudosGot)) +
      '</div></div>' +
      '<div class="section-label">Achievements</div>' +
      '<div class="badges">' + badges.map(function (b) {
        return '<div class="card badge' + (b.got ? '' : ' locked') + '">' +
          '<span class="badge-ico">' + b.icon + '</span>' +
          '<span><span class="badge-name">' + b.name + '</span><br>' +
          '<span class="badge-desc">' + b.desc + (b.got ? '' : ' — locked') + '</span></span></div>';
      }).join('') + '</div>' +
      '<div class="danger-zone"><button type="button" class="btn btn-ghost btn-danger" id="reset-demo">Reset demo data</button></div>' +
      '</div>';

    document.getElementById('reset-demo').addEventListener('click', function () {
      if (!window.confirm('Reset Stride to the original demo data? Your recorded activities will be lost.')) return;
      state = window.StrideData.reset();
      location.hash = '#/feed';
      route();
    });
  }

  /* ---------------- router ---------------- */

  function debounce(fn, ms) {
    var t = null;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  function setActiveTab(tab) {
    document.querySelectorAll('.tabs a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-tab') === tab);
    });
  }

  function route() {
    runCleanup();
    var hash = location.hash || '#/feed';
    var parts = hash.replace(/^#\//, '').split('/');
    window.scrollTo(0, 0);
    if (parts[0] === 'activity' && parts[1]) {
      setActiveTab('feed');
      renderActivity(parts[1]);
    } else if (parts[0] === 'progress') {
      setActiveTab('progress');
      renderProgress();
    } else if (parts[0] === 'profile') {
      setActiveTab('profile');
      renderProfile();
    } else if (parts[0] === 'record') {
      setActiveTab('');
      renderRecord();
    } else {
      setActiveTab('feed');
      renderFeed();
    }
    viewEl.focus({ preventScroll: true });
  }

  window.addEventListener('hashchange', route);
  route();
})();
