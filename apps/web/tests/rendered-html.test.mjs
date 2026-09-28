import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta = /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;
const catalogHref = "/course-catalog/Village_Strong_FAMILY_Course_Catalog_2026_2027.docx";

let workerPromise;
function getWorker() {
  if (!workerPromise) {
    const workerUrl = new URL("../dist/server/index.js", import.meta.url);
    workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
    workerPromise = import(workerUrl.href).then(({ default: worker }) => worker);
  }
  return workerPromise;
}

async function render(pathname) {
  const worker = await getWorker();
  const response = await worker.fetch(new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  return response.text();
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
