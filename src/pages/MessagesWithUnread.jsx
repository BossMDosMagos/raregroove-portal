import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Disc, MessageSquare, Archive, ArchiveRestore, Trash2, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Avatar from '../components/Avatar';
import { Pill } from '../components/UIComponents';
import { toast } from 'sonner';
import { useUnreadMessages } from '../contexts/UnreadMessagesContext';
import { useI18n } from '../contexts/I18nContext.jsx';

export default function MessagesWithUnread() {
  // Force refresh v1.1
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [archivedConversations, setArchivedConversations] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [activeTab, setActiveTab] = useState('conversas');
  const [deletingConversationKey, setDeletingConversationKey] = useState(null);
  const navigate = useNavigate();
  const { unreadCount } = useUnreadMessages();
  const { t } = useI18n();

  const fetchConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: archivedData } = await supabase
        .from('archived_conversations')
        .select('item_id')
        .eq('user_id', user.id);

      const archivedItemIds = new Set((archivedData || []).map(a => a.item_id));

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
        if (archivedItemIds.has(msg.item_id)) return;
        
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
        .select('id, full_name, avatar_url')
        .in('id', Array.from(otherUserIds));

      const itemsMap = new Map((itemsData || []).map((item) => [item.id, item]));
      const profilesMap = new Map((profilesData || []).map((profile) => [profile.id, profile]));

      const result = Array.from(latestByItem.values()).map((msg) => {
        const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        return {
          id: msg.id,
          itemId: msg.item_id,
          otherUserId: otherId,
          lastMessage: msg.content,
          createdAt: msg.created_at,
          item: itemsMap.get(msg.item_id),
          otherUser: profilesMap.get(otherId),
          userId: user.id
        };
      });

      setConversations(result);

      const unreadByItem = new Map();
      (messages || []).forEach((msg) => {
        if (msg.receiver_id === user.id && msg.read_at === null) {
          unreadByItem.set(msg.item_id, (unreadByItem.get(msg.item_id) || 0) + 1);
        }
      });
      setUnreadCounts(Object.fromEntries(unreadByItem));

    } catch (error) {
      toast.error('ERRO AO CARREGAR');
    } finally {
      setLoading(false);
    }
  };

  const fetchArchivedConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: archivedData } = await supabase
        .from('archived_conversations')
        .select('item_id')
        .eq('user_id', user.id);

      const archivedItemIds = new Set((archivedData || []).map(a => a.item_id));

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
        if (!archivedItemIds.has(msg.item_id)) return;
        if (!latestByItem.has(msg.item_id)) {
          latestByItem.set(msg.item_id, msg);
          itemIds.add(msg.item_id);
          const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
          otherUserIds.add(otherId);
        }
      });

      const { data: itemsData } = await supabase.from('items').select('id, title, image_url').in('id', Array.from(itemIds));
      const { data: profilesData } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', Array.from(otherUserIds));

      const itemsMap = new Map((itemsData || []).map((item) => [item.id, item]));
      const profilesMap = new Map((profilesData || []).map((profile) => [profile.id, profile]));

      const result = Array.from(latestByItem.values()).map((msg) => {
        const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        return {
          id: msg.id,
          itemId: msg.item_id,
          otherUserId: otherId,
          lastMessage: msg.content,
          createdAt: msg.created_at,
          item: itemsMap.get(msg.item_id),
          otherUser: profilesMap.get(otherId),
          userId: user.id
        };
      });

      setArchivedConversations(result);
    } catch (error) {
      console.error(error);
    }
  };

  const handleUnarchive = async (itemId, e) => {
    e.stopPropagation();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('archived_conversations').delete().eq('user_id', user.id).eq('item_id', itemId);
      toast.success('CONVERSA RESTAURADA');
      fetchConversations();
      fetchArchivedConversations();
    } catch (error) {
      toast.error('ERRO AO DESARQUIVAR');
    }
  };

  const handleDeleteConversation = async (conversation, e) => {
    e.stopPropagation();
    if (!window.confirm("Apagar permanentemente para ambos?")) return;

    try {
      const conversationKey = `${conversation.itemId}-${conversation.otherUserId}`;
      setDeletingConversationKey(conversationKey);

      // 1. Apagar todas as mensagens do item_id onde sender_id ou receiver_id seja igual a qualquer um dos dois participantes
      const { error: delMsgErr } = await supabase
        .from('messages')
        .delete()
        .eq('item_id', conversation.itemId)
        .or(`sender_id.eq.${conversation.userId},receiver_id.eq.${conversation.userId},sender_id.eq.${conversation.otherUserId},receiver_id.eq.${conversation.otherUserId}`);

      if (delMsgErr) throw delMsgErr;

      // 2. Limpar Arquivamentos
      await supabase
        .from('archived_conversations')
        .delete()
        .eq('item_id', conversation.itemId);

      toast.success('CONVERSA EXTERMINADA');
      setConversations(prev => prev.filter(c => c.itemId !== conversation.itemId));
      setArchivedConversations(prev => prev.filter(c => c.itemId !== conversation.itemId));
    } catch (error) {
      toast.error('ERRO AO APAGAR');
    } finally {
      setDeletingConversationKey(null);
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchArchivedConversations();
  }, [unreadCount]);

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Disc className="animate-spin text-[#D4AF37]" size={40} />
    </div>
  );

  const activeConversations = activeTab === 'conversas' ? conversations : archivedConversations;

  return (
    <div className="min-h-screen bg-charcoal-deep text-white py-12 px-4 md:px-8 pt-28 selection:bg-gold-premium/30 selection:text-gold-light">
      <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-1000">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div className="space-y-4">
            <Pill color="gold">{t('messages.badge')}</Pill>
            <div>
              <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase leading-none text-luxury">
                {t('messages.title')}
              </h1>
              <p className="text-silver-premium/60 text-lg font-medium tracking-wide mt-1">
                {t('messages.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-[1px] w-12 bg-gold-premium/30"></div>
              <p className="text-silver-premium/40 text-[10px] uppercase tracking-[0.3em] font-bold">
                {unreadCount > 0 ? `${unreadCount} ${t('messagesWithUnread.unreadCount') || 'MENSAGENS NÃO LIDAS'}` : t('messagesWithUnread.allRead') || 'TODAS AS MENSAGENS LIDAS'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/catalogo')} 
            className="group flex items-center justify-center gap-3 bg-charcoal-mid/50 text-gold-premium border border-gold-premium/20 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-gold-premium hover:text-charcoal-deep transition-all duration-500 shadow-xl active:scale-95"
          >
            {t('messagesWithUnread.backToCatalog') || 'Explorar Catálogo'}
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 p-1 bg-charcoal-mid/30 rounded-[1.5rem] border border-gold-premium/5 w-fit">
          <button 
            onClick={() => setActiveTab('conversas')} 
            className={`px-8 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-500 flex items-center gap-3
              ${activeTab === 'conversas' 
                ? 'bg-gold-premium text-charcoal-deep shadow-lg scale-105' 
                : 'text-silver-premium/40 hover:text-gold-premium hover:bg-gold-premium/5'}`}
          >
            <MessageSquare size={14} className={activeTab === 'conversas' ? 'animate-pulse' : ''} />
            {t('messagesWithUnread.tabs.conversations') || 'Ativas'}
            <span className={`ml-1 px-2 py-0.5 rounded-full text-[9px] ${activeTab === 'conversas' ? 'bg-charcoal-deep/20 text-charcoal-deep' : 'bg-gold-premium/10 text-gold-premium'}`}>
              {conversations.length}
            </span>
          </button>
          <button 
            onClick={() => setActiveTab('arquivadas')} 
            className={`px-8 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-500 flex items-center gap-3
              ${activeTab === 'arquivadas' 
                ? 'bg-gold-premium text-charcoal-deep shadow-lg scale-105' 
                : 'text-silver-premium/40 hover:text-gold-premium hover:bg-gold-premium/5'}`}
          >
            <Archive size={14} className={activeTab === 'arquivadas' ? 'animate-pulse' : ''} />
            {t('messagesWithUnread.tabs.archived') || 'Arquivadas'}
            <span className={`ml-1 px-2 py-0.5 rounded-full text-[9px] ${activeTab === 'arquivadas' ? 'bg-charcoal-deep/20 text-charcoal-deep' : 'bg-gold-premium/10 text-gold-premium'}`}>
              {archivedConversations.length}
            </span>
          </button>
        </div>

        {/* Conversations List */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          {activeConversations.length === 0 ? (
            <div className="glass-card rounded-[3rem] p-24 text-center border-dashed border-2 border-gold-premium/20">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-[2.5rem] bg-gold-premium/5 border border-gold-premium/10 mb-8 shadow-inner">
                <MessageSquare size={48} className="text-gold-premium/20" />
              </div>
              <h2 className="text-2xl font-black text-white mb-4 tracking-tighter uppercase">
                {activeTab === 'conversas' ? t('messagesWithUnread.empty.title') || 'Nenhuma conversa ativa' : t('messagesWithUnread.empty.archived') || 'Nenhuma conversa arquivada'}
              </h2>
              <p className="text-silver-premium/40 max-w-xs mx-auto text-xs leading-relaxed uppercase tracking-widest font-medium">
                {activeTab === 'conversas' ? t('messagesWithUnread.empty.desc') || 'Suas negociações aparecerão aqui assim que você iniciar um contato.' : t('messagesWithUnread.empty.archivedDesc') || 'Conversas antigas que você arquivou aparecerão nesta seção.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-6">
              {activeConversations.map((conv) => (
                <div key={conv.id} className="relative group perspective-1000">
                  <button 
                    onClick={() => navigate(`/chat/${conv.itemId}/${conv.otherUserId}`)}
                    className="w-full glass-card border-gold-premium/5 p-6 md:p-8 rounded-[2.5rem] text-left hover:border-gold-premium/30 hover:bg-gold-premium/[0.02] transition-all duration-500 flex flex-col md:flex-row gap-6 md:items-center shadow-xl group-hover:translate-z-10"
                  >
                    {/* Item and User Avatar */}
                    <div className="flex items-center gap-5 shrink-0">
                      <div className="relative">
                        <div className="w-20 h-20 rounded-2xl overflow-hidden border border-gold-premium/10 shadow-2xl">
                          <img src={conv.item?.image_url} alt={conv.item?.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 ring-4 ring-charcoal-deep rounded-full">
                          <Avatar 
                            src={conv.otherUser?.avatar_url} 
                            name={conv.otherUser?.full_name} 
                            size="lg" 
                            className="rounded-full border border-gold-premium/20"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1 min-w-0">
                          <h3 className="font-black uppercase truncate text-luxury text-lg tracking-tight group-hover:text-gold-premium transition-colors">
                            {conv.item?.title}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="text-gold-premium/60 text-[10px] font-black uppercase tracking-widest">{conv.otherUser?.full_name}</span>
                            <span className="w-1 h-1 rounded-full bg-gold-premium/20"></span>
                            <span className="text-silver-premium/30 text-[9px] font-medium uppercase tracking-tighter">
                              {new Date(conv.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-2">
                          {unreadCounts[conv.itemId] > 0 && (
                            <span className="bg-gold-premium text-charcoal-deep text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-[0_0_15px_rgba(212,175,55,0.4)] animate-pulse">
                              {unreadCounts[conv.itemId]} {t('messagesWithUnread.newBadge') || 'NOVAS'}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-silver-premium/60 text-sm italic line-clamp-1 font-medium tracking-tight bg-gold-premium/5 p-3 rounded-xl border border-gold-premium/5 group-hover:bg-gold-premium/10 transition-all">
                        "{conv.lastMessage}"
                      </p>
                    </div>

                    {/* Action Space (Placeholder for Desktop) */}
                    <div className="w-12 hidden md:block"></div>
                  </button>
                  
                  {/* Floating Actions */}
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 flex gap-3 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
                    {activeTab === 'arquivadas' && (
                      <button 
                        onClick={(e) => handleUnarchive(conv.itemId, e)} 
                        className="w-12 h-12 flex items-center justify-center bg-charcoal-mid/80 backdrop-blur-xl border border-gold-premium/20 rounded-2xl text-gold-premium hover:bg-gold-premium hover:text-charcoal-deep transition-all duration-300 shadow-2xl"
                        title="Restaurar"
                      >
                        <ArchiveRestore size={20} />
                      </button>
                    )}
                    <button 
                      onClick={(e) => handleDeleteConversation(conv, e)} 
                      disabled={deletingConversationKey === `${conv.itemId}-${conv.otherUserId}`}
                      className="w-12 h-12 flex items-center justify-center bg-danger/5 backdrop-blur-xl border border-danger/20 rounded-2xl text-danger hover:bg-danger hover:text-white transition-all duration-300 shadow-2xl disabled:opacity-50"
                      title="Excluir Permanentemente"
                    >
                      {deletingConversationKey === `${conv.itemId}-${conv.otherUserId}` ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={20} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
