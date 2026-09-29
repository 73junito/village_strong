/** Cloudflare Worker entry point for the vinext-starter template. */
import handler from "vinext/server/app-router-entry";

interface Env {
  /**
   * Declared by `assets.binding` in wrangler.jsonc. vinext's app router entry
   * reads env.ASSETS to serve files from dist/client, so the binding must stay
   * even though this file no longer references it directly.
   */
  ASSETS: Fetcher;
  DB: D1Database;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// No /_vinext/image route lives here any more. Nothing in app/ imports
// next/image, Cloudflare Images is a paid product that is not provisioned in
// this account, and the route answered every request with HTTP 500 while being
// the only unauthenticated path not owned by the app router. To re-enable image
// optimization, provision Cloudflare Images, restore the `images` binding in
// wrangler.jsonc, and re-add the route in the same change. See CLOUDFLARE.md.
const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
