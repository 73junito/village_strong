import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta = /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;
const appTitle = /Village Strong Foundation\s*\|\s*FAMILY/i;
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
  assert.match(html, /Helping Fathers Build Stronger Connections\./i);
  assert.match(html, /Pilot in Development - Enrollment Not Yet Open/i);
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
  assert.match(html, /Building a Stronger Village/i);
  assert.match(html, /for Children and Families/i);
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
  assert.match(html, /Research methods/i);
  assert.match(html, /Construct development/i);
  assert.match(html, /Expert content review/i);
  assert.match(html, /Cognitive interviews/i);
  assert.match(html, /Pilot administration/i);
  assert.match(html, /Psychometric validation/i);
  assert.match(html, /Governance and dissemination/i);
  assert.match(html, /No participant information or research responses are collected/i);
  assert.doesNotMatch(html, /validated scale/i);
});

test("shared navigation exposes the implementation-plan routes", async () => {
  const html = await render("/");
  for (const href of [
    "/about",
    "/family",
    "/family/how-it-works",
    "/resources",
    "/partners",
    "/research",
    "/contact",
    "/privacy",
    "/accessibility",
  ]) {
    assert.match(html, new RegExp(`href=["']${href.replaceAll("/", "\\/")}["']`));
  }
  assert.match(html, /Skip to main content/i);
});

test("FAMILY describes the proposed hybrid model without opening enrollment", async () => {
  const family = await render("/family");
  assert.match(family, /Live virtual/i);
  assert.match(family, /Regional in person/i);
  assert.match(family, /Self-paced support/i);
  assert.match(family, /Resource navigation/i);

  const process = await render("/family/how-it-works");
  assert.match(process, /Five proposed steps/i);
  assert.match(process, /Enrollment Not Open/i);
  assert.match(process, /not therapy, diagnosis, legal representation, or custody evaluation/i);
});

test("public information pages preserve governance and privacy boundaries", async () => {
  const partners = await render("/partners");
  assert.match(partners, /not represented as official partners/i);
  assert.match(partners, /No Referrals Accepted/i);

  const contact = await render("/contact");
  assert.match(contact, /protected participant-interest form is not yet active/i);
  assert.match(contact, /Do not send sensitive or emergency information/i);

  const privacy = await render("/privacy");
  assert.match(privacy, /Program intake and research data collection are not active/i);
  assert.match(privacy, /Program participation and optional research consent will remain separate/i);

  const accessibility = await render("/accessibility");
  assert.match(accessibility, /keyboards, screen readers, mobile devices, zoom, and low-bandwidth access/i);
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
    `${canonicalBase}/about`,
    `${canonicalBase}/family`,
    `${canonicalBase}/family/how-it-works`,
    `${canonicalBase}/village-strong`,
    `${canonicalBase}/resources`,
    `${canonicalBase}/partners`,
    `${canonicalBase}/research`,
    `${canonicalBase}/contact`,
    `${canonicalBase}/privacy`,
    `${canonicalBase}/accessibility`,
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
