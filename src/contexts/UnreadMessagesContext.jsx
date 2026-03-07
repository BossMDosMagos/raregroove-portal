import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const UnreadMessagesContext = createContext();

export const useUnreadMessages = () => {
  const context = useContext(UnreadMessagesContext);
  if (!context) {
    throw new Error('useUnreadMessages must be used within UnreadMessagesProvider');
  }
  return context;
};

export const UnreadMessagesProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState(null);

  const fetchUnreadCount = async () => {
    try {
      console.log('🔵 Buscando contador de mensagens não lidas...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('⚠️ Usuário não autenticado');
        setUnreadCount(0);
        setCurrentUserId(null);
        return;
      }

      setCurrentUserId(user.id);
      console.log('👤 Usuário atual:', user.id);

      // Contar mensagens não lidas (com read_at NULL)
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, item_id, read_at')
        .eq('receiver_id', user.id)
        .is('read_at', null);

      if (error) {
        console.error('❌ Erro ao buscar mensagens:', error);
        return;
      }

      console.log('📨 Mensagens não lidas encontradas:', messages?.length || 0);
      console.log('Mensagens:', messages);

      if (messages) {
        // Contar TOTAL de mensagens não lidas (não apenas conversas)
        const newCount = messages.length;
        const uniqueConversations = new Set(messages.map(m => m.item_id)).size;
        console.log('🔔 Total de mensagens não lidas:', newCount);
        console.log('💬 Conversas com mensagens não lidas:', uniqueConversations);
        setUnreadCount(newCount);
      }
    } catch (error) {
      console.error('❌ Erro ao buscar mensagens não lidas:', error);
    }
  };

  // Configurar realtime para atualizar contador quando novas mensagens chegam
  useEffect(() => {
    const initId = setTimeout(fetchUnreadCount, 0);

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(() => {
      setTimeout(fetchUnreadCount, 0);
    });

    return () => {
      clearTimeout(initId);
      authSubscription?.unsubscribe();
    };
  }, []);

  // Realtime para novas mensagens
  useEffect(() => {
    if (!currentUserId) return;

    console.log('🔴 Configurando realtime de notificações para user:', currentUserId);

    const channel = supabase
      .channel(`notifications-${currentUserId}`) // Canal único por usuário
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUserId}`
        },
        (payload) => {
          console.log('🟢 Nova mensagem INSERT detectada via Realtime:', payload.new);
          console.log('🔄 Atualizando contador...');
          fetchUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUserId}`
        },
        (payload) => {
          console.log('🟡 Mensagem UPDATE detectada via Realtime:', payload.new);
          console.log('🔄 Atualizando contador...');
          fetchUnreadCount();
        }
      )
      .subscribe((status) => {
        console.log('📡 Status da subscrição de notificações:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Notificações realtime conectadas com sucesso!');
          console.log('🎯 Monitorando receiver_id:', currentUserId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erro ao conectar realtime de notificações');
          console.error('🔍 Verifique se Realtime está ativo no Supabase Dashboard');
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ Timeout ao conectar Realtime');
        } else if (status === 'CLOSED') {
          console.warn('🔴 Canal Realtime foi fechado');
        }
      });

    return () => {
      console.log('🔴 Desconectando realtime de notificações');
      channel.unsubscribe();
    };
  }, [currentUserId]);

  return (
    <UnreadMessagesContext.Provider value={{ unreadCount, refreshUnreadCount: fetchUnreadCount }}>
      {children}
    </UnreadMessagesContext.Provider>
  );
};
