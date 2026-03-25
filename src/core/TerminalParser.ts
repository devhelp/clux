export interface TerminalSequence {
  type: 'key' | 'text';
  value: string;
}

const CSI_KEY_MAP: Record<string, string> = {
  A: 'Up',
  B: 'Down',
  C: 'Right',
  D: 'Left',
  H: 'Home',
  F: 'End',
  '2~': 'Insert',
  '3~': 'DC',
  '5~': 'PageUp',
  '6~': 'PageDown',
  '1;5A': 'C-Up',
  '1;5B': 'C-Down',
  '1;5C': 'C-Right',
  '1;5D': 'C-Left',
  '1;3A': 'M-Up',
  '1;3B': 'M-Down',
  '1;3C': 'M-Right',
  '1;3D': 'M-Left',
  '1;2A': 'S-Up',
  '1;2B': 'S-Down',
  '1;2C': 'S-Right',
  '1;2D': 'S-Left',
  Z: 'BTab',
};

const SS3_KEY_MAP: Record<string, string> = {
  P: 'F1',
  Q: 'F2',
  R: 'F3',
  S: 'F4',
  H: 'Home',
  F: 'End',
};

const CTRL_KEY_MAP: Record<number, string> = {
  0x00: 'C-Space',
  0x01: 'C-a',
  0x02: 'C-b',
  0x03: 'C-c',
  0x04: 'C-d',
  0x05: 'C-e',
  0x06: 'C-f',
  0x07: 'C-g',
  0x08: 'BSpace',
  0x09: 'Tab',
  0x0a: 'Enter',
  0x0b: 'C-k',
  0x0c: 'C-l',
  0x0d: 'Enter',
  0x0e: 'C-n',
  0x0f: 'C-o',
  0x10: 'C-p',
  0x11: 'C-q',
  0x12: 'C-r',
  0x13: 'C-s',
  0x14: 'C-t',
  0x15: 'C-u',
  0x16: 'C-v',
  0x17: 'C-w',
  0x18: 'C-x',
  0x19: 'C-y',
  0x1a: 'C-z',
  0x7f: 'BSpace',
};

export function parseTerminalSequences(data: string): TerminalSequence[] {
  const results: TerminalSequence[] = [];
  let textBuf = '';
  let i = 0;

  const flushText = () => {
    if (textBuf) {
      results.push({ type: 'text', value: textBuf });
      textBuf = '';
    }
  };

  while (i < data.length) {
    const ch = data.charCodeAt(i);

    if (ch === 0x1b && i + 1 < data.length) {
      flushText();

      if (data[i + 1] === '[') {
        let j = i + 2;
        while (j < data.length && data.charCodeAt(j) >= 0x20 && data.charCodeAt(j) <= 0x3f) j++;
        const finalByte = j < data.length ? data[j] : '';
        const params = data.slice(i + 2, j);
        const full = params + finalByte;

        if (CSI_KEY_MAP[full]) {
          results.push({ type: 'key', value: CSI_KEY_MAP[full] });
        } else {
          results.push({ type: 'text', value: data.slice(i, j + 1) });
        }
        i = j + 1;
        continue;
      }

      if (data[i + 1] === 'O' && i + 2 < data.length) {
        if (SS3_KEY_MAP[data[i + 2]]) {
          results.push({ type: 'key', value: SS3_KEY_MAP[data[i + 2]] });
          i += 3;
          continue;
        }
      }

      results.push({ type: 'key', value: 'Escape' });
      i++;
      continue;
    }

    if (CTRL_KEY_MAP[ch] !== undefined) {
      flushText();
      results.push({ type: 'key', value: CTRL_KEY_MAP[ch] });
      i++;
      continue;
    }

    textBuf += data[i];
    i++;
  }

  flushText();
  return results;
}
