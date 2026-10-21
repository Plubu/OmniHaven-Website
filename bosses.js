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
    { name: 'snake',  idle: 'snake-idle.gif',  hurt: 'snake-hurt.png',  w: 323, h: 243, scale: 1, vis: 293, cx: 165 },
    { name: 'pencil', idle: 'pencil-idle.gif', hurt: 'pencil-hurt.gif', w: 144, h: 144, scale: 2, vis: 135, cx: 70 },
    { name: 'monkey', idle: 'monkey-idle.gif', hurt: 'monkey-hurt.gif', w: 401, h: 300, scale: 2, vis: 131, cx: 200 },
    // 4th boss: a scarf sprite sits behind her while idle (removed when hurt).
    // back.dx/dy = offset of the scarf's middle from her middle, in sprite pixels.
    // anchor 'center' = hurt sprite is lined up by its middle instead of its bottom.
    { name: 'hero', idle: 'hero-idle.gif', hurt: 'hero-hurt.gif', w: 64, h: 155, scale: 2, vis: 63, cx: 32,
      anchor: 'center', hurtUp: 48,   // hurt sprite moves up this many screen pixels
      back: { src: 'hero-scarf.gif', w: 42, h: 34, dx: 33, dy: -22.5 } }   // dy -22.5 x2 scale = 45px higher
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

  // Preload every sprite
  BOSSES.forEach(function (b) { new Image().src = base + b.idle; new Image().src = base + b.hurt; });

  var style = document.createElement('style');
  style.textContent =
    'html, body { overflow-x: clip; }' +
    '.omni-boss { position: absolute; z-index: 1000; image-rendering: pixelated;' +
    ' user-select: none; -webkit-user-drag: none; }' +
    '.omni-boss img { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);' +
    ' image-rendering: pixelated; pointer-events: none; }';
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
    setTimeout(function () { waiting = false; spawn(); }, SPAWN_DELAY);
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

    var img = document.createElement('img');
    img.alt = b.name;
    img.src = base + b.idle + '?t=' + Date.now();   // always start idle from frame 0
    img.style.width = w + 'px';
    if (b.anchor === 'center') { img.style.bottom = 'auto'; img.style.top = '50%'; img.style.transform = 'translate(-50%, -50%)'; }

    // Optional sprite drawn behind the boss (e.g. the 4th boss's scarf)
    var back = null;
    if (b.back) {
      back = document.createElement('img');
      back.alt = '';
      back.src = base + b.back.src + '?t=' + Date.now();
      back.style.cssText = 'position:absolute; transform:none; bottom:auto; image-rendering:pixelated; pointer-events:none;' +
        'width:' + (b.back.w * b.scale) + 'px;' +
        'left:' + (w / 2 + b.back.dx * b.scale - b.back.w * b.scale / 2) + 'px;' +
        'top:' + (h / 2 + b.back.dy * b.scale - b.back.h * b.scale / 2) + 'px;';
      el.appendChild(back);              // added first, so it's behind the boss
    }
    el.appendChild(img);
    document.body.appendChild(el);

    var target = OUTER_EDGE - half;
    var startD = Math.max(pageMiddle() + w, target + 300);   // fully outside the window
    var boss = { el: el, img: img, back: back, data: b, side: side, d: startD, target: target, hurt: false };
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
    // hurt sprite, scaled the same and anchored at the bottom so it doesn't jump
    var hurtImg = new Image();
    hurtImg.onload = function () { boss.img.style.width = (hurtImg.naturalWidth * b.scale) + 'px'; };
    // unique URL each time so the hurt animation always starts from frame 0
    hurtImg.src = base + b.hurt + '?t=' + Date.now();
    boss.img.src = hurtImg.src;
    if (boss.back) boss.back.remove();   // the extra sprite goes away when hurt
    if (b.hurtUp) boss.img.style.marginTop = (-b.hurtUp) + 'px';
    boss.el.style.pointerEvents = 'none';

    var start = 0;
    function shake(now) {
      if (!start) start = now;
      var p = (now - start) / FADE_MS;
      if (p >= 1) {
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
