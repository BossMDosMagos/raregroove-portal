import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, RefreshCw, Loader2, AlertTriangle, ArrowLeftRight, Truck, Search, CheckCircle2, Scale, Trash2, Pencil, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { maskEmail, maskName } from '../utils/sensitiveDataMask';
import { useI18n } from '../contexts/I18nContext.jsx';

const toastSuccessStyle = { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' };
const toastErrorStyle = { background: '#050505', border: '1px solid #ef4444', color: '#FFF' };

const FINAL_STATUSES = new Set(['concluida', 'concluido', 'cancelada', 'cancelado', 'sinistro_resolvido_venda_reversa']);

export default function AdminSwapsManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [swaps, setSwaps] = useState([]);
  const [routesMap, setRoutesMap] = useState({});
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busySwapId, setBusySwapId] = useState(null);
  const [incidentModalData, setIncidentModalData] = useState(null);
  const [incidentReason, setIncidentReason] = useState('');
  const [resolveModalData, setResolveModalData] = useState(null);
  const [faultUserId, setFaultUserId] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [editModalData, setEditModalData] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null);

  const { formatCurrency, formatDate: formatDateLocale } = useI18n();
  const formatMoney = (value) => formatCurrency(value, 'BRL');

  const formatDate = (value) => {
    if (!value) return '—';
    return formatDateLocale(value, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (status) => {
    const map = {
      proposta_criada: 'bg-white/10 border-white/30 text-white/70',
      aguardando_checkin: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
      checkin_parcial: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
      etiquetas_liberadas: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
      em_transito: 'bg-purple-500/20 border-purple-500/40 text-purple-300',
      aguardando_confirmacao_recebimento: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
      sinistro_aberto: 'bg-red-500/20 border-red-500/40 text-red-300',
      sinistro_em_analise: 'bg-red-600/20 border-red-600/40 text-red-200',
      sinistro_resolvido_venda_reversa: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
      concluida: 'bg-green-500/20 border-green-500/40 text-green-300',
      concluido: 'bg-green-500/20 border-green-500/40 text-green-300',
      cancelada: 'bg-zinc-500/20 border-zinc-500/40 text-zinc-300',
      cancelado: 'bg-zinc-500/20 border-zinc-500/40 text-zinc-300',

      aguardando_taxas: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
      autorizado_envio: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
      em_troca: 'bg-purple-500/20 border-purple-500/40 text-purple-300',
    };

    return map[status] || 'bg-white/10 border-white/30 text-white/70';
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: swapsData, error: swapsError }, { data: profilesData, error: profilesError }, { data: itemsData, error: itemsError }, { data: routesData, error: routesError }] = await Promise.all([
        supabase
          .from('swaps')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(300),
        supabase
          .from('profiles')
          .select('id, full_name, email'),
        supabase
          .from('items')
          .select('id, title, artist, price'),
        supabase
          .from('swap_status_routes')
          .select('*')
      ]);

      if (swapsError) throw swapsError;
      if (profilesError) throw profilesError;
      if (itemsError) throw itemsError;
      if (routesError) throw routesError;

      // Build lookup maps
      const profilesMap = (profilesData || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      const itemsMap = (itemsData || []).reduce((acc, i) => {
        acc[i.id] = i;
        return acc;
      }, {});

      const routesMap = (routesData || []).reduce((acc, row) => {
        acc[row.status] = row;
        return acc;
      }, {});

      // Enrich swaps data with user and item info
      const enrichedSwaps = (swapsData || []).map(swap => ({
        ...swap,
        user1: profilesMap[swap.user_1_id] || {},
        user2: profilesMap[swap.user_2_id] || {},
        item1: itemsMap[swap.item_1_id] || {},
        item2: itemsMap[swap.item_2_id] || {}
      }));

      setRoutesMap(routesMap);
      setSwaps(enrichedSwaps);
    } catch (error) {
      console.error('Erro ao carregar trocas no admin:', error);
      toast.error('ERRO AO CARREGAR TROCAS', {
        description: error.message,
        style: toastErrorStyle,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredSwaps = useMemo(() => {
    const term = query.trim().toLowerCase();

    return swaps.filter((swap) => {
      if (statusFilter !== 'all' && swap.status !== statusFilter) return false;
      if (!term) return true;

      const user1Name = swap.user1?.full_name || swap.user1?.email || '';
      const user2Name = swap.user2?.full_name || swap.user2?.email || '';
      const item1 = swap.item1?.title || '';
      const item2 = swap.item2?.title || '';

      return [
        swap.swap_id,
        swap.status,
        user1Name,
        user2Name,
        item1,
        item2,
      ].join(' ').toLowerCase().includes(term);
    });
  }, [swaps, query, statusFilter]);

  const summary = useMemo(() => {
    const active = swaps.filter((s) => !FINAL_STATUSES.has(s.status));
    const totalCustody = active.reduce((sum, row) => sum + Number(row.checkin_paid_amount_user_1 || 0) + Number(row.checkin_paid_amount_user_2 || 0), 0);

    return {
      total: swaps.length,
      active: active.length,
      incidents: swaps.filter((s) => ['sinistro_aberto', 'sinistro_em_analise'].includes(s.status)).length,
      custody: totalCustody,
    };
  }, [swaps]);

  const statusOptions = useMemo(() => {
    const set = new Set(swaps.map((s) => s.status).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [swaps]);

  const withBusy = async (swapId, action) => {
    setBusySwapId(swapId);
    try {
      await action();
      await fetchData();
    } finally {
      setBusySwapId(null);
    }
  };

  const handleMarkInTransit = async (swapId) => {
    await withBusy(swapId, async () => {
      const { data, error } = await supabase.rpc('swap_mark_in_transit', { p_swap_id: swapId });
      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : null;
      toast.success('STATUS ATUALIZADO', {
        description: result?.message || 'Troca marcada como em trânsito.',
        style: toastSuccessStyle,
      });
    });
  };

  const handleOpenIncidentAsAdmin = async () => {
    if (!incidentModalData) return;
    if (!incidentReason.trim()) {
      toast.error('MOTIVO OBRIGATÓRIO', { description: 'Informe o motivo do sinistro.', style: toastErrorStyle });
      return;
    }

    await withBusy(incidentModalData.swap_id, async () => {
      const { error } = await supabase
        .from('swaps')
        .update({
          status: 'sinistro_aberto',
          incident_opened_at: new Date().toISOString(),
          incident_reason: incidentReason.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('swap_id', incidentModalData.swap_id);

      if (error) throw error;

      toast.success('SINISTRO ABERTO', {
        description: 'Sinistro registrado pelo administrativo.',
        style: toastSuccessStyle,
      });

      setIncidentModalData(null);
      setIncidentReason('');
    });
  };

  const handleSetIncidentAnalysis = async (swapId) => {
    await withBusy(swapId, async () => {
      const { error } = await supabase
        .from('swaps')
        .update({ status: 'sinistro_em_analise', updated_at: new Date().toISOString() })
        .eq('swap_id', swapId);

      if (error) throw error;

      toast.success('EM ANÁLISE', {
        description: 'Sinistro movido para análise administrativa.',
        style: toastSuccessStyle,
      });
    });
  };

  const handleResolveReverseSale = async () => {
    if (!resolveModalData) return;
    if (!faultUserId) {
      toast.error('CULPADO OBRIGATÓRIO', {
        description: 'Selecione o usuário culpado para aplicar venda reversa.',
        style: toastErrorStyle,
      });
      return;
    }

    await withBusy(resolveModalData.swap_id, async () => {
      const { data, error } = await supabase.rpc('swap_resolve_incident_reverse_sale', {
        p_swap_id: resolveModalData.swap_id,
        p_fault_user_id: faultUserId,
        p_resolution_notes: resolutionNotes || null,
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : null;
      toast.success('SINISTRO RESOLVIDO', {
        description: result?.message || 'Venda reversa aplicada com sucesso.',
        style: toastSuccessStyle,
      });

      setResolveModalData(null);
      setFaultUserId('');
      setResolutionNotes('');
    });
  };

  const handleEditSwap = async () => {
    if (!editModalData) return;

    await withBusy(editModalData.swap_id, async () => {
      const updateData = {};
      
      if (editValues.checkin_amount_user_1 !== undefined) {
        updateData.checkin_amount_user_1 = Number(editValues.checkin_amount_user_1) || 0;
      }
      if (editValues.checkin_amount_user_2 !== undefined) {
        updateData.checkin_amount_user_2 = Number(editValues.checkin_amount_user_2) || 0;
      }
      if (editValues.insurance_required !== undefined) {
        updateData.insurance_required = editValues.insurance_required;
      }

      updateData.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('swaps')
        .update(updateData)
        .eq('swap_id', editModalData.swap_id);

      if (error) throw error;

      toast.success('TROCA ATUALIZADA', {
        description: 'Dados da troca alterados com sucesso.',
        style: toastSuccessStyle,
      });

      setEditModalData(null);
      setEditValues({});
    });
  };

  const handleDeleteSwap = async () => {
    if (!deleteConfirmModal) return;

    try {
      await withBusy(deleteConfirmModal.swap_id, async () => {
        const { data: deletedRows, error } = await supabase
          .from('swaps')
          .delete()
          .eq('swap_id', deleteConfirmModal.swap_id)
          .select('swap_id');

        if (error) throw error;

        if (!deletedRows || deletedRows.length === 0) {
          throw new Error('Nenhuma troca foi removida. Verifique a política RLS de DELETE para administradores na tabela swaps.');
        }

        toast.success('TROCA DELETADA', {
          description: 'Troca removida do sistema.',
          style: toastSuccessStyle,
        });

        setDeleteConfirmModal(null);
      });
    } catch (error) {
      console.error('Erro ao deletar troca no admin:', error);
      toast.error('DELETE NÃO EFETIVADO', {
        description: error.message || 'Não foi possível deletar a troca.',
        style: toastErrorStyle,
      });
    }
  };

  const openEditModal = (swap) => {
    setEditModalData(swap);
    setEditValues({
      checkin_amount_user_1: swap.checkin_amount_user_1 || 0,
      checkin_amount_user_2: swap.checkin_amount_user_2 || 0,
      insurance_required: swap.insurance_required || false,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4 md:px-6 pt-20">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-bold uppercase tracking-widest">
              <ArrowLeftRight className="w-4 h-4" /> Gerenciamento de Trocas
            </div>
            <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter mt-4 uppercase">
              Permutas <span className="text-[#D4AF37]">Custodiadas</span>
            </h1>
            <p className="text-white/40 text-sm mt-2">Controle administrativo completo das transações de troca</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin')}
              className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest border border-white/20 text-white/80 hover:border-[#D4AF37]/60 hover:text-[#D4AF37]"
            >
              Voltar Admin
            </button>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-[#D4AF37]/10 border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/20"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/admin"
            className="flex items-center justify-center gap-2 bg-black/60 text-[#D4AF37] border border-[#D4AF37]/30 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:border-[#D4AF37]/80 hover:bg-[#D4AF37]/10 transition-all"
          >
            <Shield size={14} /> Cofre Central
          </Link>
          <Link
            to="/swaps"
            className="flex items-center justify-center gap-2 bg-black/60 text-purple-400 border border-purple-400/30 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:border-purple-400/80 hover:bg-purple-400/10 transition-all"
          >
            <RefreshCw size={14} /> Simulador
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Total de Trocas" value={summary.total} icon={<ArrowLeftRight className="w-5 h-5" />} />
          <StatCard label="Em Andamento" value={summary.active} icon={<Truck className="w-5 h-5" />} />
          <StatCard label="Sinistros" value={summary.incidents} icon={<AlertTriangle className="w-5 h-5" />} />
          <StatCard label="Custódia Atual" value={formatMoney(summary.custody)} icon={<Scale className="w-5 h-5" />} />
        </div>

        <div className="bg-[#050505] border border-[#D4AF37]/20 rounded-2xl p-4 md:p-6 space-y-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por swap, usuário, item ou status..."
                className="w-full bg-black/60 border border-white/10 rounded-lg pl-10 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37]/50"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4AF37]/50"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === 'all' ? 'Todos os status' : status}
                </option>
              ))}
            </select>
          </div>

          {filteredSwaps.length === 0 ? (
            <div className="text-center py-10 text-white/40">Nenhuma troca encontrada para os filtros atuais.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-white/50 border-b border-white/10">
                  <tr>
                    <th className="py-3 pr-3">Swap</th>
                    <th className="py-3 pr-3">Participantes</th>
                    <th className="py-3 pr-3">Itens</th>
                    <th className="py-3 pr-3">Status</th>
                    <th className="py-3 pr-3">Check-in</th>
                    <th className="py-3 pr-3">Custódia</th>
                    <th className="py-3 pr-3">Rota</th>
                    <th className="py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSwaps.map((swap) => {
                    const user1Name = swap.user1?.full_name || swap.user1?.email || swap.user_1_id;
                    const user2Name = swap.user2?.full_name || swap.user2?.email || swap.user_2_id;
                    const custody = Number(swap.checkin_paid_amount_user_1 || 0) + Number(swap.checkin_paid_amount_user_2 || 0);
                    const route = routesMap[swap.status];
                    const isBusy = busySwapId === swap.swap_id;

                    return (
                      <tr key={swap.swap_id} className="border-b border-white/5 align-top hover:bg-white/5">
                        <td className="py-3 pr-3">
                          <p className="text-[#D4AF37] font-bold">#{String(swap.swap_id).slice(0, 8)}</p>
                          <p className="text-[11px] text-white/40">{formatDate(swap.updated_at || swap.created_at)}</p>
                        </td>
                        <td className="py-3 pr-3">
                          <p className="text-white/80 text-xs font-semibold">A: {maskName(user1Name, true)}</p>
                          <p className="text-white/80 text-xs font-semibold mt-1">B: {maskName(user2Name, true)}</p>
                          <p className="text-[11px] text-white/40 mt-1">{maskEmail(swap.user1?.email, true)} • {maskEmail(swap.user2?.email, true)}</p>
                        </td>
                        <td className="py-3 pr-3">
                          <p className="text-white/80 text-xs">A: {swap.item1?.title || swap.item_1_id}</p>
                          <p className="text-white/80 text-xs mt-1">B: {swap.item2?.title || swap.item_2_id}</p>
                        </td>
                        <td className="py-3 pr-3">
                          <span className={`inline-flex px-2 py-1 rounded-full border text-[11px] font-bold uppercase ${getStatusBadge(swap.status)}`}>
                            {swap.status}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-xs text-white/70">
                          <p>A: {swap.guarantee_fee_1_paid ? 'Pago' : 'Pendente'} ({formatMoney(swap.checkin_amount_user_1)})</p>
                          <p className="mt-1">B: {swap.guarantee_fee_2_paid ? 'Pago' : 'Pendente'} ({formatMoney(swap.checkin_amount_user_2)})</p>
                          <p className="mt-1 text-white/40">Seguro: {swap.insurance_required ? 'Obrigatório' : 'Legado'} | {swap.insurance_user_1_accepted && swap.insurance_user_2_accepted ? 'Aceito' : 'Pendente'}</p>
                        </td>
                        <td className="py-3 pr-3 text-[#D4AF37] font-bold">{formatMoney(custody)}</td>
                        <td className="py-3 pr-3 text-[11px] text-white/60 max-w-[220px]">
                          {route?.descricao || '—'}
                        </td>
                        <td className="py-3">
                          <div className="flex flex-col gap-2 min-w-[190px]">
                            {(swap.status === 'etiquetas_liberadas' || swap.status === 'autorizado_envio') && (
                              <button
                                disabled={isBusy}
                                onClick={() => handleMarkInTransit(swap.swap_id)}
                                className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[11px] font-bold uppercase hover:bg-blue-500/30 disabled:opacity-50"
                              >
                                {isBusy ? 'Processando...' : 'Marcar Em Trânsito'}
                              </button>
                            )}

                            {(swap.status === 'em_transito' || swap.status === 'aguardando_confirmacao_recebimento') && (
                              <button
                                disabled={isBusy}
                                onClick={() => {
                                  setIncidentModalData(swap);
                                  setIncidentReason(swap.incident_reason || '');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-[11px] font-bold uppercase hover:bg-red-500/30 disabled:opacity-50"
                              >
                                Abrir Sinistro
                              </button>
                            )}

                            {swap.status === 'sinistro_aberto' && (
                              <button
                                disabled={isBusy}
                                onClick={() => handleSetIncidentAnalysis(swap.swap_id)}
                                className="px-3 py-1.5 rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-300 text-[11px] font-bold uppercase hover:bg-orange-500/30 disabled:opacity-50"
                              >
                                Mover para Análise
                              </button>
                            )}

                            {(swap.status === 'sinistro_aberto' || swap.status === 'sinistro_em_analise') && (
                              <button
                                disabled={isBusy}
                                onClick={() => {
                                  setResolveModalData(swap);
                                  setFaultUserId(swap.incident_fault_user_id || '');
                                  setResolutionNotes(swap.incident_resolution_notes || '');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-bold uppercase hover:bg-amber-500/30 disabled:opacity-50"
                              >
                                Resolver Venda Reversa
                              </button>
                            )}

                            <div className="flex gap-2 mt-2 pt-2 border-t border-white/10">
                              <button
                                disabled={isBusy}
                                onClick={() => openEditModal(swap)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[11px] font-bold uppercase hover:bg-blue-500/30 disabled:opacity-50"
                                title="Editar dados"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Editar
                              </button>
                              <button
                                disabled={isBusy}
                                onClick={() => setDeleteConfirmModal(swap)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600/20 border border-red-600/40 text-red-300 text-[11px] font-bold uppercase hover:bg-red-600/30 disabled:opacity-50"
                                title="Deletar troca"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Deletar
                              </button>
                            </div>

                            {FINAL_STATUSES.has(swap.status) && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-green-300 font-semibold mt-2">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Encerrada
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {incidentModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg bg-[#050505] border border-[#D4AF37]/30 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-black text-white uppercase">Abrir Sinistro</h3>
            <p className="text-white/60 text-sm">Swap #{String(incidentModalData.swap_id).slice(0, 8)} será enviado para trilha de sinistro.</p>
            <textarea
              value={incidentReason}
              onChange={(e) => setIncidentReason(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-[#D4AF37]/50"
              rows={4}
              placeholder="Descreva o extravio/avaria e contexto da ocorrência"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIncidentModalData(null);
                  setIncidentReason('');
                }}
                className="px-4 py-2 text-xs font-black uppercase rounded-lg border border-white/20 text-white/70"
              >
                Cancelar
              </button>
              <button
                onClick={handleOpenIncidentAsAdmin}
                className="px-4 py-2 text-xs font-black uppercase rounded-lg bg-red-500/20 border border-red-500/40 text-red-300"
              >
                Confirmar Sinistro
              </button>
            </div>
          </div>
        </div>
      )}

      {resolveModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg bg-[#050505] border border-[#D4AF37]/30 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-black text-white uppercase">Resolver Sinistro</h3>
            <p className="text-white/60 text-sm">Aplicar venda reversa no swap #{String(resolveModalData.swap_id).slice(0, 8)}.</p>

            <div>
              <label className="text-xs text-white/60 uppercase font-bold">Usuário Culpado</label>
              <select
                value={faultUserId}
                onChange={(e) => setFaultUserId(e.target.value)}
                className="mt-1 w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4AF37]/50"
              >
                <option value="">Selecione...</option>
                <option value={resolveModalData.user_1_id}>Usuário A - {maskName(resolveModalData.user1?.full_name || resolveModalData.user1?.email || resolveModalData.user_1_id, true)}</option>
                <option value={resolveModalData.user_2_id}>Usuário B - {maskName(resolveModalData.user2?.full_name || resolveModalData.user2?.email || resolveModalData.user_2_id, true)}</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-white/60 uppercase font-bold">Notas da Resolução</label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="mt-1 w-full bg-black/60 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-[#D4AF37]/50"
                rows={4}
                placeholder="Detalhes da decisão administrativa"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setResolveModalData(null);
                  setFaultUserId('');
                  setResolutionNotes('');
                }}
                className="px-4 py-2 text-xs font-black uppercase rounded-lg border border-white/20 text-white/70"
              >
                Cancelar
              </button>
              <button
                onClick={handleResolveReverseSale}
                className="px-4 py-2 text-xs font-black uppercase rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300"
              >
                Confirmar Venda Reversa
              </button>
            </div>
          </div>
        </div>
      )}

      {editModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg bg-[#050505] border border-[#D4AF37]/30 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-black text-white uppercase">Editar Troca</h3>
            </div>
            <p className="text-white/60 text-sm">#{String(editModalData.swap_id).slice(0, 8)} - Atualize dados operacionais</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/60 uppercase font-bold">Valor Check-in Usuário A (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editValues.checkin_amount_user_1 || 0}
                  onChange={(e) => setEditValues({ ...editValues, checkin_amount_user_1: e.target.value })}
                  className="mt-1 w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4AF37]/50"
                />
              </div>

              <div>
                <label className="text-xs text-white/60 uppercase font-bold">Valor Check-in Usuário B (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editValues.checkin_amount_user_2 || 0}
                  onChange={(e) => setEditValues({ ...editValues, checkin_amount_user_2: e.target.value })}
                  className="mt-1 w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4AF37]/50"
                />
              </div>

              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg p-3">
                <input
                  type="checkbox"
                  checked={editValues.insurance_required || false}
                  onChange={(e) => setEditValues({ ...editValues, insurance_required: e.target.checked })}
                  id="insurance-required"
                  className="w-4 h-4"
                />
                <label htmlFor="insurance-required" className="text-xs text-white/80 font-semibold cursor-pointer">
                  Seguro de Frete Obrigatório
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditModalData(null);
                  setEditValues({});
                }}
                className="px-4 py-2 text-xs font-black uppercase rounded-lg border border-white/20 text-white/70"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditSwap}
                className="px-4 py-2 text-xs font-black uppercase rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg bg-[#050505] border border-red-500/30 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="text-lg font-black text-white uppercase">Deletar Troca</h3>
            </div>
            
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-white font-semibold">#{String(deleteConfirmModal.swap_id).slice(0, 8)}</p>
              <p className="text-white/70 text-sm mt-2">
                <strong>Usuário A:</strong> {deleteConfirmModal.user1?.full_name || deleteConfirmModal.user1?.email}
              </p>
              <p className="text-white/70 text-sm">
                <strong>Usuário B:</strong> {deleteConfirmModal.user2?.full_name || deleteConfirmModal.user2?.email}
              </p>
              <p className="text-white/70 text-sm mt-2">
                <strong>Status:</strong> {deleteConfirmModal.status}
              </p>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-yellow-200 text-xs font-semibold uppercase">⚠️ Ação Irreversível</p>
              <p className="text-yellow-100/80 text-xs mt-2">
                Esta ação irá deletar permanentemente a troca e todos seus registros associados. Todos os dados de transações serão perdidos.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmModal(null)}
                className="px-4 py-2 text-xs font-black uppercase rounded-lg border border-white/20 text-white/70"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteSwap}
                className="px-4 py-2 text-xs font-black uppercase rounded-lg bg-red-600/30 border border-red-600/40 text-red-300 hover:bg-red-600/40"
              >
                Confirmar Deleção
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="bg-[#050505] border border-[#D4AF37]/20 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[3px] text-white/40">{label}</p>
          <p className="text-2xl font-black text-[#D4AF37] mt-2">{value}</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37]">
          {icon}
        </div>
      </div>
    </div>
  );
}
