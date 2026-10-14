// One timer for all mounted pharmacy status displays, including saved pharmacy cards.
export function createMinuteClock(timers = globalThis, now = () => Date.now()) {
  const listeners = new Set();
  let timer, timestamp = now();
  return {
    getSnapshot: () => timestamp,
    subscribe(listener) {
      if (!listeners.size) {
        timestamp = now();
        timer = timers.setInterval(() => { timestamp = now(); listeners.forEach(notify => notify()); }, 60000);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) { timers.clearInterval(timer); timer = undefined; }
      };
    },
  };
}
export const pharmacyClock = createMinuteClock();
