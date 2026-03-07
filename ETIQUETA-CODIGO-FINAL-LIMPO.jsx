/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ETIQUETA A6 - CÓDIGO FINAL LIMPO
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Dimensões: 105mm × 148mm (397px × 559px @ 96 DPI)
 * Sem molduras, sem bordas decorativas
 * Hierarquia Branca: Nome + CEP em fontWeight 900
 * Espaço dos Correios: Vazio sagrado (flex-grow)
 * 
 * Estrutura de Blocos (flex: space-between):
 * 1. Logo + Branding (TOPO)
 * 2. Destinatário (NOME 13pt/900, Endereço 8pt, CEP 20pt/900)
 * 3. Código de Barras (75px FIXO)
 * 4. Espaço Vazio (FLEX-GROW, mín. 113px)
 * 5. Aviso Frágil + Remetente + QR (RODAPÉ)
 * 6. Linha de Corte (SEPARADOR)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

// JSX DA ETIQUETA A6 (excerto do ShippingLabelCard.jsx)

<div 
  id="shipping-label-a6"
  style={{
    width: '397px',
    height: '559px',
    fontFamily: 'Arial, Helvetica, sans-serif',
    padding: '19px',
    pageBreakInside: 'avoid',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    color: '#000000',
    overflow: 'hidden',
    boxSizing: 'border-box',
    margin: '0',
    fontSize: '12px',
    lineHeight: '1'
  }}
  className="mx-auto"
>
  {/* ═══════════════════════════════════════════════════════════════════════ */}
  {/* BLOCO 1: BRANDING (TOPO) - flex: 0 0 auto */}
  {/* ═══════════════════════════════════════════════════════════════════════ */}
  <div style={{ flex: '0 0 auto', marginBottom: '11px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      {/* Logo + Nome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <img
          src="/img/LogoRareGroove.png"
          alt="Rare Groove"
          style={{ width: '30px', height: '30px', objectFit: 'contain' }}
        />
        <span style={{ fontSize: '9pt', fontWeight: '700', letterSpacing: '0.3px' }}>
          RARE GROOVE PORTAL
        </span>
      </div>
      {/* Tagline direita */}
      <span style={{ fontSize: '7pt', color: '#5c5c5c', fontStyle: 'italic' }}>
        Sua Raridade Imortal.
      </span>
    </div>
  </div>

  {/* ═══════════════════════════════════════════════════════════════════════ */}
  {/* BLOCO 2: DESTINATÁRIO (HIERARQUIA BRANCA) - flex: 0 0 auto */}
  {/* ═══════════════════════════════════════════════════════════════════════ */}
  <div style={{ flex: '0 0 auto', marginBottom: '11px' }}>
    {/* Label "DESTINATÁRIO" */}
    <div style={{ fontSize: '7pt', fontWeight: '700', marginBottom: '7px', color: '#4d4d4d', letterSpacing: '0.8px' }}>
      DESTINATÁRIO
    </div>

    {/* NOME DO COMPRADOR - RAINHA DA HIERARQUIA (fontWeight: 900) */}
    <div style={{ fontSize: '13pt', fontWeight: '900', marginBottom: '7px', lineHeight: '1.2' }}>
      {buyerInfo?.full_name || 'NOME_COMPRADOR'}
    </div>

    {/* Endereço (rua, número, complemento, bairro, cidade-estado) */}
    <div style={{ fontSize: '8pt', marginBottom: '7px', lineHeight: '1.3' }}>
      <div style={{ fontWeight: 'bold' }}>
        {recipientStreet}
      </div>
      <div>
        {recipientNumber}
        {recipientComplement ? ` - ${recipientComplement}` : ''}
      </div>
      {recipientNeighborhood && <div>{recipientNeighborhood}</div>}
      <div>
        {recipientCity} - {recipientState}
      </div>
    </div>

    {/* CEP - LABEL */}
    <div style={{ fontSize: '7pt', color: '#4d4d4d', marginBottom: '3px', fontWeight: '700', letterSpacing: '0.6px' }}>
      CEP
    </div>

    {/* CEP - NÚMERO GRANDE (fontWeight: 900) - SEGUNDA RAINHA */}
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: '11px',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <div style={{
        fontSize: '20pt',
        fontWeight: '900',        // ← PESO MÁXIMO
        lineHeight: '1',
        whiteSpace: 'nowrap',
        textAlign: 'center'
      }}>
        {recipientCep}
      </div>
    </div>
  </div>

  {/* ═══════════════════════════════════════════════════════════════════════ */}
  {/* BLOCO 3: CÓDIGO DE BARRAS - flex: 0 0 75px (ALTURA FIXA) */}
  {/* ═══════════════════════════════════════════════════════════════════════ */}
  {barcodeImage && (
    <div style={{
      flex: '0 0 75px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      pageBreakInside: 'avoid',
      marginBottom: '0px'
    }}>
      <img
        src={barcodeImage}
        alt="Código de Barras CEP"
        style={{
          maxWidth: '340px',
          height: '100%',
          pageBreakInside: 'avoid',
          display: 'block',
          objectFit: 'contain'
        }}
      />
    </div>
  )}

  {/* ═══════════════════════════════════════════════════════════════════════ */}
  {/* BLOCO 4: VAZIO SAGRADO - flex: 1 1 auto (FLEX-GROW) */}
  {/* ═══════════════════════════════════════════════════════════════════════ */}
  {/* Espaço para uso exclusivo dos Correios (sem moldura, sem borda) */}
  <div style={{
    flex: '1 1 auto',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '113px',
    position: 'relative'
  }}>
    {/* Vazio sagrado - nenhuma moldura ou borda */}
  </div>

  {/* ═══════════════════════════════════════════════════════════════════════ */}
  {/* BLOCO 5: RODAPÉ (AVISO + REMETENTE + QR) - flex: 0 0 auto */}
  {/* ═══════════════════════════════════════════════════════════════════════ */}
  <div style={{ flex: '0 0 auto' }}>
    
    {/* AVISO FRÁGIL - Integrado na base */}
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: '11px',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3px',
        whiteSpace: 'nowrap'
      }}>
        <Disc size={10} style={{ color: '#111', flexShrink: 0 }} />
        <span style={{ fontSize: '6.5pt', fontWeight: '700', letterSpacing: '0.3px' }}>
          CONTEÚDO FRÁGIL: DISCOS/CDs
        </span>
      </div>
    </div>

    {/* REMETENTE + QR CODE - Layout lado a lado */}
    <div style={{ 
      borderTop: '1px solid #d7d7d7',   {/* ← Divisor apenas (não moldura) */}
      paddingTop: '11px', 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'flex-start', 
      gap: '8px',
      pageBreakInside: 'avoid'
    }}>
      {/* REMETENTE - Esquerda */}
      <div style={{ flex: '1 1 auto', minWidth: '0' }}>
        <div style={{ fontSize: '6pt', color: '#9f9f9f', marginBottom: '2px' }}>
          REMETENTE
        </div>

        <div style={{ fontSize: '8pt', fontWeight: '700', marginBottom: '2px', color: '#5f5f5f', lineHeight: '1.1' }}>
          {sellerInfo?.full_name || 'RAREGROOVE'}
        </div>

        <div style={{ fontSize: '7pt', color: '#8a8a8a', lineHeight: '1.2' }}>
          <div style={{ wordWrap: 'break-word' }}>
            {sellerInfo?.address || 'RUA/AVENIDA'}
            {sellerInfo?.number ? ` ${sellerInfo.number}` : ''}
          </div>
          {sellerInfo?.complement && <div style={{ fontSize: '6.5pt' }}>{sellerInfo.complement}</div>}
          <div>
            {sellerInfo?.city || 'CIDADE'} - {sellerInfo?.state || 'SP'}
          </div>
          <div style={{ fontWeight: '700', fontSize: '6.5pt', marginTop: '2px' }}>
            {sellerInfo?.cep || '00000-000'}
          </div>
        </div>
      </div>
      
      {/* QR CODE - Direita */}
      <div style={{ 
        flex: '0 0 auto',
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        pageBreakInside: 'avoid'
      }}>
        {portalUrl ? (
          <QRCodeSVG
            ref={qrCodeRef}
            value={`${portalUrl}/pedido/${shipping?.transaction_id || transactionId}`}
            size={28}
            level="M"
            includeMargin={false}
            style={{ 
              width: '75px', 
              height: '75px',
              backgroundColor: '#fff',
              flexShrink: 0
              /* SEM BORDER - Código limpo */
            }}
          />
        ) : (
          <div style={{
            width: '75px',
            height: '75px',
            backgroundColor: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            fontSize: '6pt',
            color: '#666',
            textAlign: 'center',
            fontWeight: 'bold',
            flexShrink: 0
            /* SEM BORDER - Código limpo */
          }}>
            <div style={{ marginBottom: '1px' }}>ID</div>
            <div style={{ fontSize: '5pt', wordBreak: 'break-all' }}>{shipping?.transaction_id || transactionId}</div>
          </div>
        )}
      </div>
    </div>
  </div>

  {/* ═══════════════════════════════════════════════════════════════════════ */}
  {/* BLOCO 6: LINHA DE CORTE - Separador apenas */}
  {/* ═══════════════════════════════════════════════════════════════════════ */}
  <div style={{ 
    fontSize: '7pt',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    textAlign: 'center',
    color: '#7a7a7a',
    marginTop: '7px',
    paddingTop: '7px',
    paddingBottom: '0',
    borderTop: '1px dashed #bcbcbc',  {/* ← Apenas linha de corte */}
    letterSpacing: '0.6px',
    fontWeight: '700',
    width: '100%',
    boxSizing: 'border-box'
  }}>
    <Scissors size={12} />
    CORTE AQUI NO RITMO
    <Scissors size={12} style={{ transform: 'scaleX(-1)' }} />
  </div>
