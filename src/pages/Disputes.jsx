import React, { useEffect, useState } from 'react';
import { AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Disputes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [disputes, setDisputes] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        if (!cancelled) setDisputes([]);
        if (!cancelled) setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('disputes')
        .select('id, transaction_id, status, reason, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (!cancelled) {
        setDisputes(error ? [] : (data || []));
        setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const statusConfig = {
    open: { label: 'Aberta', icon: AlertCircle, className: 'bg-red-500/10 border-red-500/30 text-red-300' },
    awaiting_seller: { label: 'Aguardando Vendedor', icon: Clock, className: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' },
    awaiting_buyer: { label: 'Aguardando Comprador', icon: Clock, className: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' },
    under_review: { label: 'Em Análise', icon: Clock, className: 'bg-blue-500/10 border-blue-500/30 text-blue-300' },
    resolved_refund_pending: { label: 'Reembolso (Pendente)', icon: Clock, className: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' },
    resolved_refund: { label: 'Resolvida (Reembolso)', icon: CheckCircle, className: 'bg-green-500/10 border-green-500/30 text-green-300' },
    resolved_release: { label: 'Resolvida (Liberação)', icon: CheckCircle, className: 'bg-green-500/10 border-green-500/30 text-green-300' },
    rejected: { label: 'Rejeitada', icon: XCircle, className: 'bg-[#C0C0C0]/10 border-[#C0C0C0]/30 text-[#C0C0C0]' },
    cancelled: { label: 'Cancelada', icon: XCircle, className: 'bg-[#C0C0C0]/10 border-[#C0C0C0]/30 text-[#C0C0C0]' },
  };

  return (
    <div className="min-h-screen bg-charcoal-deep text-white">
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase text-luxury">Disputas</h1>
          <p className="text-silver-premium/60 text-sm mt-1">Abra e acompanhe disputas relacionadas às suas compras e vendas.</p>
        </div>

        {loading ? (
          <div className="text-white/50">Carregando...</div>
        ) : disputes.length === 0 ? (
          <div className="bg-black/40 border border-white/10 rounded-2xl p-10 text-center text-white/50">
            Nenhuma disputa encontrada.
          </div>
        ) : (
          <div className="space-y-3">
            {disputes.map((d) => {
              const cfg = statusConfig[d.status] || statusConfig.open;
              const Icon = cfg.icon;
              return (
                <button
                  key={d.id}
                  onClick={() => navigate(`/disputas/${d.id}`)}
                  className="w-full text-left bg-black/40 border border-white/10 rounded-2xl p-5 flex items-start justify-between gap-4 hover:border-white/20 transition"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${cfg.className}`}>
                        <Icon className="w-4 h-4" />
                        {cfg.label}
                      </span>
                      <span className="text-white/40 text-xs truncate">
                        TX: {d.transaction_id}
                      </span>
                    </div>
                    {d.reason && (
                      <div className="text-white/80 text-sm break-words">{d.reason}</div>
                    )}
                    <div className="text-white/40 text-xs mt-2">
                      Aberta em {new Date(d.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
