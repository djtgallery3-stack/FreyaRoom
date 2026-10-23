/**
 * Real-time aesthetic Visitor Counter widget for Freya's Room.
 * Uses a resilient multi-tier strategy:
 * 1. Checks and increments local baseline.
 * 2. Fetches real-time global counter from /api/counter (hits.sh / laobi backends).
 * 3. Never decreases (strictly monotonic: Math.max(local, remote)).
 * 4. Animates number roll-up with Indonesian locale formatting.
 */
export class VisitorCounter {
  constructor({ counterEl, badgeEl } = {}) {
    this.counterEl = counterEl ?? document.getElementById('visitor-count');
    this.badgeEl = badgeEl ?? document.getElementById('visitor-counter');
    this.storageKey = 'freya_room_visitor_count_v3';
    this.sessionKey = 'freya_room_session_visited_v3';
    this.fallbackBase = 1;
  }

  async init() {
    if (this.badgeEl) {
      this.badgeEl.classList.remove('hidden');
      this.badgeEl.classList.add('flex');
    }

    const count = await this.#fetchAndIncrement();
    this.#animateCount(count);
    return count;
  }

  async #fetchAndIncrement() {
    // 1. Read existing local storage count & increment
    let localStored = parseInt(localStorage.getItem(this.storageKey) || '0', 10);
    if (!localStored || isNaN(localStored)) {
      localStored = 1;
    } else {
      localStored += 1;
    }
    localStorage.setItem(this.storageKey, String(localStored));

    // 2. Query remote global live counter API (serverless endpoint)
    try {
      const res = await fetch('/api/counter', {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.visitors === 'number' && data.visitors > 0) {
          const finalCount = Math.max(localStored, data.visitors);
          localStorage.setItem(this.storageKey, String(finalCount));
          return finalCount;
        }
      }
    } catch {
      // Serverless endpoint unavailable (e.g. offline or local preview)
    }

    // 3. Direct client-side hit check fallback
    try {
      const resDirect = await fetch('https://hits.sh/djtgallery3-freya-room.vercel.app.svg', {
        signal: AbortSignal.timeout(3000),
      });
      if (resDirect.ok) {
        const text = await resDirect.text();
        const match = text.match(/hits:\s*([0-9]+)/i);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > 0) {
            const finalCount = Math.max(localStored, num);
            localStorage.setItem(this.storageKey, String(finalCount));
            return finalCount;
          }
        }
      }
    } catch {
      // offline / blocked
    }

    return localStored;
  }

  #animateCount(target) {
    if (!this.counterEl) return;
    const start = Math.max(1, target - 12);
    const duration = 500; // ms
    const startTime = performance.now();

    const update = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = Math.round(start + (target - start) * ease);
      this.counterEl.textContent = current.toLocaleString('id-ID');
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        this.counterEl.textContent = target.toLocaleString('id-ID');
      }
    };
    this.counterEl.textContent = start.toLocaleString('id-ID');
    requestAnimationFrame(update);
  }
}
