#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { simulate, type Input } from './index.ts';

const { values, positionals: [file] } = parseArgs({
  allowPositionals: true,
  options: { help: { type: 'boolean', short: 'h' } },
});
if (values.help || !file) {
  console.error('usage: il-tax-sim <input.json>');
  process.exit(values.help ? 0 : 1);
}
const input: Input = JSON.parse(readFileSync(file, 'utf8'));
const r = await simulate(input);
console.log(`${r.year} — ${r.calcType}`);
console.table(Object.fromEntries(r.rows.map((row) => [row.label, row.values])));
console.log(r.balance < 0 ? `Refund: ${-r.balance}` : r.balance > 0 ? `To pay: ${r.balance}` : 'Balanced');
