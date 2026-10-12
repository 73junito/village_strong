import type { MetadataRoute } from "next";

const canonicalBase = "https://villagestrongfoundation.org";
const contentRevision = "2026-10-12T00:00:00.000Z";

const routes = [
  ["/", 1],
  ["/about", 0.7],
  ["/family", 0.9],
  ["/family/how-it-works", 0.8],
  ["/village-strong", 0.8],
  ["/resources", 0.7],
  ["/partners", 0.7],
  ["/research", 0.7],
  ["/contact", 0.6],
  ["/privacy", 0.4],
  ["/accessibility", 0.4],
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(contentRevision);
  return routes.map(([path, priority]) => ({
    url: `${canonicalBase}${path}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority,
  }));
}
