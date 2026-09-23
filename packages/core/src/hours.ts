import type {RestaurantConfig} from './types.ts';

const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const minutes = (value: string) => {
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
};

export function isRestaurantOpen(config: RestaurantConfig, at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone: config.identity.timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(at);
  const day = parts.find(part => part.type === 'weekday')?.value.toLowerCase().slice(0, 3) ?? '';
  const now = Number(parts.find(part => part.type === 'hour')?.value) * 60 + Number(parts.find(part => part.type === 'minute')?.value);
  const slot = config.hours[day];
  if (slot?.open) {
    const from = minutes(slot.from);
    const to = minutes(slot.to);
    if (from === to) return true; // same "from" and "to" (e.g. 00:00-00:00) means open all day
    if (from < to ? now >= from && now < to : now >= from) return true;
  }
  const previous = config.hours[keys[(keys.indexOf(day) + 6) % 7]];
  return Boolean(previous?.open && minutes(previous.from) > minutes(previous.to) && now < minutes(previous.to));
}
