# 🚫 Solução: Email Rate Limit do Supabase

## 🐛 O Problema

**Erro:** "Email rate limit exceeded"

**Causa:** Supabase tem limite de emails enviados por hora:
- Máximo **4 emails por hora** ao mesmo usuário
- Máximo X emails por hora ao total (depende do plano)

**Quando acontece:**
- Usuário tenta cadastrar múltiplas vezes (mesmo email)
- Clica "Cadastrar" várias vezes rapidamente
- Sistema testa com muitos usuários diferentes
- Testa em produção com poucos emails disponíveis

---

## ✅ Solução 1: Cooldown no Frontend (IMPLEMENTADO)

Agora o sistema:
- ✅ Bloqueia botão por **60 segundos** se erro de rate limit
- ✅ Bloqueia por **5 segundos** após cadastro bem-sucedido (evita duplo-clique)
- ✅ Mostra contador: "Aguarde 45s" no botão
- ✅ Libera automaticamente quando tempo passar

### Como Funciona

1. **Usuário tenta cadastrar → Erro de rate limit**
   - Toast vermelho: "MUITOS CADASTROS"
   - Botão fica desabilitado
   - Mostra: "Aguarde 60s"

2. **Contador regressivo**
   - Botão mostra: "Aguarde 59s", "Aguarde 58s"...

3. **Após 60 segundos**
   - Botão libera automaticamente
   - Usuário pode tentar novamente

---

## ✅ Solução 2: Usar Email Diferente (IMEDIATO)

**Tática rápida para testes:**

Se receber erro com email `teste@gmail.com`, tente com:
- `teste2@gmail.com`
- `teste3@gmail.com`
- Ou use email completamente diferente

Cada email tem seu próprio limite de 4/hora.

---

## ✅ Solução 3: Configurar Email Customizado (RECOMENDADO)

**Melhor solução permanente:**

### Passo 1: Criar Conta Resend
```
1. Acesse: https://resend.com
2. Clique "Sign Up"
3. Confirme email
```

### Passo 2: Obter API Key
```
1. Dashboard → "API Keys"
2. Clique "Create API Key"
3. Copie a key (formato: re_...)
```

### Passo 3: Configurar no Supabase
```
1. Supabase Dashboard → seu projeto
2. Authentication → SMTP Settings
3. Habilitar: "Enable Custom SMTP"
4. Preencher:
   - SMTP Host: smtp.resend.com
   - SMTP Port: 465
   - SMTP User: resend
   - SMTP Password: [sua API Key]
   - From Email: noreply@seudominio.com
   - From Name: Rare Groove
5. Clique "Save"
6. Teste enviando email de teste
```

### Vantagens
- ✅ Limite de 3000 emails/mês (grátis)
- ✅ Muito maior que Supabase nativo
- ✅ Seu domínio/marca no email
- ✅ Emails não caem em spam
- ✅ Logs detalhados de entrega

---

## ✅ Solução 4: Aguardar Limite Resetar (Simples)

**Se é só para testes:**

Simplesmente aguarde **1 hora** e tente de novo.

O limite de 4 emails/hora se reseta automaticamente.

---

## 🔧 Código Implementado

### Login.jsx - Mudanças:

#### 1. Estado de cooldown
```jsx
const [signUpCooldown, setSignUpCooldown] = useState(0);
```

#### 2. useEffect para contar para baixo
```jsx
useEffect(() => {
  if (signUpCooldown <= 0) return;
  
  const timer = setInterval(() => {
    setSignUpCooldown(prev => prev > 1 ? prev - 1 : 0);
  }, 1000);

  return () => clearInterval(timer);
}, [signUpCooldown]);
```

#### 3. Detectar erro de rate limit
```jsx
if (error.message?.toLowerCase().includes('rate limit')) {
  toast.error('MUITOS CADASTROS', {
    description: 'Aguarde 1 minuto antes de tentar novamente'
  });
  setSignUpCooldown(60);
  return;
}
```

#### 4. Bloquear botão durante cooldown
```jsx
<button 
  disabled={loading || (signUpCooldown > 0 && !isLogin)}
>
  {signUpCooldown > 0 && !isLogin 
    ? `Aguarde ${signUpCooldown}s`
    : 'Criar Credenciais'}
</button>
```

#### 5. Cooldown após sucesso (5s)
```jsx
setSignUpCooldown(5); // Evitar duplo-clique
```

---

## 🧪 Teste Agora

### Se recebeu erro de rate limit:

**Opção A: Esperar 60s (Automático)**
- Botão muda para: "Aguarde 60s"
- Contador regressivo automático
- Libera sozinho após 60s ✅

**Opção B: Trocar email (Imediato)**
- Use email diferente
- Tente cadastro novamente
- Funciona imediatamente ✅

**Opção C: Configurar Resend (5 min)**
- Siga passos acima
- Configure SMTP customizado
- Rate limit muito maior ✅

---

## 📊 Resumo das Soluções

| Solução | Tempo | Implementação | Limite |
|---------|-------|---|---|
| **Cooldown (Frontend)** | Espera 60s | ✅ Pronta | 4 emails/hora por usuário |
| **Email Diferente** | Imediato | Manual | 4 emails/hora cada |
| **Resend SMTP** | 5 minutos | Simples | 3000 emails/mês |
| **Aguardar 1h** | 1 hora | Nada | Limite reseta sozinho |

**Recomendado para desenvolvimento:** Email diferente  
**Recomendado para produção:** Resend SMTP  
**Recomendado para demos:** Cooldown + Aguardar  

---

## 🚀 Próximos Passos

### Curto prazo (Hoje)
- [ ] Se em cooldown: Aguarde 60s OU use email diferente
- [ ] Teste cadastro depois

### Médio prazo (Esta semana)
- [ ] Configure Resend (5 min)
- [ ] Atualize SMTP no Supabase
- [ ] Teste com Resend

### Produção
- [ ] Use seu domínio próprio em Resend
- [ ] Configure SPF/DKIM/DMARC
- [ ] Monitore logs de entrega
- [ ] Aumente limite se necessário

---

## ⚠️ Dicas Extras

### Evitar rate limit no futuro:
1. ✅ Não clicar múltiplas vezes no botão (cooldown de 5s após sucesso)
2. ✅ Não testar com mesmo email repetidamente
3. ✅ Use serviço de email robusto em produção
4. ✅ Implemente cooldown no frontend (já implementado!)

### Monitorar limite:
```sql
-- Ver usuários que tentaram cadastrar múltiplas vezes
SELECT 
  email,
  COUNT(*) as tentativas,
  MAX(created_at) as ultima_tentativa
FROM auth.users
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY tentativas DESC;
```

### Limpar teste:
```sql
-- Deletar usuários de teste não confirmados
DELETE FROM profiles
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email_confirmed_at IS NULL 
  AND created_at < NOW() - INTERVAL '1 hour'
);

DELETE FROM auth.users
WHERE email_confirmed_at IS NULL 
AND created_at < NOW() - INTERVAL '1 hour';
```

---

## 📞 Suporte

**Problema persiste?**
1. Confirme que está usando email diferente
2. Aguarde 1 hora (limite reseta)
3. Configure Resend (solução permanente)
4. Verifique logs: Supabase → Logs → Auth Logs

**Está em produção?**
1. Configure SMTP imediatamente
2. Use Resend ou SendGrid
3. Monitore taxa de entrega
4. Aumentar limite conforme crescer

---

**Sistema agora está preparado para evitar múltiplos envios! 🛡️**
