import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Disc, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useI18n } from '../contexts/I18nContext.jsx';

export default function Messages() {
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const navigate = useNavigate();
  const { t } = useI18n();

  const fetchConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const latestByItem = new Map();
      const itemIds = new Set();
      const otherUserIds = new Set();

      (messages || []).forEach((msg) => {
        if (!latestByItem.has(msg.item_id)) {
          latestByItem.set(msg.item_id, msg);
          itemIds.add(msg.item_id);
          const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
          otherUserIds.add(otherId);
        }
      });

      const { data: itemsData } = await supabase
        .from('items')
        .select('id, title, image_url')
        .in('id', Array.from(itemIds));

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', Array.from(otherUserIds));

      const itemsMap = new Map((itemsData || []).map((item) => [item.id, item]));
      const profilesMap = new Map((profilesData || []).map((profile) => [profile.id, profile]));

      const result = Array.from(latestByItem.values()).map((msg) => {
        const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        return {
          id: msg.id,
          itemId: msg.item_id,
          lastMessage: msg.content,
          createdAt: msg.created_at,
          item: itemsMap.get(msg.item_id),
          otherUser: profilesMap.get(otherId)
        };
      });

      setConversations(result);
    } catch (error) {
      toast.error('ERRO AO CARREGAR', {
        description: 'Não foi possível carregar suas mensagens',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Disc className="animate-spin text-[#D4AF37]" size={40} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white py-8 px-4 md:px-6 pt-20">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
          <div>
            <Pill>{t('messages.badge') || 'Comunicação'}</Pill>
            <h1 className="text-4xl font-black italic tracking-tighter mt-4 uppercase"><span className="text-[#D4AF37]">{t('messages.title') || 'Mensagens'}</span></h1>
            <p className="text-white/40 text-[10px] uppercase tracking-[3px] mt-2">{t('messages.subtitle') || 'Negocie dentro do Rare Groove'}</p>
          </div>
          <button
            onClick={() => navigate('/catalogo')}
            className="bg-white/5 text-white/80 border border-white/10 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-[#D4AF37]/50 hover:text-[#D4AF37] transition-all"
          >
            {t('messages.backToCatalog') || 'Voltar ao Catalogo'}
          </button>
        </div>

        {conversations.length === 0 ? (
          <div className="border-2 border-dashed border-white/10 rounded-[2rem] p-20 text-center">
            <p className="text-white/20 uppercase font-black tracking-widest">{t('messages.empty') || 'Nenhuma conversa encontrada.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => navigate(`/chat/${conv.itemId}`)}
                className="text-left bg-white/5 border border-white/10 rounded-[2rem] p-6 hover:border-[#D4AF37]/50 transition-all"
              >
                <div className="flex gap-4">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/5 shrink-0">
                    {conv.item?.image_url ? (
                      <img src={conv.item.image_url} alt={conv.item.title} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Disc size={24} className="text-white/20" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-black uppercase truncate">{conv.item?.title || 'Item'}</h3>
                      <MessageSquare size={16} className="text-[#D4AF37]" />
                    </div>
                    <p className="text-white/40 text-xs uppercase mt-1">{conv.otherUser?.full_name || 'Colecionador'}</p>
                    <p className="text-white/70 text-sm mt-3 line-clamp-2">{conv.lastMessage}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
