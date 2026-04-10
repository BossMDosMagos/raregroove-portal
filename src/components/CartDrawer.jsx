import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ShoppingCart, Timer, Trash2, Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext.jsx';

export default function CartDrawer() {
  const navigate = useNavigate();
  const { open, setOpen, cartItems, itemsDetails, removeFromCart, remainingText, totalPrice } = useCart();

  const totalText = useMemo(() => totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), [totalPrice]);
  const MotionDiv = motion.div;
  const MotionAside = motion.aside;

  const close = () => setOpen(false);

  return (
    <AnimatePresence>
      {open && (
        <>
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm"
            onClick={close}
          />

          <MotionAside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="fixed right-0 top-0 h-full w-full max-w-md z-[100] bg-[#050505] border-l border-[#D4AF37]/20 shadow-2xl flex flex-col"
          >
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.35em] text-white/40 font-black">Carrinho de Elite</p>
                  <p className="text-sm font-black text-white uppercase tracking-wider">Reserva Exclusiva</p>
                </div>
              </div>
              <button
                onClick={close}
                className="p-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-colors"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 flex-1 overflow-auto">
              {cartItems.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {cartItems.map((cartItem) => {
                      const itemDetails = itemsDetails[cartItem.itemId];
                      if (!itemDetails) return null;
                      const price = Number(itemDetails?.price || 0);
                      
                      return (
                        <div key={cartItem.itemId} className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-4 flex items-start gap-4">
                          <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex-shrink-0">
                            {itemDetails?.image_url ? (
                              <img src={itemDetails.image_url} alt={itemDetails.title || 'Item'} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/20">
                                <Sparkles className="w-6 h-6" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-white font-black uppercase tracking-wider text-sm truncate">
                              {itemDetails?.title || 'Raridade'}
                            </p>
                            <p className="text-white/50 text-xs truncate">
                              {itemDetails?.artist || '—'}
                            </p>
                            <p className="mt-2 text-[#D4AF37] font-black">
                              {price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>

                          <button
                            onClick={() => removeFromCart(cartItem.itemId)}
                            className="p-2 rounded-xl hover:bg-red-500/10 text-red-400 border border-red-500/20 hover:border-red-500/40 transition-colors"
                            aria-label="Remover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {remainingText && (
                    <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Timer className="w-4 h-4 text-orange-300" />
                        <p className="text-orange-200 text-[10px] font-black uppercase tracking-[0.25em]">
                          Reserva garantida por:
                        </p>
                      </div>
                      <p className="text-orange-200 font-black text-sm tabular-nums">
                        {remainingText}
                      </p>
                    </div>
                  )}

                  <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-white/50 text-[10px] uppercase tracking-[0.35em] font-black">Total ({cartItems.length} itens)</p>
                      <p className="text-white font-black">{totalText}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30">
                      <ShoppingCart className="w-8 h-8" />
                    </div>
                    <p className="text-white/70 font-black uppercase tracking-wider">Seu carrinho está vazio</p>
                    <p className="text-white/40 text-xs uppercase tracking-widest">Escolha raridades para reservar</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-white/5 space-y-3">
              <button
                disabled={cartItems.length === 0}
                onClick={() => {
                  if (cartItems.length === 0) return;
                  navigate(`/checkout`);
                }}
                className="group relative overflow-hidden w-full py-4 rounded-2xl font-black uppercase tracking-[0.25em] text-[11px] transition-all duration-500 disabled:opacity-40 disabled:cursor-not-allowed bg-[#D4AF37] text-black shadow-[0_0_30px_rgba(212,175,55,0.25)] hover:shadow-[0_0_50px_rgba(212,175,55,0.45)]"
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  <Sparkles className="w-4 h-4" />
                  Finalizar Compra ({cartItems.length})
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute -left-1/2 top-0 h-full w-1/2 bg-white/30 blur-xl rotate-12 translate-x-0 group-hover:translate-x-[220%] transition-transform duration-700" />
                </div>
              </button>

              <button
                onClick={close}
                className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.25em] text-[11px] bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                Continuar Explorando
              </button>
            </div>
          </MotionAside>
        </>
      )}
    </AnimatePresence>
  );
}
