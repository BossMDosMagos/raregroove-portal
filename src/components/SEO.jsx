import React from 'react';
import { Helmet } from 'react-helmet-async';

export default function SEO({ title, description, image, url }) {
  const siteTitle = 'Rare Groove Portal';
  const defaultDescription = 'O mercado definitivo para colecionadores de vinil e CDs raros. Compre, venda e troque relíquias musicais com segurança.';
  const defaultImage = 'https://raregroove.com.br/og-image.jpg'; // Substituir por imagem real
  const siteUrl = 'https://raregroove.com.br';

  const fullTitle = title ? `${title} | ${siteTitle}` : siteTitle;
  const metaDescription = description || defaultDescription;
  const metaImage = image || defaultImage;
  const metaUrl = url ? `${siteUrl}${url}` : siteUrl;

  return (
    <Helmet>
      {/* Standard Metadata */}
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      <link rel="canonical" href={metaUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={metaUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={metaImage} />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={metaUrl} />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={metaDescription} />
      <meta property="twitter:image" content={metaImage} />
    </Helmet>
  );
}
