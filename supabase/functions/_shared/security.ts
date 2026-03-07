// 🛡️ SECURITY UTILITIES FOR SUPABASE EDGE FUNCTIONS
// ========================================
// Funções de segurança reutilizáveis para proteger Edge Functions

/**
 * 🍯 HONEY POT VALIDATOR
 * Verifica se campos honey pot foram preenchidos (indicando bot)
 */
export function validateHoneyPot(body: any, honeypotFields: string[] = ['address_secondary_field', 'website_url']): boolean {
  for (const field of honeypotFields) {
    if (body[field] && body[field].trim() !== '') {
      console.warn('🚨 BOT DETECTADO: Honey pot preenchido:', field);
      return false; // Falhou na validação - é um bot
    }
  }
  return true; // Passou na validação
}

/**
 * ⏱️ RATE LIMITER
 * Limita requisições por IP usando Deno KV (se disponível) ou Map em memória
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitConfig {
  maxRequests: number; // Máximo de requisições permitidas
  windowMs: number; // Janela de tempo em milissegundos
}

export function checkRateLimit(
  identifier: string, // IP ou user ID
  config: RateLimitConfig = { maxRequests: 5, windowMs: 60000 } // 5 req/min
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  // Se não existe ou expirou, criar novo
  if (!record || now > record.resetAt) {
    const resetAt = now + config.windowMs;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  // Se ainda está dentro da janela de tempo
  if (record.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  // Incrementar contador
  record.count++;
  rateLimitStore.set(identifier, record);
  return { allowed: true, remaining: config.maxRequests - record.count, resetAt: record.resetAt };
}

/**
 * 🔐 WEBHOOK SIGNATURE VALIDATOR (Stripe)
 * Valida assinatura de webhooks da Stripe
 */
export async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    // Stripe usa HMAC SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );

    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Stripe envia no formato: t=timestamp,v1=signature
    const signatureParts = signature.split(',');
    const receivedSignature = signatureParts.find(part => part.startsWith('v1='))?.split('=')[1];

    return receivedSignature === computedSignature;
  } catch (error) {
    console.error('Erro ao verificar assinatura webhook:', error);
    return false;
  }
}

/**
 * 🔒 HEADERS DE SEGURANÇA (Helmet-like)
 * Retorna headers de segurança para as respostas
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    // CORS (já existente, mantém configurável)
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    
    // Security Headers (Helmet-inspired)
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Content-Security-Policy': "default-src 'self'",
  };
}

/**
 * 🧪 SANITIZAÇÃO DE INPUT
 * Remove caracteres perigosos de inputs (SQL Injection prevention layer)
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  // Remove caracteres perigosos
  return input
    .replace(/[<>'"]/g, '') // Remove HTML/SQL perigosos
    .trim()
    .slice(0, 1000); // Limite de comprimento
}

/**
 * 📊 VALIDADOR DE VALORES MONETÁRIOS
 * Garante que valores monetários são números positivos válidos
 */
export function validateAmount(amount: any): { valid: boolean; value: number; error?: string } {
  // Converter para número
  const numAmount = Number(amount);

  // Validações
  if (isNaN(numAmount)) {
    return { valid: false, value: 0, error: 'Valor inválido: não é um número' };
  }

  if (numAmount <= 0) {
    return { valid: false, value: 0, error: 'Valor deve ser maior que zero' };
  }

  if (numAmount > 1000000) {
    return { valid: false, value: 0, error: 'Valor excede o limite permitido' };
  }

  if (!Number.isFinite(numAmount)) {
    return { valid: false, value: 0, error: 'Valor deve ser finito' };
  }

  // Arredondar para 2 casas decimais
  const rounded = Math.round(numAmount * 100) / 100;

  return { valid: true, value: rounded };
}

/**
 * 🔍 EXTRATOR DE IP
 * Extrai IP real da request (considerando proxies)
 */
export function getClientIp(req: Request): string {
  // Cloudflare/proxy headers
  const cfConnectingIp = req.headers.get('CF-Connecting-IP');
  if (cfConnectingIp) return cfConnectingIp;

  const xForwardedFor = req.headers.get('X-Forwarded-For');
  if (xForwardedFor) return xForwardedFor.split(',')[0].trim();

  const xRealIp = req.headers.get('X-Real-IP');
  if (xRealIp) return xRealIp;

  // Fallback
  return 'unknown';
}

/**
 * 🛡️ RESPONSE DE ERRO SEGURA
 * Retorna erro sem expor detalhes internos
 */
export function secureErrorResponse(
  error: any,
  statusCode: number = 400
): Response {
  console.error('❌ Erro na Edge Function:', error);

  const headers = getSecurityHeaders();
  headers['Content-Type'] = 'application/json';

  // Não expor detalhes em produção
  const message = Deno.env.get('ENVIRONMENT') === 'production'
    ? 'Erro ao processar requisição'
    : error.message || 'Erro desconhecido';

  return new Response(
    JSON.stringify({ error: message }),
    { headers, status: statusCode }
  );
}

/**
 * ✅ RESPONSE DE SUCESSO SEGURA
 */
export function secureSuccessResponse(data: any, statusCode: number = 200): Response {
  const headers = getSecurityHeaders();
  headers['Content-Type'] = 'application/json';

  return new Response(
    JSON.stringify(data),
    { headers, status: statusCode }
  );
}
