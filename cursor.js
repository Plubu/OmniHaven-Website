// OmniHaven custom cursor
// Sprite follows the mouse. On click: switch to click sprite, scale to 0.2,
// then each frame: scale = lerp(scale, 1, 0.20) (like GameMaker at 60 fps).
// When it's back to 1, switch back to the normal sprite.
(function () {
  // Skip on touch-only devices (phones/tablets have no mouse cursor)
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  // Load sprites from the same folder as this script (works locally and online)
  var base = document.currentScript.src.replace(/[^\/]*$/, '');
  var SPRITE = base + 'cursor.png';
  var SPRITE_CLICK = base + 'cursor-click.png';
  var CLICK_SOUND = new Audio(base + 'sounds/click.wav');
  CLICK_SOUND.preload = 'auto';
  var EFFECT = base + 'click-effect.png';  // 9-frame sprite sheet, 36x29 per frame
  var EFFECT_W = 36, EFFECT_H = 29, EFFECT_FRAMES = 9, EFFECT_MS = 70;
  var EFFECT_SIZE = 2;                     // drawn at double size
  var EFFECT_OFFSET_Y = 14;                // pixels lower than the click point
  var TIP_X = 13, TIP_Y = 0;   // where the arrow's point is inside the sprite (px)
  var DRAW_SIZE = 2;           // 1 = original sprite size, 2 = double

  // Preload both sprites so the swap never flickers
  [SPRITE, SPRITE_CLICK, EFFECT].forEach(function (s) { new Image().src = s; });

  var style = document.createElement('style');
  style.textContent =
    'html, body, a, button, * { cursor: none !important; }' +
    '#omni-cursor { position: fixed; left: 0; top: 0; z-index: 2147483647;' +
    ' pointer-events: none; image-rendering: pixelated; display: none;' +
    ' width: ' + (26 * DRAW_SIZE) + 'px; height: ' + (38 * DRAW_SIZE) + 'px;' +
    ' transform-origin: center center; }' +
    '.omni-click-fx { position: fixed; left: 0; top: 0; z-index: 2147483646;' +
    ' pointer-events: none; image-rendering: pixelated;' +
    ' width: ' + (EFFECT_W * EFFECT_SIZE) + 'px; height: ' + (EFFECT_H * EFFECT_SIZE) + 'px;' +
    ' background: url("' + EFFECT + '") no-repeat 0 0;' +
    ' background-size: ' + (EFFECT_W * EFFECT_FRAMES * EFFECT_SIZE) + 'px ' + (EFFECT_H * EFFECT_SIZE) + 'px; }';
  document.head.appendChild(style);

  var el = document.createElement('img');
  el.id = 'omni-cursor';
  el.alt = '';
  el.src = SPRITE;
  document.body.appendChild(el);

  var x = 0, y = 0, scale = 1, animating = false, last = 0;

  function draw() {
    el.style.transform =
      'translate(' + (x - TIP_X * DRAW_SIZE) + 'px,' + (y - TIP_Y * DRAW_SIZE) + 'px) scale(' + scale + ')';
  }

  function step(now) {
    // frame-rate independent version of lerp(scale, 1, 0.20) per 60fps step
    var frames = last ? (now - last) / (1000 / 60) : 1;
    last = now;
    scale += (1 - scale) * (1 - Math.pow(1 - 0.20, frames));
    if (scale >= 0.99) {          // back to original size
      scale = 1;
      el.src = SPRITE;
      animating = false;
    }
    draw();
    if (animating) requestAnimationFrame(step);
  }

  document.addEventListener('mousemove', function (e) {
    x = e.clientX; y = e.clientY;
    el.style.display = 'block';
    draw();
  });

  // Click effect: plays once at the click spot, one layer below the cursor, then removes itself
  function spawnEffect(cx, cy) {
    var fx = document.createElement('div');
    fx.className = 'omni-click-fx';
    fx.style.transform = 'translate(' + (cx - EFFECT_W * EFFECT_SIZE / 2) + 'px,' +
                         (cy - EFFECT_H * EFFECT_SIZE / 2 + EFFECT_OFFSET_Y) + 'px)';
    document.body.appendChild(fx);
    var frame = 0;
    var timer = setInterval(function () {
      frame++;
      if (frame >= EFFECT_FRAMES) { clearInterval(timer); fx.remove(); return; }
      fx.style.backgroundPosition = (-frame * EFFECT_W * EFFECT_SIZE) + 'px 0';
    }, EFFECT_MS);
  }

  document.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;           // left click only
    // Click sound (bosses play their own hit sound instead)
    if (!(e.target.closest && e.target.closest('.omni-boss'))) {
      var snd = CLICK_SOUND.cloneNode();    // a fresh copy so fast clicks overlap
      snd.play().catch(function () {});
    }
    spawnEffect(e.clientX, e.clientY);
    el.src = SPRITE_CLICK;
    scale = 0.2;
    draw();
    if (!animating) { animating = true; last = 0; requestAnimationFrame(step); }
  });

  // Hide the sprite when the mouse leaves the window (or goes over the Steam widget)
  document.addEventListener('mouseout', function (e) {
    if (!e.relatedTarget) el.style.display = 'none';
  });
})();
