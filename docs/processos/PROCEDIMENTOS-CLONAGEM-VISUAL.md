# 📋 PROCEDIMENTOS DE CLONAGEM VISUAL DE PÁGINAS

## Objetivo
Clonar a estrutura visual (HTML/JSX + Classes Tailwind) de uma página **template** para uma página **destino**, mantendo o conteúdo/dados da página destino.

---

## 🔧 PROCEDIMENTO PASSO A PASSO

### **PASSO 1: ANÁLISE DOS ARQUIVOS**
1. Leia completamente o arquivo **template** (origem visual)
2. Leia completamente o arquivo **destino** (origem de dados/conteúdo)
3. Identifique:
   - Estrutura de tags (DIVs, SECTIONs, HEADER, ASIDE, MAIN)
   - Classes Tailwind CSS
   - Componentes modulares usados
   - Imports necessários
   - Variáveis de estado e funções

### **PASSO 2: MAPEAMENTO DE COMPONENTES**
Verifique quais componentes cada arquivo usa:

**TEMPLATE:**
- Componentes internos (Section, SubSection, Pill, FAQ, etc.)
- Componentes importados (CompareTable, BehaviorGrid, etc.)
- Ícones (lucide-react)

**DESTINO:**
- Componentes já importados no arquivo original
- O que será mantido vs o que será substituído

### **PASSO 3: PREPARAÇÃO DO ARQUIVO DESTINO**

#### A) Atualize os imports
```jsx
// REMOVA:
- Imports desnecessários (ex: Link, createPageUrl se não existem)
- Componentes não utilizados (ex: BehaviorGrid, PunishmentCard)

// ADICIONE:
- Novos ícones necessários (ex: ExternalLink se novo)
- Novos componentes do template (ex: FAQ)
```

#### B) Identifique padrões de classe Tailwind do template
- Cores principais: `[#D4AF37]` (ouro), `[#C0C0C0]` (prata), `black`, `white`
- Bordas: `border-[#D4AF37]/20`, `border-[#D4AF37]/10`
- Fundos: `bg-black/40`, `bg-black/60`, `[#D4AF37]/5`, `[#D4AF37]/10`
- Efeitos: `backdrop-blur-md`, `border-l-4`, radial gradients
- Tipografia: `font-black`, `font-bold`, `uppercase`, `tracking-wider`

### **PASSO 4: TRANSPLANTE DE ESTRUTURA**

#### A) Hero/Header Section
```jsx
<div className="relative overflow-hidden border-b border-[#D4AF37]/20 
                 bg-gradient-to-b from-[#0a0a0a] to-black px-4 md:px-12 py-16">
  <div className="absolute inset-0 opacity-5" style={{
    backgroundImage: 'radial-gradient(...)'
  }} />
  <div className="max-w-4xl mx-auto text-center relative">
    {/* Conteúdo do hero aqui */}
  </div>
</div>
```

#### B) Layout Principal (Sidebar + Main)
```jsx
<div className="max-w-7xl mx-auto px-4 md:px-12 py-10 flex gap-8">
  <aside className="hidden lg:block w-60 shrink-0">
    {/* SIDEBAR com navegação */}
  </aside>
  
  <main className="flex-1 space-y-8 min-w-0">
    {/* CONTEÚDO PRINCIPAL */}
  </main>
</div>
```

#### C) Sidebar Navigation
- Use `sticky top-24` para fixar
- Botões com estado ativo: `bg-[#D4AF37]/10 text-[#D4AF37] font-semibold`
- Estados hover: `hover:bg-[#D4AF37]/5`

#### D) Section Wrapper
```jsx
<section id="ID" className="bg-black/40 border border-[#D4AF37]/20 rounded-2xl p-6 md:p-8">
  <div className="flex items-center gap-3 mb-6">
    <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 flex items-center 
                    justify-center text-[#D4AF37]">
      <Icon size={18} />
    </div>
    <h2 className="text-xl font-black text-white">{title}</h2>
  </div>
  {children}
</section>
```

### **PASSO 5: INJEÇÃO DE CONTEÚDO DO ARQUIVO DESTINO**

1. **Identifique seções chave** no arquivo destino:
   - Quotas/citações
   - Listas de responsabilidades
   - Informações específicas do domínio

2. **Copie copiador de conteúdo** mantendo estrutura do template:
```jsx
// TEMPLATE tem:
<SubSection title="Exemplo">
  <ul className="space-y-1">
    <Li>Item 1</Li>
    <Li>Item 2</Li>
  </ul>
</SubSection>

// Injete conteúdo do DESTINO aqui, respeitando classes CSS
```

