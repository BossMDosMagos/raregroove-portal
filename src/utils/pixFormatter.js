/**
 * Utilitários de formatação e validação de chaves PIX
 * Suporta máscara visual e normalização para padrão Banco Central
 */

/**
 * Formata visualmente a chave PIX enquanto o usuário digita
 * Mostra máscara apropriada para cada tipo de chave
 * @param {string} value - Valor bruto digitado pelo usuário
 * @returns {string} Valor formatado com máscara
 */
export function formatPixKeyDisplay(value) {
  const cleaned = value.replace(/\D/g, '');
  
  // Email - retorna como está
  if (value.includes('@')) {
    return value.trimStart();
  }

  // 11 dígitos - Telefone celular (DDD + 9 + 8 dígitos)
  if (cleaned.length === 11) {
    // Verificar se começa com 1 ou 9 válido
    const ddd = parseInt(cleaned.substring(0, 2));
    const isValidDDD = ddd >= 11 && ddd <= 99;
    const thirdDigit = cleaned.charAt(2);
    
    if (isValidDDD && thirdDigit === '9') {
      return `+55 (${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
  }

  // 10 dígitos - Telefone fixo (DDD + 8 dígitos)
  if (cleaned.length === 10) {
    const ddd = parseInt(cleaned.substring(0, 2));
    const isValidDDD = ddd >= 11 && ddd <= 99;
    
    if (isValidDDD) {
      return `+55 (${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
  }

  // 14 dígitos - CNPJ
  if (cleaned.length === 14) {
    return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`;
  }

  // 11 dígitos - CPF
  if (cleaned.length === 11 && cleaned.length === value.replace(/\./g, '').replace(/\-/g, '').length) {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
  }

  // Chave aleatória ou outros formatos
  return value.trimStart();
}

/**
 * Normaliza a chave PIX para o padrão aceito pelo Banco Central
 * Adiciona automaticamente +55 em telefones
 * @param {string} value - Valor da chave PIX
 * @returns {string} Chave normalizada
 */
export function normalizePixKeyForBrcode(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  // Remove labels comuns (CPF:, CNPJ:, etc)
  const withoutLabel = raw.replace(/^(cpf|cnpj|telefone|celular|email|aleatoria|aleatório|chave)\s*[:\-]\s*/i, '').trim();

  // Email: retorna lowercase
  if (withoutLabel.includes('@')) {
    return withoutLabel.toLowerCase();
  }

  const digitsOnly = withoutLabel.replace(/\D/g, '');

  // TELEFONE BRASILEIRO: 10 ou 11 dígitos
  if (digitsOnly.length === 11 || digitsOnly.length === 10) {
    const ddd = parseInt(digitsOnly.substring(0, 2));
    const isValidDDD = ddd >= 11 && ddd <= 99;
    
    const thirdDigit = digitsOnly.charAt(2);
    const isCellphone = digitsOnly.length === 11 && thirdDigit === '9';
    const isLandline = digitsOnly.length === 10;
    
    // Se tem DDD válido E (é celular OU fixo): É TELEFONE
    // OBRIGATORIAMENTE adiciona +55
    if (isValidDDD && (isCellphone || isLandline)) {
      return `+55${digitsOnly}`;
    }
  }

  // CPF (11 dígitos) ou CNPJ (14 dígitos): retorna só os dígitos
  if (digitsOnly.length === 11 || digitsOnly.length === 14) {
    return digitsOnly;
  }

  // Telefone que já começa com +
  if (withoutLabel.startsWith('+')) {
    return `+${withoutLabel.slice(1).replace(/\D/g, '')}`;
  }

  // Telefone com código de país mas sem +
  if (digitsOnly.length >= 12 && digitsOnly.length <= 13 && digitsOnly.startsWith('55')) {
    return `+${digitsOnly}`;
  }

  // Chave aleatória ou outros formatos: remove espaços
  return withoutLabel.replace(/\s+/g, '');
}

/**
 * Valida se a chave PIX é válida
 * @param {string} value - Chave PIX a validar
 * @returns {object} { isValid, message, type }
 */
export function validatePixKey(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return { isValid: false, message: 'Chave PIX é obrigatória', type: null };
  }

  const normalized = normalizePixKeyForBrcode(value);
  
  if (!normalized) {
    return { isValid: false, message: 'Formato de chave PIX inválido', type: null };
  }

  // Email
  if (normalized.includes('@')) {
    return { 
      isValid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized), 
      message: normalized.includes('@') ? 'Email PIX válido' : 'Email inválido',
      type: 'email'
    };
  }

  // Telefone
  if (normalized.startsWith('+55')) {
    return { 
      isValid: normalized.length === 13 || normalized.length === 12,
      message: 'Telefone PIX válido',
      type: 'telefone'
    };
  }

  // CPF
  if (/^\d{11}$/.test(normalized)) {
    return { 
      isValid: true, 
      message: 'CPF PIX válido',
      type: 'cpf'
    };
  }

  // CNPJ
  if (/^\d{14}$/.test(normalized)) {
    return { 
      isValid: true, 
      message: 'CNPJ PIX válido',
      type: 'cnpj'
    };
  }

  // Chave aleatória (32 caracteres)
  if (normalized.length === 36) {
    return { 
      isValid: true, 
      message: 'Chave aleatória PIX válida',
      type: 'aleatoria'
    };
  }

  return { 
    isValid: false, 
    message: 'Formato de chave PIX não reconhecido',
    type: null 
  };
}

/**
 * Obtém um ícone de tipo de chave PIX
 * @param {string} type - Tipo da chave (email, cpf, cnpj, telefone, aleatoria)
 * @returns {string} Emoji/símbolo representativo
 */
export function getPixTypeIcon(type) {
  const icons = {
    email: '📧',
    cpf: '📝',
    cnpj: '🏢',
    telefone: '📱',
    aleatoria: '🔑'
  };
  return icons[type] || '💳';
}

/**
 * Mascara visualmente uma chave PIX para exibição (ocultando dígitos)
 * @param {string} value - Chave PIX
 * @returns {string} Chave mascarada
 */
export function maskPixKeyDisplay(value) {
  if (!value) return '—';
  
  const normalized = normalizePixKeyForBrcode(value);
  
  // Email
  if (normalized.includes('@')) {
    const [local, domain] = normalized.split('@');
    if (local.length <= 3) {
      return `${local}@***`;
    }
    return `${local.substring(0, 3)}***@${domain}`;
  }

  // Telefone
  if (normalized.startsWith('+55')) {
    const lastFour = normalized.slice(-4);
    return `+55 (****) *****-${lastFour}`;
  }

  // CPF
  if (normalized.length === 11) {
    return `***.***.***.${normalized.slice(-2)}`;
  }

  // CNPJ
  if (normalized.length === 14) {
    return `**.***.***/****.${normalized.slice(-2)}`;
  }

  return '••••••••••••••••';
}
