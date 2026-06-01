import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/login', '/checkout/'],
      },
    ],
    sitemap: 'https://www.nexguard360.com/sitemap.xml',
  };
}
