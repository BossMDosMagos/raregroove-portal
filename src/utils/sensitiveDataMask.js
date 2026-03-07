export function maskEmail(value, isAdmin = false) {
  // Portal/Admin tem transparência total
  if (isAdmin) return String(value || '');

  const email = String(value || '').trim();
  if (!email || !email.includes('@')) return '***';

  const [localPart, domainPart] = email.split('@');
  if (!domainPart) return '***';

  const safeLocal = localPart.length <= 2
    ? `${localPart[0] || '*'}*`
    : `${localPart.slice(0, 2)}${'*'.repeat(Math.max(localPart.length - 2, 3))}`;

  const domainChunks = domainPart.split('.');
  const domainName = domainChunks[0] || '';
  const domainSuffix = domainChunks.slice(1).join('.') || '***';
  const safeDomain = domainName.length <= 1
    ? '*'
    : `${domainName[0]}${'*'.repeat(Math.max(domainName.length - 1, 2))}`;

  return `${safeLocal}@${safeDomain}.${domainSuffix}`;
}

export function maskPhone(value, isAdmin = false) {
  if (isAdmin) return String(value || '');
  
  const phone = String(value || '').trim().replace(/\D/g, '');
  if (!phone || phone.length < 4) return '***';
  
  // Formato: +55 (XX) XXXXX-XXXX -> mostrar apenas primeiros 2 e últimos 4 dígitos
  return `+55 (${phone.slice(0, 2)}) ****-${phone.slice(-4)}`;
}

export function maskCPF(value, isAdmin = false) {
  if (isAdmin) return String(value || '');
  
  const cpf = String(value || '').trim().replace(/\D/g, '');
  if (!cpf || cpf.length !== 11) return '***';
  
  // Formato: XXX.XXX.XXX-XX -> *** .*** .***-45
  return `***.***.***.${cpf.slice(-2)}`;
}

export function maskRG(value, isAdmin = false) {
  if (isAdmin) return String(value || '');
  
  const rg = String(value || '').trim().replace(/\D/g, '');
  if (!rg || rg.length < 4) return '***';
  
  // Mostrar apenas últimos 3 dígitos
  return `***.***.*${rg.slice(-3)}`;
}

export function maskPixKey(value, isAdmin = false) {
  if (isAdmin) return String(value || '');
  
  const key = String(value || '').trim();
  if (!key) return '***';
  
  // Se o PIX key é um email
  if (key.includes('@')) {
    return maskEmail(key, false);
  }
  
  // Se é telefone (11 dígitos)
  if (/^\d{11}$/.test(key)) {
    return maskPhone(key, false);
  }
  
  // Se é CPF (11 dígitos)
  if (/^\d{11}$/.test(key.replace(/\D/g, ''))) {
    return maskCPF(key, false);
  }
  
  // Se é chave aleatória (UUID)
  if (key.length > 10) {
    return `${key.slice(0, 4)}****${key.slice(-4)}`;
  }
  
  // Fallback
  return '***';
}

export function maskAddress(value, isAdmin = false) {
  if (isAdmin) return String(value || '');
  
  const address = String(value || '').trim();
  if (!address) return '***';
  
  // Mostrar apenas primeiro e último caractere de cada palavra
  const words = address.split(' ');
  return words
    .map(word => word.length <= 2 ? '**' : `${word[0]}${'*'.repeat(word.length - 2)}${word[word.length - 1]}`)
    .join(' ');
}

export function maskName(value, isAdmin = false) {
  if (isAdmin) return String(value || '');
  
  const name = String(value || '').trim();
  if (!name) return '***';

  const words = name.split(' ').filter(Boolean);
  if (words.length === 1) {
    const first = words[0];
    return first.length <= 2 ? `${first[0] || '*'}*` : `${first.slice(0, 2)}${'*'.repeat(first.length - 2)}`;
  }

  return words
    .map((word, index) => {
      if (index === 0) {
        return word.length <= 2 ? `${word[0] || '*'}*` : `${word.slice(0, 2)}${'*'.repeat(word.length - 2)}`;
      }
      return `${word[0] || '*'}${'*'.repeat(Math.max(word.length - 1, 1))}`;
    })
    .join(' ');
}
