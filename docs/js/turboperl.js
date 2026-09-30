// The interface of the site: a Turbo Vision desktop with a menu bar, one
// window holding the document, and a status line.  Everything is placed on a
// grid of character cells which are half the font size wide and the font
// size tall, see css/turboperl.css.

(function () {
  'use strict';

  const $ = (selector, parent = document) => parent.querySelector(selector);

  function create(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const screen  = $('#screen');
  const pattern = $('#desktop-pattern');

  const MIN_WIDTH  = 16;   // smallest a window can be sized to, in cells
  const MIN_HEIGHT = 6;
  const FILL       = 400;  // more cells than any edge of the screen has

  let fontSize;            // in pixels; a cell is fontSize / 2 by fontSize
  let cols, rows;          // size of the desktop, in cells

  const state = { modal: null, dos: false };

  // ---- frames ------------------------------------------------------------

  // Draws the frame around a window or dialog.  The pieces that differ
  // between the active (double line) and inactive (single line) frame are
  // remembered so that they can be redrawn.
  function frame(el, options) {
    const pieces = [];
    const piece = (parent, className, active, inactive) => {
      const p = parent.appendChild(create('span', className, active));
      pieces.push([p, active, inactive]);
      return p;
    };
    const icon = (parent, glyph) => {
      const i = parent.appendChild(create('span', 'tv-icon'));
      i.append('[', create('span', '', glyph), ']');
      return i;
    };

    const top = create('div', 'tv-frame tv-frame-top');
    piece(top, '', '╔═', '┌─');
    const close = icon(top, '■');
    piece(top, 'tv-fill', '═'.repeat(FILL), '─'.repeat(FILL));
    top.append($('.tv-title', el));
    piece(top, 'tv-fill', '═'.repeat(FILL), '─'.repeat(FILL));
    let zoom;
    if (options.resizable) {
      piece(top, '', '1═', '1─');
      zoom = $('span', icon(top, '↕'));
    }
    piece(top, '', '═╗', '─┐');

    const bottom = create('div', 'tv-frame tv-frame-bottom');
    piece(bottom, '', '╚', '└');
    piece(bottom, 'tv-fill', '═'.repeat(FILL), '─'.repeat(FILL));
    const resize = options.resizable
      ? piece(bottom, 'tv-resize', '─┘', '─┘')
      : piece(bottom, '', '═╝', '─┘');

    const left = create('div', 'tv-frame tv-frame-left');
    piece(left, '', '║\n'.repeat(FILL), '│\n'.repeat(FILL));

    const right = create('div', 'tv-frame tv-frame-right');
    piece(right, 'tv-side', '║\n'.repeat(FILL), '│\n'.repeat(FILL));

    el.append(top, bottom, left, right,
      create('div', 'tv-shadow tv-shadow-right'),
      create('div', 'tv-shadow tv-shadow-bottom'));

    return {
      top, right, close, zoom, resize,
      setActive(active) {
        el.classList.toggle('tv-inactive', !active);
        for (const [p, on, off] of pieces) p.textContent = active ? on : off;
      },
    };
  }

  // Calls move(dx, dy) with the distance in cells that the pointer has been
  // dragged from where it went down on the handle.
  function draggable(handle, start, move) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.tv-icon')) return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const x = e.clientX, y = e.clientY;
      start();
      const onMove = (ev) => move(
        Math.round((ev.clientX - x) / (fontSize / 2)),
        Math.round((ev.clientY - y) / fontSize));
      const onUp = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    });
  }

  function place(el, box) {
    el.style.left = box.x / 2 + 'em';
    el.style.top  = box.y + 'em';
    if (box.w) el.style.width  = box.w / 2 + 'em';
    if (box.h) el.style.height = box.h + 'em';
  }

  // ---- the document window ---------------------------------------------

  const win = (function () {
    const el      = $('#window');
    const content = $('.tv-content', el);
    const f       = frame(el, { resizable: true });

    const bar   = f.right.appendChild(create('div', 'tv-scrollbar'));
    const up    = bar.appendChild(create('div', '', '▲'));
    const track = bar.appendChild(create('div', 'tv-scrollbar-track'));
    const down  = bar.appendChild(create('div', '', '▼'));
    const fill  = track.appendChild(create('div'));
    const thumb = track.appendChild(create('div', 'tv-scrollbar-thumb', '■'));
    fill.style.whiteSpace = 'pre';

    let box     = null;   // where the window is on the desktop, in cells
    let zoomed  = true;   // does it fill the desktop
    let restore = null;   // where it goes back to when it is unzoomed

    // the position survives going from one page to the next
    try {
      const saved = JSON.parse(sessionStorage.getItem('tv-window'));
      if (saved && !saved.zoomed) { box = saved.box; zoomed = false; }
      if (saved) restore = saved.restore;
    } catch (e) { /* start zoomed */ }

    const save = () => {
      try {
        sessionStorage.setItem('tv-window', JSON.stringify({ box, zoomed, restore }));
      } catch (e) { /* not remembered then */ }
    };

    const full = () => ({ x: 0, y: 0, w: cols, h: rows });

    function fit(b) {
      const w = clamp(b.w, Math.min(MIN_WIDTH, cols), cols);
      const h = clamp(b.h, Math.min(MIN_HEIGHT, rows), rows);
      return { x: clamp(b.x, 0, cols - w), y: clamp(b.y, 0, rows - h), w, h };
    }

    function set(b) {
      box = fit(b);
      zoomed = box.w === cols && box.h === rows;
      f.zoom.textContent = zoomed ? '↕' : '↑';
      place(el, box);
      scrollTo(position());
      save();
    }

    function zoom() {
      if (zoomed) {
        const x = Math.max(2, Math.floor(cols / 10)), y = Math.max(1, Math.floor(rows / 10));
        set(restore || { x, y, w: cols - 2 * x, h: rows - 2 * y });
      } else {
        restore = box;
        set(full());
      }
    }

    // scrolling is by whole rows, so the text stays on the grid

    const visible  = () => box.h - 2;
    const maximum  = () => Math.max(0, Math.ceil(content.scrollHeight / fontSize - 0.01) - visible());
    const position = () => Math.round(content.scrollTop / fontSize);

    function drawScrollBar() {
      const length = Math.max(0, box.h - 4), max = maximum();
      fill.textContent = (max ? '▒\n' : '▓\n').repeat(length);
      thumb.hidden = !max || !length;
      if (max) thumb.style.top = Math.round(position() / max * (length - 1)) + 'em';
    }

    function scrollTo(row) {
      content.scrollTop = clamp(row, 0, maximum()) * fontSize;
      drawScrollBar();
    }

    const scrollBy = (n) => scrollTo(position() + n);

    content.addEventListener('scroll', drawScrollBar);

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!state.modal) scrollBy(Math.sign(e.deltaY) * 3);
    }, { passive: false });

    // holding the button down on an arrow keeps it scrolling
    function repeating(target, action) {
      target.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        action();
        let timer = setTimeout(() => { timer = setInterval(action, 50); }, 400);
        const stop = () => {
          clearTimeout(timer); clearInterval(timer);
          removeEventListener('pointerup', stop);
          removeEventListener('pointercancel', stop);
        };
        addEventListener('pointerup', stop);
        addEventListener('pointercancel', stop);
      });
    }
    repeating(up,   () => scrollBy(-1));
    repeating(down, () => scrollBy(1));

    const trackRow = (e) => Math.floor((e.clientY - track.getBoundingClientRect().top) / fontSize);

    track.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      if (e.target !== thumb) {
        scrollBy((trackRow(e) < parseInt(thumb.style.top) ? -1 : 1) * (visible() - 1));
        return;
      }
      track.setPointerCapture(e.pointerId);
      const onMove = (ev) => {
        const length = box.h - 4;
        if (length > 1) scrollTo(Math.round(clamp(trackRow(ev), 0, length - 1) / (length - 1) * maximum()));
      };
      const onUp = () => {
        track.removeEventListener('pointermove', onMove);
        track.removeEventListener('pointerup', onUp);
        track.removeEventListener('pointercancel', onUp);
      };
      track.addEventListener('pointermove', onMove);
      track.addEventListener('pointerup', onUp);
      track.addEventListener('pointercancel', onUp);
    });

    // move by the title bar, size by the bottom right corner

    let from;
    draggable(f.top, () => { from = box; },
      (dx, dy) => set({ x: from.x + dx, y: from.y + dy, w: from.w, h: from.h }));
    draggable(f.resize, () => { from = box; },
      (dx, dy) => set({
        x: from.x, y: from.y,
        w: clamp(from.w + dx, MIN_WIDTH, cols - from.x),
        h: clamp(from.h + dy, MIN_HEIGHT, rows - from.y),
      }));

    f.top.addEventListener('dblclick', (e) => {
      if (!e.target.closest('.tv-icon')) zoom();
    });
    f.zoom.parentNode.addEventListener('click', zoom);
    f.close.addEventListener('click', () => commands.close());

    return {
      zoom, scrollBy, scrollTo, visible, maximum,
      setActive: f.setActive,
      layout() { set(zoomed || !box ? full() : box); },
    };
  })();

  // ---- dialogs -----------------------------------------------------------

  function dialog(el) {
    const f = frame(el, { resizable: false });
    let box;

    const size = () => ({
      w: Math.round(el.offsetWidth / (fontSize / 2)),
      h: Math.round(el.offsetHeight / fontSize),
    });

    function move(x, y) {
      const { w, h } = size();
      box = { x: clamp(x, 0, Math.max(0, cols - w)), y: clamp(y, 0, Math.max(0, rows - h)) };
      place(el, box);
    }

    const centre = () => {
      const { w, h } = size();
      move(Math.floor((cols - w) / 2), Math.floor((rows - h) / 2));
    };

    function close() {
      el.hidden = true;
      state.modal = null;
      win.setActive(true);
    }

    let from;
    draggable(f.top, () => { from = box; }, (dx, dy) => move(from.x + dx, from.y + dy));
    f.close.addEventListener('click', close);
    $('.tv-button', el).addEventListener('click', close);

    return {
      el, close,
      layout() { if (!el.hidden) centre(); },
      open() {
        closeMenu();
        el.hidden = false;
        state.modal = this;
        win.setActive(false);
        centre();
      },
    };
  }

  const about = dialog($('#about'));

  // ---- commands ----------------------------------------------------------

  const commands = {
    about() { about.open(); },

    // closing the window leaves nothing to show
    close() {
      if (document.body.dataset.page === '404') location.reload();
      else location.href = '/404.html';
    },

    // leave for the DOS prompt; only loading the page again comes back
    exit() {
      closeMenu();
      state.dos = true;
      document.body.classList.add('tv-dos');
      $('#dos').hidden = false;
    },
  };

  // ---- menus -------------------------------------------------------------

  const hotKey = (el) => $('.tv-hot', el).textContent.toLowerCase();

  const menus = Array.from(document.querySelectorAll('#menubar > .tv-menu'), (li) => {
    const list  = $('.tv-menu-items', li);
    const rows  = Array.from(list.children);
    const items = [];

    // a box is as wide as its longest item, the way Turbo Vision sizes them
    let width = 0;
    for (const row of rows) {
      const a = $('a', row);
      if (!a) continue;
      const shortcut = a.dataset.shortcut;
      width = Math.max(width, a.textContent.length + (shortcut ? shortcut.length + 5 : 3));
    }

    for (const row of rows) {
      const a = $('a', row);
      if (!a) {
        row.textContent = ' ├' + '─'.repeat(width) + '┤ ';
        continue;
      }
      const label = create('span', 'tv-menu-label');
      label.append(...a.childNodes);
      a.append(label);
      if (a.dataset.shortcut) a.append(create('span', 'tv-menu-shortcut', a.dataset.shortcut));
      a.tabIndex = -1;
      row.prepend(' │');
      row.append('│ ');
      items.push({ row, a, hot: hotKey(a) });
    }

    list.prepend(create('li', '', ' ┌' + '─'.repeat(width) + '┐ '));
    list.append(
      create('li', '', ' └' + '─'.repeat(width) + '┘ '),
      create('li', 'tv-shadow tv-shadow-right'),
      create('li', 'tv-shadow tv-shadow-bottom'));
    list.style.width = (width + 4) / 2 + 'em';

    return { li, items, hot: hotKey($('.tv-menu-title', li)) };
  });

  // active: the bar has the keyboard; open: the box of menus[index] is
  // down; item: the entry the selection bar is on, or -1
  const menu = { active: false, index: 0, open: false, item: -1 };

  function drawMenu() {
    menus.forEach((m, i) => {
      const selected = menu.active && i === menu.index;
      m.li.classList.toggle('tv-selected', selected);
      m.li.classList.toggle('tv-open', selected && menu.open);
      m.items.forEach((item, j) =>
        item.row.classList.toggle('tv-selected', selected && menu.open && j === menu.item));
    });
  }

  function openMenu(index, item = 0) {
    Object.assign(menu, { active: true, index, open: true, item });
    drawMenu();
  }

  function closeMenu() {
    Object.assign(menu, { active: false, open: false, item: -1 });
    drawMenu();
  }

  function activate(item) {
    closeMenu();
    const command = item.a.dataset.command;
    if (command) commands[command]();
    else location.href = item.a.href;
  }

  function menuKey(e) {
    const count = menus.length, items = menus[menu.index].items;
    const across = (n) => {
      menu.index = (menu.index + n + count) % count;
      if (menu.open) menu.item = 0;
    };
    const along = (n) => {
      if (menu.open) menu.item = (menu.item + n + items.length) % items.length;
      else Object.assign(menu, { open: true, item: 0 });
    };

    switch (e.key) {
      case 'Escape':
        // one level at a time: the box, and then the bar
        if (menu.open) Object.assign(menu, { open: false, item: -1 });
        else menu.active = false;
        break;
      case 'ArrowLeft':  across(-1); break;
      case 'ArrowRight': across(1);  break;
      case 'ArrowUp':    along(-1);  break;
      case 'ArrowDown':  along(1);   break;
      case 'Home': if (menu.open) menu.item = 0; break;
      case 'End':  if (menu.open) menu.item = items.length - 1; break;
      case 'Enter':
        if (menu.open && menu.item >= 0) return activate(items[menu.item]);
        along(1);
        break;
      default: {
        if (e.key.length !== 1) break;
        const key = e.key.toLowerCase();
        if (menu.open) {
          const item = items.find((i) => i.hot === key);
          if (item) return activate(item);
        } else {
          const index = menus.findIndex((m) => m.hot === key);
          if (index >= 0) Object.assign(menu, { index, open: true, item: 0 });
        }
      }
    }
    drawMenu();
  }

  // The mouse works the menus as it does in the app: press on a title to
  // pull its box down, drag along the entries with the button held, and let
  // go on one to pick it.  Letting go on the title leaves the box down for a
  // second click.

  function menuAt(target) {
    const li = target && target.closest('#menubar > .tv-menu');
    if (!li) return null;
    const index = menus.findIndex((m) => m.li === li);
    const row = target.closest('.tv-menu-items > li');
    return {
      index,
      item: row ? menus[index].items.findIndex((i) => i.row === row) : -1,
      title: !!target.closest('.tv-menu-title'),
    };
  }

  let tracking = null;

  document.addEventListener('pointerdown', (e) => {
    if (state.dos || state.modal || e.button !== 0) return;
    const hit = menuAt(e.target);
    if (!hit) {
      if (menu.active) closeMenu();
      return;
    }
    e.preventDefault();
    // pressing the title of a box that is already down puts it away
    tracking = { toggle: hit.title && menu.active && menu.open && menu.index === hit.index };
    openMenu(hit.index, hit.item);
  });

  document.addEventListener('pointermove', (e) => {
    if (!tracking) return;
    const hit = menuAt(document.elementFromPoint(e.clientX, e.clientY));
    if (!hit || !hit.title || hit.index !== menu.index) tracking.toggle = false;
    if (hit) openMenu(hit.index, hit.item);
    else openMenu(menu.index, -1);
  });

  document.addEventListener('pointerup', (e) => {
    if (!tracking) return;
    const { toggle } = tracking;
    tracking = null;
    const hit = menuAt(document.elementFromPoint(e.clientX, e.clientY));
    if (!hit || (hit.title && toggle)) closeMenu();
    else if (hit.item >= 0) activate(menus[hit.index].items[hit.item]);
    else openMenu(hit.index, 0);
  });

  // the entries are links, but they are followed by activate()
  $('#menubar').addEventListener('click', (e) => e.preventDefault());

  $('#statusline').addEventListener('click', (e) => {
    const a = e.target.closest('a[data-command]');
    if (!a) return;
    e.preventDefault();
    if (!state.modal) commands[a.dataset.command]();
  });

  // a dialog is modal: nothing behind it answers the mouse
  for (const type of ['pointerdown', 'mousedown', 'click', 'dblclick']) {
    document.addEventListener(type, (e) => {
      if (!state.modal || state.modal.el.contains(e.target)) return;
      e.stopPropagation();
      e.preventDefault();
    }, true);
  }

  // ---- keyboard ----------------------------------------------------------

  // The keys are the ones the app uses.  Some of them belong to the browser
  // or the window manager first, in which case they never arrive here.
  document.addEventListener('keydown', (e) => {
    if (state.dos || e.ctrlKey || e.metaKey) return;

    const letter = /^Key[A-Z]$/.test(e.code) ? e.code[3].toLowerCase() : '';

    if (state.modal) {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ' || letter === 'o') {
        state.modal.close();
        e.preventDefault();
      } else if (e.key === 'Tab' || e.key === 'F10' || e.altKey) {
        e.preventDefault();
      }
      return;
    }

    if (e.altKey) {
      const index = menus.findIndex((m) => m.hot === letter);
      if (letter === 'x') commands.exit();
      else if (e.key === 'F3') commands.close();
      else if (index >= 0) openMenu(index);
      else return;
      e.preventDefault();
      return;
    }

    if (e.key === 'F10' && !e.shiftKey) {
      if (menu.active) closeMenu();
      else { menu.active = true; drawMenu(); }
      e.preventDefault();
      return;
    }

    if (menu.active) {
      menuKey(e);
      e.preventDefault();
      return;
    }

    if (e.shiftKey) return;

    switch (e.key) {
      case 'F5':        win.zoom(); break;
      case 'ArrowUp':   win.scrollBy(-1); break;
      case 'ArrowDown': win.scrollBy(1); break;
      case 'PageUp':    win.scrollBy(1 - win.visible()); break;
      case 'PageDown':  win.scrollBy(win.visible() - 1); break;
      case 'Home':      win.scrollTo(0); break;
      case 'End':       win.scrollTo(win.maximum()); break;
      default: return;
    }
    e.preventDefault();
  });

  // ---- clock -------------------------------------------------------------

  const clock = $('#clock');

  function tick() {
    const now = new Date();
    clock.textContent = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map((n) => String(n).padStart(2, '0')).join(':');
  }

  tick();
  setInterval(tick, 1000);

  // ---- layout ------------------------------------------------------------

  // The largest font size that still leaves the classic 80x25 screen, and
  // however many cells fit in the browser window at that size.
  function layout() {
    const width = window.innerWidth, height = window.innerHeight;
    fontSize = [32, 24].find((s) => width / (s / 2) >= 80 && height / s >= 25) || 16;

    const screenCols = Math.max(MIN_WIDTH, Math.floor(width / (fontSize / 2)));
    const screenRows = Math.max(MIN_HEIGHT + 2, Math.floor(height / fontSize));
    screen.style.fontSize = fontSize + 'px';
    screen.style.width    = screenCols / 2 + 'em';
    screen.style.height   = screenRows + 'em';

    // the desktop is what is between the menu bar and the status line
    cols = screenCols;
    rows = screenRows - 2;
    pattern.textContent = ('░'.repeat(cols) + '\n').repeat(rows);

    win.layout();
    about.layout();
  }

  window.addEventListener('resize', layout);
  layout();
})();
