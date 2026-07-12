/* Stride — data layer: seeded demo data, route synthesis, localStorage store. */
(function () {
  'use strict';

  var STORAGE_KEY = 'stride:v1';

  /* ---------------- seeded RNG (deterministic demo data) ---------------- */

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- geometry helpers ---------------- */

  var R_EARTH = 6371000;

  function haversine(a, b) {
    var dLat = (b[0] - a[0]) * Math.PI / 180;
    var dLng = (b[1] - a[1]) * Math.PI / 180;
    var la1 = a[0] * Math.PI / 180, la2 = b[0] * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R_EARTH * Math.asin(Math.sqrt(h));
  }

  /* Chaikin corner-cutting: rounds hard corners so routes read as paths, not polygons. */
  function chaikin(pts, iterations) {
    var out = pts;
    for (var it = 0; it < iterations; it++) {
      var next = [out[0]];
      for (var i = 0; i < out.length - 1; i++) {
        var a = out[i], b = out[i + 1];
        next.push([
          a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25, a[2] * 0.75 + b[2] * 0.25
        ]);
        next.push([
          a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75, a[2] * 0.25 + b[2] * 0.75
        ]);
      }
      next.push(out[out.length - 1]);
      out = next;
    }
    return out;
  }

  /*
   * Densify handcrafted waypoints [lat,lng,ele] into a GPS-looking stream
   * with points every ~30m, gentle jitter, and smooth elevation noise.
   */
  function buildRoute(waypoints, seed) {
    var rnd = mulberry32(seed);
    var phase1 = rnd() * Math.PI * 2, phase2 = rnd() * Math.PI * 2;
    var smooth = chaikin(waypoints, 2);
    var pts = [];
    var dist = 0;
    for (var i = 0; i < smooth.length - 1; i++) {
      var a = smooth[i], b = smooth[i + 1];
      var segLen = haversine(a, b);
      var n = Math.max(1, Math.round(segLen / 30));
      for (var j = 0; j < n; j++) {
        var t = j / n;
        var lat = a[0] + (b[0] - a[0]) * t;
        var lng = a[1] + (b[1] - a[1]) * t;
        var ele = a[2] + (b[2] - a[2]) * t;
        if (pts.length) dist += haversine(pts[pts.length - 1], [lat, lng]);
        // gentle GPS wobble (~±2.5m) + smooth elevation noise (~±2m)
        var wob = 0.000022;
        lat += Math.sin(dist / 61 + phase1) * wob * (rnd() * 0.5 + 0.5);
        lng += Math.cos(dist / 47 + phase2) * wob * (rnd() * 0.5 + 0.5);
        ele += 1.4 * Math.sin(dist / 230 + phase1) + 0.9 * Math.sin(dist / 97 + phase2);
        pts.push([+lat.toFixed(5), +lng.toFixed(5), +ele.toFixed(1)]);
      }
    }
    var last = smooth[smooth.length - 1];
    pts.push([+last[0].toFixed(5), +last[1].toFixed(5), +last[2].toFixed(1)]);
    return pts;
  }

  function reversed(waypoints) {
    return waypoints.slice().reverse();
  }

  function outAndBack(waypoints) {
    return waypoints.concat(reversed(waypoints).slice(1));
  }

  /*
   * Given a point stream and a base speed (m/s), assign a cumulative time to
   * every point. Speed dips on climbs, rises on descents, plus smooth noise —
   * so splits and pace charts look organic.
   */
  function assignTimes(pts, baseSpeed, seed) {
    var rnd = mulberry32(seed);
    var phase = rnd() * Math.PI * 2;
    var t = 0, d = 0;
    pts[0][3] = 0;
    for (var i = 1; i < pts.length; i++) {
      var seg = haversine(pts[i - 1], pts[i]);
      var dEle = pts[i][2] - pts[i - 1][2];
      var slope = seg > 1 ? dEle / seg : 0;
      d += seg;
      var factor = 1 - slope * 4.2 + 0.05 * Math.sin(d / 400 + phase);
      factor = Math.max(0.45, Math.min(1.4, factor));
      var v = baseSpeed * factor;
      t += seg / v;
      pts[i][3] = Math.round(t);
    }
    return pts;
  }

  function totalDistance(pts) {
    var d = 0;
    for (var i = 1; i < pts.length; i++) d += haversine(pts[i - 1], pts[i]);
    return d;
  }

  function elevGain(pts) {
    var g = 0;
    for (var i = 1; i < pts.length; i++) {
      var dEle = pts[i][2] - pts[i - 1][2];
      if (dEle > 0.25) g += dEle;
    }
    return Math.round(g);
  }

  /* ---------------- handcrafted San Francisco routes ---------------- */

  var ROUTES = {
    ggpark: [ // Golden Gate Park perimeter loop
      [37.7714, -122.4547, 120], [37.7735, -122.4610, 105], [37.7719, -122.4665, 95],
      [37.7735, -122.4762, 70], [37.7712, -122.4855, 55], [37.7727, -122.4938, 35],
      [37.7715, -122.5030, 20], [37.7666, -122.5090, 10], [37.7645, -122.5008, 20],
      [37.7655, -122.4925, 35], [37.7645, -122.4823, 55], [37.7663, -122.4732, 75],
      [37.7652, -122.4645, 90], [37.7683, -122.4570, 105], [37.7714, -122.4547, 120]
    ],
    embarcadero: outAndBack([ // Ferry Building → Aquatic Park waterfront
      [37.7929, -122.3925, 5], [37.7955, -122.3937, 4], [37.8005, -122.3980, 4],
      [37.8045, -122.4030, 5], [37.8078, -122.4090, 5], [37.8080, -122.4145, 5],
      [37.8062, -122.4190, 6], [37.8071, -122.4230, 8]
    ]),
    sausalito: outAndBack([ // Marina Green → Golden Gate Bridge → Sausalito
      [37.8005, -122.4433, 5], [37.8039, -122.4640, 5], [37.8065, -122.4735, 15],
      [37.8105, -122.4770, 60], [37.8199, -122.4786, 72], [37.8270, -122.4790, 70],
      [37.8324, -122.4813, 60], [37.8395, -122.4838, 22], [37.8480, -122.4880, 10],
      [37.8555, -122.4855, 5], [37.8590, -122.4852, 3]
    ]),
    twinpeaks: [ // Castro → Twin Peaks summit loop
      [37.7626, -122.4358, 60], [37.7612, -122.4400, 85], [37.7597, -122.4432, 120],
      [37.7570, -122.4442, 160], [37.7554, -122.4460, 205], [37.7544, -122.4477, 268],
      [37.7528, -122.4472, 248], [37.7518, -122.4440, 190], [37.7538, -122.4400, 140],
      [37.7570, -122.4370, 92], [37.7605, -122.4352, 66], [37.7626, -122.4358, 60]
    ],
    landsend: outAndBack([ // Sutro Baths → Eagle Point coastal trail
      [37.7804, -122.5115, 60], [37.7830, -122.5105, 82], [37.7853, -122.5062, 96],
      [37.7870, -122.5010, 84], [37.7884, -122.4952, 70], [37.7889, -122.4900, 76]
    ]),
    oceanbeach: outAndBack([ // Ocean Beach / Great Highway straightaway
      [37.7695, -122.5103, 8], [37.7600, -122.5088, 6], [37.7500, -122.5075, 5],
      [37.7400, -122.5062, 5], [37.7352, -122.5058, 6]
    ]),
    presidio: [ // Presidio hills loop
      [37.7980, -122.4560, 20], [37.7998, -122.4620, 26], [37.8010, -122.4680, 32],
      [37.7985, -122.4730, 56], [37.7950, -122.4760, 80], [37.7920, -122.4720, 96],
      [37.7900, -122.4660, 86], [37.7920, -122.4600, 60], [37.7950, -122.4565, 36],
      [37.7980, -122.4560, 20]
    ]
  };

  /* ---------------- seed dataset ---------------- */

  var ATHLETES = [
    { id: 'u1', name: 'Alex Rivera', initials: 'AR', color: '#cf4514', location: 'San Francisco, CA', bio: 'Chasing sunrise miles around the city.' },
    { id: 'u2', name: 'Maya Chen', initials: 'MC', color: '#2a78d6', location: 'Oakland, CA', bio: 'Trail runner, fog enthusiast.' },
    { id: 'u3', name: 'Sam Kowalski', initials: 'SK', color: '#1b8f66', location: 'Sausalito, CA', bio: 'Weekend century rider.' }
  ];

  // paces as m/s: run ~5:30/km ≈ 3.03, ride 27 km/h = 7.5, hike ≈ 1.5, walk ≈ 1.35
  var SEED_SPECS = [
    // [athleteId, type, routeKey|null, name, daysAgo, 'HH:MM', baseSpeed, seed, kudosFrom, comments]
    ['u1', 'run', 'ggpark', 'Golden Gate Park long loop', 54, '07:15', 3.00, 11, ['u2', 'u3'], []],
    ['u1', 'ride', 'sausalito', 'Bridge & Sausalito spin', 49, '08:05', 7.4, 12, ['u3'], []],
    ['u2', 'run', 'landsend', 'Lands End coastal cruise', 46, '17:30', 2.85, 13, ['u1'], []],
    ['u1', 'run', 'embarcadero', 'Embarcadero tempo', 43, '06:40', 3.25, 14, ['u2'], [
      ['u2', 'That pace after a rest day — flying!']
    ]],
    ['u1', 'run', 'twinpeaks', 'Twin Peaks hill repeats', 38, '07:00', 2.70, 15, ['u2', 'u3'], []],
    ['u3', 'ride', 'sausalito', 'Coffee ride to Sausalito', 35, '09:20', 7.8, 16, ['u1', 'u2'], []],
    ['u1', 'run', 'oceanbeach', 'Ocean Beach shakeout', 32, '18:10', 3.05, 17, [], []],
    ['u1', 'hike', 'landsend', 'Lands End golden hour hike', 27, '16:45', 1.55, 18, ['u2'], [
      ['u2', 'That light on the Golden Gate 😍']
    ]],
    ['u2', 'run', 'ggpark', 'GGP recovery jog', 24, '12:15', 2.75, 19, ['u1'], []],
    ['u1', 'run', 'presidio', 'Presidio hills', 21, '06:55', 2.95, 20, ['u3'], []],
    ['u1', 'ride', 'sausalito', 'Headlands-lite loop', 16, '08:10', 7.6, 21, ['u2', 'u3'], [
      ['u3', 'Strong over the bridge today, barely held your wheel.']
    ]],
    ['u1', 'swim', null, 'Pool intervals', 13, '06:30', 0, 22, [], []],
    ['u3', 'run', 'presidio', 'Lunch loop', 11, '12:05', 3.10, 23, ['u1'], []],
    ['u1', 'run', 'embarcadero', 'Waterfront progression', 9, '06:45', 3.30, 24, ['u2'], []],
    ['u1', 'walk', 'oceanbeach', 'Sunset beach walk', 6, '19:05', 1.40, 25, [], []],
    ['u2', 'ride', 'sausalito', 'Wind-assisted return', 4, '10:00', 7.2, 26, ['u1', 'u3'], []],
    ['u1', 'run', 'ggpark', 'Park loop, negative split', 2, '07:20', 3.12, 27, ['u2', 'u3'], [
      ['u2', 'Negative split machine 🔥'], ['u3', 'Nice one!']
    ]],
    ['u1', 'run', 'twinpeaks', 'Morning summit run', 0, '06:50', 2.78, 28, ['u2'], []]
  ];

  function seedActivities() {
    var now = new Date();
    var acts = SEED_SPECS.map(function (s, idx) {
      var athleteId = s[0], type = s[1], routeKey = s[2], name = s[3];
      var daysAgo = s[4], hm = s[5].split(':'), baseSpeed = s[6], seed = s[7];
      var kudos = s[8], comments = s[9];

      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo,
        parseInt(hm[0], 10), parseInt(hm[1], 10));

      var act = {
        id: 'a' + (idx + 1),
        athleteId: athleteId,
        type: type,
        name: name,
        date: d.toISOString(),
        points: null,
        distance: 0,
        movingTime: 0,
        elevGain: 0,
        kudos: kudos.slice(),
        comments: comments.map(function (c) {
          return { athleteId: c[0], text: c[1] };
        })
      };

      if (routeKey) {
        var pts = buildRoute(ROUTES[routeKey], seed);
        assignTimes(pts, baseSpeed, seed + 100);
        act.points = pts;
        act.distance = Math.round(totalDistance(pts));
        act.movingTime = pts[pts.length - 1][3];
        act.elevGain = elevGain(pts);
      } else if (type === 'swim') {
        act.distance = 1500;
        act.movingTime = 32 * 60 + 40;
        act.elevGain = 0;
      }
      return act;
    });
    // newest first
    acts.sort(function (a, b) { return b.date < a.date ? -1 : 1; });
    return acts;
  }

  /* ---------------- store ---------------- */

  function freshState() {
    return {
      version: 1,
      me: 'u1',
      athletes: ATHLETES,
      activities: seedActivities()
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var state = JSON.parse(raw);
        if (state && state.version === 1 && Array.isArray(state.activities)) return state;
      }
    } catch (e) { /* corrupted or unavailable storage → reseed */ }
    var s = freshState();
    save(s);
    return s;
  }

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* storage full/blocked: app keeps working in-memory */ }
  }

  function reset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    return load();
  }

  window.StrideData = {
    load: load,
    save: save,
    reset: reset,
    haversine: haversine,
    totalDistance: totalDistance,
    elevGain: elevGain
  };
})();
