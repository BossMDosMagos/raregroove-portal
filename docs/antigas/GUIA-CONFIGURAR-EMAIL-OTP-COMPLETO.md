# 📧 CONFIGURAR SERVIÇO DE EMAIL PARA VALIDAÇÃO OTP

## ⚡ Status: OBRIGATÓRIO

Sem serviço de email configurado, os códigos de validação **NÃO SERÃO ENVIADOS** e ninguém conseguirá cadastrar.

---

## 🎯 OPÇÃO 1: Resend (RECOMENDADO) ✅

**Melhor para produção**
- ✅ Grátis até 3.000 emails/mês
- ✅ API simples e confiável
- ✅ Usado por grandes empresas
- ✅ 100% compliance (DMARC, SPF, DKIM)

### Passo a Passo:

#### 1. Criar conta Resend
1. Acesse: https://resend.com
2. Clique em **"Sign Up"**
3. Use email profissional (pode ser Gmail)
4. Confirme email

#### 2. Adicionar domínio (Opcional - Produção)
1. Dashboard → **"Domains"**
2. **"Add Domain"** → Digite seu domínio: `raregroove.com`
3. Copie registros DNS (MX, TXT, CNAME)
4. Adicione no seu provedor de domínio (GoDaddy/Hostinger/etc)
5. Aguarde verificação (5-60min)

**Para desenvolvimento:** Pode usar email de teste (não precisa domínio)

#### 3. Obter API Key
1. Dashboard → **"API Keys"**
2. Clique em **"Create API Key"**
3. Nome: `RareGroove Production`
4. Permissão: **"Sending access"**
5. Clique **"Add"**
6. **COPIE A KEY** (só aparece uma vez!) → Formato: `re_...`

#### 4. Configurar no Supabase
1. Abra Dashboard Supabase: https://supabase.com/dashboard
2. Seu projeto → **Authentication** → **"Email Templates"**
3. No topo, clique em **"SMTP Settings"** (guia pequena)
4. Marque: ☑️ **"Enable Custom SMTP"**
5. Preencha:
   ```
   SMTP Host: smtp.resend.com
   SMTP Port: 465
   SMTP Username: resend
   SMTP Password: (COLE SUA API KEY AQUI - re_...)
   Sender Email: noreply@raregroove.com (ou seu domínio)
   Sender Name: Rare Groove
   ```
6. Clique **"Save"**
7. ⚠️ **TESTE:** Clique em **"Send Test Email"** → Digite seu email → Confirme recebimento

#### 5. Ativar Confirmação de Email
1. Ainda em **Authentication** → **"Providers"**
2. Clique em **"Email"**
3. ☑️ **Marque** "Confirm email"
4. **"Save"**

#### 6. Personalizar Template (Opcional)
1. **Authentication** → **"Email Templates"**
2. Selecione **"Confirm signup"**
3. Personalize:
   ```html
   <h2>Bem-vindo ao Rare Groove! 🎵</h2>
   <p>Seu código de verificação é:</p>
   <h1 style="font-size: 40px; letter-spacing: 10px;">{{ .Token }}</h1>
   <p>Válido por 60 minutos</p>
   ```
4. **"Save"**

---

## 🎯 OPÇÃO 2: SendGrid (Alternativa)

**Bom para testes**
- ✅ Grátis até 100 emails/dia
- ⚠️ Requer validação de identidade (lento)

### Passo a Passo:

1. Criar conta: https://sendgrid.com
2. Complete verificação de identidade (demora 1-3 dias)
3. **Settings** → **"API Keys"** → **"Create API Key"**
4. Copie a key (formato `SG....`)
5. No Supabase SMTP Settings:
   ```
   SMTP Host: smtp.sendgrid.net
   SMTP Port: 587
   SMTP Username: apikey
   SMTP Password: (SUA API KEY - SG....)
   Sender Email: seu-email@gmail.com (validado no SendGrid)
   ```

---

## 🎯 OPÇÃO 3: Gmail SMTP (APENAS TESTES)

**⚠️ NÃO USE EM PRODUÇÃO**
- Limite: ~500 emails/dia
- Pode cair em spam
- Requer senha de app

### Passo a Passo:

1. Ativar autenticação 2 fatores no Gmail
2. Google Account → **Security** → **"App passwords"**
3. Criar novo app password → Copiar (16 caracteres)
4. No Supabase SMTP Settings:
   ```
   SMTP Host: smtp.gmail.com
   SMTP Port: 587
   SMTP Username: seu-email@gmail.com
   SMTP Password: (SENHA DE APP - 16 caracteres)
   Sender Email: seu-email@gmail.com
   ```

---

## 🧪 TESTAR SISTEMA

Após configurar:

1. **Logout** completo da aplicação
2. Limpe cache (Ctrl+Shift+Del)
3. Tente **cadastrar novo usuário**:
   - Nome completo
   - Email válido (use seu email real)
   - CPF/CNPJ válido
   - RG válido
   - Senha forte
4. Deve aparecer tela de **6 dígitos**
5. **Verifique seu email** → Código deve chegar em 1-3 min
6. Digite código → Sistema valida → Redireciona para Portal ✅

---

## 🚨 TROUBLESHOOTING

### ❌ "Não recebi o email"
1. Verifique pasta **Spam/Lixeira**
2. Confira API Key no Supabase (pode ter copiado errado)
3. No Resend Dashboard → **"Logs"** → Veja se email foi enviado
4. Clique em **"Reenviar código"** na tela de verificação

### ❌ "Token inválido/expirado"
- Código expira em **60 minutos**
- Solicite novo código
- Não tente usar código antigo

### ❌ "Custom SMTP not working"
1. Confira porta (465 para Resend, 587 para outros)
2. Username DEVE ser `resend` (não seu email)
3. Password DEVE ser a API Key completa
4. Sender Email deve ser do domínio verificado

### ❌ "Email cai em spam"
- Configure registros DNS (SPF, DKIM, DMARC)
- Use domínio próprio (não @gmail.com em produção)
- Valide domínio no Resend

---

## ✅ CHECKLIST FINAL

Antes de colocar em produção:

- [ ] Serviço de email configurado (Resend recomendado)
- [ ] API Key válida no Supabase SMTP
- [ ] "Confirm email" ATIVADO em Providers
- [ ] Template de email personalizado
- [ ] Teste completo: cadastro → email → validação → login
- [ ] Email não cai em spam
- [ ] Domínio verificado (se usando domínio próprio)
- [ ] Logs de email monitorados (Resend Dashboard)

---

## 🎯 RESULTADO ESPERADO

Após tudo configurado:
1. Usuário se cadastra → **"Cadastro criado! Verifique seu email"**
2. Tela de 6 dígitos aparece
3. Email chega com código (1-3min)
4. Usuário digita código → **"Email verificado! Bem-vindo"**
5. Redireciona para Portal ✅

---

## 📞 SUPORTE

**Problemas?**
- Resend Docs: https://resend.com/docs
- Supabase Auth Docs: https://supabase.com/docs/guides/auth
- Logs Resend: https://resend.com/logs
- Logs Supabase: Dashboard → Logs → Auth Logs
