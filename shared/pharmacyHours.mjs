const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export function validateHours(hours, timezone) {
  if (typeof timezone !== "string" || timezone.length > 100) throw new Error("Invalid timezone");
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(); }
  catch { throw new Error("Invalid timezone"); }
  if (!Array.isArray(hours) || hours.length !== 7 || new Set(hours.map(h => h.day)).size !== 7) throw new Error("Provide seven unique days (Sunday=0)");
  return hours.map(h => {
    if (!Number.isInteger(h.day) || h.day < 0 || h.day > 6 || typeof h.closed !== "boolean" || typeof h.allDay !== "boolean" || (h.closed && h.allDay)) throw new Error("Invalid opening day");
    if (!h.closed && !h.allDay && (typeof h.open !== "string" || typeof h.close !== "string" || !timePattern.test(h.open) || !timePattern.test(h.close) || h.open === h.close)) throw new Error("Use valid, unequal HH:mm opening and closing times");
    return { day: h.day, closed: h.closed, allDay: h.allDay, ...(!h.closed && !h.allDay ? { open: h.open, close: h.close } : {}) };
  });
}
export function openingStatus(pharmacy, now = new Date()) {
  let hours;
  try { hours = validateHours(pharmacy.openingHours, pharmacy.timezone || "Asia/Colombo"); }
  catch { return { isOpen: null, openStatus: "Hours unavailable", open24Hours: false, hoursToday: "Hours unavailable", timingText: "" }; }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return { isOpen: null, openStatus: "Hours unavailable", open24Hours: false, hoursToday: "Hours unavailable", timingText: "" };
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: pharmacy.timezone || "Asia/Colombo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map(p => [p.type, p.value]));
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  const current = Number(parts.hour) * 60 + Number(parts.minute);
  const today = hours.find(h => h.day === day), previous = hours.find(h => h.day === (day + 6) % 7);
  const overnight = h => !h.closed && !h.allDay && minutes(h.open) > minutes(h.close);
  const isOpen = (!today.closed && (today.allDay || (overnight(today) ? current >= minutes(today.open) : current >= minutes(today.open) && current < minutes(today.close)))) || (overnight(previous) && current < minutes(previous.close));
  const open24Hours = hours.every(h => h.allDay && !h.closed);
  return { timingText: timingForHours(hours, day, current, isOpen, open24Hours), isOpen, openStatus: isOpen ? "Open" : "Closed", open24Hours, hoursToday: today.closed ? "Closed today" : today.allDay ? "24 hours today" : `${today.open}–${today.close}${overnight(today) ? " (next day)" : ""}` };
}


const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function clockLabel(value) {
  const minute = ((value % 1440) + 1440) % 1440;
  const hour = Math.floor(minute / 60);
  return `${hour % 12 || 12}:${String(minute % 60).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}
function timingForHours(hours, day, current, isOpen, allWeek) {
  if (allWeek) return '';
  // Previous day includes an overnight carry; one full week ahead bounds the search.
  const intervals = [];
  for (let offset = -1; offset <= 7; offset++) {
    const h = hours.find(value => value.day === (day + offset + 7) % 7);
    if (h.closed) continue;
    const start = offset * 1440 + (h.allDay ? 0 : minutes(h.open));
    const end = offset * 1440 + (h.allDay ? 1440 : minutes(h.close) + (minutes(h.close) < minutes(h.open) ? 1440 : 0));
    intervals.push({ start, end });
  }
  intervals.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const period of intervals) {
    const last = merged.at(-1);
    if (last && period.start <= last.end) last.end = Math.max(last.end, period.end);
    else merged.push({ ...period });
  }
  if (isOpen) {
    const active = merged.find(period => period.start <= current && current < period.end);
    if (!active) return '';
    const remaining = active.end - current;
    if (remaining < 120) {
      const hour = Math.floor(remaining / 60), minute = remaining % 60;
      return `Closes in ${hour ? `${hour} hr${minute ? ` ${minute} min` : ''}` : `${minute} min`}`;
    }
    const offset = Math.floor(active.end / 1440);
    // Overnight shifts closing next morning retain the familiar "Closes at" label.
    const when = offset > 1 ? ` ${weekdays[(day + offset) % 7]}` : '';
    return `Closes${when} at ${clockLabel(active.end)}`;
  }
  const next = merged.find(period => period.start > current);
  if (!next) return '';
  const offset = Math.floor(next.start / 1440);
  const when = offset === 0 ? '' : offset === 1 ? ' tomorrow' : ` ${weekdays[(day + offset) % 7]}`;
  return `Opens${when} at ${clockLabel(next.start)}`;
}
