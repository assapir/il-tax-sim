# il-tax-sim

A client for the Israel Tax Authority's **annual tax simulator for employees**
(סימולטור לחישוב מס הכנסה שנתי לשכירים,
[secapp.taxes.gov.il/shSimulatorMas](https://secapp.taxes.gov.il/shSimulatorMas/main.aspx)).

The simulator has no API. It is an old ASP.NET form, so this library fetches the
year's form, posts it back with your figures, and parses the result table. No login,
no browser, no dependencies.

It is useful for checking whether a year is worth a refund request
([טופס 135](https://www.gov.il/he/service/itc135)) before you file one. Filing opens the
whole year to assessment, so a year that was under-withheld becomes a bill.

> Unofficial. The result comes from the Tax Authority's own calculator, but the
> simulator itself says it is not binding. If the form changes, this breaks.

## Use

Requires Node ≥ 23.6, which runs TypeScript directly.

```sh
node src/cli.ts example.json
```

Prints the simulator's breakdown for each spouse (taxable income, gross tax, every credit,
tax withheld) and the bottom line, for example `Refund: 30218`.

As a library:

```ts
import { simulate } from './src/index.ts';

const r = await simulate({
  year: 2024,
  withheld: 120000,             // total income tax withheld, both spouses (Form 106 field 042)
  children: [2012, 2018, 2022], // birth years
  registered: { sex: 'male', birth: { month: 1, year: 1985 }, income: 480000 },
  spouse: { sex: 'female', income: 210000 },
});
r.balance; // negative = refund
```

## Input

Each `Person` takes figures straight from their Form 106. The codes are for the
registered spouse (בן זוג רשום) and then the spouse:

| Field | 106 code |
|---|---|
| `income` | 158 / 172 |
| `insuredIncome` | 244 / 245 |
| `employerPensionDeposits` | 248 / 249 |
| `pensionDeposits` (35 % credit) | 045 / 086 |
| `taxableSeverance` | 258 / 272 |
| `lifeInsurance` | 036 / 081 |
| `donations` | 037 / 237 |
| `disabledChildren` (section 45, including a special-education personal basket) | 023 / 131 |

- `birth` is **required for the registered spouse**. Without it the server throws an error.
- With several employers in a year, add their 106s together.
- `receivesChildAllowance` defaults to the woman and decides which child-credit field the
  children go in.
- `fields` passes any other form field by name (for example `{ txt060: '1000' }`) for
  anything not modelled here.
- Supported years are whatever the simulator offers (2020–2025 as of October 2026).

## How it works

- The year page is `DochSchirimYY.aspx`. It needs the session cookie from `main.aspx`
  first, and a successful post redirects to `Result.aspx`.
- The per-age children boxes on the page are display only and the server ignores them. It
  reads a packed string of two-digit counts per age group (see `packChildren`). Send just a
  count and every child is credited as 2.5 points.

```sh
node --test test/
```

## License

MIT
