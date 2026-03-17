import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Clock, Loader2, RefreshCw, Search, Shield, AlertTriangle, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const toastSuccessStyle = { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' };
const toastErrorStyle = { background: '#050505', border: '1px solid #ef4444', color: '#FFF' };

export default function AdminEscrowSla() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [deleting, setDeleting] = useState({});
  const [events, setEvents] = useState([]);
  const [transactionsMap, setTransactionsMap] = useState({});
  const [profilesMap, setProfilesMap] = useState({});
  const [disputesByTransaction, setDisputesByTransaction] = useState({});
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const typeOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'ship_overdue_2d', label: 'Envio atrasado (2d)' },
    { value: 'delivery_overdue_14d', label: 'Entrega atrasada (14d)' },
    { value: 'auto_dispute_30d', label: 'Auto-disputa (30d)' },
  ];

  const load = async () => {
    setLoading(true);
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('escrow_sla_events')
        .select('id, transaction_id, event_type, created_at, metadata')
        .order('created_at', { ascending: false })
        .limit(500);

      if (eventsError) throw eventsError;

      const ev = eventsData || [];
      const transactionIds = Array.from(new Set(ev.map((e) => e.transaction_id).filter(Boolean)));

      const [{ data: txData }, { data: disputesData }] = await Promise.all([
        transactionIds.length > 0
          ? supabase
              .from('transactions')
              .select('id, status, total_amount, net_amount, buyer_id, seller_id, created_at, shipped_at, delivered_at, items(title)')
              .in('id', transactionIds)
          : Promise.resolve({ data: [] }),
        transactionIds.length > 0
          ? supabase
              .from('disputes')
              .select('id, transaction_id, status, created_at')
              .in('transaction_id', transactionIds)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);

      const txMap = (txData || []).reduce((acc, t) => {
        acc[t.id] = t;
        return acc;
      }, {});

      const disputesMap = (disputesData || []).reduce((acc, d) => {
        if (!acc[d.transaction_id]) acc[d.transaction_id] = d;
        return acc;
      }, {});

      const userIds = Array.from(new Set((txData || []).flatMap((t) => [t.buyer_id, t.seller_id]).filter(Boolean)));
      const { data: profilesData } = userIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds)
        : { data: [] };

      const pMap = (profilesData || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      setEvents(ev);
      setTransactionsMap(txMap);
      setProfilesMap(pMap);
      setDisputesByTransaction(disputesMap);
    } catch (error) {
      console.error('Erro ao carregar SLA:', error);
      toast.error('ERRO AO CARREGAR', {
        description: error.message || 'Não foi possível carregar eventos.',
        style: toastErrorStyle,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.rpc('admin_run_escrow_sla');
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Falha ao executar SLA');
      toast.success('SLA EXECUTADO', {
        description: JSON.stringify(data.result),
        style: toastSuccessStyle,
      });
      await load();
    } catch (error) {
      toast.error('ERRO', {
        description: error.message || 'Falha ao executar SLA.',
        style: toastErrorStyle,
      });
    } finally {
      setRunning(false);
    }
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('Tem certeza que deseja excluir este evento SLA?')) return;
    
    setDeleting((prev) => ({ ...prev, [eventId]: true }));
    try {
      const { error } = await supabase
        .from('escrow_sla_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      toast.success('EVENTO EXCLUÍDO', {
        description: 'Evento SLA removido com sucesso.',
        style: toastSuccessStyle,
      });

      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (error) {
      toast.error('ERRO AO EXCLUIR', {
        description: error.message || 'Falha ao excluir evento.',
        style: toastErrorStyle,
      });
    } finally {
      setDeleting((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (typeFilter !== 'all' && e.event_type !== typeFilter) return false;
      if (!q) return true;
      const tx = transactionsMap[e.transaction_id];
      const buyer = profilesMap[tx?.buyer_id];
      const seller = profilesMap[tx?.seller_id];
      const hay = [
        e.event_type,
        e.transaction_id,
        tx?.status,
        tx?.items?.title,
        buyer?.email,
        buyer?.full_name,
        seller?.email,
        seller?.full_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [events, profilesMap, query, transactionsMap, typeFilter]);

  const badgeClass = (type) => {
    if (type === 'ship_overdue_2d') return 'bg-red-500/10 border-red-500/30 text-red-300';
    if (type === 'delivery_overdue_14d') return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300';
    if (type === 'auto_dispute_30d') return 'bg-blue-500/10 border-blue-500/30 text-blue-300';
    return 'bg-white/5 border-white/10 text-white/60';
  };

  return (
    <div className="min-h-screen bg-charcoal-deep text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gold-premium/10 border border-gold-premium/30 rounded-full text-gold-premium text-xs font-semibold">
              <Shield size={12} /> Admin • SLA Custódia
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase text-luxury">Timers de Escrow</h1>
            <p className="text-silver-premium/60 text-sm">Sinais automáticos de atraso e auto-disputa.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin')}
              className="px-5 py-3 bg-black/40 border border-white/10 rounded-xl text-white/70 hover:text-white hover:border-white/20 transition"
            >
              Voltar
            </button>
            <button
              onClick={runNow}
              disabled={running}
              className="px-5 py-3 bg-[#D4AF37] text-black font-black rounded-xl hover:bg-[#D4AF37]/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {running ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
              Rodar SLA agora
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 bg-black/40 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por transação, usuário, item..."
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/30"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none"
          >
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value} className="bg-[#050505]">
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="bg-black/40 border border-white/10 rounded-2xl p-10 text-center text-white/50">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-black/40 border border-white/10 rounded-2xl p-10 text-center text-white/50">
            Nenhum evento SLA encontrado.
          </div>
        ) : (
          <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white/5 text-white/60">
                  <tr>
                    <th className="text-left px-4 py-3">Evento</th>
                    <th className="text-left px-4 py-3">Transação</th>
                    <th className="text-left px-4 py-3">Comprador</th>
                    <th className="text-left px-4 py-3">Vendedor</th>
                    <th className="text-left px-4 py-3">Criado</th>
                    <th className="text-left px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => {
                    const tx = transactionsMap[e.transaction_id];
                    const buyer = profilesMap[tx?.buyer_id];
                    const seller = profilesMap[tx?.seller_id];
                    const disputeId = e?.metadata?.dispute_id || disputesByTransaction[e.transaction_id]?.id;
                    return (
                      <tr key={e.id} className="border-t border-white/5 hover:bg-white/5 transition">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${badgeClass(e.event_type)}`}>
                            <Clock className="w-4 h-4" />
                            {e.event_type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-white font-bold">{tx?.items?.title || '—'}</div>
                          <div className="text-white/40 text-xs">TX: {e.transaction_id?.slice(0, 8)}… • {tx?.status || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-white font-semibold text-sm">{buyer?.full_name || '—'}</div>
                          <div className="text-white/40 text-xs">{buyer?.email || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-white font-semibold text-sm">{seller?.full_name || '—'}</div>
                          <div className="text-white/40 text-xs">{seller?.email || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-white/80 text-xs">{new Date(e.created_at).toLocaleString('pt-BR')}</div>
                          {e.event_type === 'ship_overdue_2d' && (
                            <div className="text-white/40 text-xs flex items-center gap-2 mt-1">
                              <AlertTriangle className="w-4 h-4 text-yellow-300" />
                              Cobrar postagem do vendedor
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {disputeId ? (
                              <button
                                onClick={() => navigate(`/disputas/${disputeId}`)}
                                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-black uppercase tracking-wider hover:border-white/20 transition"
                              >
                                Abrir disputa
                              </button>
                            ) : null}
                            <button
                              onClick={() => handleDelete(e.id)}
                              disabled={deleting[e.id]}
                              className="px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-red-500/20 hover:border-red-400 transition disabled:opacity-50 flex items-center gap-2"
                            >
                              {deleting[e.id] ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
