// Doberg: builds the app demos into any <div data-demo="skintel|blith">, switches between the two
// stages with tabs (auto-advancing every 8 s until someone picks one), and reveals [data-reveal]
// elements as they scroll into view. All copy in the demos is example data.
(function () {
  var STAGES = {
    skintel: [
      { id: 'scan', label: 'Scan', html:
        '<div class="hd">Scan</div><span class="ex">Example</span>' +
        '<div class="finder"><div class="bottle"><i></i><b></b><s></s><u></u></div><div class="line"></div></div>' +
        '<div class="hint">Point at a barcode or label</div>' +
        '<div class="sheet"><span class="k">Daily Gentle Cleanser</span><h4>Not great for your skin</h4>' +
        '<span class="verdict">Caution for you</span>' +
        '<p class="why"><b>Fragrance (parfum)</b> was in 3 of your 4 bad-skin days this month.</p></div>' },
      { id: 'ask', label: 'Ask Skintel', html:
        '<div class="hd">Ask Skintel</div><span class="ex">Example</span>' +
        '<div class="chat"><div class="me a1">Why did my skin break out this week?</div>' +
        '<div class="ai a2">Fragrance shows up in 3 of your 4 bad days. Your new cleanser has it.</div>' +
        '<div class="chip a3"><span class="t"></span><span>Daily Gentle Cleanser<em>On your shelf · try pausing it</em></span></div></div>' +
        '<div class="composer">Ask about your skin…<i></i></div>' }
    ],
    blith: [
      { id: 'body', label: 'Body notes', html:
        '<div class="hd">Body</div><span class="ex">Example</span>' +
        '<div class="body"><img src="assets/blith-body.png" alt=""><span class="ring"></span></div>' +
        '<div class="note a3"><span class="k">Body note · today</span><h4>Right knee</h4><p>Rolled it on a run</p><span class="saved">Saved</span></div>' },
      { id: 'ask', label: 'Ask', html:
        '<div class="hd">Ask</div><span class="ex">Example</span>' +
        '<div class="chat"><div class="me a1">What’s my readiness today?</div>' +
        '<div class="ai a2">High, above your usual. Sleep and HRV lifted it.</div>' +
        '<div class="card a3"><span class="k">Readiness · today</span><div class="score"><b>78</b><span>▲ High</span></div>' +
        '<div class="bar"><span class="band"></span><span class="fill"></span><span class="mk"></span></div><div class="usual">Your usual: 64–74</div></div></div>' +
        '<div class="composer">Ask about your health…<i></i></div>' }
    ]
  };
  var LABEL = {
    skintel: 'Skintel demo: scanning a cleanser flags fragrance, which appeared on most of your bad-skin days; Ask Skintel explains it and points to the product on your shelf.',
    blith: 'Blith demo: tapping the right knee on the body map saves a note; Ask shows readiness 78, High, above the usual range of 64 to 74.'
  };

  function build(el) {
    var app = el.getAttribute('data-demo'), stages = STAGES[app];
    if (!stages) return;
    var dark = app === 'blith' ? ' dark' : '';
    var tabs = '<div class="demo-tabs' + dark + '" role="group" aria-label="Demo">' + stages.map(function (s, i) {
      return '<button type="button" data-i="' + i + '" aria-pressed="' + (i === 0) + '">' + s.label + '</button>';
    }).join('') + '</div>';
    var screens = stages.map(function (s, i) {
      return '<div class="stage ' + (app === 'skintel' ? 'sk' : 'bl') + (i === 0 ? ' is-on' : '') + '">' + s.html + '</div>';
    }).join('');
    el.classList.add('demo');
    el.innerHTML = tabs + '<div class="phone" role="img" aria-label="' + LABEL[app] + '"><div class="screen"><span class="island"></span>' + screens + '</div></div>';

    var buttons = el.querySelectorAll('.demo-tabs button'), panes = el.querySelectorAll('.stage'), cur = 0, auto = true;
    function show(i) {
      cur = i;
      panes.forEach(function (p, k) {
        p.classList.toggle('is-on', k === i);
        // restart the pane's timeline so it always plays from the beginning
        p.querySelectorAll('*').forEach(function (n) { n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; });
      });
      buttons.forEach(function (b, k) { b.setAttribute('aria-pressed', String(k === i)); });
    }
    buttons.forEach(function (b) { b.addEventListener('click', function () { auto = false; show(+b.getAttribute('data-i')); }); });
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) setInterval(function () { if (auto) show((cur + 1) % panes.length); }, 8000);
  }

  function reveal() {
    var els = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    els.forEach(function (e) { io.observe(e); });
  }

  document.querySelectorAll('[data-demo]').forEach(build);
  reveal();
})();
