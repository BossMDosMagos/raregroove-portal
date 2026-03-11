import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Check, CheckCheck, Heart, Package, Star, MessageSquare, Sparkles } from 'lucide-react';
import { useUnreadMessages } from '../contexts/UnreadMessagesContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

// Ícone por tipo de notificação
const NotificationIcon = ({ type }) => {
  const iconClass = "w-5 h-5";
  switch(type) {
    case 'wishlist_match': return <Heart className={`${iconClass} text-[#D4AF37]`} />;
    case 'transaction': return <Package className={`${iconClass} text-blue-400`} />;
    case 'review': return <Star className={`${iconClass} text-yellow-400`} />;
    case 'message': return <MessageSquare className={`${iconClass} text-green-400`} />;
    case 'system': return <Sparkles className={`${iconClass} text-purple-400`} />;
    default: return <Bell className={`${iconClass} text-gray-400`} />;
  }
};

// Card de notificação individual
function NotificationCard({ notification, onMarkRead, onNavigate }) {
  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Agora';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m atrás`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h atrás`;
    return `${Math.floor(seconds / 86400)}d atrás`;
  };

  const handleClick = () => {
    if (!notification.is_read) {
      onMarkRead(notification.id);
    }
    onNavigate(notification);
  };

  return (
    <div
      onClick={handleClick}
      className={`
        p-4 border-b border-[#D4AF37]/10 cursor-pointer transition-colors
        ${notification.is_read ? 'bg-black/20' : 'bg-[#D4AF37]/5 hover:bg-[#D4AF37]/10'}
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`
          w-10 h-10 rounded-full flex items-center justify-center shrink-0
          ${notification.is_read ? 'bg-white/5' : 'bg-[#D4AF37]/20'}
        `}>
          <NotificationIcon type={notification.type} />
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className={`
            font-bold text-sm mb-1
            ${notification.is_read ? 'text-white/60' : 'text-white'}
          `}>
            {notification.title}
          </h4>
          <p className={`
            text-xs leading-relaxed
            ${notification.is_read ? 'text-white/40' : 'text-white/70'}
          `}>
            {notification.message}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-white/40">
              {timeAgo(notification.created_at)}
            </span>
            {!notification.is_read && (
              <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const { unreadCount: unreadMessagesCount } = useUnreadMessages();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const dropdownRef = useRef(null);

  // Total de notificações não lidas (sistema + mensagens)
  const unreadNotificationsCount = notifications.filter(n => !n.is_read).length;
  const totalUnreadCount = unreadNotificationsCount + unreadMessagesCount;

  const loadNotifications = async (userId) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (!error) {
      setNotifications(data || []);
    }
    setLoading(false);
  };

  const subscribeToNotifications = (userId) => {
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev]);
          if (payload.new.type === 'wishlist_match') {
            toast.success('🔥 ' + payload.new.title, {
              description: payload.new.message,
              duration: 5000,
              style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' }
            });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Carregar usuário e notificações
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (user) {
        loadNotifications(user.id);
        subscribeToNotifications(user.id);
      }
    };
    loadUser();
  }, []);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Marcar notificação como lida
  const markAsRead = async (notificationId) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (!error) {
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    }
  };

  // Marcar todas como lidas
  const markAllAsRead = async () => {
    if (!currentUser) return;
    
    const { error } = await supabase
      .rpc('mark_all_notifications_read', { user_uuid: currentUser.id });

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('Todas as notificações foram marcadas como lidas', {
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
    }
  };

  // Navegar baseado no tipo de notificação
  const handleNavigate = (notification) => {
    setIsOpen(false);
    
    if (notification.related_id && notification.type === 'system' && (String(notification.title || '').toUpperCase().includes('DISPUTA') || String(notification.message || '').toLowerCase().includes('disputa'))) {
      navigate(`/disputas/${notification.related_id}`);
    } else if (notification.item_id) {
      navigate(`/item/${notification.item_id}`);
    } else if (notification.type === 'message') {
      navigate('/mensagens');
    } else if (notification.type === 'review') {
      navigate('/profile');
    }
  };

  const hasUnread = totalUnreadCount > 0;

  return (
    <div ref={dropdownRef} className="fixed top-6 right-6 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative"
        aria-label={`${totalUnreadCount} notificações não lidas`}
      >
        <div className="relative">
          {/* Sino com animação */}
          <div
            className={`
              w-12 h-12 rounded-full 
              bg-black/80 backdrop-blur-sm
              border-2 border-[#D4AF37]/30
              flex items-center justify-center
              transition-all duration-300
              hover:border-[#D4AF37] hover:shadow-[0_0_20px_rgba(212,175,55,0.3)]
              ${hasUnread ? 'animate-pulse' : ''}
            `}
          >
            <Bell
              size={20}
              className={`
                transition-colors duration-300
                ${hasUnread ? 'text-[#D4AF37] fill-[#D4AF37]' : 'text-white/60'}
                group-hover:text-[#D4AF37]
              `}
            />
          </div>

          {/* Badge contador */}
          {hasUnread && (
            <div
              className="
                absolute -top-1 -right-1
                min-w-[20px] h-5 px-1.5
                bg-red-500 
                rounded-full
                flex items-center justify-center
                border-2 border-black
                animate-bounce
              "
            >
              <span className="text-white text-[10px] font-black">
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </span>
            </div>
          )}
        </div>
      </button>

      {/* Dropdown de notificações */}
      {isOpen && (
        <div className="absolute top-16 right-0 w-[400px] max-w-[calc(100vw-2rem)] bg-[#050505] border border-[#D4AF37]/30 rounded-lg shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-black/60 border-b border-[#D4AF37]/20 p-4 flex items-center justify-between">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#D4AF37]" />
              Notificações
            </h3>
            <div className="flex items-center gap-2">
              {unreadNotificationsCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-[#D4AF37] hover:text-[#D4AF37]/80 transition-colors flex items-center gap-1"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Lista de notificações */}
          <div className="max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-white/40">
                Carregando...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <>
                {notifications.map(notification => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onMarkRead={markAsRead}
                    onNavigate={handleNavigate}
                  />
                ))}
              </>
            )}
          </div>

          {/* Footer com link para mensagens */}
          {unreadMessagesCount > 0 && (
            <div 
              onClick={() => {
                setIsOpen(false);
                navigate('/mensagens');
              }}
              className="bg-black/40 border-t border-[#D4AF37]/20 p-4 cursor-pointer hover:bg-[#D4AF37]/10 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#D4AF37]" />
                  <span className="text-white text-sm font-medium">
                    {unreadMessagesCount} {unreadMessagesCount === 1 ? 'mensagem nova' : 'mensagens novas'}
                  </span>
                </div>
                <span className="text-[#D4AF37] text-xs font-bold">VER →</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

