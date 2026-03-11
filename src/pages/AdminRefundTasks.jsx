import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { CheckCircle, Download, Loader2, Search, Shield, Trash2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const toastSuccessStyle = { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' };
const toastErrorStyle = { background: '#050505', border: '1px solid #ef4444', color: '#FFF' };

export default function AdminRefundTasks() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [transactionsMap, setTransactionsMap] = useState({});
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending_execution');
  const [busyId, setBusyId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [purging, setPurging] = useState(false);

  const statusOptions = [
    { value: 'pending_execution', label: 'Pendentes' },
    { value: 'executed', label: 'Executados' },
    { value: 'cancelled', label: 'Cancelados' },
    { value: 'all', label: 'Todos' },
  ];

  const load = async () => {
    setLoading(true);
    try {
      const { data: tasksData, error: tasksError } = await supabase
        .from('dispute_refund_tasks')
        .select('id, dispute_id, transaction_id, buyer_id, seller_id, status, requested_by, requested_at, executed_by, executed_at, execution_note, metadata, proof_file_path, proof_original_filename, proof_expires_at')
        .order('requested_at', { ascending: false })
        .limit(500);

      if (tasksError) throw tasksError;

      const ts = tasksData || [];
      const transactionIds = Array.from(new Set(ts.map((t) => t.transaction_id).filter(Boolean)));
      const userIds = Array.from(new Set(ts.flatMap((t) => [t.buyer_id, t.seller_id, t.requested_by, t.executed_by]).filter(Boolean)));

      const [{ data: txData }, { data: profilesData }] = await Promise.all([
        transactionIds.length > 0
          ? supabase
              .from('transactions')
              .select('id, status, total_amount, net_amount, buyer_id, seller_id, created_at, items(title)')
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
      setTasks(ts);
    } catch (error) {
      console.error('Erro ao carregar fila de reembolsos:', error);
      toast.error('ERRO AO CARREGAR', {
        description: error.message || 'Não foi possível carregar a fila.',
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
    return tasks.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (!q) return true;
      const tx = transactionsMap[t.transaction_id];
      const buyer = profilesMap[t.buyer_id];
      const seller = profilesMap[t.seller_id];
      const hay = [
        t.id,
        t.dispute_id,
        t.transaction_id,
        t.status,
        tx?.items?.title,
        buyer?.email,
        buyer?.full_name,
        seller?.email,
        seller?.full_name,
        t.execution_note,
        t.metadata ? JSON.stringify(t.metadata) : null,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [profilesMap, query, statusFilter, tasks, transactionsMap]);

  const markExecuted = async (task) => {
    const note = window.prompt('Notas (opcional):') || '';
    setBusyId(task.id);
    try {
      const { data, error } = await supabase.rpc('admin_mark_refund_executed', {
        p_dispute_id: task.dispute_id,
        p_note: note,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Falha ao marcar executado');

      toast.success('REEMBOLSO EXECUTADO', {
        description: data.message,
        style: toastSuccessStyle,
      });
      await load();
    } catch (error) {
      toast.error('ERRO', {
        description: error.message || 'Falha ao marcar executado.',
        style: toastErrorStyle,
      });
    } finally {
      setBusyId(null);
    }
  };

  const validateProofFile = (file) => {
    const validTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];
    if (!validTypes.includes(file.type)) {
      toast.error('FORMATO INVÁLIDO', {
        description: 'Use PDF, JPG, PNG, WebP ou GIF.',
        style: toastErrorStyle,
      });
      return false;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('ARQUIVO MUITO GRANDE', {
        description: 'Tamanho máximo permitido: 5MB.',
        style: toastErrorStyle,
      });
      return false;
    }

    return true;
  };

  const uploadProof = async (task, file) => {
    if (!file) return;
    if (!validateProofFile(file)) return;

    setUploadingId(task.id);
    try {
      const fileExt = (file.name.split('.').pop() || 'bin').toLowerCase();
      const timestamp = Date.now();
      const proofPath = `admin_archive/${task.id}/proof_${timestamp}.${fileExt}`;
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { error: uploadError } = await supabase.storage
        .from('refund_proofs')
        .upload(proofPath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        const bucketNotFound = /bucket not found/i.test(uploadError.message || '');
        throw new Error(bucketNotFound ? 'Bucket refund_proofs não encontrado. Rode as migrations do projeto.' : uploadError.message);
      }

      const { data: updatedRows, error: updateError } = await supabase
        .from('dispute_refund_tasks')
        .update({
          proof_file_path: proofPath,
          proof_original_filename: file.name,
          proof_expires_at: expiresAt,
        })
        .eq('id', task.id)
        .select('id');

      if (updateError) throw updateError;
      if (!updatedRows || updatedRows.length === 0) throw new Error('Falha ao vincular comprovante na tarefa.');

      toast.success('COMPROVANTE ENVIADO', {
        description: 'Arquivo arquivado por 30 dias.',
        style: toastSuccessStyle,
      });
      await load();
    } catch (error) {
      console.error('Erro ao enviar comprovante:', error);
      toast.error('ERRO NO UPLOAD', {
        description: error.message || 'Falha ao enviar comprovante.',
        style: toastErrorStyle,
      });
    } finally {
      setUploadingId(null);
    }
  };

  const downloadProof = async (task) => {
    if (!task?.proof_file_path || downloadingId) return;
    const expiresAt = task.proof_expires_at ? new Date(task.proof_expires_at) : null;
    const isExpired = expiresAt ? expiresAt.getTime() <= Date.now() : false;
    if (isExpired) return;

    setDownloadingId(task.id);
    try {
      const { data, error } = await supabase.storage
        .from('refund_proofs')
        .createSignedUrl(task.proof_file_path, 60);

      if (error) throw error;

      window.open(data?.signedUrl, '_blank', 'noopener,noreferrer');
      toast.success('COMPROVANTE ABERTO', { style: toastSuccessStyle });
    } catch (error) {
      console.error('Erro ao abrir comprovante:', error);
      toast.error('ERRO AO ABRIR', { description: error.message, style: toastErrorStyle });
    } finally {
      setDownloadingId(null);
    }
  };

  const purgeExpiredProofs = async () => {
    const expired = tasks.filter((t) => {
      if (!t.proof_file_path || !t.proof_expires_at) return false;
      return new Date(t.proof_expires_at).getTime() <= Date.now();
    });

    if (expired.length === 0) {
      toast.info('NENHUM COMPROVANTE EXPIRADO', { style: toastSuccessStyle });
      return;
    }

    setPurging(true);
    try {
      const paths = expired.map((t) => t.proof_file_path).filter(Boolean);
      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage.from('refund_proofs').remove(paths);
        if (storageError) throw storageError;
      }

      const expiredIds = expired.map((t) => t.id);
      const { error: updateError } = await supabase
        .from('dispute_refund_tasks')
        .update({
          proof_file_path: null,
          proof_original_filename: null,
          proof_expires_at: null,
        })
        .in('id', expiredIds);

      if (updateError) throw updateError;

      toast.success('EXPURGO CONCLUÍDO', {
        description: `${expired.length} comprovante(s) removido(s).`,
        style: toastSuccessStyle,
      });
      await load();
    } catch (error) {
      console.error('Erro ao expurgar comprovantes:', error);
      toast.error('ERRO NO EXPURGO', { description: error.message, style: toastErrorStyle });
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal-deep text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gold-premium/10 border border-gold-premium/30 rounded-full text-gold-premium text-xs font-semibold">
              <Shield size={12} /> Admin • Reembolsos
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase text-luxury">Fila de Reembolsos</h1>
            <p className="text-silver-premium/60 text-sm">Reembolsos aprovados aguardando execução humana.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin')}
              className="px-5 py-3 bg-black/40 border border-white/10 rounded-xl text-white/70 hover:text-white hover:border-white/20 transition"
            >
              Voltar
            </button>
            <button
              onClick={purgeExpiredProofs}
              disabled={purging}
              className="px-5 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 hover:bg-red-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {purging ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
              Expurgar expirados
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 bg-black/40 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por disputa, transação, usuário..."
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
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-black/40 border border-white/10 rounded-2xl p-10 text-center text-white/50">
            Nenhum reembolso encontrado.
          </div>
        ) : (
          <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white/5 text-white/60">
                  <tr>
                    <th className="text-left px-4 py-3">Disputa</th>
                    <th className="text-left px-4 py-3">Item</th>
                    <th className="text-left px-4 py-3">Comprador</th>
                    <th className="text-left px-4 py-3">Vendedor</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Solicitado</th>
                    <th className="text-left px-4 py-3">Comprovante</th>
                    <th className="text-left px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const tx = transactionsMap[t.transaction_id];
                    const buyer = profilesMap[t.buyer_id];
                    const seller = profilesMap[t.seller_id];
                    const isBusy = busyId === t.id;
                    const isUploading = uploadingId === t.id;
                    const isDownloading = downloadingId === t.id;
                    const expiresAt = t.proof_expires_at ? new Date(t.proof_expires_at) : null;
                    const isExpired = expiresAt ? expiresAt.getTime() <= Date.now() : false;
                    return (
                      <tr key={t.id} className="border-t border-white/5 hover:bg-white/5 transition">
                        <td className="px-4 py-3">
                          <div className="text-white/80 text-xs font-mono">{t.dispute_id?.slice(0, 8)}…</div>
                          <button
                            onClick={() => navigate(`/disputas/${t.dispute_id}`)}
                            className="text-xs text-[#D4AF37] hover:text-[#D4AF37]/80 font-bold mt-1"
                          >
                            Abrir
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-white font-bold">{tx?.items?.title || '—'}</div>
                          <div className="text-white/40 text-xs">TX: {t.transaction_id?.slice(0, 8)}…</div>
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
                          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border bg-yellow-500/10 border-yellow-500/30 text-yellow-300">
                            {t.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-white/80 text-xs">{new Date(t.requested_at).toLocaleString('pt-BR')}</div>
                          {t.execution_note ? <div className="text-white/40 text-xs mt-1">{t.execution_note}</div> : null}
                        </td>
                        <td className="px-4 py-3">
                          {t.proof_file_path ? (
                            <div>
                              <div className="text-white/70 text-xs">{t.proof_original_filename || 'comprovante'}</div>
                              {expiresAt ? (
                                <div className={`text-xs font-semibold mt-1 ${isExpired ? 'text-red-300' : 'text-blue-300'}`}>
                                  Expira em {expiresAt.toLocaleString('pt-BR')}
                                </div>
                              ) : (
                                <div className="text-white/40 text-xs mt-1">Expiração não definida</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-white/40 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {t.proof_file_path && !isExpired ? (
                              <button
                                type="button"
                                disabled={isDownloading}
                                onClick={() => downloadProof(t)}
                                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-black uppercase tracking-wider hover:border-white/20 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                Abrir
                              </button>
                            ) : null}

                            {t.status === 'pending_execution' ? (
                              <>
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
                                  className="hidden"
                                  id={`refund-proof-${t.id}`}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] || null;
                                    if (file) uploadProof(t, file);
                                    e.target.value = '';
                                  }}
                                />
                                <button
                                  type="button"
                                  disabled={isUploading || isBusy}
                                  onClick={() => document.getElementById(`refund-proof-${t.id}`)?.click()}
                                  className="px-3 py-2 bg-blue-500/10 border border-blue-500/30 text-blue-300 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-blue-500/20 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                  Anexar
                                </button>
                                <button
                                  disabled={isBusy || isUploading}
                                  onClick={() => markExecuted(t)}
                                  className="px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-yellow-500/20 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                  Marcar executado
                                </button>
                              </>
                            ) : (
                              <span className="text-white/40 text-xs">—</span>
                            )}
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
