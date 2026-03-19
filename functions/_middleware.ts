// Pages Function para sobrescrever CSP
// Deployado em: functions/_middleware.ts
// Executa em TODAS as requisições do Cloudflare Pages

export async function onRequest(context) {
  const response = await context.next();
  
  // Copiar todos os headers
  const newHeaders = new Headers();
  
  // CSP com Backblaze liberado
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.paypal.com https://sdk.mercadopago.com https://static.cloudflareinsights.com https://http2.mlstatic.com https://*.mlstatic.com https://*.mercadolivre.com https://*.mercadolibre.com https://*.sentry.io",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://api.qrserver.com https://*.supabase.co https://*.backblazeb2.com https://*.backblaze.com https://f005.backblazeb2.com https://*.stripe.com https://*.paypal.com https://*.mlstatic.com https://*.mercadolibre.com https://*.mercadolivre.com https://*.discogs.com https://i.discogs.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://www.paypal.com https://www.sandbox.paypal.com https://api.mercadopago.com https://*.mercadolibre.com https://*.mlstatic.com https://*.backblazeb2.com https://*.backblaze.com https://pod-*.backblazeb2.com https://pod-*.backblaze.com https://f005.backblazeb2.com https://economia.awesomeapi.com.br https://*.sentry.io https://api.discogs.com",
    "frame-src 'self' https://js.stripe.com https://www.paypal.com https://*.mercadopago.com https://*.mercadopago.com.br https://*.mercadolibre.com",
    "media-src 'self' blob: https://*.backblazeb2.com https://*.backblaze.com https://f005.backblazeb2.com https://*.supabase.co",
    "worker-src 'self' blob:",
    "font-src 'self' https://fonts.gstatic.com"
  ].join('; ');
  
  // Copiar headers existentes exceto CSP
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'content-security-policy') {
      newHeaders.set(key, value);
    }
  });
  
  // Definir CSP customizado
  newHeaders.set('Content-Security-Policy', csp);
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}
