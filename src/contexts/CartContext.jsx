import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const CartContext = createContext(null);

const STORAGE_KEY = 'rg_cart_v2';

function safeJsonParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function nowMs() {
  return Date.now();
}

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function CartProvider({ children }) {
  const reserveMinutes = Number(import.meta.env.VITE_CART_RESERVE_MINUTES || 15);
  const reserveMs = Number.isFinite(reserveMinutes) ? reserveMinutes * 60 * 1000 : 15 * 60 * 1000;

  const [open, setOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [itemsDetails, setItemsDetails] = useState({});
  const [tick, setTick] = useState(0);
  const releasingRef = useRef(false);

  const loadFromStorage = useCallback(() => {
    const stored = safeJsonParse(localStorage.getItem(STORAGE_KEY) || 'null', null);
    if (!stored || !Array.isArray(stored) || stored.length === 0) return [];
    const valid = stored.filter(item => item?.itemId && item?.reservedUntilMs);
    return valid;
  }, []);

  const persist = useCallback((next) => {
    if (!next || next.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const fetchItemDetails = useCallback(async (itemId) => {
    const { data, error } = await supabase
      .from('items')
      .select('id, title, artist, price, image_url, status, is_sold, seller_id')
      .eq('id', itemId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }, []);

  const fetchMultipleItemsDetails = useCallback(async (itemIds) => {
    if (!itemIds || itemIds.length === 0) return {};
    const { data, error } = await supabase
      .from('items')
      .select('id, title, artist, price, image_url, status, is_sold, seller_id')
      .in('id', itemIds);

    if (error) throw error;
    const details = {};
    (data || []).forEach(item => {
      details[item.id] = item;
    });
    return details;
  }, []);

  const releaseReservation = useCallback(async (itemId) => {
    try {
      releasingRef.current = true;
      const { error } = await supabase.rpc('release_item_reservation', { item_uuid: itemId });
      if (!error) return;

      const shouldFallback = error.code === '42883' || /release_item_reservation/i.test(error.message || '');
      if (!shouldFallback) throw error;

      const { error: updateError } = await supabase
        .from('items')
        .update({ status: 'disponivel' })
        .eq('id', itemId)
        .eq('status', 'reservado');

      if (updateError) throw updateError;
    } finally {
      releasingRef.current = false;
    }
  }, []);

  const removeFromCart = useCallback(async (itemId, { silent } = { silent: false }) => {
    if (!itemId || cartItems.length === 0) return;

    const newCartItems = cartItems.filter(item => item.itemId !== itemId);
    setCartItems(newCartItems);
    persist(newCartItems);

    setItemsDetails(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });

    try {
      await releaseReservation(itemId);
      if (!silent) {
        toast.success('ITEM REMOVIDO', {
          description: 'O item voltou ao catálogo.',
          style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
        });
      }
    } catch (e) {
      if (!silent) {
        toast.error('ERRO AO LIBERAR', {
          description: e?.message || 'Não foi possível liberar a reserva.',
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
      }
    }
  }, [cartItems, persist, releaseReservation]);

  const clearLocalCart = useCallback(async () => {
    if (cartItems.length === 0) return;
    
    for (const item of cartItems) {
      try {
        await releaseReservation(item.itemId);
      } catch (e) {
        console.error('Erro ao liberar reserva:', e);
      }
    }
    
    setCartItems([]);
    setItemsDetails({});
    persist([]);
  }, [cartItems, persist, releaseReservation]);

  const addToCart = useCallback(async (itemId) => {
    const existingItem = cartItems.find(item => item.itemId === itemId);
    if (existingItem) {
      setOpen(true);
      return existingItem;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      toast.error('FAÇA LOGIN', {
        description: 'Você precisa estar logado para reservar.',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return null;
    }

    const { data, error } = await supabase.rpc('reserve_item', {
      item_uuid: itemId,
      duration_minutes: reserveMinutes,
    });

    if (error) {
      const shouldFallback = error.code === '42883' || /reserve_item/i.test(error.message || '');
      if (!shouldFallback) {
        toast.error('RESERVA FALHOU', {
          description: error.message,
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
        return null;
      }

      const { error: updateError } = await supabase
        .from('items')
        .update({ status: 'reservado' })
        .eq('id', itemId)
        .eq('is_sold', false)
        .not('status', 'in', '("vendido","reservado")');

      if (updateError) {
        toast.error('RESERVA FALHOU', {
          description: updateError.message,
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
        return null;
      }
    }

    const reservedUntilMs = data?.reserved_until ? new Date(data.reserved_until).getTime() : nowMs() + reserveMs;
    const newItem = { itemId, reservedUntilMs };
    const nextCartItems = [...cartItems, newItem];
    
    setCartItems(nextCartItems);
    persist(nextCartItems);
    setOpen(true);

    try {
      const details = await fetchItemDetails(itemId);
      setItemsDetails(prev => ({ ...prev, [itemId]: details }));
    } catch {
      setItemsDetails(prev => ({ ...prev, [itemId]: null }));
    }

    toast.success('ITEM ADICIONADO', {
      description: `Reserva garantida por ${reserveMinutes} minutos.`,
      style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
    });

    return newItem;
  }, [cartItems, fetchItemDetails, persist, reserveMinutes, reserveMs]);

  useEffect(() => {
    const stored = loadFromStorage();
    if (stored.length === 0) return;
    setCartItems(stored);

    const itemIds = stored.map(item => item.itemId);
    fetchMultipleItemsDetails(itemIds)
      .then(d => setItemsDetails(d))
      .catch(() => setItemsDetails({}));
  }, [fetchMultipleItemsDetails, loadFromStorage]);

  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (cartItems.length === 0) return;
    if (releasingRef.current) return;

    const now = nowMs();
    const expiredItems = cartItems.filter(item => item.reservedUntilMs && item.reservedUntilMs <= now);
    
    if (expiredItems.length > 0) {
      expiredItems.forEach(async (item) => {
        await removeFromCart(item.itemId, { silent: true });
      });
      
      if (cartItems.length === expiredItems.length) {
        toast.error('RESERVAS EXPIRADAS', {
          description: 'Todos os itens expiraram e foram removidos.',
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
      }
    }
  }, [cartItems, removeFromCart, tick]);

  const totalItems = cartItems.length;
  
  const totalPrice = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const details = itemsDetails[item.itemId];
      return sum + (Number(details?.price) || 0);
    }, 0);
  }, [cartItems, itemsDetails]);

  const earliestExpiry = useMemo(() => {
    if (cartItems.length === 0) return null;
    const minExpiry = Math.min(...cartItems.map(item => item.reservedUntilMs || 0));
    return minExpiry > 0 ? minExpiry : null;
  }, [cartItems]);

  const remainingMs = earliestExpiry ? Math.max(0, earliestExpiry - nowMs()) : 0;
  const remainingText = earliestExpiry ? formatRemaining(remainingMs) : null;

  const value = useMemo(() => ({
    open,
    setOpen,
    cartItems,
    itemsDetails,
    addToCart,
    removeFromCart,
    clearLocalCart,
    totalItems,
    totalPrice,
    remainingMs,
    remainingText,
    reserveMinutes,
  }), [addToCart, cartItems, clearLocalCart, itemsDetails, open, remainingMs, remainingText, removeFromCart, reserveMinutes, totalItems, totalPrice]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
