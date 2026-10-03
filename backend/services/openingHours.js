const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
function validateHours(hours, timezone) {
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
function openingStatus(pharmacy, now = new Date()) {
  let hours;
  try { hours = validateHours(pharmacy.openingHours, pharmacy.timezone || "Asia/Colombo"); }
  catch { return { isOpen: null, openStatus: "Hours unavailable", open24Hours: false, hoursToday: "Hours unavailable" }; }
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: pharmacy.timezone || "Asia/Colombo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map(p => [p.type, p.value]));
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  const current = Number(parts.hour) * 60 + Number(parts.minute);
  const today = hours.find(h => h.day === day), previous = hours.find(h => h.day === (day + 6) % 7);
  const overnight = h => !h.closed && !h.allDay && minutes(h.open) > minutes(h.close);
  const isOpen = (!today.closed && (today.allDay || (overnight(today) ? current >= minutes(today.open) : current >= minutes(today.open) && current < minutes(today.close)))) || (overnight(previous) && current < minutes(previous.close));
  return { isOpen, openStatus: isOpen ? "Open" : "Closed", open24Hours: hours.every(h => h.allDay && !h.closed), hoursToday: today.closed ? "Closed today" : today.allDay ? "24 hours today" : `${today.open}–${today.close}${overnight(today) ? " (next day)" : ""}` };
}
module.exports = { validateHours, openingStatus };
