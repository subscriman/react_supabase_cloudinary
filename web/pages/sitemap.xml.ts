import type { GetServerSideProps } from 'next';
import { getPublishedExhibitions } from '../lib/exhibitions';

const DEFAULT_SITE_URL = 'https://arttomato.vercel.app';

export default function SitemapXml() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  const result = await getPublishedExhibitions();
  const now = new Date().toISOString();

  const urls = [
    {
      loc: `${siteUrl}/`,
      lastmod: now,
      changefreq: 'daily',
      priority: '1.0',
    },
    ...result.data.items.map((item) => ({
      loc: `${siteUrl}/exhibitions/${item.slug}`,
      lastmod: now,
      changefreq: 'daily',
      priority: '0.8',
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (entry) => `  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml');
  res.write(body);
  res.end();

  return { props: {} };
};
