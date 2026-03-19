export default {
  async fetch(request, env, ctx) {
    const response = await fetch(request);
    
    const newHeaders = new Headers(response.headers);
    
    // CSP atualizado com Backblaze
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.backblazeb2.com https://*.backblaze.com https://f005.backblazeb2.com https://*.supabase.co https://*.supabase.in",
      "connect-src 'self' https://*.supabase.co https://*.supabase.in https://*.backblazeb2.com https://*.backblaze.com https://pod-*.backblazeb2.com https://pod-*.backblaze.com https://f005.backblazeb2.com https://api.stripe.com https://www.paypal.com https://www.sandbox.paypal.com https://api.mercadopago.com https://*.mercadolibre.com https://*.mlstatic.com https://economia.awesomeapi.com.br https://*.sentry.io https://api.discogs.com",
      "media-src 'self' blob: https://*.backblazeb2.com https://*.backblaze.com https://f005.backblazeb2.com",
      "frame-src 'self' https://*.supabase.co https://js.stripe.com https://sdk.mercadopago.com https://www.paypal.com"
    ].join('; ');
    
    newHeaders.set('Content-Security-Policy', csp);
    newHeaders.set('X-Frame-Options', 'DENY');
    newHeaders.set('X-Content-Type-Options', 'nosniff');
    newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
};
