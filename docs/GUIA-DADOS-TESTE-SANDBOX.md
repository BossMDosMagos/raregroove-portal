# 🧪 Dados de Teste - Mercado Pago Sandbox

## O que foi implementado

Uma nova seção **"Dados de Teste - Sandbox"** foi adicionada à aba de Configurações de Pagamentos (FeeManagement) no painel admin.

## Localização
**Admin Dashboard → Central de Taxas & Gateway → Seção "Dados de Teste"** (apareça apenas quando **Sandbox** está ativo)

## Funcionalidades

### 1. Dados do Comprador
- **País**: Brasil
- **User ID**: 3239678586
- **Usuário**: TESTUSER4209988089763575370
- **Senha**: eVTrQ5m7Jf
- **Código de Verificação**: 678586
- ✅ **Botão "Copiar"**: Copia automáticamente usuário + senha para a clipboard

### 2. Dados do Vendedor
- **País**: Brasil
- **User ID**: 3239678584
- **Usuário**: TESTUSER396528322220256871
- **Senha**: 9ALpMREwSU
- **Código de Verificação**: 678584
- ✅ **Botão "Copiar"**: Copia automáticamente usuário + senha para a clipboard

## Como Usar

### Fluxo de Teste:
1. Vá para **Admin Dashboard** → **Central de Taxas & Gateway**
2. Certifique-se que o **modo está em "Sandbox"**
3. Procure pela seção **"🧪 Dados de Teste - Sandbox"**
4. Clique no botão **"Copiar"** ao lado de "Comprador" ou "Vendedor"
5. O sistema irá copiar: `Usuário: [...]\nSenha: [...]`
6. Quando o Mercado Pago solicitar login:
   - Cole o usuário e a senha copiados
   - Complete o login

## Alterações no Banco de Dados

Execute este SQL para adicionar as colunas na tabela `platform_settings`:

```sql
-- Comprador
ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS test_buyer_country VARCHAR(100) DEFAULT 'Brasil';
ADD COLUMN IF NOT EXISTS test_buyer_user_id VARCHAR(100) DEFAULT '3239678586';
ADD COLUMN IF NOT EXISTS test_buyer_username VARCHAR(100) DEFAULT 'TESTUSER4209988089763575370';
ADD COLUMN IF NOT EXISTS test_buyer_password VARCHAR(100) DEFAULT 'eVTrQ5m7Jf';
ADD COLUMN IF NOT EXISTS test_buyer_verification_code VARCHAR(100) DEFAULT '678586';

-- Vendedor
ADD COLUMN IF NOT EXISTS test_seller_country VARCHAR(100) DEFAULT 'Brasil';
ADD COLUMN IF NOT EXISTS test_seller_user_id VARCHAR(100) DEFAULT '3239678584';
ADD COLUMN IF NOT EXISTS test_seller_username VARCHAR(100) DEFAULT 'TESTUSER396528322220256871';
ADD COLUMN IF NOT EXISTS test_seller_password VARCHAR(100) DEFAULT '9ALpMREwSU';
ADD COLUMN IF NOT EXISTS test_seller_verification_code VARCHAR(100) DEFAULT '678584';
```

Arquivo: `SQL-ADICIONAR-DADOS-TESTE.sql`

## Editar Dados

Todos os campos são **editáveis** na interface. Se você precisar alterar qualquer dado:
1. Edite o campo desejado
2. Clique em **"Salvar"** no topo da página
3. Os dados serão persistidos no banco de dados

## Segurança

- Senhas são ocultadas por padrão (ícone de olho)
- Clique no ícone de olho para revelar/ocultar senhas
- Dados são salvos no banco de dados (tabela `platform_settings`)
- Apenas admins podem acessar esta seção

## Botão de Cópia

- Feedback visual: o botão muda para "✅ Copiado" por 2 segundos
- Toast notification confirma a ação
- Copia automaticamente no formato: `Usuário: [...]\nSenha: [...], \n Código: [...]`

## Próximas Melhorias Sugeridas

- [ ] Adicionar histórico de testes realizados
- [ ] Criar múltiplos perfis de teste
- [ ] Gerar dados de teste aleatórios
- [ ] Integração direta com API do Mercado Pago para validação
