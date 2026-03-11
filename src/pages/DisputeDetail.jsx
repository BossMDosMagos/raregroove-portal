import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { uploadDisputeEvidence } from '../utils/disputeService';
import { AlertCircle, ArrowLeft, Clock, FileText, Loader2, Send } from 'lucide-react';

export default function DisputeDetail() {
  const navigate = useNavigate();
  const { disputeId } = useParams();
  const [loading, setLoading] = useState(true);
  const [dispute, setDispute] = useState(null);
  const [messages, setMessages] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState({});

  const statusConfig = useMemo(() => ({
    open: { label: 'Aberta', className: 'bg-red-500/10 border-red-500/30 text-red-300', icon: AlertCircle },
    awaiting_seller: { label: 'Aguardando Vendedor', className: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300', icon: Clock },
    awaiting_buyer: { label: 'Aguardando Comprador', className: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300', icon: Clock },
    under_review: { label: 'Em Análise', className: 'bg-blue-500/10 border-blue-500/30 text-blue-300', icon: Clock },
    resolved_refund: { label: 'Resolvida (Reembolso)', className: 'bg-green-500/10 border-green-500/30 text-green-300', icon: Clock },
    resolved_release: { label: 'Resolvida (Liberação)', className: 'bg-green-500/10 border-green-500/30 text-green-300', icon: Clock },
    rejected: { label: 'Rejeitada', className: 'bg-[#C0C0C0]/10 border-[#C0C0C0]/30 text-[#C0C0C0]', icon: Clock },
    cancelled: { label: 'Cancelada', className: 'bg-[#C0C0C0]/10 border-[#C0C0C0]/30 text-[#C0C0C0]', icon: Clock },
  }), []);

  const load = async () => {
    setLoading(true);

    const { data: d, error: disputeError } = await supabase
      .from('disputes')
      .select('id, transaction_id, status, reason, created_at, updated_at')
      .eq('id', disputeId)
      .single();

    if (disputeError) {
      setDispute(null);
      setMessages([]);
      setEvidence([]);
      setLoading(false);
      return;
    }

    const [{ data: msgs }, { data: ev }] = await Promise.all([
      supabase
        .from('dispute_messages')
        .select('id, dispute_id, sender_id, body, created_at')
        .eq('dispute_id', disputeId)
        .order('created_at', { ascending: true }),
      supabase
        .from('dispute_evidence')
        .select('id, dispute_id, uploader_id, file_path, file_name, mime_type, created_at')
        .eq('dispute_id', disputeId)
        .order('created_at', { ascending: false }),
    ]);

    setDispute(d);
    setMessages(msgs || []);
    setEvidence(ev || []);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      await load();
    };
    run();

    return () => { cancelled = true; };
  }, [disputeId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const next = {};
      for (const e of evidence) {
        if (signedUrls[e.file_path]) continue;
        const { data } = await supabase.storage
          .from('dispute_evidence')
          .createSignedUrl(e.file_path, 60 * 60);
        if (data?.signedUrl) next[e.file_path] = data.signedUrl;
      }
      if (!cancelled && Object.keys(next).length > 0) {
        setSignedUrls((prev) => ({ ...prev, ...next }));
      }
    };
    run();
    return () => { cancelled = true; };
  }, [evidence, signedUrls]);

  const handleSend = async (e) => {
    e.preventDefault();
    const body = newMessage.trim();
    if (!body) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Não autenticado');

      const { error } = await supabase
        .from('dispute_messages')
        .insert([{
          dispute_id: disputeId,
          sender_id: user.id,
          body,
        }]);

      if (error) throw error;
      setNewMessage('');
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadEvidence = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadDisputeEvidence({ disputeId, file });
      await load();
    } finally {
      setUploading(false);
    }
  };

  const cfg = statusConfig[dispute?.status] || statusConfig.open;
  const StatusIcon = cfg?.icon || AlertCircle;

  return (
    <div className="min-h-screen bg-charcoal-deep text-white">
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => navigate('/disputas')}
            className="flex items-center gap-2 px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-white/70 hover:text-white hover:border-white/20 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <div className="text-white/40 text-xs truncate">ID: {disputeId}</div>
        </div>

        {loading ? (
          <div className="text-white/50">Carregando...</div>
        ) : !dispute ? (
          <div className="bg-black/40 border border-white/10 rounded-2xl p-10 text-center text-white/50">
            Disputa não encontrada.
          </div>
        ) : (
          <>
            <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${cfg.className}`}>
                    <StatusIcon className="w-4 h-4" />
                    {cfg.label}
                  </div>
                  <div className="text-white/40 text-xs">Transação: {dispute.transaction_id}</div>
                  {dispute.reason && <div className="text-white/80 text-sm break-words">{dispute.reason}</div>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-black/40 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-black uppercase tracking-widest text-white/70">Mensagens</div>
                </div>

                <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
                  {messages.length === 0 ? (
                    <div className="text-white/40 text-sm">Nenhuma mensagem.</div>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="text-white/40 text-xs mb-2">
                          {new Date(m.created_at).toLocaleString('pt-BR')}
                        </div>
                        <div className="text-white/90 text-sm whitespace-pre-wrap break-words">{m.body}</div>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSend} className="mt-4 flex gap-2">
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#D4AF37]/50"
                    placeholder="Escreva uma mensagem..."
                  />
                  <button
                    disabled={submitting || !newMessage.trim()}
                    className="px-5 py-3 bg-[#D4AF37] text-black rounded-xl font-black uppercase tracking-wider text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Enviar
                  </button>
                </form>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-black uppercase tracking-widest text-white/70">Evidências</div>
                </div>

                <label className="block">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => handleUploadEvidence(e.target.files?.[0])}
                    disabled={uploading}
                  />
                  <div className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:border-[#D4AF37]/30 hover:text-white transition cursor-pointer flex items-center gap-2">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    {uploading ? 'Enviando...' : 'Enviar evidência'}
                  </div>
                </label>

                <div className="mt-4 space-y-2">
                  {evidence.length === 0 ? (
                    <div className="text-white/40 text-sm">Nenhuma evidência enviada.</div>
                  ) : (
                    evidence.map((e) => (
                      <a
                        key={e.id}
                        href={signedUrls[e.file_path] || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="block bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition"
                      >
                        <div className="text-white/80 text-sm break-words">{e.file_name || e.file_path}</div>
                        <div className="text-white/40 text-xs mt-1">{new Date(e.created_at).toLocaleString('pt-BR')}</div>
                      </a>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

