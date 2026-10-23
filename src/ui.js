/** Modal overlays: memory-box gallery, photo lightbox, 3D orbit viewer. */
const $ = (id) => document.getElementById(id);

const FOCUSABLE = 'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])';

export class UI {
  /** @type {{ el: HTMLElement, returnFocus: Element|null, onClose?: () => void }[]} */
  #stack = [];

  constructor({ orbit }) {
    this.orbit = orbit;
    this.gallery = $('gallery');
    this.lightbox = $('lightbox');
    this.orbitEl = $('orbit');
    this.lb = { items: [], index: 0 };

    for (const el of [this.gallery, this.lightbox, this.orbitEl]) {
      el.addEventListener('click', (e) => {
        // click on the dim backdrop or a close button
        if (e.target === el || e.target.closest('[data-close]')) this.closeTop();
      });
    }
    $('lb-prev').addEventListener('click', () => this.#step(-1));
    $('lb-next').addEventListener('click', () => this.#step(1));

    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        this.closeTop();
      } else if (e.code === 'Tab') {
        this.#trapFocus(e);
      } else if (this.top?.el === this.lightbox) {
        if (e.code === 'ArrowLeft') this.#step(-1);
        if (e.code === 'ArrowRight') this.#step(1);
      }
    });
  }

  get isOpen() {
    return this.#stack.length > 0;
  }
  get top() {
    return this.#stack.at(-1);
  }

  closeTop() {
    const entry = this.#stack.pop();
    if (!entry) return;
    entry.el.hidden = true;
    if (entry.el === this.orbitEl) this.orbit.hide();
    if (entry.el === this.lightbox) $('lightbox-img').removeAttribute('src');
    entry.onClose?.();
    if (entry.returnFocus instanceof HTMLElement && entry.returnFocus.isConnected) entry.returnFocus.focus();
  }

  closeAll() {
    while (this.isOpen) this.closeTop();
  }

  #open(el, { onClose, focus } = {}) {
    this.#stack.push({ el, returnFocus: document.activeElement, onClose });
    el.hidden = false;
    (focus ?? el.querySelector('[data-close]'))?.focus({ preventScroll: true });
  }

  #trapFocus(e) {
    const nodes = [...this.top.el.querySelectorAll(FOCUSABLE)].filter((n) => !n.closest('[hidden]'));
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes.at(-1);
    if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
    else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
  }

  /** @param box { n, label, name, color, photos[] } */
  openGallery(box, onClose) {
    $('gallery-eyebrow').textContent = `Kotak Kenangan ${box.n}`;
    $('gallery-title').textContent = box.name;
    $('gallery-count').textContent = `${box.photos.length} foto`;
    $('gallery-title').style.color = box.color;

    const grid = $('gallery-grid');
    grid.replaceChildren(
      ...box.photos.map((p, i) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('aria-label', `Buka foto: ${p.title}`);
        const img = new Image();
        img.src = p.thumb;
        img.alt = p.title;
        img.loading = 'lazy';
        img.decoding = 'async';
        btn.append(img);
        btn.addEventListener('click', () => this.openLightbox(box.photos, i));
        li.append(btn);
        return li;
      }),
    );
    grid.scrollTop = 0;
    this.#open(this.gallery, { onClose, focus: grid.querySelector('button') });
  }

  /** @param items { full, title, note }[] */
  openLightbox(items, index = 0, onClose) {
    this.lb = { items, index };
    this.#renderLightbox();
    const multi = items.length > 1;
    $('lb-prev').hidden = $('lb-next').hidden = !multi;
    this.#open(this.lightbox, { onClose });
  }

  #step(d) {
    const { items, index } = this.lb;
    if (items.length < 2) return;
    this.lb.index = (index + d + items.length) % items.length;
    this.#renderLightbox();
  }

  #renderLightbox() {
    const { items, index } = this.lb;
    const p = items[index];
    const img = $('lightbox-img');
    img.src = p.full;
    img.alt = p.title;
    $('lightbox-title').textContent = p.title;
    $('lightbox-note').textContent = p.note ?? '';
    $('lightbox-pos').textContent = items.length > 1 ? `${index + 1} / ${items.length}` : '';
    // warm the neighbours
    for (const n of [items[(index + 1) % items.length], items[(index - 1 + items.length) % items.length]]) {
      if (n && n !== p) new Image().src = n.full;
    }
  }

  openOrbit(title, mesh, onClose) {
    $('orbit-title').textContent = title;
    this.#open(this.orbitEl, { onClose });
    this.orbit.show(mesh);
  }
}
