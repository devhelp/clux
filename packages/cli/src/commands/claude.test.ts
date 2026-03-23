import { describe, it, expect } from 'vitest';
import { shortenPath, buildSessionName } from './claude';

describe('shortenPath', () => {
  it('keeps paths with 1 segment as-is', () => {
    expect(shortenPath('/home')).toBe('home');
  });

  it('keeps paths with 2 segments joined by dash', () => {
    expect(shortenPath('/home/user')).toBe('home-user');
  });

  it('shortens earlier segments to first letter, keeps last two', () => {
    expect(shortenPath('/home/user/projects/clux')).toBe('h-u-projects-clux');
  });

  it('handles deeply nested paths', () => {
    expect(shortenPath('/home/user/projects/clux/foo/bar')).toBe('h-u-p-c-foo-bar');
  });

  it('handles 3 segments', () => {
    expect(shortenPath('/home/user/projects')).toBe('h-user-projects');
  });

  it('handles trailing slashes', () => {
    expect(shortenPath('/home/user/projects/clux/')).toBe('h-u-projects-clux');
  });
});

describe('buildSessionName', () => {
  it('uses provided name when given', () => {
    expect(buildSessionName('my-session', '/home/user/projects')).toBe('my-session');
  });

  it('generates name from path when no name provided', () => {
    expect(buildSessionName(undefined, '/home/user/projects/clux')).toBe(
      'claude_h-u-projects-clux',
    );
  });

  it('generates name for short paths', () => {
    expect(buildSessionName(undefined, '/home/user')).toBe('claude_home-user');
  });

  it('generates name for deeply nested paths', () => {
    expect(buildSessionName(undefined, '/home/tmolenda/projects/bundesdruckerei/certs')).toBe(
      'claude_h-t-p-bundesdruckerei-certs',
    );
  });
});
