import { TIME_CALCULATIONS } from '../../constants';

export function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / TIME_CALCULATIONS.MILLISECONDS_PER_MINUTE);
  const hours = Math.floor(diff / TIME_CALCULATIONS.MILLISECONDS_PER_HOUR);
  const days = Math.floor(diff / TIME_CALCULATIONS.MILLISECONDS_PER_DAY);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}