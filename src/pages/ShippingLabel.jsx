import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ShippingLabelCard from '../components/ShippingLabelCard';

function ShippingLabelPage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    getUser();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  if (!transactionId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-xl mb-4 text-red-400">Transação não encontrada</p>
          <button 
            onClick={() => navigate('/profile')}
            className="bg-[#D4AF37] text-black px-6 py-2 rounded-lg font-bold"
          >
            Voltar ao Perfil
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-xl mb-4">Você precisa estar logado</p>
          <button 
            onClick={() => navigate('/login')}
            className="bg-[#D4AF37] text-black px-6 py-2 rounded-lg font-bold"
          >
            Fazer Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-zinc-900">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">
            Gerar Etiqueta de Envio
          </h1>
          <button 
            onClick={() => navigate(-1)}
            className="p-2 text-white/60 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="bg-zinc-900/50 rounded-2xl p-6 border border-[#D4AF37]/20">
            <ShippingLabelCard transactionId={transactionId} />
        </div>
      </div>
    </div>
  );
}

export default ShippingLabelPage;