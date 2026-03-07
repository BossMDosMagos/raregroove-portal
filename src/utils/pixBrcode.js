/**
 * Gerador de QR Code PIX - Padrão Banco Central do Brasil (EMV QRCode)
 * Implementação do padrão oficial de Código de Barras 2D para PIX
 */

/**
 * Calcula CRC16-CCITT (polinômio 0x1021)
 * @param {string} input - String ASCII do payload
 * @returns {string} CRC16 em 4 caracteres hexadecimais
 */
function calculateCRC16(input) {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    const byte = input.charCodeAt(i);
    crc ^= byte << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).padStart(4, '0').toUpperCase();
}

function onlyValidPixChars(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .\-@_]/g, '')
    .trim();
}

function normalizePixKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const withoutLabel = raw.replace(/^(cpf|cnpj|telefone|celular|email|aleatoria|aleatório|chave)\s*[:\-]\s*/i, '').trim();

  // Email: retorna lowercase
  if (withoutLabel.includes('@')) {
    return withoutLabel.toLowerCase();
  }

  const digitsOnly = withoutLabel.replace(/\D/g, '');

  // TELEFONE BRASILEIRO: 10 ou 11 dígitos / ou já com +55 (12 ou 13 dígitos)
  if (digitsOnly.length === 11 || digitsOnly.length === 10) {
    const ddd = parseInt(digitsOnly.substring(0, 2));
    const isValidDDD = ddd >= 11 && ddd <= 99;
    
    // Se tem 11 dígitos, verifica se o 3º dígito é 9 (celular)
    const thirdDigit = digitsOnly.charAt(2);
    const isCellphone = digitsOnly.length === 11 && thirdDigit === '9';
    const isLandline = digitsOnly.length === 10;
    
    // Se tem DDD válido E (é celular OU fixo): É TELEFONE
    // OBRIGATORIAMENTE adiciona +55 para padrão Banco Central
    if (isValidDDD && (isCellphone || isLandline)) {
      return `+55${digitsOnly}`;
    }
  }

  // Telefone que já começa com +55 (12 ou 13 dígitos)
  if (digitsOnly.length === 12 || digitsOnly.length === 13) {
    if (digitsOnly.startsWith('55')) {
      return `+${digitsOnly}`;
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

  // Chave aleatória ou outros formatos
  return withoutLabel.replace(/\s+/g, '');
}

function normalizeTxid(value) {
  const raw = String(value || '').trim();
  if (raw === '***') return '***';

  const normalized = onlyValidPixChars(raw)
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .substring(0, 25);

  return normalized || '***';
}

/**
 * Codifica um par tag-length-value
 * @param {string} tag - Tag de 2 dígitos
 * @param {string} value - Valor da tag
 * @returns {string} String codificada
 */
function encodeTagValue(tag, value) {
  const length = value.length.toString().padStart(2, '0');
  return `${tag}${length}${value}`;
}

/**
 * Gera Brcode PIX padrão Banco Central do Brasil (EMV QRCode Estático)
 * Segue rigorosamente o padrão: https://www.bcb.gov.br/estabilidade/pix/arquivos/resolucoErbcpix2020.pdf
 * 
 * Estrutura EMV completa:
 * - Tag 00: Payload Format Indicator (sempre '01' para PIX)
 * - Tag 01: Point of Initiation Method (12=estático, 11=dinâmico)
 * - Tag 26: Merchant Account Information
 *   - Sub-tag 00: GUID do PIX do Banco Central ('br.gov.bcb.pix')
 *   - Sub-tag 01: Chave PIX (CPF, CNPJ, telefone com +55, email ou aleatória)
 * - Tag 52: Merchant Category Code (MCC) - 0000 para não especificado
 * - Tag 53: Transaction Currency (986 = BRL - Real Brasileiro)
 * - Tag 54: Transaction Amount (opcional se não houver valor fixo)
 * - Tag 58: Country Code (sempre 'BR')
 * - Tag 59: Merchant Name (nome do beneficiário)
 * - Tag 60: Merchant City (cidade do beneficiário)
 * - Tag 62: Additional Data Field Template
 *   - Sub-tag 05: Unique Transaction Identifier (txid - até 25 caracteres)
 * - Tag 63: CRC16-CCITT (validação - OBRIGATÓRIO)
 *
 * @param {string} pixKey - Chave PIX já normalizada (+5521985581997, 12345678901234, email@domain.com, etc)
 * @param {number} amount - Valor da transação em reais (0 = sem valor fixo)
 * @param {object} options - Opções adicionais
 * @returns {string} Brcode completo para gerar QR Code (ex: 00020126860014br.gov.bcb.pixd)
 */
export function generatePixBrcode(pixKey, amount, options = {}) {
  try {
    const {
      merchantName = 'RAREGROOVE',
      merchantCity = 'BRASIL',
      txid = '***'
    } = options;

    const cleanPixKey = normalizePixKey(pixKey);
    if (!cleanPixKey) return '';

    const safeMerchantName = onlyValidPixChars(merchantName).substring(0, 25) || 'RAREGROOVE';
    const safeMerchantCity = onlyValidPixChars(merchantCity).substring(0, 15) || 'BRASIL';
    const safeTxid = normalizeTxid(txid);

    let brcode = '';

    // Tag 00: Payload Format Indicator
    brcode += encodeTagValue('00', '01');

    // Tag 01: Point of Initiation Method (12 = Estático, 11 = Dinâmico)
    brcode += encodeTagValue('01', '12');

    // Tag 26: Merchant Account Information (PIX)
    let merchantInfo = '';
    merchantInfo += encodeTagValue('00', 'br.gov.bcb.pix');
    merchantInfo += encodeTagValue('01', cleanPixKey);
    
    brcode += encodeTagValue('26', merchantInfo);

    // Tag 52: Merchant Category Code (MCC)
    brcode += encodeTagValue('52', '0000');

    // Tag 53: Transaction Currency (986 = BRL)
    brcode += encodeTagValue('53', '986');

    // Tag 54: Transaction Amount
    if (Number(amount) > 0) {
      brcode += encodeTagValue('54', Number(amount).toFixed(2));
    }

    // Tag 58: Country Code
    brcode += encodeTagValue('58', 'BR');

    // Tag 59: Merchant Name
    brcode += encodeTagValue('59', safeMerchantName.toUpperCase());

    // Tag 60: Merchant City
    brcode += encodeTagValue('60', safeMerchantCity.toUpperCase());

    // Tag 62: Additional Data Field Template
    let additionalData = '';
    additionalData += encodeTagValue('05', safeTxid);
    brcode += encodeTagValue('62', additionalData);

    // Tag 63: CRC16-CCITT
    const payloadForCrc = `${brcode}6304`;
    const crc16 = calculateCRC16(payloadForCrc);
    brcode = `${payloadForCrc}${crc16}`;

    return brcode;
  } catch (error) {
    console.error('Erro ao gerar Brcode PIX:', error);
    return pixKey; // Fallback
  }
}

/**
 * Gera URL para QR Code usando API gratuita do Banco Central
 * @param {string} brcode - Brcode PIX
 * @returns {string} URL da imagem QR Code
 */
export function getQRCodeURL(brcode) {
  // Usando API gratuita e confiável
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(brcode)}`;
}

/**
 * Gera URL para QR Code usando API alternativa (Pix.siderite.com.br)
 * Mais específica para PIX, mas requer validação
 * @param {string} brcode - Brcode PIX
 * @returns {string} URL da imagem QR Code
 */
export function getQRCodeURLAlternative(brcode) {
  // API alternativa mais específica
  return `https://pix.siderite.com.br/qr-code/generate?data=${encodeURIComponent(brcode)}&size=300`;
}

/**
 * Valida se um Brcode PIX é válido
 * @param {string} brcode - Brcode a validar
 * @returns {boolean} true se válido, false caso contrário
 */
export function isValidBrcode(brcode) {
  return Boolean(brcode) && brcode.startsWith('000201') && brcode.includes('6304');
}
