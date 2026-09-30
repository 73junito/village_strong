import type { MetadataRoute } from "next";

/**
 * T-H4 repair, 2026-09-30. vinext serves this module at /robots.txt as text/plain
 * (file-based metadata route).
 *
 * WHY THIS FILE OWNS THE WHOLE RESPONSE
 *
 * T-H4 first shipped this route as a plain MetadataRoute.Robots object and relied
 * on Cloudflare's managed robots.txt being PREPENDED to it at the edge, because
 * that is what Cloudflare documents for an origin that answers 200. Production
 * measured the opposite: as soon as this route answered 200, the managed content
 * - including the EU Directive 2019/790 Article 4 reservation of rights - was
 * gone from the live file (101 bytes, this route's text only, confirmed with a
 * cache-buster). Cloudflare's own documentation example, www.crawlstop.com/
 * robots.txt, likewise serves origin-only content with no managed block, and
 * cloudflare-docs issue #29198 reports the same class of failure ("managed rules
 * only ... existing rules nowhere to be found"). The documented prepend therefore
 * cannot be relied on, and a rights reservation that silently disappears is not
 * acceptable.
 *
 * So the application is now the authoritative source of the file and the edge is
 * treated as optional augmentation: the response must carry the reservation and
 * the Sitemap reference whether or not anything is ever prepended to it.
 *
 * WHY THIS RETURNS A Response AND NOT MetadataRoute.Robots
 *
 * MetadataRoute.Robots has no field that can express a comment line, and the
 * content-signal notice is a comment block handed down by Cloudflare. vinext
 * returns a Response from a dynamic metadata route unchanged, checking that
 * before it inspects the value at all:
 *     if (result instanceof Response) return result;
 * (vinext/dist/server/metadata-route-response.js). The declared return type stays
 * MetadataRoute.Robots so the route still satisfies Next's metadata route
 * contract, and the body is built as one literal so the notice is transcribed
 * exactly rather than generated.
 */
const canonicalBase = "https://villagestrongfoundation.org";

/**
 * Cloudflare's Content Signals Policy, transcribed verbatim from the "robots.txt
 * setting" documentation (developers.cloudflare.com/bots/additional-configurations
 * /managed-robots-txt/, last updated 2026-08-03) - the text the edge served for
 * this zone before T-H4. It is a statement of rights: do not paraphrase, reflow
 * or re-indent it, because the only thing that makes it verifiable is that it
 * stays comparable with the text Cloudflare publishes.
 */
const contentSignalNotice = `# As a condition of accessing this website, you agree to abide by the
# following content signals:

# (a)  If a content-signal = yes, you may collect content for the
#      corresponding use.
# (b)  If a content-signal = no, you may not collect content for the
#      corresponding use.
# (c)  If the website operator does not include a content signal for a
#      corresponding use, the website operator neither grants nor restricts
#      permission via content signal with respect to the corresponding use.

# The content signals and their meanings are:

# search: building a search index and providing search results (e.g., returning
#         hyperlinks and short excerpts from your website's contents). Search
#         does not include providing AI-generated search summaries.
# ai-input: inputting content into one or more AI models (e.g., retrieval
#           augmented generation, grounding, or other real-time taking of
#           content for generative AI search answers).
# ai-train: training or fine-tuning AI models.

# ANY RESTRICTIONS EXPRESSED VIA CONTENT SIGNALS ARE EXPRESS RESERVATIONS OF
# RIGHTS UNDER ARTICLE 4 OF THE EUROPEAN UNION DIRECTIVE 2019/790 ON COPYRIGHT
# AND RELATED RIGHTS IN THE DIGITAL SINGLE MARKET.`;

/**
 * One User-Agent group carrying the policy and our crawl rules, then the Sitemap
 * reference. /_vinext/ is the framework's image optimizer: an internal endpoint
 * that answers with redirects, not a page, so it is the only path worth excluding
 * by name. The Sitemap line sits outside the group, as the standard expects.
 */
const robotsBody = `${contentSignalNotice}

User-Agent: *
Content-signal: search=yes, ai-train=no
Allow: /
Disallow: /_vinext/

Sitemap: ${canonicalBase}/sitemap.xml
`;

export default function robots(): MetadataRoute.Robots {
  return new Response(robotsBody, {
    headers: {
      "Content-Type": "text/plain",
      // The same caching contract vinext applies to its own metadata routes, so
      // overriding the body does not change how the file is cached at the edge.
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  }) as unknown as MetadataRoute.Robots;
}
