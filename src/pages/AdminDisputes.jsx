import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle, Clock, ExternalLink, Loader2, Scale, Search, Shield, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const toastSuccessStyle = { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' };
const toastErrorStyle = { background: '#050505', border: '1px solid #ef4444', color: '#FFF' };

export default function AdminDisputes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [disputes, setDisputes] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [transactionsMap, setTransactionsMap] = useState({});
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);

  const statusOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'open', label: 'Aberta' },
    { value: 'awaiting_seller', label: 'Aguardando Vendedor' },
    { value: 'awaiting_buyer', label: 'Aguardando Comprador' },
    { value: 'under_review', label: 'Em Análise' },
    { value: 'resolved_release', label: 'Resolvida (Liberação)' },
    { value: 'resolved_refund', label: 'Resolvida (Reembolso)' },
    { value: 'rejected', label: 'Rejeitada' },
    { value: 'cancelled', label: 'Cancelada' },
  ];

  const statusBadge = (status) => {
    const map = {
      open: 'bg-red-500/10 border-red-500/30 text-red-300',
      awaiting_seller: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
      awaiting_buyer: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
      under_review: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
      resolved_release: 'bg-green-500/10 border-green-500/30 text-green-300',
      resolved_refund: 'bg-green-500/10 border-green-500/30 text-green-300',
      rejected: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-300',
      cancelled: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-300',
    };
    return map[status] || 'bg-white/10 border-white/20 text-white/60';
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data: disputesData, error: disputesError } = await supabase
        .from('disputes')
        .select('id, transaction_id, opened_by, buyer_id, seller_id, status, reason, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (disputesError) throw disputesError;

      const ds = disputesData || [];

      const transactionIds = Array.from(new Set(ds.map((d) => d.transaction_id).filter(Boolean)));
      const userIds = Array.from(new Set(ds.flatMap((d) => [d.opened_by, d.buyer_id, d.seller_id]).filter(Boolean)));

      const [{ data: txData }, { data: profilesData }] = await Promise.all([
        transactionIds.length > 0
          ? supabase
              .from('transactions')
              .select('id, status, total_amount, net_amount, tracking_code, created_at, buyer_id, seller_id, items(title)')
              .in('id', transactionIds)
          : Promise.resolve({ data: [] }),
        userIds.length > 0
          ? supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', userIds)
          : Promise.resolve({ data: [] }),
      ]);

      const nextTxMap = (txData || []).reduce((acc, t) => {
        acc[t.id] = t;
        return acc;
      }, {});

      const nextProfilesMap = (profilesData || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      setTransactionsMap(nextTxMap);
      setProfilesMap(nextProfilesMap);
      setDisputes(ds);
    } catch (error) {
      console.error('Erro ao carregar disputas:', error);
      toast.error('ERRO AO CARREGAR', {
        description: error.message || 'Não foi possível carregar disputas.',
        style: toastErrorStyle,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return disputes.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (!q) return true;
      const tx = transactionsMap[d.transaction_id];
      const buyer = profilesMap[d.buyer_id];
      const seller = profilesMap[d.seller_id];
      const openedBy = profilesMap[d.opened_by];
      const hay = [
        d.id,
        d.transaction_id,
        d.reason,
        d.status,
        tx?.items?.title,
        tx?.tracking_code,
        buyer?.email,
        buyer?.full_name,
        seller?.email,
        seller?.full_name,
        openedBy?.email,
        openedBy?.full_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [disputes, profilesMap, query, statusFilter, transactionsMap]);

  const setStatus = async (disputeId, status) => {
    setBusyId(disputeId);
    try {
      const { data, error } = await supabase.rpc('admin_set_dispute_status', {
        p_dispute_id: disputeId,
        p_status: status,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Falha ao atualizar status');
      toast.success('STATUS ATUALIZADO', { style: toastSuccessStyle });
      await load();
    } catch (error) {
      toast.error('ERRO', {
        description: error.message || 'Falha ao atualizar status.',
        style: toastErrorStyle,
      });
    } finally {
      setBusyId(null);
    }
  };

  const resolve = async (disputeId, resolution) => {
    const note = window.prompt('Notas (opcional):') || '';
    setBusyId(disputeId);
    try {
      const { data, error } = await supabase.rpc('admin_resolve_dispute', {
        p_dispute_id: disputeId,
        p_resolution: resolution,
        p_note: note,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Falha ao resolver disputa');
      toast.success('DISPUTA RESOLVIDA', { description: data.message, style: toastSuccessStyle });
      await load();
    } catch (error) {
      toast.error('ERRO', {
        description: error.message || 'Falha ao resolver disputa.',
        style: toastErrorStyle,
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal-deep text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gold-premium/10 border border-gold-premium/30 rounded-full text-gold-premium text-xs font-semibold">
              <Shield size={12} /> Admin • Disputas
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase text-luxury">Gestor de Disputas</h1>
            <p className="text-silver-premium/60 text-sm">Triagem, análise e resolução (reembolso/liberação).</p>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="px-5 py-3 bg-black/40 border border-white/10 rounded-xl text-white/70 hover:text-white hover:border-white/20 transition"
          >
            Voltar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 bg-black/40 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por id, transação, email, título, rastreio..."
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/30"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none"
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value} className="bg-[#050505]">
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="bg-black/40 border border-white/10 rounded-2xl p-10 text-center text-white/50">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
            Carregando disputas...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-black/40 border border-white/10 rounded-2xl p-10 text-center text-white/50">
            Nenhuma disputa encontrada.
          </div>
        ) : (
          <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white/5 text-white/60">
                  <tr>
                    <th className="text-left px-4 py-3">Disputa</th>
                    <th className="text-left px-4 py-3">Transação</th>
                    <th className="text-left px-4 py-3">Comprador</th>
                    <th className="text-left px-4 py-3">Vendedor</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const tx = transactionsMap[d.transaction_id];
                    const buyer = profilesMap[d.buyer_id];
                    const seller = profilesMap[d.seller_id];
                    const isBusy = busyId === d.id;
                    return (
                      <tr key={d.id} className="border-t border-white/5 hover:bg-white/5 transition">
                        <td className="px-4 py-3">
                          <div className="text-white font-bold">{d.id.slice(0, 8)}…</div>
                          <div className="text-white/40 text-xs">{new Date(d.created_at).toLocaleString('pt-BR')}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-white/80 text-xs">TX: {d.transaction_id?.slice(0, 8)}…</div>
                          <div className="text-white font-semibold text-sm">{tx?.items?.title || '—'}</div>
                          <div className="text-white/40 text-xs">Status TX: {tx?.status || '—'}</div>
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
                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${statusBadge(d.status)}`}>
                            {d.status === 'open' ? <AlertCircle className="w-4 h-4" /> : null}
                            {['awaiting_seller', 'awaiting_buyer', 'under_review'].includes(d.status) ? <Clock className="w-4 h-4" /> : null}
                            {['resolved_release', 'resolved_refund'].includes(d.status) ? <CheckCircle className="w-4 h-4" /> : null}
                            {['rejected', 'cancelled'].includes(d.status) ? <XCircle className="w-4 h-4" /> : null}
                            {d.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => navigate(`/disputas/${d.id}`)}
                              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-black uppercase tracking-wider hover:border-white/20 transition flex items-center gap-2"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Abrir
                            </button>

                            <select
                              disabled={isBusy}
                              value={d.status}
                              onChange={(e) => setStatus(d.id, e.target.value)}
                              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white outline-none"
                            >
                              {statusOptions
                                .filter((o) => o.value !== 'all')
                                .map((o) => (
                                  <option key={o.value} value={o.value} className="bg-[#050505]">
                                    {o.label}
                                  </option>
                                ))}
                            </select>

                            <button
                              disabled={isBusy}
                              onClick={() => resolve(d.id, 'release')}
                              className="px-3 py-2 bg-green-500/10 border border-green-500/30 text-green-300 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-green-500/20 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
                              Liberar
                            </button>

                            <button
                              disabled={isBusy}
                              onClick={() => resolve(d.id, 'refund')}
                              className="px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-red-500/20 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                              Reembolsar
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

