import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/desk'].map((p) => ({ url: `https://albashi.vercel.app${p}` }));
}
