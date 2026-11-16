import type { Parameter } from '../types';

/** Tiny expression language for dimensions: numbers, parameters, + - * / and parentheses.
 *  Units suffixes (mm) are tolerated and ignored — every value in the document is millimetres.
 */

type Token = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j += 1;
      const raw = src.slice(i, j);
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`"${raw}" is not a number`);
      out.push({ t: 'num', v: value });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j += 1;
      const name = src.slice(i, j);
      i = j;
      if (name === 'mm' || name === 'cm' || name === 'in' || name === 'deg') continue;
      out.push({ t: 'id', v: name });
      continue;
    }
    if ('+-*/()'.includes(ch)) {
      out.push({ t: 'op', v: ch });
      i += 1;
      continue;
    }
    throw new Error(`Unexpected character "${ch}"`);
  }
  return out;
}

/** Evaluate an expression. `lookup` resolves identifiers (parameters). */
export function evaluate(expr: string, lookup: (name: string) => number): number {
  const tokens = tokenize(expr);
  let pos = 0;

  const peek = () => tokens[pos];
  const eat = (op: string) => {
    const tk = tokens[pos];
    if (tk && tk.t === 'op' && tk.v === op) {
      pos += 1;
      return true;
    }
    return false;
  };

  const parseFactor = (): number => {
    const tk = tokens[pos];
    if (!tk) throw new Error('Incomplete expression');
    if (tk.t === 'num') {
      pos += 1;
      return tk.v;
    }
    if (tk.t === 'id') {
      pos += 1;
      return lookup(tk.v);
    }
    if (tk.t === 'op' && tk.v === '-') {
      pos += 1;
      return -parseFactor();
    }
    if (tk.t === 'op' && tk.v === '+') {
      pos += 1;
      return parseFactor();
    }
    if (tk.t === 'op' && tk.v === '(') {
      pos += 1;
      const v = parseExpr();
      if (!eat(')')) throw new Error('Missing ")"');
      return v;
    }
    throw new Error(`Unexpected "${tk.v}"`);
  };

  const parseTerm = (): number => {
    let v = parseFactor();
    for (;;) {
      if (eat('*')) v *= parseFactor();
      else if (eat('/')) {
        const d = parseFactor();
        if (Math.abs(d) < 1e-12) throw new Error('Division by zero');
        v /= d;
      } else return v;
    }
  };

  const parseExpr = (): number => {
    let v = parseTerm();
    for (;;) {
      if (eat('+')) v += parseTerm();
      else if (eat('-')) v -= parseTerm();
      else return v;
    }
  };

  const value = parseExpr();
  if (pos !== tokens.length) {
    const tk = peek();
    throw new Error(`Unexpected "${tk ? tk.v : ''}"`);
  }
  if (!Number.isFinite(value)) throw new Error('Result is not a finite number');
  return value;
}

/** Resolve every parameter, following references between parameters. */
export function parameterValues(params: Parameter[]): {
  values: Record<string, number>;
  errors: Record<string, string>;
} {
  const values: Record<string, number> = {};
  const errors: Record<string, string> = {};
  const visiting = new Set<string>();

  const resolve = (name: string): number => {
    if (name in values) return values[name];
    const param = params.find((p) => p.name === name);
    if (!param) throw new Error(`Unknown parameter "${name}"`);
    if (visiting.has(name)) throw new Error(`Circular reference through "${name}"`);
    visiting.add(name);
    try {
      const value = evaluate(param.expression, resolve);
      values[name] = value;
      return value;
    } finally {
      visiting.delete(name);
    }
  };

  for (const param of params) {
    try {
      resolve(param.name);
    } catch (err) {
      errors[param.id] = (err as Error).message;
    }
  }

  return { values, errors };
}
