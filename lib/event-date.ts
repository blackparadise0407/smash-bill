export function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

export function formatEventDate(eventDate: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${eventDate}T00:00:00Z`));
}

export function isEventExpired(eventDate: string) {
  const now = new Date();
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const eventUtc = new Date(`${eventDate}T00:00:00Z`).getTime();

  return eventUtc < todayUtc;
}
