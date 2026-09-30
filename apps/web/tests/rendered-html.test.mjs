import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta = /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;
const catalogHref = "/course-catalog/Village_Strong_FAMILY_Course_Catalog_2026_2027.docx";

// Mirrors verify-deploy.ps1's Get-AppTitleNote: acceptance is the application
// title in the body, never a bare 200.
const appTitle = /Village Strong\s*\|\s*FAMILY Foundation/i;
const canonicalBase = "https://villagestrongfoundation.org";

let workerPromise;
function getWorker() {
  if (!workerPromise) {
    const workerUrl = new URL("../dist/server/index.js", import.meta.url);
    workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
    workerPromise = import(workerUrl.href).then(({ default: worker }) => worker);
  }
  return workerPromise;
}

const assetsStub = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const ctxStub = { waitUntil() {}, passThroughOnException() {} };

async function fetchFromWorker(pathname, accept) {
  const worker = await getWorker();
  const request = new Request(`http://localhost${pathname}`, accept ? { headers: { accept } } : undefined);
  return worker.fetch(request, assetsStub, ctxStub);
}

async function render(pathname) {
  const response = await fetchFromWorker(pathname, "text/html");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  return response.text();
}

async function sitemapLocations() {
  const response = await fetchFromWorker("/sitemap.xml", "application/xml");
  assert.equal(response.status, 200);
  return [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

test("renders development preview metadata", async () => {
  assert.match(await render("/"), developmentPreviewMeta);
});

test("renders FAMILY classification and catalog download", async () => {
  const html = await render("/family");
  assert.match(html, /Fatherhood Science/i);
  assert.match(html, /CIP 19\.0712/);
  assert.match(html, /96 instructional hours/i);
  assert.ok(html.includes(catalogHref));
});

test("renders Village Strong classification and catalog download", async () => {
  const html = await render("/village-strong");
  assert.match(html, /Human and child development/i);
  assert.match(html, /CIP 19\.0701/);
  assert.match(html, /birth through age 18/i);
  assert.ok(html.includes(catalogHref));
});

test("serves a sitemap listing exactly the canonical public routes", async () => {
  const response = await fetchFromWorker("/sitemap.xml", "application/xml");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/xml\b/i);

  const xml = await response.text();
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<\/urlset>\n$/);
  assert.deepEqual(await sitemapLocations(), [
    `${canonicalBase}/`,
    `${canonicalBase}/family`,
    `${canonicalBase}/village-strong`,
  ]);
});

// A sitemap is only trustworthy if every URL it advertises actually renders, so
// the sitemap's own output is driven back through the worker. This cannot pass
// while the sitemap lists a route the app does not serve, or lists www.
test("every sitemap URL renders the verified application", async () => {
  const locations = await sitemapLocations();
  assert.ok(locations.length > 0, "the sitemap must advertise at least one URL");

  for (const location of locations) {
    assert.ok(location.startsWith(canonicalBase), `${location} must use the canonical host`);
    const pathname = location.slice(canonicalBase.length) || "/";
    const html = await render(pathname);
    assert.match(html, appTitle, `${pathname} must serve the verified application`);
  }
});

test("serves robots.txt pointing crawlers at the sitemap", async () => {
  const response = await fetchFromWorker("/robots.txt");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/plain\b/i);

  const text = await response.text();
  assert.match(text, /^User-Agent: \*$/m);
  assert.match(text, /^Allow: \/$/m);
  assert.match(text, /^Disallow: \/_vinext\/$/m);
  assert.match(text, /^Sitemap: https:\/\/villagestrongfoundation\.org\/sitemap\.xml$/m);
  // Cloudflare PREPENDS its managed content-signal notice (including the Article
  // 4 reservation) to this response at the edge, so the app must not repeat that
  // text: duplication would ship the notice twice in one file.
  assert.doesNotMatch(text, /EUROPEAN UNION DIRECTIVE/i);
});
