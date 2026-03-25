export function validateSecretVault() {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  if (!env?.DEV) return;

  const required = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
  ];

  const optional = [
    'VITE_STRIPE_PUBLISHABLE_KEY',
    'VITE_MP_PUBLIC_KEY',
    'VITE_PAYPAL_CLIENT_ID',
  ];

  const missingRequired = required.filter((key) => !env[key] || String(env[key]).trim().length === 0);
  const missingOptional = optional.filter((key) => !env[key] || String(env[key]).trim().length === 0);
}

