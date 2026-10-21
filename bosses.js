// OmniHaven boss parade
// Bosses slide in on the left and right sides of the page, one at a time:
// left, right, left, right... Order: snake > pencil > monkey > hero > (loops).
// The 4-second timer for a spot only starts once that spot is empty.
// Click a boss: it shakes, switches to its hurt sprite and fades out over half a second.
(function () {
  var root = document.currentScript.src.replace(/[^\/]*$/, '');
  var base = root + 'bosses/';
  var HIT_SOUND = new Audio(root + 'sounds/hit.wav');
  HIT_SOUND.preload = 'auto';

  // scale = how big to draw the sprite (pixel art stays sharp)
  // vis = width of the visible part of the sprite, cx = its middle (in sprite pixels),
  // so empty space in the image doesn't push the boss away from the edge
  var BOSSES = [
    { name: 'snake',  idle: 'snake-idle',  hurt: 'snake-hurt',  w: 323, h: 243, scale: 1, vis: 293, cx: 165 },
    { name: 'pencil', idle: 'pencil-idle', hurt: 'pencil-hurt', w: 144, h: 144, scale: 2, vis: 135, cx: 70 },
    { name: 'monkey', idle: 'monkey-idle', hurt: 'monkey-hurt', w: 401, h: 300, scale: 2, vis: 131, cx: 200 },
    // 4th boss: a scarf sprite sits behind her while idle (removed when hurt).
    // back.dx/dy = offset of the scarf's middle from her middle, in sprite pixels.
    // anchor 'center' = hurt sprite is lined up by its middle instead of its bottom.
    { name: 'hero', idle: 'hero-idle', hurt: 'hero-hurt', w: 64, h: 155, scale: 2, vis: 63, cx: 32,
      anchor: 'center', hurtUp: 48,   // hurt sprite moves up this many screen pixels
      back: { src: 'hero-scarf', w: 42, h: 34, dx: 33, dy: -22.5 } }   // dy -22.5 x2 scale = 45px higher
  ];

  // Positions are measured from the middle of the page (like the rest of the site),
  // so zooming in/out keeps the bosses in the same place relative to everything else.
  var OUTER_EDGE = 820;     // px from page middle to the outer edge of the boss's visible body
  var CENTER_TOP = 360;     // px from the top of the page to the boss's middle
  var SPAWN_DELAY = 4000;   // ms the spot must be empty before the next boss appears
  var SLIDE_LERP = 0.10;    // like lerp(x, target, 0.10) every frame at 60 fps
  var SHAKE_PX = 10;        // how far it shakes left/right when hurt
  var FADE_MS = 500;        // hurt fade-out length

  // Only on screens wide enough to have room at the sides
  if (window.innerWidth < 900) return;

  // Sprite sheets: every animation is one image with its frames side by side.
  // w/h = one frame's size, n = frame count, d = how long each frame shows (ms).
  // Loaded once up front, so swapping sprites is instant and always starts at frame 0.
  var SHEETS = {
    'snake-idle':  { w: 323, h: 243, n: 12, d: [50] },
    'snake-hurt':  { w: 267, h: 228, n: 1,  d: [100] },
    'pencil-idle': { w: 144, h: 144, n: 20, d: [50] },
    'pencil-hurt': { w: 144, h: 144, n: 20, d: [30] },
    'monkey-idle': { w: 401, h: 300, n: 13, d: [50] },
    'monkey-hurt': { w: 401, h: 300, n: 33, d: [500, 50] },   // first frame 500ms, rest 50ms
    'hero-idle':   { w: 64,  h: 155, n: 12, d: [50] },
    'hero-hurt':   { w: 400, h: 300, n: 8,  d: [50] },
    'hero-scarf':  { w: 42,  h: 34,  n: 12, d: [50] }
  };
  function frameMs(sh, i) { return i < sh.d.length ? sh.d[i] : sh.d[sh.d.length - 1]; }

  // Preload every sheet; a boss only appears once its sheets are ready
  var loaded = {};
  Object.keys(SHEETS).forEach(function (k) {
    var im = new Image();
    im.onload = function () { loaded[k] = true; };
    im.src = base + k + '.png';
    SHEETS[k].img = im;
  });
  function bossReady(b) {
    return loaded[b.idle] && loaded[b.hurt] && (!b.back || loaded[b.back.src]);
  }

  // An animated sprite drawn from a sheet
  function Sprite(scale) {
    this.el = document.createElement('div');
    this.el.className = 'omni-spr';
    this.scale = scale;
    this.timer = null;
  }
  Sprite.prototype.play = function (name) {
    var sh = SHEETS[name], sc = this.scale, el = this.el, self = this;
    clearTimeout(this.timer);
    el.style.width = (sh.w * sc) + 'px';
    el.style.height = (sh.h * sc) + 'px';
    el.style.backgroundImage = 'url("' + base + name + '.png")';
    el.style.backgroundSize = (sh.w * sh.n * sc) + 'px ' + (sh.h * sc) + 'px';
    var i = 0;
    function show() {
      el.style.backgroundPosition = (-i * sh.w * sc) + 'px 0';
      if (sh.n > 1) self.timer = setTimeout(function () { i = (i + 1) % sh.n; show(); }, frameMs(sh, i));
    }
    show();                               // starts at frame 0
  };
  Sprite.prototype.stop = function () { clearTimeout(this.timer); };

  var style = document.createElement('style');
  style.textContent =
    'html, body { overflow-x: clip; }' +
    '.omni-boss { position: absolute; z-index: 1000; image-rendering: pixelated;' +
    ' user-select: none; -webkit-user-drag: none; }' +
    '.omni-spr { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);' +
    ' background-repeat: no-repeat; image-rendering: pixelated; pointer-events: none; }';
  document.head.appendChild(style);

  var spots = { left: null, right: null };
  var nextSide = 'left';
  var nextBoss = 0;
  var waiting = false;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function frameT(t, dtMs) { return 1 - Math.pow(1 - t, dtMs / (1000 / 60)); }
  function pageMiddle() { return document.documentElement.clientWidth / 2; }

  // Place a boss: boss.d = distance from page middle to the middle of its visible body
  function place(boss, extra) {
    var b = boss.data, dir = boss.side === 'left' ? -1 : 1;
    var visMiddle = pageMiddle() + dir * boss.d + (extra || 0);
    boss.el.style.left = (visMiddle - b.cx * b.scale) + 'px';
    boss.el.style.top = (CENTER_TOP - b.h * b.scale / 2) + 'px';
  }

  window.addEventListener('resize', function () {
    ['left', 'right'].forEach(function (s) { if (spots[s] && !spots[s].hurt) place(spots[s]); });
  });

  function scheduleNext() {
    if (waiting) return;
    if (spots[nextSide]) return;          // spot is taken: wait until it's cleared
    waiting = true;
    setTimeout(function () { waiting = false; trySpawn(); }, SPAWN_DELAY);
  }

  // If the next boss's sprites are still downloading, wait for them before spawning
  function trySpawn() {
    if (bossReady(BOSSES[nextBoss])) spawn();
    else setTimeout(trySpawn, 100);
  }

  function spawn() {
    var side = nextSide;
    if (spots[side]) return;
    var b = BOSSES[nextBoss];
    nextBoss = (nextBoss + 1) % BOSSES.length;
    nextSide = side === 'left' ? 'right' : 'left';

    var w = b.w * b.scale, h = b.h * b.scale, half = b.vis * b.scale / 2;
    var el = document.createElement('div');
    el.className = 'omni-boss';
    el.style.width = w + 'px';
    el.style.height = h + 'px';

    var spr = new Sprite(b.scale);
    spr.play(b.idle);
    var img = spr.el;
    if (b.anchor === 'center') { img.style.bottom = 'auto'; img.style.top = '50%'; img.style.transform = 'translate(-50%, -50%)'; }

    // Optional sprite drawn behind the boss (e.g. the 4th boss's scarf)
    var back = null;
    if (b.back) {
      back = new Sprite(b.scale);
      back.play(b.back.src);
      back.el.style.cssText += 'transform:none; bottom:auto;' +
        'left:' + (w / 2 + b.back.dx * b.scale - b.back.w * b.scale / 2) + 'px;' +
        'top:' + (h / 2 + b.back.dy * b.scale - b.back.h * b.scale / 2) + 'px;';
      el.appendChild(back.el);           // added first, so it's behind the boss
    }
    el.appendChild(img);
    document.body.appendChild(el);

    var target = OUTER_EDGE - half;
    var startD = Math.max(pageMiddle() + w, target + 300);   // fully outside the window
    var boss = { el: el, img: img, spr: spr, back: back, data: b, side: side, d: startD, target: target, hurt: false };
    spots[side] = boss;
    place(boss);

    var last = 0;
    function slide(now) {
      if (boss.hurt) return;
      var dt = last ? now - last : 1000 / 60; last = now;
      boss.d = lerp(boss.d, target, frameT(SLIDE_LERP, dt));
      if (Math.abs(boss.d - target) < 0.5) boss.d = target;
      place(boss);
      if (boss.d !== target) requestAnimationFrame(slide);
    }
    requestAnimationFrame(slide);

    el.addEventListener('mousedown', function (e) { if (e.button === 0) hurt(boss); });  // left click only

    scheduleNext();                       // the other side's timer can start now
  }

  function hurt(boss) {
    if (boss.hurt) return;
    boss.hurt = true;
    var hitSnd = HIT_SOUND.cloneNode();
    hitSnd.volume = 0.5;                  // hit sound at 50% volume
    hitSnd.play().catch(function () {});
    var b = boss.data;
    // hurt sprite: already loaded, so it switches instantly and starts at frame 0
    boss.spr.play(b.hurt);
    if (boss.back) { boss.back.stop(); boss.back.el.remove(); }   // the extra sprite goes away when hurt
    if (b.hurtUp) boss.img.style.marginTop = (-b.hurtUp) + 'px';
    boss.el.style.pointerEvents = 'none';

    var start = 0;
    function shake(now) {
      if (!start) start = now;
      var p = (now - start) / FADE_MS;
      if (p >= 1) {
        boss.spr.stop();
        boss.el.remove();
        spots[boss.side] = null;
        scheduleNext();                   // spot is empty: its timer can start
        return;
      }
      var offset = Math.sin(p * Math.PI * 16) * SHAKE_PX * (1 - p);
      place(boss, offset);
      boss.el.style.opacity = 1 - p;
      requestAnimationFrame(shake);
    }
    requestAnimationFrame(shake);
  }

  scheduleNext();
})();
