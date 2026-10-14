import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packChildren, parseResult, toFields } from '../src/index.ts';

test('packChildren uses each year format, oldest group first', () => {
  // ages in 2024: 12, 6, 2, 0
  assert.equal(packChildren(2024, [2012, 2018, 2022, 2024]), '000200000101');
  // 2022–23 split 6–12 / 13–17; ages in 2023: 14, 5, 1
  assert.equal(packChildren(2023, [2009, 2018, 2022]), '0001000200');
  // ≤2021: ages 7, 4, 2
  assert.equal(packChildren(2020, [2013, 2016, 2018]), '00010200');
  assert.equal(packChildren(2024, [1990]), '');
});

test('toFields routes children to the allowance recipient', () => {
  const f = toFields({
    year: 2024, withheld: 1, children: [2020],
    registered: { sex: 'male', birth: { month: 1, year: 1985 } },
    spouse: { sex: 'female' },
  });
  assert.equal(f.txt190, '000001000000'); // father, no allowance (age 4)
  assert.equal(f.txt262, '000001000000'); // mother, receives allowance
  assert.equal(f.ledambzr, '01');
});

// Hand-written in the simulator's markup, not captured from it.
const html = `<b>תוצאות
  חישוב המס לשנת -&nbsp;2024&nbsp; סוג חישוב &nbsp;נפרד</b>
<table cellspacing="0" id="dgResult" style="x"><tr><th> בן/בת זוג </th><th> בן זוג רשום </th><th> סך הכל </th><th>מרכיבי החישוב</th></tr>
<tr><td>100,000</td><td>200,000</td><td>300,000</td><td><a href="#">הכנסה חייבת</A></td></tr>
<tr><td>&nbsp;</td><td>&nbsp;</td><td>-1,234&nbsp;&nbsp;</td><td>מס לאחר ניכוי במקור</td></tr></table>`;

test('parseResult reads columns, rows and the balance', () => {
  const r = parseResult(html);
  assert.equal(r.year, 2024);
  assert.equal(r.calcType, 'נפרד');
  assert.deepEqual(r.columns, ['בן/בת זוג', 'בן זוג רשום', 'סך הכל']);
  assert.deepEqual(r.rows[0], { label: 'הכנסה חייבת', values: { 'בן/בת זוג': 100000, 'בן זוג רשום': 200000, 'סך הכל': 300000 } });
  assert.equal(r.balance, -1234);
});
