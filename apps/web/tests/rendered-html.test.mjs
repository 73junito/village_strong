import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta = /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;
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

test("home presents one foundation and three planning-stage components", async () => {
  const html = await render("/");
  assert.match(html, /Building Stronger Families\. Strengthening Communities\./i);
  assert.match(html, /In Development - Not Currently Enrolling/i);
  assert.match(html, /Fatherhood Research (?:&|&amp;) Evaluation/i);
  assert.match(html, /not an offer of enrollment/i);
});

test("FAMILY separates participant and facilitator pathways without credential claims", async () => {
  const html = await render("/family");
  assert.match(html, /Fatherhood Engagement (?:&|&amp;) Education/i);
  assert.match(html, /FAMILY Facilitator Development/i);
  assert.match(html, /Conceptual - Not Enrolling/i);
  assert.match(html, /24:7 Dad/i);
  assert.match(html, /subject to applicable permissions/i);
  assert.doesNotMatch(html, /96 instructional hours/i);
  assert.doesNotMatch(html, /CIP 19\.0712/i);
  assert.doesNotMatch(html, /Download the complete Word catalog/i);
  assert.doesNotMatch(html, /Fathers empowered/i);
});

test("Village Strong presents planned focus areas without a public course catalog", async () => {
  const html = await render("/village-strong");
  assert.match(html, /Building a Stronger Village/i);\n  assert.match(html, /for Children and Families/i);
  assert.match(html, /Planned areas of focus/i);
  assert.match(html, /No formal program enrollment/i);
  assert.doesNotMatch(html, /96 instructional hours/i);
  assert.doesNotMatch(html, /CIP 19\.0701/i);
  assert.doesNotMatch(html, /Download the complete Word catalog/i);
  assert.doesNotMatch(html, /shared support plan/i);
});

test("research page identifies concepts as developmental and not validated", async () => {
  const html = await render("/research");
  assert.match(html, /Advancing Understanding of Fatherhood/i);
  assert.match(html, /FRI/);
  assert.match(html, /EFAS/);
  assert.match(html, /PPARS/);
  assert.match(html, /not diagnostic or clinical instruments/i);
  assert.match(html, /appropriate protocol/i);
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
    `${canonicalBase}/research`,
  ]);
});

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
  assert.match(text, /^# As a condition of accessing this website, you agree to abide by the$/m);
  assert.match(text, /^# RIGHTS UNDER ARTICLE 4 OF THE EUROPEAN UNION DIRECTIVE 2019\/790 ON COPYRIGHT$/m);

  assert.equal(countMatches(text, /EUROPEAN UNION DIRECTIVE 2019\/790/gi), 1);
  assert.equal(countMatches(text, /^Sitemap:/gim), 1);
  assert.equal(countMatches(text, /^User-Agent:/gim), 1);
});
