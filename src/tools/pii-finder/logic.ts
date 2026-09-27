export type PiiType = 'email' | 'phone' | 'credit-card' | 'ip' | 'ssn';
export interface Finding { type: PiiType; text: string; start: number; end: number }

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

const PATTERNS: { type: PiiType; re: RegExp; extra?: (m: RegExpExecArray) => boolean }[] = [
  { type: 'email', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { type: 'credit-card', re: /\b(?:\d[ -]?){13,19}\b/g, extra: (m) => luhnValid(m[0].replace(/[ -]/g, '')) },
  { type: 'ssn', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: 'ip', re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g },
  { type: 'phone', re: /(?<!\d)(?:\+?\d{1,3}[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}(?!\d)/g },
];

/** Finds candidate PII. Regex-based detection is inherently imperfect: it can miss unusual formats
 *  and occasionally flags something that isn't PII (e.g. a long non-card reference number). */
export function findPii(text: string): Finding[] {
  const all: Finding[] = [];
  for (const { type, re, extra } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (!extra || extra(m)) all.push({ type, text: m[0], start: m.index, end: m.index + m[0].length });
      if (m[0] === '') re.lastIndex++;
    }
  }
  all.sort((a, b) => a.start - b.start || b.end - a.end);
  // Drop findings fully contained in an earlier (longer) one, e.g. an IP-looking substring inside a phone number.
  const out: Finding[] = [];
  for (const f of all) if (!out.some((o) => f.start >= o.start && f.end <= o.end)) out.push(f);
  return out;
}

export type RedactStyle = 'mask' | 'placeholder';

const LABEL: Record<PiiType, string> = { email: 'EMAIL', phone: 'PHONE', 'credit-card': 'CARD', ip: 'IP', ssn: 'SSN' };

export function redact(text: string, findings: Finding[], style: RedactStyle): string {
  let out = '';
  let last = 0;
  for (const f of [...findings].sort((a, b) => a.start - b.start)) {
    out += text.slice(last, f.start);
    out += style === 'placeholder' ? `[${LABEL[f.type]}]` : '•'.repeat(f.end - f.start);
    last = f.end;
  }
  return out + text.slice(last);
}
