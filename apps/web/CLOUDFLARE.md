# Cloudflare Deployment

Operational guide for deploying `apps/web` to Cloudflare Workers. For how the
application is structured, see [README.md](./README.md).

## What gets deployed

`apps/web` is a [vinext](https://github.com/cloudflare/vinext) application:
Next.js 16 running on Cloudflare Workers via the Cloudflare Vite plugin. One
Worker (`village-strong-family-foundation`) serves three routes:

| Route             | Page                                     |
| ----------------- | ---------------------------------------- |
| `/`               | Foundation home                          |
| `/family`         | FAMILY Foundation — fatherhood science   |
| `/village-strong` | Village Strong — childhood science, birth–18 |

Static assets are uploaded from `dist/client`; the Worker bundle comes from
`dist/server`. `npm run build` regenerates both and validates the result.

## Prerequisites

- Node.js `>=22.13.0`
- A Cloudflare account, plus either an interactive `wrangler login` (local) or
  an API token (CI)

## Local development

```bash
npm install
npm run dev
```

`wrangler login` is only needed for commands that call the Cloudflare API. The
development server runs entirely local.

## Authentication

**Local** — interactive OAuth:

```bash
npx wrangler login     # opens a browser
npm run cf:whoami      # confirm the active account
```

**CI** — an API token with these permissions:

- Account → Workers Scripts → **Edit**
- Account → Workers KV Storage → **Edit** (only if KV is added later)

Store it as the `CLOUDFLARE_API_TOKEN` repository secret and the account ID as
`CLOUDFLARE_ACCOUNT_ID`. `account_id` is deliberately not committed in
`wrangler.jsonc`, so the account resolves from the token or environment in both
cases.

## Build, test, and verify

```bash
npm run build              # bounded vinext build + artifact validation
npm test                   # build, then assert the rendered HTML
npm run lint
npm run deploy:check       # wrangler deploy --dry-run (no API writes)
```

`deploy:check` is the safe pre-flight: it bundles, uploads nothing, and prints
the binding table.

## Deploy

```bash
npm run deploy             # build, then wrangler deploy
```

The first deploy creates the Worker, and Wrangler prints its `*.workers.dev`
hostname. Later deploys update the Worker and roll forward its version history.

```bash

## Custom domain

`villagestrongfoundation.org` is configured as a custom domain on this Worker.
The zone is active in the same account, so Wrangler provisions the DNS record
and TLS certificate on the first deploy:

| Hostname                          | Behavior                        |
| --------------------------------- | ------------------------------- |
| `villagestrongfoundation.org`     | Serves this Worker              |
| `www.villagestrongfoundation.org` | Serves this Worker (same pages) |

Verified zone details:

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| Zone id      | `e296a044e112b01e77f14496a97339ee`        |
| Status       | `active`                                  |
| Account      | `0257b4518015b64bd28bca05b803de27`        |
| Name servers | `kinsley.ns.cloudflare.com`, `zod.ns.cloudflare.com` |

A zone export taken before this configuration contained only SOA and NS
records — no A, AAAA, or CNAME — so no existing site was displaced. A custom
domain only takes effect once the Worker is deployed; before that, and
alongside it, the `*.workers.dev` hostname also serves the app.

### Redirecting www to the apex

Serving both hostnames duplicates content. To make `www` a permanent redirect to
the apex instead, replace the `www` route with a zone-level redirect created in
the dashboard (**DNS → Records → Add record → Redirect**) or the API, then drop
the `www` entry from `routes` in `wrangler.jsonc`.

### Verifying a custom domain

`npm run deploy:check` validates the bundle and prints bindings, but it does
**not** contact the API to confirm the routes. Route and certificate problems
only surface on a real `npm run deploy`.

## Secrets

Secrets are never committed and never uploaded by `wrangler deploy`. Add them
explicitly:

```bash
npx wrangler secret put <NAME>     # prompts, then writes an encrypted secret
npm run cf:secret:list              # list names (values are never returned)
```

For local development, copy the example and fill in real values:

```bash
cp .dev.vars.example .dev.vars
```

`.dev.vars` is gitignored; `.dev.vars.example` is tracked so the expected shape
stays documented.

## Bindings

`wrangler.jsonc` declares the bindings the Worker reads:

| Binding  | Resource          | Purpose                                          |
| -------- | ----------------- | ------------------------------------------------ |
| `ASSETS` | Static assets     | Serves `dist/client`; used by the image optimizer |
| `IMAGES` | Cloudflare Images | Backs `/_vinext/image` optimization              |

> **Cloudflare Images is a paid product.** The `IMAGES` binding only resolves
> once Images is enabled on the account. No route currently requests
> `/_vinext/image`, so the site serves correctly either way. If a deploy fails
> with an Images-related error, either enable the product or temporarily remove
> the `images` block from `wrangler.jsonc`.

### Adding D1

`db/index.ts` and the Drizzle schema are wired but intentionally empty —
`db/schema.ts` exports nothing, so no table exists yet, and the account has no D1
databases. To enable one:

```bash
npx wrangler d1 create village-strong            # note the returned database_id
```

Then add the binding to `wrangler.jsonc`, substituting the real ID:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "village-strong",
    "database_id": "<paste-database-id-here>",
    "migrations_dir": "drizzle"
  }
]
```

`getDb()` throws a descriptive error until this binding exists, so the app
degrades cleanly when D1 is not configured. Schema changes flow through
`npm run db:generate`, then apply remotely with
`npx wrangler d1 migrations apply <database_name> --remote`.

## Continuous deployment

`.github/workflows/deploy.yml` builds and deploys on pushes to `main` and on
manual dispatch. It requires the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` secrets. `ci.yml` independently runs `deploy:check` on
every push, so a broken bundle fails before it can ship.

## Troubleshooting

**`Cannot find native binding`** during build — the `rolldown` native binary for
this platform is missing. Reinstall from the lockfile:

```bash
rm -rf node_modules     # Windows: rmdir /s /q node_modules
npm install
```

**`'...' is not recognized as an internal or external command`** — a Windows path
containing spaces reached a shell unquoted. The scripts in `scripts/` quote
arguments; quote any new `.cmd` shim the same way.

**Deploy reports the Worker does not exist** — expected before the first deploy.
Run `npm run deploy` once; later commands resolve it.

**`wrangler deploy` misbehaves on Windows** — run it from PowerShell or cmd, not
inside WSL, so the native Windows binary is used.

npm run cf:versions        # inspect live versions
npm run cf:tail            # stream Workers Logs
```
