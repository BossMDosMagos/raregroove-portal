import { Metadata } from 'next';

export const metadata = {
  title: 'RareGroove - Marketplace de CDs e Vinil Raros',
  description: 'Encontre CDs e vinil raros, edições limitadas e collector\'s items. Marketplace seguro para colecionadores de música.',
  keywords: ['CDs raros', 'vinil', 'marketplace', 'colecionadores', 'música', 'edição limitada'],
  openGraph: {
    title: 'RareGroove - Marketplace de CDs e Vinil Raros',
    description: 'Encontre CDs e vinil raros no maior marketplace para colecionadores de música.',
    url: 'https://raregroove.com',
    siteName: 'RareGroove',
    images: [{
      url: 'https://raregroove.com/og-image.jpg',
      width: 1200,
      height: 630,
    }],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RareGroove - Marketplace de CDs e Vinil Raros',
    description: 'Encontre CDs e vinil raros no maior marketplace para colecionadores de música.',
    images: ['https://raregroove.com/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function Sitemap() {
  const baseUrl = 'https://raregroove.com';
  
  const staticPages = [
    { url: baseUrl, changefreq: 'daily', priority: 1.0 },
    { url: `${baseUrl}/catalog`, changefreq: 'daily', priority: 0.9 },
    { url: `${baseUrl}/about`, changefreq: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/terms`, changefreq: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/privacy`, changefreq: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/faq`, changefreq: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/shipping`, changefreq: 'yearly', priority: 0.4 },
    { url: `${baseUrl}/login`, changefreq: 'yearly', priority: 0.4 },
    { url: `${baseUrl}/register`, changefreq: 'yearly', priority: 0.4 },
  ];

  const genres = ['rock', 'pop', 'jazz', 'classical', 'electronic', 'hiphop', 'metal', 'soul', 'funk', 'brazilian'];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${staticPages.map(page => `  <url>
    <loc>${page.url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
${genres.map(genre => `  <url>
    <loc>${baseUrl}/catalog?genre=${genre}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800',
    },
  });
}
