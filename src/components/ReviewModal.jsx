import React, { useState } from 'react';
import { Star, X, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export default function ReviewModal({ 
  isOpen, 
  onClose, 
  transaction, 
  reviewedUser, 
  onReviewSubmitted 
}) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (rating === 0) {
      toast.error('Selecione uma nota', {
        description: 'Clique nas estrelas para avaliar',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }

    try {
      setSubmitting(true);

      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('reviews')
        .insert([{
          transaction_id: transaction.transaction_id || transaction.id,
          reviewer_id: user.id,
          reviewed_id: reviewedUser.id,
          rating: rating,
          comment: comment.trim() || null
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success('Avaliação enviada!', {
        description: 'Obrigado por contribuir com a comunidade',
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });

      // Atualizar stats (materializada view será atualizada pelo trigger)
      if (onReviewSubmitted) {
        onReviewSubmitted(data);
      }

      // Resetar e fechar
      setRating(0);
      setComment('');
      onClose();

    } catch (error) {
      if (error.code === '23505') {
        toast.error('Você já avaliou esta transação', {
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
      } else {
        toast.error('Erro ao enviar avaliação', {
          description: error.message,
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-[#D4AF37]/30 rounded-3xl max-w-lg w-full p-8 relative">
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-black uppercase tracking-tight mb-2">
            Avaliar <span className="text-[#D4AF37]">Colecionador</span>
          </h2>
          <p className="text-white/40 text-sm">
            Como foi sua experiência com {reviewedUser.full_name}?
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Rating Stars */}
          <div className="flex flex-col items-center gap-4 py-6 bg-white/5 rounded-2xl border border-white/10">
            <p className="text-white/60 text-xs uppercase font-bold tracking-widest">
              Nota
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    size={40}
                    className={`transition-colors ${
                      star <= (hoveredRating || rating)
                        ? 'fill-[#D4AF37] text-[#D4AF37]'
                        : 'text-white/20'
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-[#D4AF37] text-sm font-bold">
                {rating === 5 && '⭐ Excelente!'}
                {rating === 4 && '⭐ Muito bom!'}
                {rating === 3 && '⭐ Bom'}
                {rating === 2 && '⭐ Regular'}
                {rating === 1 && '⭐ Ruim'}
              </p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-xs text-white/60 uppercase font-bold tracking-widest mb-2">
              Comentário (Opcional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Compartilhe sua experiência com a comunidade..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm 
                         focus:border-[#D4AF37]/50 outline-none transition-all resize-none
                         placeholder:text-white/20"
            />
            <p className="text-white/30 text-xs mt-1 text-right">
              {comment.length}/500 caracteres
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white/5 border border-white/10 text-white/80 px-6 py-3 rounded-xl 
                         text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || rating === 0}
              className="flex-1 bg-[#D4AF37] text-black px-6 py-3 rounded-xl text-xs font-black 
                         uppercase tracking-widest hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] 
                         transition-all flex items-center justify-center gap-2 disabled:opacity-50 
                         disabled:cursor-not-allowed"
            >
              {submitting ? (
                'Enviando...'
              ) : (
                <>
                  <Send size={16} /> Enviar Avaliação
                </>
              )}
            </button>
          </div>
        </form>

        {/* Info Footer */}
        <p className="text-white/20 text-[10px] text-center mt-6 uppercase tracking-wider">
          Sua avaliação ajuda a construir uma comunidade confiável
        </p>
      </div>
    </div>
  );
}
