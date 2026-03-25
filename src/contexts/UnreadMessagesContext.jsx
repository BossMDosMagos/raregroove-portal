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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUnreadCount(0);
        setCurrentUserId(null);
        return;
      }

      setCurrentUserId(user.id);

      // Contar mensagens não lidas (com read_at NULL)
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, item_id, read_at')
        .eq('receiver_id', user.id)
        .is('read_at', null);

      if (error) {
        return;
      }

      if (messages) {
        // Contar TOTAL de mensagens não lidas (não apenas conversas)
        const newCount = messages.length;
        setUnreadCount(newCount);
      }
    } catch {
      // Silent fail
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

    const channel = supabase
      .channel(`notifications-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUserId}`
        },
        (payload) => {
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
          fetchUnreadCount();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          // Silent fail
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [currentUserId]);

  return (
    <UnreadMessagesContext.Provider value={{ unreadCount, refreshUnreadCount: fetchUnreadCount }}>
      {children}
    </UnreadMessagesContext.Provider>
  );
};
