import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Disc, AlertCircle, Heart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export default function SwapProposalModal({ isOpen, onClose, item, currentUserId }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [myItems, setMyItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [proposalMessage, setProposalMessage] = useState('');
  const [creating, setCreating] = useState(false);
  
  // 🍯 HONEY POT: Campo oculto anti-bot
  const [websiteUrl, setWebsiteUrl] = useState('');

  useEffect(() => {
    if (isOpen && currentUserId) {
      loadMyItems();
    }
  }, [isOpen, currentUserId]);

  const loadMyItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('seller_id', currentUserId)
        .eq('is_sold', false)
        .neq('status', 'vendido')
        .neq('id', item.id) // Não pode trocar com o mesmo item
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyItems(data || []);

      if (data?.length > 0) {
        setSelectedItemId(data[0].id);
      }
    } catch (error) {
      toast.error('Erro ao carrregar seus itens');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSwapProposal = async () => {
    if (!selectedItemId) {
      toast.error('Selecione um item para trocar');
      return;
    }

    // 🍯 HONEY POT: Detectar bots preenchendo campo oculto
    if (websiteUrl) {
      toast.error('ATIVIDADE SUSPEITA', {
        description: 'Sua solicitação foi bloqueada por motivos de segurança.',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }

    try {
      setCreating(true);

      // 1. Buscar dados dos itens
      const [myItemData, theirItemData] = await Promise.all([
        supabase.from('items').select('*').eq('id', selectedItemId).single(),
        supabase.from('items').select('*').eq('id', item.id).single()
      ]);

      if (myItemData.error || theirItemData.error) throw new Error('Erro ao buscar itens');

      // 2. Criar registro de swap na tabela swaps
      const { data: swapData, error: swapError } = await supabase
        .from('swaps')
        .insert([
          {
            user_1_id: currentUserId, // Usuario atual (propositor)
            user_2_id: item.seller_id, // Vendedor do item
            item_1_id: selectedItemId, // Item do usuario atual
            item_2_id: item.id, // Item do vendedor
            status: 'aguardando_taxas',
            user_1_item_reserved: true,
            user_2_item_reserved: false // Será confirmado depois
          }
        ])
        .select()
        .single();

      if (swapError) throw swapError;

      // 3. Criar mensagem no chat propondo a troca
      const { error: messageError } = await supabase
        .from('messages')
        .insert([
          {
            sender_id: currentUserId,
            receiver_id: item.seller_id,
            item_id: item.id,
            content: `🔄 PROPOSTA DE TROCA\n\nEu ofereço: ${myItemData.data.title}\nVous recebe: ${theirItemData.data.title}\n\n${proposalMessage || 'Que acha?'}`
          }
        ]);

      if (messageError) throw messageError;

      toast.success('Proposta de troca criada! Redirecionando para pagamento...');
      onClose();
      setProposalMessage('');
      setSelectedItemId(null);
      
      // Redirecionar para página de pagamento da taxa de garantia
      setTimeout(() => {
        navigate(`/swap-payment/${swapData.swap_id || swapData.id}`);
      }, 1000);
    } catch (error) {
      toast.error('Erro ao criar proposta de troca');
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  const selectedItem = myItems.find(i => i.id === selectedItemId);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Modal */}
      <div className="relative w-full md:w-full max-w-2xl bg-black border border-white/10 rounded-t-3xl md:rounded-3xl p-8 space-y-6 md:max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-white/60 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        {/* Header */}
        <div>
          <h2 className="text-3xl font-black uppercase mb-2">Propor Troca</h2>
          <p className="text-white/60 text-sm">
            Selecione um item do seu acervo para trocar com <strong>{item.title}</strong>
          </p>
        </div>

        {/* Items do Vendedor (Referência) */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
          <p className="text-xs text-white/60 uppercase font-bold tracking-widest">Item que você deseja</p>
          <div className="flex gap-4">
            {item.image_url && (
              <img src={item.image_url} alt={item.title} className="w-20 h-20 rounded-lg object-cover" />
            )}
            <div className="flex-1">
              <p className="font-bold text-[#D4AF37]">{item.title}</p>
              <p className="text-white/60 text-sm">{item.artist}</p>
              <p className="text-xl font-black mt-2">R$ {parseFloat(item.price).toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Meus Items */}
        <div className="space-y-3">
          <p className="text-xs text-white/60 uppercase font-bold tracking-widest">Selecione o que você oferece</p>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-white/60">
              <Disc className="animate-spin mr-2" size={20} />
              Carregando seus itens...
            </div>
          ) : myItems.length === 0 ? (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex gap-2">
              <AlertCircle size={20} className="text-yellow-500 flex-shrink-0" />
              <p className="text-sm text-yellow-100">
                Você não tem itens disponíveis para trocar. Adicione itens ao seu acervo primeiro!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-80 overflow-y-auto">
              {myItems.map((myItem) => (
                <button
                  key={myItem.id}
                  onClick={() => setSelectedItemId(myItem.id)}
                  className={`relative flex flex-col gap-2 p-3 rounded-xl border transition-all ${
                    selectedItemId === myItem.id
                      ? 'bg-[#D4AF37]/20 border-[#D4AF37]/50'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  {myItem.image_url && (
                    <img
                      src={myItem.image_url}
                      alt={myItem.title}
                      className="w-full aspect-square rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <p className="text-xs font-bold text-[#D4AF37] line-clamp-2">{myItem.title}</p>
                    <p className="text-[10px] text-white/60">{myItem.artist}</p>
                  </div>
                  <p className="text-xs font-bold text-white/80">R$ {parseFloat(myItem.price).toFixed(2)}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Preview do Item Selecionado */}
        {selectedItem && (
          <div className="bg-gradient-to-b from-[#D4AF37]/10 to-transparent border border-[#D4AF37]/30 rounded-2xl p-6 space-y-3">
            <p className="text-xs text-white/60 uppercase font-bold tracking-widest">Seu item selecionado</p>
            <div className="flex gap-4">
              {selectedItem.image_url && (
                <img src={selectedItem.image_url} alt={selectedItem.title} className="w-20 h-20 rounded-lg object-cover" />
              )}
              <div className="flex-1">
                <p className="font-bold text-[#D4AF37]">{selectedItem.title}</p>
                <p className="text-white/60 text-sm">{selectedItem.artist}</p>
                <p className="text-xl font-black mt-2">R$ {parseFloat(selectedItem.price).toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* 🍯 HONEY POT: Campo oculto para capturar bots */}
        <input
          type="text"
          name="website_url"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          autoComplete="off"
          tabIndex="-1"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '-9999px',
            width: '1px',
            height: '1px',
            opacity: 0,
            pointerEvents: 'none'
          }}
        />

        {/* Mensagem (Opcional) */}
        <div>
          <label className="text-xs text-white/60 uppercase font-bold tracking-widest block mb-2">
            Mensagem (Opcional)
          </label>
          <textarea
            value={proposalMessage}
            onChange={(e) => setProposalMessage(e.target.value)}
            placeholder="Adicione uma mensagem pessoal sobre a troca..."
            maxLength={200}
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-[#D4AF37]/50 outline-none resize-none"
          />
          <p className="text-[10px] text-white/40 mt-1">{proposalMessage.length}/200</p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-2">
          <p className="text-xs font-bold text-blue-300 flex items-center gap-2">
            <Heart size={14} /> Como funciona?
          </p>
          <ul className="text-xs text-blue-100/80 space-y-1">
            <li>✓ Você propõe a troca enviando uma mensagem ao vendedor</li>
            <li>✓ Se aceitar, ambas as partes pagam a Taxa de Garantia (R$ 10)</li>
            <li>✓ Após ambos confirmarem, geram etiquetas de envio</li>
            <li>✓ Taxa revertida à conta se cancelado</li>
          </ul>
        </div>

        {/* Botões */}
        <div className="flex gap-3 pt-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-white/5 border border-white/10 rounded-xl font-bold uppercase text-xs hover:border-white/20 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreateSwapProposal}
            disabled={!selectedItemId || creating || myItems.length === 0}
            className="flex-1 px-6 py-3 bg-[#D4AF37] text-black rounded-xl font-bold uppercase text-xs disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {creating ? <Disc className="animate-spin" size={16} /> : '🔄'}
            Propor Troca
          </button>
        </div>
      </div>
    </div>
  );
}
