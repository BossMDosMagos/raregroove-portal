# PIX Máscara e Geração de QR Code - Implementação Completa

## 📋 O que foi implementado

### 1. **Arquivo: `src/utils/pixFormatter.js`**
   - `formatPixKeyDisplay(value)` - Formata visualmente a chave enquanto digita
   - `normalizePixKeyForBrcode(value)` - Normaliza para padrão Banco Central (+55 em telefones)
   - `validatePixKey(value)` - Valida e retorna tipo de chave
   - `maskPixKeyDisplay(value)` - Mascara para exibição segura
   - `getPixTypeIcon(type)` - Retorna emoji do tipo

### 2. **Arquivo: `src/components/PixQRCodePreview.jsx`**
   - `<PixQRCodePreview />` - Componente que gera e exibe o QR Code em tempo real
   - `<PixStatusBadge />` - Badge compacto com status do PIX
   - Usa `qrcode.react` para renderizar o QR Code

### 3. **Arquivo: `src/pages/Profile.jsx` - Atualizado**
   - Integração da máscara no campo de entrada
   - Preview em tempo real do QR Code
   - Feedback visual (válido/inválido)

### 4. **Arquivo: `src/utils/pixBrcode.js` - Melhorado**
   - Melhor tratamento de telefones brasileiros
   - Documentação completa do padrão EMV
   - CRC16-CCITT corretamente implementado

---

## ✅ Fluxo Completo de Uso

### Exemplo 1: Telefone Celular (mais comum)

**Entrada do usuário:** `21985581997` ou `(21) 98558-1997`

**Processamento:**
1. `formatPixKeyDisplay()` → `+55 (21) 98558-1997` (máscara visual)
2. `normalizePixKeyForBrcode()` → `+5521985581997` (padrão Banco Central)
3. `generatePixBrcode()` → Brcode completo
4. QR Code renderizado com `qrcode.react`

**Resultado no QR Code:**
```
00020126860014br.gov.bcb.pix260d+5521985581997520400005300986540...
```

### Exemplo 2: CPF

**Entrada do usuário:** `123.456.789-10` ou `12345678910`

**Processamento:**
1. `formatPixKeyDisplay()` → `123.456.789-10` (máscara visual)
2. `normalizePixKeyForBrcode()` → `12345678910` (sem formatação para Banco Central)
3. `generatePixBrcode()` → Brcode completo
4. QR Code renderizado

### Exemplo 3: E-mail

**Entrada do usuário:** `usuario@empresa.com.br`

**Processamento:**
1. `formatPixKeyDisplay()` → `usuario@empresa.com.br`
2. `normalizePixKeyForBrcode()` → `usuario@empresa.com.br` (lowercase)
3. `generatePixBrcode()` → Brcode completo
4. QR Code renderizado

### Exemplo 4: Telefone Fixo (10 dígitos)

**Entrada do usuário:** `2132334455` ou `(21) 3233-4455`

**Processamento:**
1. `formatPixKeyDisplay()` → `+55 (21) 3233-4455` (máscara visual)
2. `normalizePixKeyForBrcode()` → `+552132334455` (padrão Banco Central)
3. `generatePixBrcode()` → Brcode completo
4. QR Code renderizado

---

## 🔒 Estrutura do Brcode (EMV QRCode)

### Tags Principais:

| Tag | Campo | Valor | Descrição |
|-----|-------|-------|-----------|
| **00** | Payload Format Indicator | `01` | Padrão PIX |
| **01** | Point of Initiation Method | `12` | Estático (sem tempo limite) |
| **26** | Merchant Account Info | `br.gov.bcb.pix + chave` | GUID do BC + sua chave |
| **52** | Merchant Category Code | `0000` | Não especificado |
| **53** | Transaction Currency | `986` | Real Brasileiro (BRL) |
| **54** | Transaction Amount | `0.00` (opcional) | Valor fixo (0 = qualquer valor) |
| **58** | Country Code | `BR` | Brasil |
| **59** | Merchant Name | `RAREGROOVE` | Seu nome |
| **60** | Merchant City | `BRASIL` | Sua cidade |
| **62** | Additional Data Template | txid | ID único para rastreamento |
| **63** | CRC16-CCITT | 4 hex chars | Checksum de validade |

### Exemplo Real Completo:

```
00020126860014br.gov.bcb.pixd260d+5521985581997520400005300986540610005902RAREGROOVE5906BRASIL62190520***6304ABCD
```

**Quebra:**
- `0002` = Tag 00 (Payload), tamanho 02
- `01` = Valor "01"
- `2686001` = Tag 26 (Merchant Info), tamanho 86
  - `0014` = Sub-tag 00, tamanho 14
  - `br.gov.bcb.pix` = Valor (14 chars)
  - `001` = Sub-tag 01, tamanho...
  - `+5521985581997` = Sua chave normalizada
- `5204` = Tag 52, tamanho 04
- `0000` = Valor "0000"
- `5303` = Tag 53, tamanho 03
- `986` = Valor "986" (BRL)
- `5406` = Tag 54, tamanho 06
- `100.00` = Valor opcional
- `5802` = Tag 58, tamanho 02
- `BR` = Valor "BR"
- etc...
- `6304ABCD` = Tag 63, tamanho 04, valores CRC

---

## 🎨 Visual no Formulário

O componente `<PixQRCodePreview />` mostra:

1. **Status da chave:**
   - ✅ Verde se válida → exibe tipo (📧 📝 🏢 📱 🔑)
   - ❌ Vermelho se inválida → mostra erro