</div>


/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RESUMO DO CÓDIGO LIMPO
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ✅ Sem molduras externas (border removido do container)
 * ✅ Sem bordas decorativas (CEP, QR, etc. sem borders)
 * ✅ Hierarquia Branca: Nome (fontWeight: 900) + CEP (fontWeight: 900)
 * ✅ Espaço dos Correios: Vazio sagrado (flex-grow, sem conteúdo)
 * ✅ Apenas 2 linhas estruturais:
 *    - borderTop: "1px solid #d7d7d7" (divisor Remetente)
 *    - borderTop: "1px dashed #bcbcbc" (linha de corte)
 * 
 * PALETA DE CORES:
 * - Texto Primário: #000000 (preto)
 * - Texto Secundário: #5c5c5c, #5f5f5f (cinza escuro)
 * - Texto Terciário: #8a8a8a, #9f9f9f (cinza médio)
 * - Texto Mínimo: #4d4d4d (cinza escuro labels)
 * - Linhas: #d7d7d7 (divisor), #bcbcbc (corte)
 * - Background: #FFFFFF (branco)
 * 
 * PESOS DE FONTE:
 * - fontWeight: 900 → Nome Destinatário + CEP (RAINHA)
 * - fontWeight: 700 → Branding, labels, remetente
 * - fontWeight: normal → Endereços, conteúdo
 * 
 * PDF GENERATION:
 * - html2canvas com scale: 2 (alta definição)
 * - jsPDF A6: 105mm × 148mm sem margens
 * - Linha 231-285 do ShippingLabelCard.jsx
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */
