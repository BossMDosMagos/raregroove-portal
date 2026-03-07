# 🎯 GUIA VISUAL: Onde Configurar Email no Supabase Dashboard

## Passo 1: Acesse seu projeto

1. Vá em: **https://supabase.com/dashboard**
2. Faça login se necessário
3. **Clique no seu projeto** (deve aparecer na lista)

## Passo 2: Menu lateral esquerdo

No menu lateral **ESQUERDO**, procure por:

```
🏠 Home
📊 Table Editor
🔐 Authentication     ← CLIQUE AQUI
⚙️ Database
...
```

## Passo 3: Submenu Authentication

Depois de clicar em **Authentication**, aparecerá um submenu. Clique em:

```
Authentication
  ├─ Users
  ├─ Policies
  ├─ Providers       ← CLIQUE AQUI
  ├─ Templates
  └─ Logs
```

## Passo 4: Aba Providers

Na página que abrir, você verá **abas no topo**:

```
[Email] [Phone] [Auth Providers]
  ↑
CLIQUE EM "Email"
```

## Passo 5: Configurações de Email

Dentro da aba **Email**, procure por:

### 📧 Enable Email provider
```
[X] Enable Email provider    ← Deve estar MARCADO
```

### 📧 Confirm email
```
[ ] Confirm email            ← Deve estar DESMARCADO
    └─ Desmarca esta opção se estiver marcada
```

### 📧 Secure email change
```
[ ] Secure email change      ← Pode deixar desmarcado
```

## Passo 6: SALVAR

No **final da página**, clique no botão:
```
[Save]    ← CLIQUE AQUI PARA SALVAR
```

---

## 🔍 Se Não Encontrar "Providers"

Tente este caminho alternativo:

1. Menu lateral: **Project Settings** (ícone de engrenagem ⚙️)
2. Dentro de Settings, procure: **Authentication**
3. Lá devem aparecer as configurações

---

## 📸 Referência Visual

A tela deve parecer assim:

```
┌─────────────────────────────────────────┐
│ Authentication > Providers > Email       │
├─────────────────────────────────────────┤
│                                          │
│ Email Provider Configuration             │
│                                          │
│ [✓] Enable Email provider                │
│                                          │
│ [ ] Confirm email                        │
│     Users will need to click link...    │
│                                          │
│ [ ] Secure email change                  │
│                                          │
│                                          │
│                    [Cancel] [Save] ──┐   │
└──────────────────────────────────────┘   │
                                            │
                                   Clique aqui
```

---

## ⚠️ IMPORTANTE

Após salvar, **aguarde 1-2 minutos** antes de tentar cadastrar novamente!

---

## 🆘 Se AINDA não encontrar

Me diga qual versão do Supabase você está usando:
- Dashboard clássico?
- Dashboard novo (2024+)?

E me descreva o que você vê no menu lateral esquerdo quando clica no projeto.