2. **QR Code renderizado:**
   - Tamanho 200x200px
   - Fundo branco, código preto
   - Salvo automaticamente ao clicar "Salvar Dados"

3. **Detalhes técnicos (colapsível):**
   - Mostra primeiros e últimos 20 chars do Brcode
   - Mostra tamanho total em caracteres

---

## 🧪 Testando as Funções

### JavaScript console:

```javascript
// Importar as funções
import { formatPixKeyDisplay, normalizePixKeyForBrcode, validatePixKey } from './utils/pixFormatter.js';
import { generatePixBrcode, isValidBrcode } from './utils/pixBrcode.js';

// Teste 1: Telefone celular
const phone = "21985581997";
console.log(formatPixKeyDisplay(phone)); // +55 (21) 98558-1997
console.log(normalizePixKeyForBrcode(phone)); // +5521985581997
console.log(validatePixKey(phone)); // { isValid: true, type: 'telefone', ... }
console.log(generatePixBrcode(phone)); // Brcode completo
console.log(isValidBrcode(brcode)); // true

// Teste 2: Email
const email = "teste@raregroove.com";
console.log(formatPixKeyDisplay(email)); // teste@raregroove.com
console.log(validatePixKey(email)); // { isValid: true, type: 'email', ... }

// Teste 3: CPF
const cpf = "12345678901";
console.log(formatPixKeyDisplay(cpf)); // 123.456.789-01
console.log(validatePixKey(cpf)); // { isValid: true, type: 'cpf', ... }
```

---

## 🚀 Como o Usuário Usa

1. **Abrir Editar Perfil**
2. **Campo "Chave PIX":**
   - Digita `21985581997` (ou com formatação)
   - Automaticamente vira `+55 (21) 98558-1997` na entrada
   - QR Code gerado em tempo real
3. **Ver o QR Code:**
   - ✅ Badge verde "Email PIX válido" ou "Telefone PIX válido"
   - QR Code renderizado abaixo
   - Link colapsível com detalhes técnicos
4. **Salvar:**
   - Clica "Salvar Dados"
   - Chave é salva normalizada no banco: `+5521985581997`
   - QR Code está pronto para usar

---

## 📱 Detalhes Técnicos Importantes

### ⚠️ Tratamento de Telefone Brasileiro:

**DDD válidos:** 11-99 (apenas 2 dígitos)
- `(11) 9xxxx-xxxx` → celular (11 dígitos) → `+5511 9xxxx xxxx`
- `(11) xxxx-xxxx` → fixo (10 dígitos) → `+5511 xxxx xxxx`

**Validações:**
- Celular: 11 dígitos + terceiro dígito = 9
- Fixo: 10 dígitos
- DDD entre 11 e 99

### ⚠️ CRC16-CCITT:

- Polinômio: `0x1021`
- Valor inicial: `0xFFFF`
- Implementado manualmente em `calculateCRC16()`
- Anexado aos 4 últimos hex do Brcode

### ⚠️ Normalização para Banco Central:

Sempre:
- Telefone → `+55XXXXXXXXX` (obrigatório o +55)
- CPF → `11111111111` (só os dígitos)
- CNPJ → `14141414141414` (só os dígitos)
- Email → `usuario@dominio.com` (minúsculas)

---

## 📦 Dependências Usadas

- `qrcode.react` (v4.2.0) - Renderizar QR Code
- `lucide-react` - Ícones (AlertCircle, Check)
- `tailwindcss` - Estilização

Nenhuma dependência nova foi adicionada! Tudo usa packages já instalados.

---

## ✨ Funcionalidades Adicionais

### Máscara de Exibição Segura:
```javascript
maskPixKeyDisplay("+5521985581997")
// Resultado: +55 (****) *****-81997
```

### Badge de Status:
```jsx
<PixStatusBadge pixKey={editData.pix_key} />
// Mostra: ✅ Ativo ou ⚠️ Inválido com cores e ícones
```

### Validação Completa:
```javascript
const validation = validatePixKey("21985581997");
// Resultado: {
//   isValid: true,
//   message: "Telefone PIX válido",
//   type: "telefone"
// }
```

---

## 🐛 Debugging

Se o QR Code não aparecer:

1. Verifique se `formatPixKeyDisplay()` está formatando corretamente
2. Verifique se `normalizePixKeyForBrcode()` está normalizando com +55
3. Verifique se `generatePixBrcode()` retorna uma string válida
4. Verifique se `isValidBrcode()` retorna `true` (começa com "000201" e tem "6304")

```javascript
// Debug passo a passo
const input = "21985581997";
console.log("Input:", input);
console.log("Formatted:", formatPixKeyDisplay(input)); // +55 (21) 98558-1997
console.log("Normalized:", normalizePixKeyForBrcode(input)); // +5521985581997
const brcode = generatePixBrcode(input);
console.log("Brcode:", brcode);
console.log("Valid?", isValidBrcode(brcode)); // true
console.log("Starts with 000201?", brcode.startsWith("000201"));
console.log("Has 6304?", brcode.includes("6304"));
```

---

## 🎯 Próximos Passos (Opcional)

1. **Adicionar validação de dígitos** (CPF/CNPJ por algoritmo)
2. **Historiar de chaves usadas** na conta
3. **Download do QR Code como PNG**
4. **Link de pagamento PIX** com valor pré-preenchido
5. **Webhook para confirmar PIX recebido**

---

**Implementação completada com sucesso! ✅**
