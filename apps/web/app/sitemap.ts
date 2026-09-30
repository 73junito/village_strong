import type { MetadataRoute } from "next";

/**
 * T-H4: the sitemap the recovery record promised. vinext serves this module at
 * /sitemap.xml as application/xml (file-based metadata route), so there is no
 * route file to read here beyond this default export.
 *
 * Only the apex pages are listed. www.villagestrongfoundation.org serves the
 * same application (verified by verify-deploy.ps1's www gate), so listing both
 * hosts would offer a crawler a duplicate of every page instead of a canonical
 * one. The course catalog .docx is deliberately NOT listed: it is a document
 * download, it is already linked from both program pages, and a download URL in
 * a page sitemap adds no crawl path a crawler cannot follow from those pages.
 */
const canonicalBase = "https://villagestrongfoundation.org";

/**
 * A fixed revision date, not `new Date()`: a build-time timestamp would mark
 * every page as modified on every deploy that changes no content, which teaches
 * crawlers to distrust <lastmod>. Bump this when page copy actually changes.
 */
const contentRevision = "2026-09-30T00:00:00.000Z";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(contentRevision);

  return [
    {
      url: `${canonicalBase}/`,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${canonicalBase}/family`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${canonicalBase}/village-strong`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
