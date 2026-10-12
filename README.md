# Village Strong and FAMILY Foundation

Public website, release-review pipeline, and research-governance drafts for the
Village Strong and FAMILY Foundation — childhood science (birth–18) and
fatherhood science. One repository, three isolated scopes: the live site, the
private release pipeline, and review-only research materials.

## Repository structure

| Path | Scope | Deploys? |
|---|---|---|
| [`apps/web/`](apps/web/) | Public website (`villagestrongfoundation.org`, `www`) — Next.js 16 on Cloudflare Workers via vinext | **Yes** — Worker `village-strong` via Cloudflare Workers Builds |
| [`orchestration/`](orchestration/) | Ten-gate release-review pipeline (Durable Object + Workflow) | **No** — validated with `--dry-run` only; no public endpoint |
| [`supabase/`](supabase/) | Review-only research schema + governance templates | **No** — drafts only; activation gates below |
| `src/`, `tests/`, `scripts/` | Legacy Python/FastAPI assessment-service stubs | **No** — unmaintained stubs, kept for reference |
| `.github/workflows/` | CI (`ci.yml`), manual emergency deploy (`deploy.yml`), Dependabot policy | — |

See the detailed guides instead of duplicating them here:
[`apps/web/`](apps/web/) (plus [`CLOUDFLARE.md`](apps/web/CLOUDFLARE.md) for
operations), [`orchestration/`](orchestration/),
[`supabase/`](supabase/) (plus [`src/`](src/) for the Python stubs).

## Stack

| Layer | Web (`apps/web`) | Orchestration (`orchestration`) |
|---|---|---|
| Runtime | Node `>=22.13.0`, workerd via Cloudflare | Node `>=22.13.0`, workerd via Miniflare |
| Framework | Next.js `16.4.0`, React `19.3.0`, vinext `0.0.50`, Vite `8.3.4` | Agents SDK `0.27.0`, `jose`, MCP client `2.3.1` / SDK `1.31.0` (narrow overrides) |
| Language | TypeScript `5.9.3` (ES2017, Next plugin) | TypeScript `7.0.2` (ES2022, strict) |
| Data | Drizzle ORM + Drizzle Kit (SQLite; schema intentionally empty, no D1 provisioned) | Durable Object ledger + Workflow history (no external store) |
| Test | ESLint, rendered-HTML tests, `deploy:check` dry-run | 3× `tsc`, 65 unit (`node --test`), 17 workerd integration (Vitest `5.0.3` + `@cloudflare/vitest-plugin`) |
| Deploy tool | Wrangler `4.149.0` | Wrangler `4.149.0` (validate only) |

CI runs Python `3.11/3.12/3.14` + pytest for the legacy tree, a lint
placeholder, and both Node pipelines with npm cache per lockfile.
Dependabot scans both npm scopes weekly (minor+patch grouped, majors separate,
max 5 open PRs each); `npm audit` is clean in both packages.

## Local setup and validation

Prerequisites: Node.js `>=22.13.0`. Wrangler login only for Cloudflare API
commands; dev servers and dry-runs stay local.

```bash
# Web
cd apps/web
npm ci
npm run lint
npm test                  # build + rendered-output tests
npm run deploy:check      # bundle validation, no API writes

# Orchestration
cd orchestration
npm ci
npm run check             # cf:types + 3× typecheck + unit + workerd integration
npm run check:private-config   # wrangler --dry-run; exits without deploying
npm audit                 # must report 0 vulnerabilities
```

## Deployment boundaries

- **Web is the only production deploy.** Cloudflare Workers Builds (dashboard
  Git integration on `main`) is the sole path; `.github/workflows/deploy.yml`
  is a manual emergency fallback with intentionally unconfigured secrets.
  Custom domains: apex + `www` on Worker `village-strong`.
- **Orchestration must never be deployed by automation.** No `workers_dev`
  subdomain, no routes, no custom domains; CI runs `--dry-run` only and holds
  no Cloudflare credentials. There is deliberately no unqualified
  `npm run deploy` — provisioning any endpoint is an explicit human decision
  (see its README Limitations).
- **The two Workers share nothing**: no domains, data, identity, secrets,
  Durable Object namespaces, or admin interfaces.

## Governance restrictions

- **Research is review-only.** [`supabase/`](supabase/) holds a private
  `research` schema (RLS forced, no grants) and Pending governance templates.
  Do not run `supabase db push`, add Supabase credentials to the web app,
  recruit participants, or collect data until every approval gate in its README
  is documented — protocol, ethics/IRB, consent/withdrawal, minimization and
  retention plans, role matrix, RLS policies with tests, and a staging review.
- **Orchestration approvals stay human.** Ten clearing gates produce
  `AWAITING_APPROVAL`, never a release; `HELD` is terminal and no signature
  overrules a blocker. Single-token identity must become per-approver
  credentials (OIDC/mTLS) before any deployment.

## Maintenance baseline

`main` at `479cb9f`: zero open Dependabot alerts, `npm audit` clean in both
packages, all CI jobs and Workers Builds green. Dependency work lands as
scoped PRs (one package per PR, majors separately reviewable); every update PR
must pass its pipeline before merge. See
[`orchestration/`](orchestration/) for the override policy
(`undici`/`sharp` pins, `agents`-subtree MCP pins) and the recorded
follow-ups.

## Archived / retired materials

> Moodle integration is retired and is not part of the supported runtime,
> deployment path, or current development roadmap.

The Moodle install/restore scripts, architecture briefs, curriculum `.docx`
files, and related templates at the repository root, plus the legacy
Python/FastAPI stubs under `src/`, remain for reference only. They are
excluded from the stack table, setup, architecture, CI gates, and maintenance
scope above.