3. **Substitua componentes específicos**:
   - `<BehaviorGrid />` → Grid com classes do template
   - Tabelas simples → Use estrutura `<table>` do template
   - Cards customizados → Reutilize padrões de cores/bordas

### **PASSO 6: TRATAMENTO DE DEPENDÊNCIAS EXTERNAS**

Se arquivo destino usa:
- **React Router** (Link, useNavigate): 
  - REMOVA imports de react-router-dom se arquivo não for uma página roteada
  - Substitua `<Link to={...}>` por `<a href="/">`

- **Aliases de import** (`@/utils`, `@/components`):
  - REMOVA se arquivo não existir
  - Mantenha imports relativos (`../components/UIComponents`)

- **Componentes customizados não essenciais**:
  - Se tiver `BehaviorGrid` que não existe em UIComponents, reimplemente com grid Tailwind

### **PASSO 7: VALIDAÇÃO E DEBUG**

1. **Verifique sintaxe JSX**:
   - Tags fechadas corretamente: `</div>` não `</div` ou `/>`
   - Imports all presentes no topo

2. **Teste a compilação**:
   ```bash
   npm run dev
   ```

3. **Erros comuns**:
   - `Failed to resolve import "@/utils"` → REMOVE a linha
   - `Unexpected token, expected "jsxTagEnd"` → Tag HTML mal fechada
   - Componente não definido → Verificar imports

---

## 📊 CHECKLIST DE CLONAGEM

- [ ] Analisei arquivo template completamente
- [ ] Analisei arquivo destino completamente
- [ ] Atualizei imports (removi desnecessários)
- [ ] Copiei estrutura HTML/tags (DIVs, SECTIONs, ASIDE, MAIN)
- [ ] Transferi todas as classes Tailwind
- [ ] Mantive componentes modulares do destino
- [ ] Injetei conteúdo/dados do destino
- [ ] Removi dependências externas inexistentes
- [ ] Validei sintaxe JSX
- [ ] Testei compilação com `npm run dev`

---

## 🎨 PALETA DE CORES PADRÃO (Template)

| Uso | Classe | Valor |
|-----|--------|-------|
| Ouro Primário | `[#D4AF37]` | Borders, highlights, text |
| Fundo Grid | `bg-[#D4AF37]/5` | Seções com destaque |
| Fundo Grid I | `bg-[#D4AF37]/10` | Boxes, badges |
| Prata | `[#C0C0C0]` | Texto secundário |
| Prata Escura | `text-[#C0C0C0]/70` | Descrições |
| Prata Clara | `text-[#C0C0C0]/40` | Texto fraco |
| Fundo Escuro | `bg-black/40` | Cards, sections |
| Fundo Muito Escuro | `bg-black/60` | Overlays, step boxes |
| Branco | `text-white` | Títulos, em destaque |

---

## 🔄 EXEMPLO PRÁTICO: Portal.jsx ← Portal2.jsx

### Antes (Portal.jsx original)
- Header: 6xl text com tagline "The Immortal Archive"
- Estrutura: Sidebar fixo topo-10
- Styling: bg-[#050505], bordas espessas, efeitos pesados

### Depois (Portal.jsx clonado)
- Header: 4xl/5xl text com subtítulo + pills de conformidade
- Estrutura: Sidebar sticky top-24, layout flex gap-8
- Styling: bg-black, bordas de 1px, radial gradients otimizados
- Conteúdo: Mantive Sobre, Termos, Privacidade, Comunidade, Envios, DMCA
- Extras: Adicionei FAQ accordion, grid de comportamentos esperados/proibidos

---

## 💡 DICAS IMPORTANTES

1. **Preserve a "Alma" do Destino**:
   - Mantenha textos, dados, variáveis de estado
   - Preserve a lógica (useState, funções)
   - Mantenha componentes customizados que funcionam

2. **Aplique o "Corpo" do Template**:
   - Use estrutura HTML/tags exata
   - Copie classes Tailwind sem reformatações
   - Respeite responsive design (md:, lg:, sm:)

3. **Teste Incremental**:
   - Clone uma seção por vez
   - Teste compilação após cada grande mudança
   - Não deixe para validar no final

4. **Padrões de Repetição**:
   - Se template usa `.map()` para renderizar grids, use padrão similar
   - Se template usa FAQs com accordion, reutilize componente FAQ

---

## 🚀 PRÓXIMAS CLONAGENS

Quando solicitado clone de outra página:

1. Identifique a página **TEMPLATE** a usar como visual
2. Identifique a página **DESTINO** de dados
3. Siga este procedimento
4. Reporte sucesso/erros ao usuário

---

**Criado em:** 23 de fevereiro de 2026  
**Procedimento:** Clonagem Visual + Injeção de Conteúdo  
**Status:** ✅ Validado no Portal.jsx
