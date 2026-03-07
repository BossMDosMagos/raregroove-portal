// 🛡️ CLIENT-SIDE SECURITY UTILS
// ========================================

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutos
const STORAGE_KEY_ATTEMPTS = 'rg_auth_attempts';
const STORAGE_KEY_LOCKOUT = 'rg_auth_lockout';

/**
 * Verifica se o usuário está bloqueado temporariamente
 */
export function checkLoginLockout() {
  const lockoutUntil = localStorage.getItem(STORAGE_KEY_LOCKOUT);
  
  if (lockoutUntil) {
    const now = Date.now();
    if (now < parseInt(lockoutUntil)) {
      const remainingMinutes = Math.ceil((parseInt(lockoutUntil) - now) / 60000);
      return {
        isLocked: true,
        remainingMinutes,
        message: `Muitas tentativas falhas. Tente novamente em ${remainingMinutes} minutos.`
      };
    } else {
      // Bloqueio expirou
      localStorage.removeItem(STORAGE_KEY_LOCKOUT);
      localStorage.removeItem(STORAGE_KEY_ATTEMPTS);
    }
  }
  
  return { isLocked: false };
}

/**
 * Registra uma tentativa de login falha
 */
export function recordFailedLogin() {
  const currentAttempts = parseInt(localStorage.getItem(STORAGE_KEY_ATTEMPTS) || '0') + 1;
  localStorage.setItem(STORAGE_KEY_ATTEMPTS, currentAttempts.toString());
  
  if (currentAttempts >= MAX_LOGIN_ATTEMPTS) {
    const lockoutTime = Date.now() + LOCKOUT_DURATION;
    localStorage.setItem(STORAGE_KEY_LOCKOUT, lockoutTime.toString());
    return {
      isLocked: true,
      remainingMinutes: 15,
      message: 'Muitas tentativas falhas. Acesso bloqueado por 15 minutos.'
    };
  }
  
  return {
    isLocked: false,
    attemptsLeft: MAX_LOGIN_ATTEMPTS - currentAttempts
  };
}

/**
 * Limpa o registro de tentativas falhas após login bem-sucedido
 */
export function clearLoginAttempts() {
  localStorage.removeItem(STORAGE_KEY_ATTEMPTS);
  localStorage.removeItem(STORAGE_KEY_LOCKOUT);
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
