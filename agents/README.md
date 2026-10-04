# /agents

Node/TypeScript pipeline that drafts a sourced board. It runs locally or on a droplet, never in a Vercel function, and uses the Supabase service-role key, which must never reach `src/` or `dist/` (`npm test` and `npm run check:bundle` enforce this).

Pipeline: scout -> researcher -> claim classifier -> board builder -> validator -> autoOrganize (seeded from the topic) -> private DRAFT board owned by the curator.

- Claims carry a source URL and `retrievedAt` (stamped by code). Verdicts map to the schema status: confirmed=`verified`, alleged=`claim`, disputed=`disputed`, speculative=`speculation`.
- The validator fails on schema errors, dangling ids, unresolvable or unsafe URLs (https only, no private/loopback addresses, DNS and redirects re-checked), ungrounded widgets, and images that are not on an allow-listed host (`upload.wikimedia.org`) with an accepted licence and attribution. News photos are never hotlinked.
- Images need the image URL on `upload.wikimedia.org` and a source on `commons.wikimedia.org` (https, exact host) whose licence is exactly CC0, CC BY, CC BY-SA, public domain or PD (NC/ND and anything else are rejected). The licence is model-asserted and is not re-checked against the Commons page; review images before publishing. An image that fails these checks (wrong host, no or non-free licence, non-default port) or whose URL does not resolve is dropped from its photo or wanted widget with an `image_dropped` warning instead of failing the draft; an image can never reach the board without a valid licence record; a dead claim source fails the board.
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

## Demo board

`agents/fixtures/demoBoard.ts` is a hand-authored, neutral board (Dyatlov Pass incident, no images, every widget sourced). It passes the same validator and zod schema as pipeline drafts and never touches the network in tests.

```
npm run seed:demo -- --dry-run                  # offline validation only
npm run seed:demo                               # validates (probes source URLs), writes a PRIVATE draft as the curator. NOT idempotent: refuses if the curator already has a board titled as the demo, unless --force (which makes another draft)
npm run seed:demo -- --publish <slug> --thumbnail demo.png   # separate step: makes that curator board public
```

A non-local `SUPABASE_URL` needs `--yes` on every non-dry-run invocation. Review the draft (and the source URLs, which the resolver must be able to reach) before publishing. Publishing is never done automatically.

The fixture content was written from memory and its sources were never fetched (`retrievedAt` is not a fetch time). A human must open all three source URLs before publishing; Britannica may return 403 to bots.

`--publish` refuses unless the row is owned by the curator, not deleted, titled exactly as the demo, and its stored doc validates and its widgets and edges deep-equal the fixture (an edited draft is refused; other doc fields are not compared). The thumbnail must be a PNG of at most 262144 bytes, checked before anything is uploaded. It then sets the same snapshot columns as the app's `publish_board` RPC (which cannot be called here: it needs `auth.uid()` = owner, and the curator cannot log in). The share-preview thumbnail is rendered in a browser canvas (`renderThumbnailPng`), which cannot run headlessly, so supply a PNG with `--thumbnail <file>` (uploaded to `<owner>/pub-<boardId>.png`, e.g. a 320x200 image saved from the app's thumbnail). Without it the board is public but `/api/og?image=1` returns 404 and there is no og:image.

## Bundle check

`npm run build:verify` runs the normal build and then `npm run check:bundle` (greps dist/ for service-role markers and the Agent SDK) and `npm run check:fonts` (fails if dist/ or index.html mentions fonts.googleapis.com or fonts.gstatic.com). Plain `npm run build` is unchanged for Vercel.

## Tests

`npm test` covers every stage with fake LLM, resolver and store (`agents/testing/fakes.ts`). `test/agents/localStack.test.ts` runs only against a local stack; see its header for the command.
