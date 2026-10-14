# AGENTS.md

Notes for coding agents working on this repo.

## Shape
- Zero dependencies, no build step. Node ≥ 23.6 runs the `.ts` files directly, so use only
  erasable TypeScript: no enums, no parameter properties, no namespaces. Imports keep the
  `.ts` extension.
- `src/index.ts` is the whole library: `toFields` (input → form fields), `packChildren`,
  `parseResult` (result HTML → rows), `simulate` (the HTTP round trip). `src/cli.ts` is a
  thin wrapper.
- Tests: `node --test test/`. They are offline. Run `node src/cli.ts example.json` to
  check against the live site.

## The simulator
- No API. The flow: GET `main.aspx` (session cookie) → GET `DochSchirimYY.aspx` → POST every
  non-button input back with the fields set, plus `…$btnHishuv` → 302 to `Result.aspx` →
  parse the `dgResult` table.
- Field names are `ctl00$ctl00$ContentUsersPage$ChildContent1$<name>`. In a 106 code pair,
  the registered spouse has one code and the spouse the other (see the README table).
- The registered spouse's birth month and year (`ledambzr` / `ledabzr`) are required. Without
  them the server bounces to its error page, which looks like a short `<script>` redirect.
- The children fields are packed digit strings whose format changed in 2017, 2022 and 2024.
  When a new tax year appears, check `setKods260_262_190_291NetoFrom_*` in the site's
  `Scripts/FunctionsJS.js` for the new layout.

## Rules
- **Never commit real people's tax data.** That covers fixtures, examples, test inputs and
  captured responses. Fixtures are hand-written in the site's markup; keep personal inputs
  in `*.local.json`, which is gitignored.
- Keep it small. Model a new 106 field only if it is common; anything else can go through
  `fields`.
