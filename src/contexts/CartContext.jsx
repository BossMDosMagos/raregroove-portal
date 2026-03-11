import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const CartContext = createContext(null);

const STORAGE_KEY = 'rg_cart_v1';

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
  const [cartItem, setCartItem] = useState(null);
  const [itemDetails, setItemDetails] = useState(null);
  const [tick, setTick] = useState(0);
  const releasingRef = useRef(false);

  const loadFromStorage = useCallback(() => {
    const stored = safeJsonParse(localStorage.getItem(STORAGE_KEY) || 'null', null);
    if (!stored?.itemId || !stored?.reservedUntilMs) return null;
    return stored;
  }, []);

  const persist = useCallback((next) => {
    if (!next) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const fetchItemDetails = useCallback(async (itemId) => {
    const { data, error } = await supabase
      .from('items')
      .select('id, title, artist, price, image_url, status, is_sold')
      .eq('id', itemId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
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

  const removeFromCart = useCallback(async ({ silent } = { silent: false }) => {
    if (!cartItem?.itemId) return;

    const itemId = cartItem.itemId;
    setCartItem(null);
    setItemDetails(null);
    persist(null);

    try {
      await releaseReservation(itemId);
      if (!silent) {
        toast.success('RESERVA CANCELADA', {
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
  }, [cartItem?.itemId, persist, releaseReservation]);

  const clearLocalCart = useCallback((itemId) => {
    if (!cartItem?.itemId) return;
    if (itemId && cartItem.itemId !== itemId) return;
    setCartItem(null);
    setItemDetails(null);
    persist(null);
  }, [cartItem?.itemId, persist]);

  const addToCart = useCallback(async (itemId) => {
    if (cartItem?.itemId && cartItem.itemId !== itemId) {
      toast.error('CARRINHO DE ELITE', {
        description: 'Apenas 1 raridade por vez. Finalize ou cancele a reserva atual.',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      setOpen(true);
      return null;
    }

    if (cartItem?.itemId === itemId) {
      setOpen(true);
      return cartItem;
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
    const next = { itemId, reservedUntilMs };
    setCartItem(next);
    persist(next);
    setOpen(true);

    try {
      const details = await fetchItemDetails(itemId);
      setItemDetails(details);
    } catch {
      setItemDetails(null);
    }

    toast.success('RARIDADE RESERVADA', {
      description: `Reserva garantida por ${reserveMinutes} minutos.`,
      style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
    });

    return next;
  }, [cartItem?.itemId, fetchItemDetails, persist, reserveMinutes, reserveMs]);

  useEffect(() => {
    const stored = loadFromStorage();
    if (!stored) return;
    setCartItem(stored);

    fetchItemDetails(stored.itemId)
      .then((d) => setItemDetails(d))
      .catch(() => setItemDetails(null));
  }, [fetchItemDetails, loadFromStorage]);

  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!cartItem?.itemId || !cartItem?.reservedUntilMs) return;
    if (releasingRef.current) return;
    const remaining = cartItem.reservedUntilMs - nowMs();
    if (remaining > 0) return;
    removeFromCart({ silent: true }).catch(() => void 0);
  }, [cartItem?.itemId, cartItem?.reservedUntilMs, removeFromCart, tick]);

  const remainingMs = cartItem?.reservedUntilMs ? Math.max(0, cartItem.reservedUntilMs - nowMs()) : 0;
  const remainingText = cartItem?.reservedUntilMs ? formatRemaining(remainingMs) : null;

  const value = useMemo(() => ({
    open,
    setOpen,
    cartItem,
    itemDetails,
    addToCart,
    removeFromCart,
    clearLocalCart,
    remainingMs,
    remainingText,
    reserveMinutes,
  }), [addToCart, cartItem, clearLocalCart, itemDetails, open, remainingMs, remainingText, removeFromCart, reserveMinutes]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
