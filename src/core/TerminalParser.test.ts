import { describe, it, expect } from 'vitest';
import { parseTerminalSequences } from './TerminalParser';

describe('parseTerminalSequences', () => {
  it('passes through regular text', () => {
    const result = parseTerminalSequences('hello world');
    expect(result).toEqual([{ type: 'text', value: 'hello world' }]);
  });

  it('parses Enter key (0x0d)', () => {
    const result = parseTerminalSequences('\x0d');
    expect(result).toEqual([{ type: 'key', value: 'Enter' }]);
  });

  it('parses Backspace (0x7f)', () => {
    const result = parseTerminalSequences('\x7f');
    expect(result).toEqual([{ type: 'key', value: 'BSpace' }]);
  });

  it('parses Ctrl+C (0x03)', () => {
    const result = parseTerminalSequences('\x03');
    expect(result).toEqual([{ type: 'key', value: 'C-c' }]);
  });

  it('parses Tab (0x09)', () => {
    const result = parseTerminalSequences('\x09');
    expect(result).toEqual([{ type: 'key', value: 'Tab' }]);
  });

  it('parses arrow key Up (ESC [ A)', () => {
    const result = parseTerminalSequences('\x1b[A');
    expect(result).toEqual([{ type: 'key', value: 'Up' }]);
  });

  it('parses arrow key Down (ESC [ B)', () => {
    const result = parseTerminalSequences('\x1b[B');
    expect(result).toEqual([{ type: 'key', value: 'Down' }]);
  });

  it('parses arrow key Right (ESC [ C)', () => {
    const result = parseTerminalSequences('\x1b[C');
    expect(result).toEqual([{ type: 'key', value: 'Right' }]);
  });

  it('parses arrow key Left (ESC [ D)', () => {
    const result = parseTerminalSequences('\x1b[D');
    expect(result).toEqual([{ type: 'key', value: 'Left' }]);
  });

  it('parses mixed text and special keys', () => {
    const result = parseTerminalSequences('hello\x0dworld\x7f');
    expect(result).toEqual([
      { type: 'text', value: 'hello' },
      { type: 'key', value: 'Enter' },
      { type: 'text', value: 'world' },
      { type: 'key', value: 'BSpace' },
    ]);
  });

  it('parses SS3 function keys (ESC O P/Q/R/S)', () => {
    expect(parseTerminalSequences('\x1bOP')).toEqual([{ type: 'key', value: 'F1' }]);
    expect(parseTerminalSequences('\x1bOQ')).toEqual([{ type: 'key', value: 'F2' }]);
    expect(parseTerminalSequences('\x1bOR')).toEqual([{ type: 'key', value: 'F3' }]);
    expect(parseTerminalSequences('\x1bOS')).toEqual([{ type: 'key', value: 'F4' }]);
  });

  it('returns empty array for empty string', () => {
    const result = parseTerminalSequences('');
    expect(result).toEqual([]);
  });
});
