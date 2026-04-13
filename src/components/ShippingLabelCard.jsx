import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, CheckCircle, Truck, Save, Disc, Scissors } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchDefaultAddress } from '../utils/addressService';
import { toast } from 'sonner';
import JsBarcode from 'jsbarcode';
import { QRCodeCanvas } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// ─── Funções de Formatação ──────────────────────────────
const formatCEP = (value) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 5) return cleaned;
  return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 8)}`;
};

 

const formatPhone = (value) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  if (cleaned.length <= 11) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  return `+55 (${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
};

/**
 * Componente de Gerenciamento de Envio Manual
 * Exibido no painel do vendedor após pagamento aprovado
 * 
 * Fluxo:
 * 1. Exibe etiqueta de endereçamento simples (Remetente + Destinatário)
 * 2. Vendedor imprime e cola na caixa
 * 3. Vendedor digita código de rastreio recebido nos Correios
 * 4. Salva e status muda para "Enviado"
 */
export default function ShippingLabelCard({ transactionId: propTransactionId, onTrackingCodeSaved }) {
  const params = useParams();
  const transactionId = propTransactionId || params.transactionId;
  const [loading, setLoading] = useState(true);
  const [shipping, setShipping] = useState(null);
  const [sellerInfo, setSellerInfo] = useState(null);
  const [buyerInfo, setBuyerInfo] = useState(null);
  const [trackingCode, setTrackingCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [barcodeImage, setBarcodeImage] = useState(null);
  const [portalUrl, setPortalUrl] = useState('');
  const qrCodeRef = useRef(null);

  useEffect(() => {
    loadShippingData();
  }, [transactionId]);

  // Gerar código de barras quando o CEP do destinatário estiver pronto
  useEffect(() => {
    if (buyerInfo?.cep) {
      try {
            const cepDigitos = buyerInfo.cep.replace(/\D/g, ''); // Remove máscara: 22250-060 → 22250060
        const tempCanvas = document.createElement('canvas');
        tempCanvas.style.display = 'none';
        document.body.appendChild(tempCanvas);
        
        JsBarcode(tempCanvas, cepDigitos, {
          format: 'CODE128',
          width: 2.5,
          height: 60,
          displayValue: false,
          lineColor: '#000000',
          background: '#ffffff',
          margin: 5
        });
        
        // Converter canvas para imagem data URI
        const imageData = tempCanvas.toDataURL('image/png');
        setBarcodeImage(imageData);
        
        // Remover canvas temporário
        document.body.removeChild(tempCanvas);
      } catch {
        // Silent fail
      }
    }
  }, [buyerInfo?.cep]);

  const loadShippingData = async () => {
    try {
      setLoading(true);
      console.log('[ShippingLabel] Buscando transactionId:', transactionId);

      // Buscar transação (dados básicos)
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('id, buyer_id, seller_id, item_id, price')
        .eq('id', transactionId)
        .single();

      console.log('[ShippingLabel] Transação:', txData, 'Erro:', txError);
      if (txError || !txData) {
        console.error('[ShippingLabel] Erro ao buscar transação:', txError);
        throw new Error('Transação não encontrada');
      }
      
      // Verificar se há shipping real no banco
      const { data: existingShipping } = await supabase
        .from('shipping')
        .select('*')
        .eq('transaction_id', transactionId)
        .single();
      
      let shippingData;
      if (existingShipping) {
        // Usar dados reais do banco
        shippingData = existingShipping;
        console.log('[ShippingLabel] Shipping do banco:', shippingData);
      } else {
        // Criar registro no banco (obj temporário)
        const { data: newShipping } = await supabase.from('shipping').insert({
          transaction_id: transactionId,
          buyer_id: txData.buyer_id,
          seller_id: txData.seller_id,
          from_cep: '00000-000',
          to_cep: '00000-000'
        }).select().single();
        
        shippingData = newShipping || {
          id: crypto.randomUUID(),
          transaction_id: transactionId,
          buyer_id: txData.buyer_id,
          seller_id: txData.seller_id
        };
        console.log('[ShippingLabel] Shipping criado:', shippingData);
      }
      
      setShipping(shippingData);

      // Buscar URL do portal para QR Code
      const { data: settingsData } = await supabase
        .from('platform_settings')
        .select('base_portal_url')
        .eq('id', 1)
        .single();
      
      if (settingsData?.base_portal_url) {
        setPortalUrl(settingsData.base_portal_url);
      }

      // Se já tem código de rastreio, carrega
      if (shippingData.tracking_code) {
        setTrackingCode(shippingData.tracking_code);
      }

      // Buscar ENDEREÇO DE ENTREGA PADRÃO do COMPRADOR (destinatário)
      const buyerId = txData.buyer_id;
      const sellerId = txData.seller_id;
      
      const defaultBuyerAddress = await fetchDefaultAddress(buyerId);
      
      let buyerData = null;
      if (defaultBuyerAddress) {
        buyerData = {
          full_name: defaultBuyerAddress.full_name,
          phone: defaultBuyerAddress.phone,
          address: defaultBuyerAddress.address,
          number: defaultBuyerAddress.number,
          complement: defaultBuyerAddress.complement,
          city: defaultBuyerAddress.city,
          state: defaultBuyerAddress.state,
          cep: defaultBuyerAddress.cep
        };
      } else {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, phone, email, address, number, complement, city, state, cep')
          .eq('id', buyerId)
          .single();
        if (!profileError) {
          buyerData = profileData;
        }
      }
      
      if (buyerData) {
        buyerData.cep = formatCEP(buyerData.cep || '');
        buyerData.phone = formatPhone(buyerData.phone || '');
      }
      setBuyerInfo(buyerData);

      // Buscar ENDEREÇO DE ENTREGA PADRÃO do VENDEDOR (remetente)
      const defaultSellerAddress = await fetchDefaultAddress(sellerId);
      
      let sellerData = null;
      if (defaultSellerAddress) {
        sellerData = {
          full_name: defaultSellerAddress.full_name,
          phone: defaultSellerAddress.phone,
          address: defaultSellerAddress.address,
          number: defaultSellerAddress.number,
          complement: defaultSellerAddress.complement,
          city: defaultSellerAddress.city,
          state: defaultSellerAddress.state,
          cep: defaultSellerAddress.cep
        };
      } else {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, phone, email, city, state, address, number, complement, cep')
          .eq('id', sellerId)
          .single();
        if (!profileError) {
          sellerData = profileData;
        }
      }
      
      // Formatar dados do vendedor
      if (sellerData) {
        sellerData.cep = formatCEP(sellerData.cep || '');
        sellerData.phone = formatPhone(sellerData.phone || '');
      }
      setSellerInfo(sellerData);
    } catch (error) {
      toast.error('Erro ao carregar dados de envio');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLabelPDF = async () => {
    try {
      const labelElement = document.getElementById('shipping-label-a6');
      
      if (!labelElement) {
        toast.error('Etiqueta não encontrada');
        return;
      }

      // Mostrar feedback
      toast.loading('Gerando PDF de alta definição...');

      // Aguardar 500ms para garantir que todas as fontes e códigos estejam renderizados
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capturar a etiqueta com precisão de pixels
      const canvas = await html2canvas(labelElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowHeight: 559,
        windowWidth: 397,
        width: 397,
        height: 559,
        x: 0,
        y: 0
      });

      // Converter canvas para imagem base64
      const imageData = canvas.toDataURL('image/png');

      // Criar PDF A6 (105mm x 148mm) SEM margens internas
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [105, 148], // A6: 105mm x 148mm
        margins: [0, 0, 0, 0] // Sem margens
      });

      // Adicionar a imagem ocupando toda a página
      pdf.addImage(imageData, 'PNG', 0, 0, 105, 148);

      // Gerar nome do arquivo com ID do pedido
      const fileName = `Etiqueta-${shipping?.transaction_id || transactionId || 'Pedido'}.pdf`;

      // Fazer download do PDF
      pdf.save(fileName);

      toast.dismiss();
      toast.success('✓ PDF gerado e baixado com sucesso!');
    } catch (error) {
      toast.dismiss();
      toast.error('Erro ao gerar PDF', {
        description: error.message || 'Tente novamente'
      });
    }
  };

 

  const handleSaveTrackingCode = async () => {
    if (!trackingCode.trim()) {
      toast.error('Digite o código de rastreio');
      return;
    }

    try {
      setSaving(true);

      // Buscar transação para getting buyer/seller
      const { data: tx } = await supabase
        .from('transactions')
        .select('buyer_id, seller_id')
        .eq('id', transactionId)
        .single();

      // 1. Verificar se shipping existe, se não criar
      const { data: existing } = await supabase
        .from('shipping')
        .select('id')
        .eq('transaction_id', transactionId)
        .single();

      if (!existing) {
        await supabase.from('shipping').insert({
          transaction_id: transactionId,
          buyer_id: tx.buyer_id,
          seller_id: tx.seller_id,
          from_cep: '00000-000',
          to_cep: '00000-000'
        });
      }

      // 2. Salvar código de rastreio
      const { error: shippingError } = await supabase
        .from('shipping')
        .update({
          tracking_code: trackingCode.trim(),
          status: 'in_transit'
        })
        .eq('transaction_id', transactionId);

      if (shippingError) throw shippingError;

      // 3. Atualizar status da transação
      const { error: txError } = await supabase
        .from('transactions')
        .update({ status: 'enviado' })
        .eq('id', transactionId);

      if (txError) throw txError;

      // 4. Notificar comprador
      await supabase.from('notifications').insert({
        user_id: tx.buyer_id,
        type: 'system',
        title: 'Código de rastreio!',
        message: `Seu pedido foi enviado! Código: ${trackingCode.trim()}`
      });

      setShipping({ ...shipping, tracking_code: trackingCode.trim(), status: 'in_transit' });

      toast.success('✓ Código salvo! O comprador foi notificado.');
      
      if (onTrackingCodeSaved) {
        onTrackingCodeSaved();
      }
    } catch (error) {
      console.error('Erro ao salvar código de rastreio:', error);
      toast.error('Erro ao salvar código de rastreio');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center justify-center">
        <div className="animate-spin">⏳</div>
      </div>
    );
  }

  if (!shipping || !buyerInfo || !sellerInfo) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
        <p className="text-red-300 text-sm">Erro: Dados de envio não encontrados</p>
      </div>
    );
  }

  const recipientStreet = shipping?.to_address?.logradouro || shipping?.to_address?.street || buyerInfo?.address || 'RUA/AVENIDA';
  const recipientNumber = shipping?.to_address?.numero || shipping?.to_address?.street_number || buyerInfo?.number || '0';
  const recipientComplement = shipping?.to_address?.complemento || buyerInfo?.complement || '';
  const recipientNeighborhood = shipping?.to_address?.bairro || shipping?.to_address?.neighborhood || '';
  const recipientCity = shipping?.to_address?.localidade || shipping?.to_address?.city || buyerInfo?.city || 'CIDADE';
  const recipientState = shipping?.to_address?.uf || shipping?.to_address?.state || buyerInfo?.state || 'UF';
  const recipientCep = (shipping?.to_cep && shipping.to_cep !== '00000-000') ? formatCEP(shipping.to_cep) : (buyerInfo?.cep || '00000-000');

  return (
    <div className="space-y-4">
      {/* ETIQUETA DE ENDEREÇAMENTO - PADRÃO A6 (105mm x 148mm = 397px x 559px em 96 DPI) */}
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
        {/* ===== BLOCO 1: BRANDING (TOPO) ===== */}
        <div style={{ flex: '0 0 auto', marginBottom: '11px' }}>
          {/* Branding */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <img
                src="/img/LogoRareGroove.png"
                alt="Rare Groove"
                crossOrigin="anonymous"
                style={{ width: '30px', height: '30px', objectFit: 'contain' }}
              />
              <span style={{ fontSize: '9pt', fontWeight: '700', letterSpacing: '0.3px' }}>
                RARE GROOVE PORTAL
              </span>
            </div>
            <span style={{ fontSize: '7pt', color: '#5c5c5c', fontStyle: 'italic' }}>
              Sua Raridade Imortal.
            </span>
          </div>
        </div>

        {/* ===== BLOCO 2: DESTINATÁRIO (DESTAQUE) ===== */}
        <div style={{ flex: '0 0 auto', marginBottom: '11px' }}>
          <div style={{ fontSize: '7pt', fontWeight: '700', marginBottom: '7px', color: '#4d4d4d', letterSpacing: '0.8px' }}>
            DESTINATÁRIO
          </div>

          {/* Nome do Comprador - GRANDE E DESTACADO */}
          <div style={{ fontSize: '13pt', fontWeight: '900', marginBottom: '7px', lineHeight: '1.2' }}>
            {buyerInfo?.full_name || 'NOME_COMPRADOR'}
          </div>

          {/* Endereço */}
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

          {/* CEP - TEXTO CENTRALIZADO */}
          <div style={{ fontSize: '7pt', color: '#4d4d4d', marginBottom: '3px', fontWeight: '700', letterSpacing: '0.6px' }}>
            CEP
          </div>
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
              fontWeight: '900',
              lineHeight: '1',
              whiteSpace: 'nowrap',
              textAlign: 'center'
            }}>
              {recipientCep}
            </div>
          </div>
        </div>

        {/* ===== BLOCO 3: CÓDIGO DE BARRAS (ALTURA FIXA 75px) ===== */}
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

        {/* ===== BLOCO 4: ESPAÇO DE RESPIRO PARA CORREIOS (VAZIO SAGRADO) ===== */}
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

        {/* ===== BLOCO 5: AVISO FRÁGIL + REMETENTE + QR CODE (RODAPÉ) ===== */}
        <div style={{ flex: '0 0 auto' }}>
          
          {/* AVISO FRÁGIL integrado na base */}
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

          {/* REMETENTE + QR CODE */}
          <div style={{ 
            borderTop: '1px solid #d7d7d7', 
            paddingTop: '11px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start', 
            gap: '8px',
            pageBreakInside: 'avoid'
          }}>
            <div style={{ flex: '1 1 auto', minWidth: '0' }}>
              <div style={{ fontSize: '6pt', color: '#4d4d4d', marginBottom: '2px' }}>
                REMETENTE
              </div>

              <div style={{ fontSize: '8pt', fontWeight: '700', marginBottom: '2px', color: '#000000', lineHeight: '1.1' }}>
                {sellerInfo?.full_name || 'RAREGROOVE'}
              </div>

              <div style={{ fontSize: '7pt', color: '#000000', lineHeight: '1.2' }}>
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
            
            {/* QR CODE - Link para Rastrear Pedido */}
            <div style={{ 
              flex: '0 0 auto',
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              pageBreakInside: 'avoid'
            }}>
              {portalUrl ? (
                <QRCodeCanvas
                  ref={qrCodeRef}
                  value={`${portalUrl}/pedido/${shipping?.transaction_id || transactionId}`}
                  size={75}
                  level="M"
                  includeMargin={false}
                  imageSettings={{
                     src: "/img/LogoRareGroove.png",
                     x: undefined,
                     y: undefined,
                     height: 15,
                     width: 15,
                     excavate: true,
                  }}
                  style={{ 
                    width: '75px', 
                    height: '75px',
                    backgroundColor: '#fff',
                    flexShrink: 0
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
                }}>
                  <div style={{ marginBottom: '1px' }}>ID</div>
                  <div style={{ fontSize: '5pt', wordBreak: 'break-all' }}>{shipping?.transaction_id || transactionId}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Linha de corte estilizada */}
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
          borderTop: '1px dashed #bcbcbc',
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

      {/* INSTRUÇÕES DE IMPRESSÃO */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 space-y-2">
        <p className="font-bold text-blue-300">📋 Instruções de Impressão:</p>
        <ul className="list-disc list-inside text-xs text-blue-200 space-y-1">
          <li><strong>Papel: A6 (105mm x 148mm)</strong> - Use papel branco comum 75-90gsm</li>
          <li><strong>Orientação: Retrato</strong> (vertical)</li>
          <li><strong>Escala: 100%</strong> - Não reduzir ou ampliar</li>
          <li><strong>Margens: NENHUMA</strong> - Configure para 0mm em todas as bordas</li>
          <li><strong>Cor: P&B ou Colorido</strong> - Ambos funcionam</li>
          <li>Recorte pela linha pontilhada com estilete ou tesoura</li>
          <li>Cole a etiqueta no centro da frente da caixa/envelope com fita transparente</li>
        </ul>
      </div>

      {/* STATUS E CÓDIGO DE RASTREIO */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        
        {/* Status atual */}
        <div className="flex items-center gap-3">
          {shipping?.status === 'in_transit' ? (
            <CheckCircle className="text-green-500" size={24} />
          ) : (
            <Truck className="text-yellow-500" size={24} />
          )}
          <div>
            <p className="text-xs text-white/60 uppercase font-bold tracking-widest">Status do Envio</p>
            <p className="text-lg font-black">
              {shipping?.status === 'in_transit' ? '📤 Enviado' : '⏳ Aguardando Envio'}
            </p>
          </div>
        </div>

        {/* Campo de Código de Rastreio */}
        <div className="space-y-3">
          <label className="block">
            <p className="text-xs text-white/60 uppercase font-bold tracking-widest mb-2">
              Código de Rastreio
            </p>
            <p className="text-xs text-white/40 mb-3">
              (Recebido no balcão dos Correios/Loggi)
            </p>
            <input
              type="text"
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
              placeholder="Ex: AA123456789BR"
              disabled={shipping?.status === 'in_transit'}
              className="w-full px-4 py-3 bg-black/40 border border-white/20 text-white font-mono font-bold rounded-lg focus:outline-none focus:border-[#D4AF37] uppercase disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </label>

          {/* Botão Salvar */}
          {shipping?.status !== 'in_transit' ? (
            <button
              onClick={handleSaveTrackingCode}
              disabled={saving || !trackingCode.trim()}
              className="w-full px-6 py-4 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black rounded-xl font-black uppercase text-sm flex items-center justify-center gap-2 hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving ? (
                <>⏳ Salvando...</>
              ) : (
                <>
                  <Save size={18} />
                  Salvar Código e Marcar como Enviado
                </>
              )}
            </button>
          ) : (
            <div className="w-full px-6 py-4 bg-green-600/20 border border-green-500/30 text-green-300 rounded-xl font-bold uppercase text-sm flex items-center justify-center gap-2">
              <CheckCircle size={18} />
              ✓ Enviado em {new Date(shipping?.updated_at || Date.now()).toLocaleDateString('pt-BR')}
            </div>
          )}
        </div>
      </div>

      {/* Botão de Gerar PDF da Etiqueta */}
      <button
        onClick={handleGenerateLabelPDF}
        className="w-full px-6 py-3 bg-white/10 border border-white/20 text-white rounded-lg font-bold uppercase text-xs hover:bg-white/20 transition-all flex items-center justify-center gap-2 print:hidden"
      >
        <Printer size={16} />
        Baixar Etiqueta A6 (PDF)
      </button>
    </div>
  );
}
