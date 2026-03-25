import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const toastStyles = {
  success: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
  error: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
  info: { background: '#050505', border: '1px solid #3b82f6', color: '#FFF' },
};

export const notificationService = {
  async getNotifications(userId, { limit = 20, unreadOnly = false } = {}) {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (unreadOnly) {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: [], error };
    }
  },

  async markAsRead(notificationId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  },

  async markAllAsRead(userId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  },

  async delete(notificationId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  },

  async create(notification) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: notification.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          link_url: notification.linkUrl,
          metadata: notification.metadata,
        })
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getUnreadCount(userId) {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return { count, error: null };
    } catch (error) {
      return { count: 0, error };
    }
  },

  async subscribeToPush(userId) {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      toast.error('Notificações não suportadas', { style: toastStyles.error });
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        toast.error('Permissão de notificações negada', { style: toastStyles.error });
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        await this.savePushSubscription(userId, existingSubscription);
        return true;
      }

      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        return false;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      await this.savePushSubscription(userId, subscription);
      
      toast.success('Notificações ativadas!', { style: toastStyles.success });
      return true;
    } catch (error) {
      toast.error('Erro ao ativar notificações', { style: toastStyles.error });
      return false;
    }
  },

  async savePushSubscription(userId, subscription) {
    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.p256dh,
          auth: subscription.auth,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
    } catch {
      // Silent fail
    }
  },
};

export const wishlistService = {
  async getWishlist(userId) {
    try {
      const { data, error } = await supabase
        .from('wishlist')
        .select(`
          *,
          items:item_id (
            id,
            title,
            artist,
            price,
            image_url,
            is_sold,
            seller:profiles!items_seller_id_fkey (
              id,
              full_name
            )
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching wishlist:', error);
      return { data: [], error };
    }
  },

  async addToWishlist(userId, itemId, notifyOnPriceDrop = true, notifyOnAvailability = true) {
    try {
      const { data, error } = await supabase
        .from('wishlist')
        .insert({
          user_id: userId,
          item_id: itemId,
          notify_on_price_drop: notifyOnPriceDrop,
          notify_on_availability: notifyOnAvailability,
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Item adicionado à lista de desejos', { style: toastStyles.success });
      return { data, error: null };
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      toast.error('Erro ao adicionar à lista de desejos', { style: toastStyles.error });
      return { data: null, error };
    }
  },

  async removeFromWishlist(userId, itemId) {
    try {
      const { error } = await supabase
        .from('wishlist')
        .delete()
        .eq('user_id', userId)
        .eq('item_id', itemId);

      if (error) throw error;
      
      toast.success('Item removido da lista de desejos', { style: toastStyles.success });
      return { success: true };
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      return { success: false, error };
    }
  },

  async checkInWishlist(userId, itemId) {
    try {
      const { data, error } = await supabase
        .from('wishlist')
        .select('id')
        .eq('user_id', userId)
        .eq('item_id', itemId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return { inWishlist: !!data, error: null };
    } catch (error) {
      console.error('Error checking wishlist:', error);
      return { inWishlist: false, error };
    }
  },

  async updateNotificationSettings(wishlistId, { notifyOnPriceDrop, notifyOnAvailability }) {
    try {
      const { error } = await supabase
        .from('wishlist')
        .update({
          notify_on_price_drop: notifyOnPriceDrop,
          notify_on_availability: notifyOnAvailability,
        })
        .eq('id', wishlistId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error updating wishlist settings:', error);
      return { success: false, error };
    }
  },
};

export const priceAlertService = {
  async createAlert(userId, searchQuery, targetPrice) {
    try {
      const { data, error } = await supabase
        .from('price_alerts')
        .insert({
          user_id: userId,
          search_query: searchQuery,
          target_price: targetPrice,
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Alerta de preço criado!', { style: toastStyles.success });
      return { data, error: null };
    } catch (error) {
      console.error('Error creating price alert:', error);
      return { data: null, error };
    }
  },

  async getAlerts(userId) {
    try {
      const { data, error } = await supabase
        .from('price_alerts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_triggered', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching price alerts:', error);
      return { data: [], error };
    }
  },

  async deleteAlert(alertId) {
    try {
      const { error } = await supabase
        .from('price_alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting price alert:', error);
      return { success: false, error };
    }
  },
};

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
