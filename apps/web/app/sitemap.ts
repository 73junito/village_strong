import type { MetadataRoute } from "next";

const canonicalBase = "https://villagestrongfoundation.org";
const contentRevision = "2026-10-10T00:00:00.000Z";

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
    {
      url: `${canonicalBase}/research`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
