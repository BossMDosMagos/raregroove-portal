const BLOCKED_TOKEN = '[CONTEÚDO BLOQUEADO]';

const phoneRegex = /(\(?\d{2}\)?\s?\d{4,5}-?\d{4})/g;
const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const linkRegex = /https?:\/\/\S+/gi;

// Padrões suspeitos (números isolados, arrobas, pontos repetidos)
const suspiciousPatterns = [
  /^\d{1,2}$/,  // Apenas 1-2 dígitos
  /^\d{3,}$/,   // 3+ dígitos seguidos
  /^@/,          // Mensagem começando com @
  /^\w+@$/,      // Começo de email
  /^www\./i,     // Começo de URL
  /^\.(com|br|net|org|gov|edu|io|co|app|dev)$/i,  // Domínio isolado
  /^\d+\.\d+/,  // Números com ponto
  /^\.[\w-]+\.(com|br|net|org|gov|edu|io|co|app|dev)/i, // .provedor.com
];

// Provedores de email/domínios comuns
const emailProviders = [
  'gmail', 'hotmail', 'outlook', 'yahoo', 'icloud', 'live', 'msn',
  'uol', 'bol', 'terra', 'ig', 'globo', 'r7', 'oi', 'tim',
  'proton', 'zoho', 'aol', 'mail', 'email', 'yandex'
];

// Palavras e frases suspeitas
const contactKeywords = [
  'email', 'e-mail', 'e mail', 'gmail', 'hotmail', 'outlook',
  'google', 'yahoo', 'correio', 'mensagem', 'manda', 'mandar',
  'resto', 'resto é', 'resto do', 'sabe qual é', 'já sabe',
  'tu sabe', 'você sabe', 'vc sabe', 'imagina', 'adivinha',
  'whatsapp', 'whats', 'zap', 'wpp', 'tel', 'telefone', 'fone',
  'celular', 'número', 'numero', 'ligar', 'liga', 'chama',
  'me chama', 'me liga', 'me add', 'me adiciona', 'adiciona',
  'fora daqui', 'fora do site', 'conversar melhor', 'continuar',
  'arroba', '@', 'ponto com', 'ponto br', '.com', '.br',
  'underline', 'underscore', 'traço', 'hífen',
  'sabe né', 'entendeu', 'sacou', 'captou', 'pegou',
  'é o de sempre', 'o de sempre', 'de sempre', 'usual'
];

const domainFragmentRegex = new RegExp(`^(${emailProviders.join('|')})$`, 'i');

function containsContactKeywords(text) {
  const lowerText = text.toLowerCase();
  return contactKeywords.some(keyword => lowerText.includes(keyword));
}

export function sanitizeMessage(text) {
  if (!text) return '';
  return text
    .replace(phoneRegex, BLOCKED_TOKEN)
    .replace(emailRegex, BLOCKED_TOKEN)
    .replace(linkRegex, BLOCKED_TOKEN);
}

export function isMessageEmptyAfterSanitize(text) {
  const sanitized = sanitizeMessage(text);
  const withoutBlocked = sanitized.replace(/\[CONTEÚDO BLOQUEADO\]/gi, '').trim();
  return withoutBlocked.length === 0;
}

export function isMessageTooShort(text, minLength = 2) {
  const trimmed = text?.trim() || '';
  return trimmed.length < minLength;
}

export function hasSuspiciousPattern(text) {
  const trimmed = text?.trim() || '';
  
  if (suspiciousPatterns.some(pattern => pattern.test(trimmed))) {
    return true;
  }
  
  if (domainFragmentRegex.test(trimmed)) {
    return true;
  }
  
  if (/^\s*\.?\s*(gmail|hotmail|outlook|yahoo)\s*\.?\s*(com|br)/i.test(trimmed)) {
    return true;
  }
  
  // Bloquear mensagens com palavras-chave suspeitas
  if (containsContactKeywords(trimmed)) {
    return true;
  }
  
  return false;
}

export function detectPatternInHistory(recentMessages) {
  if (!recentMessages || recentMessages.length < 2) return false;
  
  const combined = recentMessages.slice(-10).map(m => m.content).join('');
  
  if (
    phoneRegex.test(combined) ||
    emailRegex.test(combined) ||
    linkRegex.test(combined) ||
    /\d{10,}/.test(combined)
  ) {
    return true;
  }
  
  // Detectar email com ponto substituindo @
  for (let i = 1; i < Math.min(recentMessages.length, 4); i++) {
    const lastMessages = recentMessages.slice(-i-1, -i+2);
    const withAt = lastMessages.map(m => m.content).join('@');
    const withAtNoDot = lastMessages.map(m => m.content.replace(/^\./, '')).join('@');
    const withAtNoSpace = lastMessages.map(m => m.content.trim()).join('@');
    
    if (emailRegex.test(withAt) || emailRegex.test(withAtNoDot) || emailRegex.test(withAtNoSpace)) {
      return true;
    }
  }
  
  const lastTwo = recentMessages.slice(-2).map(m => m.content.toLowerCase().trim()).join('');
  if (emailProviders.some(provider => lastTwo.includes(provider))) {
    return true;
  }
  
  // Detectar linguagem sugestiva após mensagem curta
  if (recentMessages.length >= 2) {
    const [prevMsg, currentMsg] = recentMessages.slice(-2);
    const prevContent = prevMsg.content.toLowerCase().trim();
    const currentContent = currentMsg.content.toLowerCase().trim();
    
    if (prevContent.length < 20 && containsContactKeywords(currentContent)) {
      return true;
    }
    
    if (prevContent.length < 15 && emailProviders.some(provider => currentContent.includes(provider))) {
      return true;
    }
  }
  
  return false;
}

export function isSpamming(recentMessages, timeWindowMs = 10000) {
  if (!recentMessages || recentMessages.length < 5) return false;
  
  const now = Date.now();
  const recentCount = recentMessages.filter(m => {
    const msgTime = new Date(m.created_at).getTime();
    return (now - msgTime) < timeWindowMs;
  }).length;
  
  return recentCount > 5;
}
