import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from './format';

describe('formatRelativeTime', () => {
  it('returns "just now" for dates less than a minute ago', () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toBe('just now');

    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
    expect(formatRelativeTime(thirtySecondsAgo)).toBe('just now');
  });

  it('returns minutes ago for dates within the last hour', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    expect(formatRelativeTime(thirtyMinutesAgo)).toBe('30m ago');
  });

  it('returns hours ago for dates within the last day', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');

    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000);
    expect(formatRelativeTime(twentyThreeHoursAgo)).toBe('23h ago');
  });

  it('returns days ago for dates older than a day', () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(oneDayAgo)).toBe('1d ago');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(sevenDaysAgo)).toBe('7d ago');
  });

  it('returns exactly 1m ago at the 1 minute boundary', () => {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    expect(formatRelativeTime(oneMinuteAgo)).toBe('1m ago');
  });
});
