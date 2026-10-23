/**
 * Real-time aesthetic Visitor Counter widget for Freya's Room.
 * Uses a resilient strategy:
 * 1. Queries live global hit badge from komarev / serverless endpoint.
 * 2. Seamlessly falls back to localStorage with baseline 1 visit.
 * 3. Animates number roll-up with Indonesian locale formatting.
 */
export class VisitorCounter {
  constructor({ counterEl, badgeEl } = {}) {
    this.counterEl = counterEl ?? document.getElementById('visitor-count');
    this.badgeEl = badgeEl ?? document.getElementById('visitor-counter');
    this.storageKey = 'freya_room_visitor_count_v2';
    this.sessionKey = 'freya_room_session_visited_v2';
    this.fallbackBase = 1;
  }

  async init() {
    if (this.badgeEl) {
      this.badgeEl.classList.remove('hidden');
      this.badgeEl.classList.add('flex');
    }

    const count = await this.#fetchAndIncrement();
    this.#animateCount(count);
  }

  async #fetchAndIncrement() {
    // 1. Local baseline starting purely from 1
    let stored = parseInt(localStorage.getItem(this.storageKey) || '0', 10);
    if (!stored || stored < this.fallbackBase) {
      stored = this.fallbackBase;
    }

    // Increment once per browser session
    const hasVisitedThisSession = sessionStorage.getItem(this.sessionKey);
    if (!hasVisitedThisSession) {
      sessionStorage.setItem(this.sessionKey, '1');
      if (!localStorage.getItem(this.storageKey)) {
        stored = 1;
      } else {
        stored += 1;
      }
      localStorage.setItem(this.storageKey, String(stored));
    }

    // 2. Attempt remote live hit counter / API
    try {
      const res = await fetch('/api/counter', {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.visitors === 'number' && data.visitors >= 1) {
          localStorage.setItem(this.storageKey, String(data.visitors));
          return data.visitors;
        }
      }
    } catch {
      // Offline / serverless unavailable: use stored count
    }

    return stored;
  }

  #animateCount(target) {
    if (!this.counterEl) return;
    const start = Math.max(0, target - 24);
    const duration = 900; // ms
    const startTime = performance.now();

    const update = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = Math.round(start + (target - start) * ease);
      this.counterEl.textContent = current.toLocaleString('id-ID');
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }
}
