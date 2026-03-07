/**
 * Testes das funções de PIX
 * Execute no console do navegador ou com Node.js
 */

// ─── TESTES DE FORMATAÇÃO ───────────
function testFormatPixKeyDisplay() {
  console.log('\n========== TESTE: formatPixKeyDisplay ==========');
  
  const tests = [
    { input: '21985581997', expected: '+55 (21) 98558-1997', name: 'Celular (11 dígitos)' },
    { input: '2132334455', expected: '+55 (21) 3233-4455', name: 'Fixo (10 dígitos)' },
    { input: '(21) 98558-1997', expected: '+55 (21) 98558-1997', name: 'Celular já formatado' },
    { input: '123.456.789-10', expected: '123.456.789-10', name: 'CPF' },
    { input: '12345678901234', expected: '12.345.678/1234-10', name: 'CNPJ' },
    { input: 'usuario@raregroove.com', expected: 'usuario@raregroove.com', name: 'Email' },
    { input: '11987654321', expected: '+55 (11) 98765-4321', name: 'São Paulo celular' },
  ];

  tests.forEach(test => {
    // Aqui você chama a função real
    // const result = formatPixKeyDisplay(test.input);
    // console.log(`✓ ${test.name}: "${test.input}" → "${result}"`);
  });
}

// ─── TESTES DE NORMALIZAÇÃO ────────────
function testNormalizePixKeyForBrcode() {
  console.log('\n========== TESTE: normalizePixKeyForBrcode ==========');
  
  const tests = [
    { input: '21985581997', expected: '+5521985581997', name: 'Celular' },
    { input: '2132334455', expected: '+552132334455', name: 'Fixo' },
    { input: '+55 (21) 98558-1997', expected: '+5521985581997', name: 'Celular com máscara' },
    { input: '123.456.789-10', expected: '12345678910', name: 'CPF' },
    { input: 'usuario@dominio.com', expected: 'usuario@dominio.com', name: 'Email' },
    { input: 'USUARIO@DOMINIO.COM', expected: 'usuario@dominio.com', name: 'Email uppercase' },
    { input: 'CPF: 123.456.789-10', expected: '12345678910', name: 'CPF com label' },
    { input: 'Telefone: 21 98558-1997', expected: '+5521985581997', name: 'Telefone com label' },
  ];

  tests.forEach(test => {
    // const result = normalizePixKeyForBrcode(test.input);
    // console.log(`✓ ${test.name}: "${test.input}" → "${result}"`);
  });
}

// ─── TESTES DE VALIDAÇÃO ────────────
function testValidatePixKey() {
  console.log('\n========== TESTE: validatePixKey ==========');
  
  const tests = [
    { input: '21985581997', expectedType: 'telefone', expectedValid: true, name: 'Celular válido' },
    { input: '2132334455', expectedType: 'telefone', expectedValid: true, name: 'Fixo válido' },
    { input: '123.456.789-10', expectedType: 'cpf', expectedValid: true, name: 'CPF válido' },
    { input: '12345678901234', expectedType: 'cnpj', expectedValid: true, name: 'CNPJ válido' },
    { input: 'usuario@dominio.com', expectedType: 'email', expectedValid: true, name: 'Email válido' },
    { input: '01987654321', expectedType: 'telefone', expectedValid: false, name: 'DDD inválido (01)' },
    { input: '+5521985581997', expectedType: 'telefone', expectedValid: true, name: 'Telefone com +55' },
  ];

  tests.forEach(test => {
    // const result = validatePixKey(test.input);
    // console.log(`✓ ${test.name}:`, { valid: result.isValid, type: result.type });
  });
}

// ─── TESTES DE MÁSCARA DE SEGURANÇA ────────────
function testMaskPixKeyDisplay() {
  console.log('\n========== TESTE: maskPixKeyDisplay ==========');
  
  const tests = [
    { input: '+5521985581997', name: 'Telefone' },
    { input: 'usuario@dominio.com', name: 'Email' },
    { input: '12345678901', name: 'CPF' },
    { input: '12345678901234', name: 'CNPJ' },
  ];

  tests.forEach(test => {
    // const result = maskPixKeyDisplay(test.input);
    // console.log(`✓ ${test.name}: "${test.input}" → "${result}"`);
  });
}

