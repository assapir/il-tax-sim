// Client for the Israel Tax Authority's annual tax simulator for employees
// (סימולטור לחישוב מס הכנסה שנתי לשכירים). It is an ASP.NET WebForms page with no API:
// this fetches the year's form, re-posts it with the fields filled in, and parses the
// result table.

const BASE = 'https://secapp.taxes.gov.il/shSimulatorMas/';
const P = 'ctl00$ctl00$ContentUsersPage$ChildContent1$';

export type Person = {
  sex: 'male' | 'female';
  /** Birth month and year. Required for the registered spouse: the server errors without it. */
  birth?: { month: number; year: number };
  /** Salary / work income, Form 106 field 158/172 */
  income?: number;
  /** Insured income for pension, 106 field 244/245 */
  insuredIncome?: number;
  /** Employer pension deposits, 106 field 248/249 */
  employerPensionDeposits?: number;
  /** Employee pension deposits (35% credit), 106 field 045/086 */
  pensionDeposits?: number;
  /** Taxable severance / retirement grants, field 258/272 */
  taxableSeverance?: number;
  /** Life insurance premiums, field 036/081 */
  lifeInsurance?: number;
  /** Donations to approved institutions, field 037/237 */
  donations?: number;
  /** Children entitling the section 45 credit (disabled / special-education), field 023/131 */
  disabledChildren?: number;
  /** Who gets child allowance from Bituach Leumi. Defaults to the woman. */
  receivesChildAllowance?: boolean;
};

export type Input = {
  year: number;
  registered: Person;
  spouse?: Person;
  /** Total income tax withheld at source, both spouses (field 042) */
  withheld: number;
  /** Birth year of each child */
  children?: number[];
  /** Raw form fields by name suffix (e.g. { txt060: '1000' }) for anything not modelled above */
  fields?: Record<string, string>;
};

export type Row = { label: string; values: Record<string, number | null> };
export type Result = {
  year: number;
  calcType: string;
  columns: string[];
  rows: Row[];
  /** Tax after withholding, total column. Negative = refund. */
  balance: number;
};

// [registered, spouse] form field per Person key
const CODES: Record<string, [string, string]> = {
  income: ['txt158', 'txt172'],
  insuredIncome: ['txt244', 'txt245'],
  employerPensionDeposits: ['txt248', 'txt249'],
  pensionDeposits: ['txt045', 'txt086'],
  taxableSeverance: ['txt258', 'txt272'],
  lifeInsurance: ['txt036', 'txt081'],
  donations: ['txt037', 'txt237'],
  disabledChildren: ['txt023', 'txt131'],
};

/**
 * The children fields are packed strings of two-digit counts per age group, oldest first.
 * The per-age boxes on the page are display only; the server reads these.
 */
export function packChildren(year: number, birthYears: number[]): string {
  const groups: [number, number][] =
    year >= 2024 ? [[18, 18], [6, 17], [4, 5], [3, 3], [1, 2], [0, 0]]
    : year >= 2022 ? [[18, 18], [13, 17], [6, 12], [1, 5], [0, 0]]
    : [[18, 18], [6, 17], [1, 5], [0, 0]];
  const ages = birthYears.map((b) => year - b);
  const packed = groups
    .map(([lo, hi]) => String(ages.filter((a) => a >= lo && a <= hi).length).padStart(2, '0'))
    .join('');
  return /^0+$/.test(packed) ? '' : packed;
}

export function toFields(input: Input): Record<string, string> {
  const f: Record<string, string> = {
    mish: input.spouse ? 'nasui' : 'ravak',
    sex: input.registered.sex,
    chk020: 'on',
    txt042: String(input.withheld),
  };
  const people: [Person | undefined, 0 | 1][] = [[input.registered, 0], [input.spouse, 1]];
  for (const [p, i] of people) {
    if (!p) continue;
    if (p.birth) {
      const sfx = i === 0 ? 'bzr' : 'bz';
      f['ledam' + sfx] = String(p.birth.month).padStart(2, '0');
      f['leda' + sfx] = String(p.birth.year);
    }
    for (const [key, codes] of Object.entries(CODES)) {
      const v = p[key as keyof Person];
      if (typeof v === 'number') f[codes[i]] = String(v);
    }
    if (input.children?.length) {
      const allowance = p.receivesChildAllowance ?? p.sex === 'female';
      const code = i === 0 ? (allowance ? 'txt260' : 'txt190') : (allowance ? 'txt262' : 'txt291');
      const packed = packChildren(input.year, input.children);
      if (packed) f[code] = packed;
    }
  }
  if (input.spouse) {
    f.sexbz = input.spouse.sex;
    f.chk021 = 'on';
  }
  return { ...f, ...input.fields };
}

const decode = (s: string) =>
  s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

export function parseResult(html: string): Result {
  const err = html.match(/id="hidErrMsg"[^>]*value="([^"]+)"/);
  if (err) throw new Error(`Simulator error: ${decode(err[1])}`);
  const head = html.match(/<b>(תוצאות[\s\S]*?)<\/b>/);
  const table = html.match(/<table[^>]*id="dgResult"[^>]*>([\s\S]*?)<\/table>/);
  if (!head || !table) throw new Error('No result table in response — the form was probably rejected');
  const [, year, calcType] = decode(head[1]).match(/(\d{4})\s*סוג חישוב\s*(.*)/) ?? [];
  const columns = [...table[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => decode(m[1])).slice(0, -1);
  const rows: Row[] = [...table[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map((tr) => [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => decode(m[1])))
    .filter((cells) => cells.length === columns.length + 1)
    .map((cells) => ({
      label: cells.at(-1)!,
      values: Object.fromEntries(columns.map((c, i) => [c, cells[i] ? Number(cells[i].replace(/,/g, '')) : null])),
    }));
  const last = rows.find((r) => r.label.includes('מס לאחר ניכוי במקור'));
  return {
    year: Number(year),
    calcType: calcType ?? '',
    columns,
    rows,
    balance: last?.values[columns.at(-1)!] ?? 0,
  };
}

// Minimal cookie-carrying GET/POST; the year pages redirect to main.aspx without a session.
async function request(jar: Map<string, string>, url: string, body?: URLSearchParams): Promise<string> {
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      body,
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0', Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') },
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      jar.set(kv.slice(0, i), kv.slice(i + 1));
    }
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      const next = new URL(loc, url).href;
      if (next.endsWith('main.aspx')) throw new Error(`Redirected to ${next} — unsupported year or session lost`);
      url = next;
      body = undefined; // POST → 302 → GET Result.aspx
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    return res.text();
  }
  throw new Error('Too many redirects');
}

export async function simulate(input: Input): Promise<Result> {
  const jar = new Map<string, string>();
  await request(jar, BASE + 'main.aspx');
  const url = `${BASE}DochSchirim${String(input.year % 100).padStart(2, '0')}.aspx`;
  const page = await request(jar, url);
  const form = new URLSearchParams();
  for (const [tag] of page.matchAll(/<input[^>]*>/g)) {
    const name = tag.match(/name="([^"]+)"/)?.[1];
    const type = tag.match(/type="([^"]+)"/)?.[1] ?? 'text';
    if (!name || ['submit', 'button', 'radio', 'checkbox', 'image'].includes(type)) continue;
    form.set(decode(name), decode(tag.match(/value="([^"]*)"/)?.[1] ?? ''));
  }
  for (const [k, v] of Object.entries(toFields(input))) form.set(P + k, v);
  form.set(P + 'btnHishuv', '');
  return parseResult(await request(jar, url, form));
}
