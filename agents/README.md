# /agents

Node/TypeScript pipeline that drafts a sourced board. It runs locally or on a droplet, never in a Vercel function, and uses the Supabase service-role key, which must never reach `src/` or `dist/` (`npm test` and `npm run check:bundle` enforce this).

Pipeline: scout -> researcher -> claim classifier -> board builder -> validator -> autoOrganize (seeded from the topic) -> private DRAFT board owned by the curator.

- Claims carry a source URL and `retrievedAt` (stamped by code). Verdicts map to the schema status: confirmed=`verified`, alleged=`claim`, disputed=`disputed`, speculative=`speculation`.
- The validator fails on schema errors, dangling ids, unresolvable or unsafe URLs (https only, no private/loopback addresses, DNS and redirects re-checked), ungrounded widgets, and images that are not on an allow-listed host (`upload.wikimedia.org`) with an accepted licence and attribution. News photos are never hotlinked.
- Images need the image URL on `upload.wikimedia.org` and a source on `commons.wikimedia.org` (https, exact host) whose licence is exactly CC0, CC BY, CC BY-SA, public domain or PD (NC/ND and anything else are rejected). The licence is model-asserted and is not re-checked against the Commons page; review images before publishing. An image whose URL does not resolve is dropped with a warning; a dead claim source fails the board.
- `confirmed` becomes `verified` only when the fact is backed by at least two distinct sites (registrable domains: subdomains, `www`, trailing dots and ports collapse; a small built-in list handles `co.uk`-style suffixes). This only proves the URLs are host-distinct and resolve. The content and relevance of the sources are NOT checked, so treat `verified` as "model-classified, human review required". URLs must use the default https port.
- Entity kind `person_of_interest` becomes a `wanted` widget whose description starts with "DRAFT: needs human review before publishing." (the schema has no notes field); other imaged entities become `photo`, `document` becomes `paper`, the rest `note`.

## Isolation

The Agent SDK subprocess receives an explicit minimal env (PATH, HOME, ANTHROPIC_API_KEY, proxy and locale vars), never `SUPABASE_*`. Only WebSearch and WebFetch are available, nothing is pre-approved, and both a `canUseTool` gate and a PreToolUse hook deny WebFetch unless the URL is public https (no localhost, private or metadata addresses, no credentials, DNS answers all public); all other tools are denied. WebFetch's own redirects are not visible to the gate, so still run agents in a network-isolated, low-privilege environment (no access to internal networks or metadata endpoints). Real-mode behaviour (SDK calls, gate in practice) is not verified end to end.

## Environment variables (names only)

Put them in `agents/.env` (gitignored, mode 600) or the process environment. Never commit or paste values.

| Name | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key (agents only) |
| `CURATOR_USER_ID` | curator account id, written by the seed script |
| `ANTHROPIC_API_KEY` | Claude API key for the Agent SDK (or an existing Claude Code login) |
| `AGENT_MODEL` | model id, default `claude-sonnet-5` |
| `AGENT_MAX_TURNS` | total turn cap per run, default 40 |
| `AGENT_MAX_BUDGET_USD` | total spend cap per run, default 2 |

## Run

```
npm run agents:dry-run -- "Dyatlov Pass incident"   # fakes only: no network, no credits, writes nothing
npm run agents:seed-curator                          # once per Supabase project; idempotent; never prints the id
npm run agents:run -- "Dyatlov Pass incident" --yes  # REAL run
```

Flags: `--dry-run`, `--yes` (required for a real run), `--print` (dry run: print the doc), `--max-turns N`, `--max-budget-usd N`. `seed-curator` takes `--env <file>` to target another env file, prints the target host, and needs `--yes` for a non-local Supabase URL.

**Cost warning:** a real run calls the Claude API with web search/fetch, spends credits, and writes to the database. The turn and USD caps stop it when exceeded (the run fails and nothing is written). Start with a low `--max-budget-usd`.

The draft is `visibility = 'private'` with no published snapshot, so only the curator can read it. Review it in the curator account, then publish through the app.

## Bundle check

`npm run build:verify` runs the normal build and then `npm run check:bundle` (greps dist/ for service-role markers and the Agent SDK). Plain `npm run build` is unchanged for Vercel.

## Tests

`npm test` covers every stage with fake LLM, resolver and store (`agents/testing/fakes.ts`). `test/agents/localStack.test.ts` runs only against a local stack; see its header for the command.