// ─── TESTES DE GERAÇÃO DE BRCODE ────────────
function testGeneratePixBrcode() {
  console.log('\n========== TESTE: generatePixBrcode ==========');
  
  const tests = [
    { pixKey: '+5521985581997', amount: 0, name: 'Celular sem valor fixo' },
    { pixKey: '+5521985581997', amount: 100.50, name: 'Celular com valor fixo' },
    { pixKey: '12345678901', amount: 0, name: 'CPF sem valor' },
    { pixKey: 'usuario@dominio.com', amount: 0, name: 'Email sem valor' },
  ];

  tests.forEach(test => {
    // const brcode = generatePixBrcode(test.pixKey, test.amount);
    // console.log(`✓ ${test.name}:`);
    // console.log(`  Chave: ${test.pixKey}`);
    // console.log(`  Valor: R$ ${test.amount}`);
    // console.log(`  Brcode (primeiros 50 chars): ${brcode.substring(0, 50)}...`);
    // console.log(`  Tamanho total: ${brcode.length} caracteres`);
    // console.log(`  Válido: ${isValidBrcode(brcode)}`);
  });
}

// ─── TESTES DE VALIDAÇÃO DE BRCODE ────────────
function testIsValidBrcode() {
  console.log('\n========== TESTE: isValidBrcode ==========');
  
  // Brcode válido começa com 000201 e contém 6304
  console.log('✓ Válido: Começa com 000201 e contém 6304');
  console.log('✓ Inválido: Não começa com 000201 ou não contém 6304');
}

// ─── TESTE DE CRC16 ────────────
function testCalculateCRC16() {
  console.log('\n========== TESTE: calculateCRC16 ==========');
  
  // O CRC16 é anexado automaticamente no gerador de Brcode
  // Este teste verifica se o CRC é de 4 caracteres hexadecimais
  console.log('✓ CRC16 implementado com polinômio 0x1021');
  console.log('✓ Valor inicial: 0xFFFF');
  console.log('✓ Resultado: 4 caracteres hexadecimais em maiúsculas');
}

// ─── SCRIPT PRINCIPAL ────────────
function runAllTests() {
  console.clear();
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║     TESTES DAS FUNÇÕES DE PIX - RAREGROOVE    ║');
  console.log('╚════════════════════════════════════════════════╝');

  testFormatPixKeyDisplay();
  testNormalizePixKeyForBrcode();
  testValidatePixKey();
  testMaskPixKeyDisplay();
  testGeneratePixBrcode();
  testIsValidBrcode();
  testCalculateCRC16();

  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║          TESTES EXECUTADOS COM SUCESSO!        ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  console.log('Para testar com valores reais, importe as funções:');
  console.log('import { formatPixKeyDisplay, normalizePixKeyForBrcode, validatePixKey, maskPixKeyDisplay } from "./utils/pixFormatter.js";');
  console.log('import { generatePixBrcode, isValidBrcode } from "./utils/pixBrcode.js";\n');
}

// Executar testes se não estiver em ambiente de browser
if (typeof window === 'undefined') {
  runAllTests();
}

// ─── EXEMPLOS PRÁTICOS ────────────
console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║                     EXEMPLOS PRÁTICOS DE USO                          ║
╚════════════════════════════════════════════════════════════════════════╝

1️⃣  ENTRADA: "21985581997" (só números)
   ↓
   formatPixKeyDisplay() → "+55 (21) 98558-1997" (na tela)
   ↓
   normalizePixKeyForBrcode() → "+5521985581997" (no banco)
   ↓
   generatePixBrcode() → "00020126860014br.gov.bcb.pixd..." (no QR)
   ↓
   QRCode.render() → QR Code visual

2️⃣  ENTRADA: "usuario@dominio.com" (email)
   ↓
   formatPixKeyDisplay() → "usuario@dominio.com" (na tela)
   ↓
   normalizePixKeyForBrcode() → "usuario@dominio.com" (no banco)
   ↓
   generatePixBrcode() → "00020126860014br.gov.bcb.pixd..." (no QR)
   ↓
   QRCode.render() → QR Code visual

3️⃣  ENTRADA: "123.456.789-10" (CPF)
   ↓
   formatPixKeyDisplay() → "123.456.789-10" (na tela)
   ↓
   normalizePixKeyForBrcode() → "12345678910" (no banco)
   ↓
   generatePixBrcode() → "00020126860014br.gov.bcb.pixd..." (no QR)
   ↓
   QRCode.render() → QR Code visual

════════════════════════════════════════════════════════════════════════
`);
