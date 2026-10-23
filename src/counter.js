/**
 * Real-time aesthetic Visitor Counter widget for Freya's Room.
 * Uses a resilient strategy:
 * 1. Queries live global hit badge from komarev / serverless endpoint.
 * 2. Seamlessly falls back to localStorage with baseline 1,428 visits.
 * 3. Animates number roll-up with Indonesian locale formatting.
 */
export class VisitorCounter {
  constructor({ counterEl, badgeEl } = {}) {
    this.counterEl = counterEl ?? document.getElementById('visitor-count');
    this.badgeEl = badgeEl ?? document.getElementById('visitor-counter');
    this.storageKey = 'freya_room_visitor_count';
    this.sessionKey = 'freya_room_session_visited';
    this.fallbackBase = 1428;
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
    // 1. Local baseline
    let stored = parseInt(localStorage.getItem(this.storageKey) || '0', 10);
    if (!stored || stored < this.fallbackBase) {
      stored = this.fallbackBase;
    }

    // Increment once per browser session
    const hasVisitedThisSession = sessionStorage.getItem(this.sessionKey);
    if (!hasVisitedThisSession) {
      sessionStorage.setItem(this.sessionKey, '1');
      stored += 1;
      localStorage.setItem(this.storageKey, String(stored));
    }

    // 2. Attempt remote live hit counter
    try {
      const res = await fetch('https://komarev.com/ghpvc/?username=djtgallery3-stack-freyaroom&style=flat', {
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const text = await res.text();
        const matches = [...text.matchAll(/<text[^>]*>([0-9]+)<\/text>/g)];
        if (matches.length > 0) {
          const remoteCount = parseInt(matches[matches.length - 1][1], 10);
          if (!isNaN(remoteCount)) {
            const finalCount = this.fallbackBase + remoteCount;
            localStorage.setItem(this.storageKey, String(finalCount));
            return finalCount;
          }
        }
      }
    } catch {
      // Offline / blocked by adblock: keep stored fallback count
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
