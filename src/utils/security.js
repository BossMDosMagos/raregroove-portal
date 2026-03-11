// 🛡️ CLIENT-SIDE SECURITY UTILS
// ========================================

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const STORAGE_KEY_ATTEMPTS = 'rg_auth_attempts';
const STORAGE_KEY_LOCKOUT = 'rg_auth_lockout';
const STORAGE_KEY_COOLDOWN_UNTIL = 'rg_auth_cooldown_until';

/**
 * Verifica se o usuário está bloqueado temporariamente
 */
export function checkLoginLockout(identifier = '') {
  const suffix = identifier ? `:${normalizeIdentifier(identifier)}` : '';
  const lockoutUntil = localStorage.getItem(`${STORAGE_KEY_LOCKOUT}${suffix}`);
  const cooldownUntil = localStorage.getItem(`${STORAGE_KEY_COOLDOWN_UNTIL}${suffix}`);
  
  if (lockoutUntil) {
    const now = Date.now();
    if (now < parseInt(lockoutUntil)) {
      const remainingMinutes = Math.ceil((parseInt(lockoutUntil) - now) / 60000);
      return {
        isLocked: true,
        remainingMinutes,
        remainingSeconds: Math.ceil((parseInt(lockoutUntil) - now) / 1000),
        message: `Muitas tentativas falhas. Tente novamente em ${remainingMinutes} minutos.`
      };
    } else {
      // Bloqueio expirou
      localStorage.removeItem(`${STORAGE_KEY_LOCKOUT}${suffix}`);
      localStorage.removeItem(`${STORAGE_KEY_ATTEMPTS}${suffix}`);
    }
  }

  if (cooldownUntil) {
    const now = Date.now();
    if (now < parseInt(cooldownUntil)) {
      const remainingSeconds = Math.ceil((parseInt(cooldownUntil) - now) / 1000);
      return {
        isLocked: false,
        cooldownSeconds: remainingSeconds,
        message: `Aguarde ${remainingSeconds}s antes de tentar novamente.`
      };
    } else {
      localStorage.removeItem(`${STORAGE_KEY_COOLDOWN_UNTIL}${suffix}`);
    }
  }
  
  return { isLocked: false };
}

/**
 * Registra uma tentativa de login falha
 */
export function recordFailedLogin(identifier = '') {
  const suffix = identifier ? `:${normalizeIdentifier(identifier)}` : '';
  const currentAttempts = parseInt(localStorage.getItem(`${STORAGE_KEY_ATTEMPTS}${suffix}`) || '0') + 1;
  localStorage.setItem(`${STORAGE_KEY_ATTEMPTS}${suffix}`, currentAttempts.toString());
  
  if (currentAttempts >= MAX_LOGIN_ATTEMPTS) {
    const lockoutTime = Date.now() + LOCKOUT_DURATION_MS;
    localStorage.setItem(`${STORAGE_KEY_LOCKOUT}${suffix}`, lockoutTime.toString());
    return {
      isLocked: true,
      remainingMinutes: 15,
      remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
      message: 'Muitas tentativas falhas. Acesso bloqueado por 15 minutos.'
    };
  }

  const cooldownSeconds = Math.min(20, Math.max(1, Math.pow(2, Math.max(0, currentAttempts - 1))));
  const cooldownUntil = Date.now() + cooldownSeconds * 1000;
  localStorage.setItem(`${STORAGE_KEY_COOLDOWN_UNTIL}${suffix}`, cooldownUntil.toString());
  
  return {
    isLocked: false,
    attemptsLeft: MAX_LOGIN_ATTEMPTS - currentAttempts,
    cooldownSeconds
  };
}

/**
 * Limpa o registro de tentativas falhas após login bem-sucedido
 */
export function clearLoginAttempts(identifier = '') {
  const suffix = identifier ? `:${normalizeIdentifier(identifier)}` : '';
  localStorage.removeItem(`${STORAGE_KEY_ATTEMPTS}${suffix}`);
  localStorage.removeItem(`${STORAGE_KEY_LOCKOUT}${suffix}`);
  localStorage.removeItem(`${STORAGE_KEY_COOLDOWN_UNTIL}${suffix}`);
}

/**
 * Validação de Honey Pot (Anti-Bot)
 */
export function validateHoneyPot(value) {
  if (value) {
    console.warn('🚨 BOT DETECTADO: Honey pot preenchido');
    return false; // Falhou (é bot)
  }
  return true; // Passou
}

export function validateDoubleHoneyPot(values = []) {
  return values.every((v) => validateHoneyPot(v));
}

export function validateFormTiming(startedAtMs, { minMs = 1200, maxMs = 1000 * 60 * 60 } = {}) {
  const started = Number(startedAtMs || 0);
  if (!started) return false;
  const elapsed = Date.now() - started;
  if (elapsed < minMs) return false;
  if (elapsed > maxMs) return false;
  return true;
}

function normalizeIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}
