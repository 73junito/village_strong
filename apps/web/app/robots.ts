import type { MetadataRoute } from "next";

/**
 * T-H4. vinext serves this module at /robots.txt as text/plain (file-based
 * metadata route).
 *
 * This route deliberately does NOT reproduce the content-signal notice that the
 * live robots.txt carries today. That notice, including the EU Directive
 * 2019/790 Article 4 reservation of rights, is Cloudflare's managed robots.txt,
 * and Cloudflare PREPENDS it to whatever this route returns: "If your website
 * already has a robots.txt file - verified by an HTTP 200 response - Cloudflare
 * will prepend our managed robots.txt before your existing robots.txt, combining
 * both into a single response" (Cloudflare docs, robots.txt setting). Copying it
 * here would duplicate the notice in one response and take over text we do not
 * maintain.
 *
 * What this route owns is the part Cloudflare cannot know: the crawl rules and
 * the Sitemap reference.
 */
const canonicalBase = "https://villagestrongfoundation.org";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /_vinext/ is the framework's image optimizer: an internal endpoint that
        // answers with redirects, not a page. It is the only path served outside
        // the app router, so it is the only one worth excluding by name.
        disallow: "/_vinext/",
      },
    ],
    sitemap: `${canonicalBase}/sitemap.xml`,
  };
}
