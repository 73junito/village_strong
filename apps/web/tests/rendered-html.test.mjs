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

// T-H4 repair (2026-09-30): the app is the authoritative source of the whole file.
// Cloudflare's documented prepend did NOT happen in production - the managed
// notice disappeared the moment this route answered 200 - so the reservation of
// rights and the Sitemap reference must both come from here, exactly once each.
// A second copy is not harmless either: it is the signature of the edge starting
// to prepend again, which is what verify-deploy.ps1 also refuses.
function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

test("serves robots.txt with the Article 4 reservation and the sitemap", async () => {
  const response = await fetchFromWorker("/robots.txt");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/plain\b/i);

  const text = await response.text();
  assert.match(text, /^User-Agent: \*$/m);
  assert.match(text, /^Content-signal: search=yes, ai-train=no$/m);
  assert.match(text, /^Allow: \/$/m);
  assert.match(text, /^Disallow: \/_vinext\/$/m);
  assert.match(text, /^Sitemap: https:\/\/villagestrongfoundation\.org\/sitemap\.xml$/m);

  // The notice leads the file and carries the reservation verbatim.
  assert.match(text, /^# As a condition of accessing this website, you agree to abide by the$/m);
  assert.match(text, /^# RIGHTS UNDER ARTICLE 4 OF THE EUROPEAN UNION DIRECTIVE 2019\/790 ON COPYRIGHT$/m);

  assert.equal(
    countMatches(text, /EUROPEAN UNION DIRECTIVE 2019\/790/gi),
    1,
    "the Article 4 reservation of rights must appear exactly once",
  );
  assert.equal(countMatches(text, /^Sitemap:/gim), 1, "exactly one Sitemap reference");
  assert.equal(countMatches(text, /^User-Agent:/gim), 1, "exactly one User-Agent group");
});
