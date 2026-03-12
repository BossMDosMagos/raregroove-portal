import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { DollarSign, Shield, TrendingUp, Lock, CheckCircle, Loader2, Users, RefreshCw, Settings, BarChart3, Bug, CreditCard, AlertCircle, XCircle, Wallet, Copy, Download, Upload, X, Trash2, Eye, Clock, Sparkles } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { generatePixBrcode } from '../utils/pixBrcode';
import { validatePixKey, getPixTypeIcon, maskPixKeyDisplay } from '../utils/pixFormatter';
import { maskEmail, maskName } from '../utils/sensitiveDataMask';
import { useI18n } from '../contexts/I18nContext.jsx';
import { uploadWithdrawalProof } from '../utils/profileService';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const withdrawalsRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [custodySales, setCustodySales] = useState(0);
  const [custodySwaps, setCustodySwaps] = useState(0);
  const [platformProfit, setPlatformProfit] = useState(0);
  const [portalRevenue, setPortalRevenue] = useState(0);
  const [marketplaceFees, setMarketplaceFees] = useState(0);
  const [readyToSplit, setReadyToSplit] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerFilter, setLedgerFilter] = useState('all');
  const [withdrawals, setWithdrawals] = useState([]);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [downloadingProofId, setDownloadingProofId] = useState(null);
  const [deletingProofId, setDeletingProofId] = useState(null);
  const [deletingLedgerId, setDeletingLedgerId] = useState(null);
  const [deletingWithdrawalId, setDeletingWithdrawalId] = useState(null);
  const [proofDeleteModal, setProofDeleteModal] = useState(null);
  const [ledgerDeleteModal, setLedgerDeleteModal] = useState(null);
  const [ledgerDetailsModal, setLedgerDetailsModal] = useState(null);
  const [withdrawalDetailsModal, setWithdrawalDetailsModal] = useState(null);
  const [withdrawalDeleteModal, setWithdrawalDeleteModal] = useState(null);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [pendingRefundTasksCount, setPendingRefundTasksCount] = useState(0);

  const { formatCurrency, formatDate: formatDateLocale } = useI18n();
  const formatMoney = (value) => formatCurrency(value, 'BRL');

  const formatDate = (value) => {
    if (!value) return '—';
    return formatDateLocale(value, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const toggleMaintenance = async () => {
    const newState = !maintenanceEnabled;
    const { error } = await supabase
      .from('system_settings')
      .upsert({ key: 'maintenance_mode', value: { enabled: newState } });

    if (error) {
      console.error('Erro ao atualizar manutenção:', error);
      toast.error('Erro ao atualizar modo manutenção: ' + (error.message || 'Erro desconhecido'));
    } else {
      setMaintenanceEnabled(newState);
      toast.success(newState ? 'MODO MANUTENÇÃO ATIVADO' : 'MODO MANUTENÇÃO DESATIVADO', {
        description: newState ? 'O site está inacessível para usuários comuns.' : 'O site está online novamente.'
      });
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // Buscar status de manutenção
      const { data: settings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'maintenance_mode')
        .single();
      
      if (settings?.value?.enabled) setMaintenanceEnabled(true);

      const { data, error } = await supabase
        .from('transactions')
        .select('id, price, total_amount, platform_fee, gateway_fee, net_amount, status, created_at, delivered_at, buyer_id, seller_id, item_id, transaction_type, items(title)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transactions = data || [];
      const custodyStatuses = new Set(['pago', 'pago_custodia', 'pago_em_custodia', 'enviado']);
      const custodySalesSum = transactions
        .filter((t) => custodyStatuses.has(t.status))
        .reduce((sum, t) => sum + Number(t.total_amount || 0), 0);

      const { data: swapsData, error: swapsError } = await supabase
        .from('swaps')
        .select('swap_id, guarantee_fee_amount, guarantee_fee_1_paid, guarantee_fee_2_paid, status');

      if (swapsError) throw swapsError;

      const custodySwapsSum = (swapsData || [])
        .filter((s) => !['concluido', 'cancelado'].includes(s.status))
        .reduce((sum, s) => {
          const paidCount = (s.guarantee_fee_1_paid ? 1 : 0) + (s.guarantee_fee_2_paid ? 1 : 0);
          return sum + Number(s.guarantee_fee_amount || 0) * paidCount;
        }, 0);

      const { data: ledgerData, error: ledgerError } = await supabase
        .from('financial_ledger')
        .select('id, source_type, source_id, entry_type, amount, user_id, created_at, metadata')
        .order('created_at', { ascending: false })
        .limit(200);

      if (ledgerError) throw ledgerError;

      // Separar receitas: Portal vs Marketplace
      const portalRevenueSum = (ledgerData || [])
        .filter((entry) => entry.entry_type === 'receita_portal')
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

      const marketplaceFeesSum = (ledgerData || [])
        .filter((entry) => entry.entry_type === 'taxa_plataforma')
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

      const profitSum = portalRevenueSum + marketplaceFeesSum;

      const ready = transactions.filter((t) => t.status === 'concluido');
      const profileIds = Array.from(new Set(ready.flatMap((t) => [t.buyer_id, t.seller_id]).filter(Boolean)));

      let profileMap = {};
      if (profileIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', profileIds);

        profileMap = (profilesData || []).reduce((acc, profile) => {
          acc[profile.id] = profile.full_name || '—';
          return acc;
        }, {});
      }

      const readyRows = ready.map((t) => ({
        id: t.id,
        itemTitle: t.items?.title || '—',
        buyerName: profileMap[t.buyer_id] || t.buyer_id,
        sellerName: profileMap[t.seller_id] || t.seller_id,
        price: t.price,
        netAmount: t.net_amount,
        platformFee: t.platform_fee,
        deliveredAt: t.delivered_at || t.created_at,
        status: t.status
      }));

      // Buscar solicitações de saque
      const { data: withdrawalsData, error: withdrawalsError } = await supabase
        .from('withdrawals')
        .select('*')
        .order('requested_at', { ascending: false })
        .limit(100);

      if (withdrawalsError) {
        console.error('Erro ao buscar saques:', withdrawalsError);
        toast.error('Erro ao carregar saques: ' + withdrawalsError.message);
      }

      // Buscar perfis dos usuários que solicitaram saque
      let enrichedWithdrawals = withdrawalsData || [];
      if (withdrawalsData && withdrawalsData.length > 0) {
        const userIds = [...new Set(withdrawalsData.map(w => w.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email, pix_key')
          .in('id', userIds);

        if (profilesData) {
          enrichedWithdrawals = withdrawalsData.map(w => {
            const profile = profilesData.find(p => p.id === w.user_id);
            return {
              ...w,
              profiles: profile,
              original_pix_key: w.pix_key, // Chave da solicitação original
              pix_key: profile?.pix_key || w.pix_key, // Chave PIX MAIS RECENTE do perfil
              pix_key_changed: profile?.pix_key && profile.pix_key !== w.pix_key // Flag se mudou
            };
          });
        }
      }

      setCustodySales(custodySalesSum);
      setCustodySwaps(custodySwapsSum);
      setPlatformProfit(profitSum);
      setPortalRevenue(portalRevenueSum);
      setMarketplaceFees(marketplaceFeesSum);
      setReadyToSplit(readyRows);
      setLedgerEntries(ledgerData || []);
      setWithdrawals(enrichedWithdrawals);

      const { data: refundTasksData } = await supabase
        .from('dispute_refund_tasks')
        .select('id, status')
        .eq('status', 'pending_execution')
        .limit(1000);

      setPendingRefundTasksCount((refundTasksData || []).length);
    } catch (error) {
      console.error('Erro ao carregar dados admin:', error);
      toast.error('Erro ao carregar painel admin');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleDownloadAdminProof = async (withdrawal) => {
    if (!withdrawal?.admin_proof_file_path || downloadingProofId) return;

    setDownloadingProofId(withdrawal.id);
    try {
      const { data, error } = await supabase.storage
        .from('withdrawal_proofs')
        .createSignedUrl(withdrawal.admin_proof_file_path, 60);

      if (error) throw error;

      window.open(data?.signedUrl, '_blank', 'noopener,noreferrer');
      toast.success('COMPROVANTE ABERTO', {
        description: 'Link temporário gerado com sucesso.',
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
    } catch (error) {
      console.error('Erro ao abrir comprovante arquivado:', error);
      toast.error('ERRO AO ABRIR COMPROVANTE', {
        description: error.message,
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setDownloadingProofId(null);
    }
  };

  const handleDeleteAdminProof = async () => {
    if (!proofDeleteModal) return;

    setDeletingProofId(proofDeleteModal.id);
    try {
      if (proofDeleteModal.admin_proof_file_path) {
        const { error: storageError } = await supabase.storage
          .from('withdrawal_proofs')
          .remove([proofDeleteModal.admin_proof_file_path]);

        if (storageError) throw storageError;
      }

      const { data: updatedRows, error: updateError } = await supabase
        .from('withdrawals')
        .update({
          admin_proof_file_path: null,
          proof_original_filename: null,
          proof_expires_at: null,
        })
        .eq('id', proofDeleteModal.id)
        .select('id');

      if (updateError) throw updateError;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error('Nenhum comprovante foi removido. Verifique RLS de UPDATE na tabela withdrawals.');
      }

      toast.success('COMPROVANTE REMOVIDO', {
        description: 'Arquivo removido do storage e desvinculado do saque.',
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });

      setProofDeleteModal(null);
      await fetchAdminData();
    } catch (error) {
      console.error('Erro ao deletar comprovante:', error);
      toast.error('ERRO AO DELETAR COMPROVANTE', {
        description: error.message,
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setDeletingProofId(null);
    }
  };

  const handlePurgeExpiredProofs = async () => {
    const expiredProofs = withdrawals.filter((w) => {
      if (!w.admin_proof_file_path || w.status !== 'concluido' || !w.proof_expires_at) return false;
      return new Date(w.proof_expires_at).getTime() <= Date.now();
    });

    if (expiredProofs.length === 0) {
      toast.info('NENHUM COMPROVANTE EXPIRADO', {
        description: 'Não há comprovantes expirados para limpeza.',
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
      return;
    }

    try {
      const filePaths = expiredProofs.map((w) => w.admin_proof_file_path).filter(Boolean);
      if (filePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('withdrawal_proofs')
          .remove(filePaths);

        if (storageError) throw storageError;
      }

      const expiredIds = expiredProofs.map((w) => w.id);
      const { data: updatedRows, error: updateError } = await supabase
        .from('withdrawals')
        .update({
          admin_proof_file_path: null,
          proof_original_filename: null,
          proof_expires_at: null,
        })
        .in('id', expiredIds)
        .select('id');

      if (updateError) throw updateError;

      toast.success('EXPURGO CONCLUÍDO', {
        description: `${updatedRows?.length || 0} comprovante(s) expirado(s) removido(s).`,
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });

      await fetchAdminData();
    } catch (error) {
      console.error('Erro ao expurgar comprovantes expirados:', error);
      toast.error('ERRO NO EXPURGO', {
        description: error.message,
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    }
  };

  const handleDeleteLedgerEntry = async () => {
    if (!ledgerDeleteModal) return;

    setDeletingLedgerId(ledgerDeleteModal.id);
    try {
      const { data: deletedRows, error } = await supabase
        .from('financial_ledger')
        .delete()
        .eq('id', ledgerDeleteModal.id)
        .select('id');

      if (error) throw error;
      if (!deletedRows || deletedRows.length === 0) {
        throw new Error('Nenhum lançamento foi removido. Verifique RLS de DELETE na tabela financial_ledger.');
      }

      toast.success('LANÇAMENTO REMOVIDO', {
        description: 'Registro de auditoria excluído com sucesso.',
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });

      setLedgerDeleteModal(null);
      await fetchAdminData();
    } catch (error) {
      console.error('Erro ao deletar lançamento da auditoria:', error);
      toast.error('ERRO AO DELETAR LANÇAMENTO', {
        description: error.message,
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setDeletingLedgerId(null);
    }
  };

  const handleDeleteWithdrawal = async () => {
    if (!withdrawalDeleteModal) return;

    setDeletingWithdrawalId(withdrawalDeleteModal.id);
    try {
      const { data: deletedRows, error } = await supabase
        .from('withdrawals')
        .delete()
        .eq('id', withdrawalDeleteModal.id)
        .select('id');

      if (error) throw error;
      if (!deletedRows || deletedRows.length === 0) {
        throw new Error('Nenhuma solicitação foi removida. Verifique RLS de DELETE na tabela withdrawals.');
      }

      toast.success('SOLICITAÇÃO REMOVIDA', {
        description: 'Solicitação de saque excluída com sucesso.',
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });

      setWithdrawalDeleteModal(null);
      await fetchAdminData();
    } catch (error) {
      console.error('Erro ao deletar solicitação de saque:', error);
      toast.error('ERRO AO DELETAR SOLICITAÇÃO', {
        description: error.message,
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setDeletingWithdrawalId(null);
    }
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
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-bold uppercase tracking-widest">
              <Shield className="w-4 h-4" /> Central Rare Groove
            </div>
            <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter mt-4 uppercase">
              Banco <span className="text-[#D4AF37]">Rare Groove</span>
            </h1>
            <p className="text-white/40 text-sm mt-2">
              Painel financeiro e custodial do cofre central
            </p>
          </div>
          
          <button
            onClick={toggleMaintenance}
            className={`flex items-center justify-center gap-2 border px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                maintenanceEnabled 
                  ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 hover:border-red-500/80' 
                  : 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20 hover:border-green-500/80'
            }`}
          >
            {maintenanceEnabled ? <XCircle size={14} /> : <CheckCircle size={14} />}
            {maintenanceEnabled ? 'Manutenção ATIVA' : 'Sistema Online'}
          </button>
        </div>

        {/* Menu de Navegação Admin */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/admin/users"
            className="flex items-center justify-center gap-2 bg-black/60 text-blue-400 border border-blue-400/30 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-blue-400/80 hover:bg-blue-400/10 transition-all"
          >
            <Users size={14} /> Gestor de Perfis
          </Link>
          <Link
            to="/admin/disputes"
            className="flex items-center justify-center gap-2 bg-black/60 text-red-400 border border-red-400/30 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-red-400/80 hover:bg-red-400/10 transition-all"
          >
            <AlertCircle size={14} /> Gestor de Disputas
          </Link>
          <Link
            to="/admin/escrow-sla"
            className="flex items-center justify-center gap-2 bg-black/60 text-[#D4AF37] border border-[#D4AF37]/30 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-[#D4AF37]/80 hover:bg-[#D4AF37]/10 transition-all"
          >
            <Clock size={14} /> Timers de Escrow
          </Link>
          <Link
            to="/admin/refunds"
            className="flex items-center justify-center gap-2 bg-black/60 text-yellow-300 border border-yellow-500/30 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-yellow-500/80 hover:bg-yellow-500/10 transition-all"
          >
            <CreditCard size={14} /> Fila de Reembolsos
            {pendingRefundTasksCount > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-yellow-500 text-black rounded-full text-[9px] font-black">
                {pendingRefundTasksCount > 99 ? '99+' : pendingRefundTasksCount}
              </span>
            )}
          </Link>
          <Link
            to="/admin/sales"
            className="flex items-center justify-center gap-2 bg-black/60 text-amber-400 border border-amber-400/30 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-amber-400/80 hover:bg-amber-400/10 transition-all"
          >
            <BarChart3 size={14} /> Relatório de Vendas
          </Link>
          <Link
            to="/swaps"
            className="flex items-center justify-center gap-2 bg-black/60 text-purple-400 border border-purple-400/30 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-purple-400/80 hover:bg-purple-400/10 transition-all"
          >
            <RefreshCw size={14} /> Simulador de Swap
          </Link>
          <Link
            to="/admin/swaps"
            className="flex items-center justify-center gap-2 bg-black/60 text-fuchsia-400 border border-fuchsia-400/30 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-fuchsia-400/80 hover:bg-fuchsia-400/10 transition-all"
          >
            <RefreshCw size={14} /> Gerenciamento de Trocas
          </Link>
          <Link
            to="/admin/fees"
            className="flex items-center justify-center gap-2 bg-black/60 text-green-400 border border-green-400/30 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-green-400/80 hover:bg-green-400/10 transition-all"
          >
            <Settings size={14} /> Configurações Financeiras
          </Link>
          <Link
            to="/admin/subscriptions"
            className="flex items-center justify-center gap-2 bg-black/60 text-fuchsia-300 border border-fuchsia-400/30 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-fuchsia-400/80 hover:bg-fuchsia-400/10 transition-all"
          >
            <Sparkles size={14} /> Gestão de Assinaturas
          </Link>
          <button
            onClick={() => withdrawalsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="flex items-center justify-center gap-2 bg-black/60 text-[#D4AF37] border border-[#D4AF37]/30 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-[#D4AF37]/80 hover:bg-[#D4AF37]/10 transition-all"
          >
            <Wallet size={14} /> Gestão de Saques
            {withdrawals.filter(w => w.status === 'pendente').length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-yellow-500 text-black rounded-full text-[9px] font-black">
                {withdrawals.filter(w => w.status === 'pendente').length}
              </span>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#050505] border border-[#D4AF37]/20 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[3px] text-white/40">Custodia Vendas</p>
                <p className="text-3xl font-black text-[#D4AF37] mt-2">
                  {formatMoney(custodySales)}
                </p>
                <p className="text-xs text-white/40 mt-2">
                  Pagos e enviados aguardando entrega
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37]">
                <Lock className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="bg-[#050505] border border-[#D4AF37]/20 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[3px] text-white/40">Custodia Trocas</p>
                <p className="text-3xl font-black text-[#D4AF37] mt-2">
                  {formatMoney(custodySwaps)}
                </p>
                <p className="text-xs text-white/40 mt-2">
                  Garantias de swap em andamento
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37]">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="bg-[#050505] border border-[#D4AF37]/20 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[3px] text-white/40">Receita Total</p>
                <p className="text-3xl font-black text-[#D4AF37] mt-2">
                  {formatMoney(platformProfit)}
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <div>
                    <p className="text-xs text-green-400">Portal: {formatMoney(portalRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-400">Taxa Marketplace: {formatMoney(marketplaceFees)}</p>
                  </div>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37]">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#050505] border border-[#D4AF37]/20 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-black">Lista de Liberacao</h2>
              <p className="text-white/40 text-xs">Transacoes prontas para split</p>
            </div>
            <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold uppercase tracking-widest">
              <CheckCircle className="w-4 h-4" /> {readyToSplit.length}
            </div>
          </div>

          {readyToSplit.length === 0 ? (
            <div className="text-center py-10 text-white/40">
              Nenhuma transacao pronta para liberacao
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-white/50 border-b border-white/10">
                  <tr>
                    <th className="py-3">Item</th>
                    <th className="py-3">Comprador</th>
                    <th className="py-3">Vendedor</th>
                    <th className="py-3">Valor</th>
                    <th className="py-3">Liquido</th>
                    <th className="py-3">Entregue em</th>
                    <th className="py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {readyToSplit.map((row) => (
                    <tr key={row.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 pr-4 font-semibold text-white/80">{row.itemTitle}</td>
                      <td className="py-3 pr-4 text-white/60">{row.buyerName}</td>
                      <td className="py-3 pr-4 text-white/60">{row.sellerName}</td>
                      <td className="py-3 pr-4 text-[#D4AF37] font-bold">{formatMoney(row.price)}</td>
                      <td className="py-3 pr-4 text-green-400 font-bold">{formatMoney(row.netAmount)}</td>
                      <td className="py-3 pr-4 text-white/60">{formatDate(row.deliveredAt)}</td>
                      <td className="py-3 text-green-400 font-bold uppercase text-xs">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Seção de Saques Pendentes */}
        <div ref={withdrawalsRef} className="bg-[#050505] border border-[#D4AF37]/20 rounded-2xl p-6 scroll-mt-20">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-black">Solicitações de Saque</h2>
              <p className="text-white/40 text-xs">Gerenciar retiradas do cofre central</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-yellow-400 text-xs font-bold uppercase tracking-widest">
                <AlertCircle className="w-4 h-4" /> 
                {withdrawals.filter(w => w.status === 'pendente').length} Pendente(s)
              </div>
              <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold uppercase tracking-widest">
                <CreditCard className="w-4 h-4" /> 
                {withdrawals.length} Total
              </div>
            </div>
          </div>

          {withdrawals.length === 0 ? (
            <div className="text-center py-10 text-white/40">
              Nenhuma solicitação de saque ainda
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-white/50 border-b border-white/10">
                  <tr>
                    <th className="py-3">Usuário</th>
                    <th className="py-3">E-mail</th>
                    <th className="py-3">Valor</th>
                    <th className="py-3">Chave PIX</th>
                    <th className="py-3">Solicitado em</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((withdrawal) => {
                    const statusColors = {
                      pendente: 'text-yellow-400',
                      processando: 'text-blue-400',
                      concluido: 'text-green-400',
                      cancelado: 'text-red-400'
                    };
                    
                    return (
                      <tr key={withdrawal.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 pr-4 font-semibold text-white/80">
                          {withdrawal.profiles?.full_name || '—'}
                        </td>
                        <td className="py-3 pr-4 text-white/60 text-xs">
                          {maskEmail(withdrawal.profiles?.email, true)}
                        </td>
                        <td className="py-3 pr-4 text-[#D4AF37] font-bold">
                          {formatMoney(withdrawal.amount)}
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs">
                          {withdrawal.pix_key ? (
                            <div className="flex items-center gap-1">
                              <span className="text-sm">
                                {getPixTypeIcon(validatePixKey(withdrawal.pix_key).type)}
                              </span>
                              <span className="text-white/60">
                                {maskPixKeyDisplay(withdrawal.pix_key)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-red-400">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-white/60 text-xs">
                          {formatDate(withdrawal.requested_at)}
                        </td>
                        <td className={`py-3 pr-4 font-bold uppercase text-xs ${statusColors[withdrawal.status]}`}>
                          {withdrawal.status}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setWithdrawalDetailsModal(withdrawal)}
                              className="px-2 py-1.5 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-lg hover:bg-blue-500/30 transition-colors flex items-center gap-1"
                              title="Ver detalhes"
                            >
                              <Eye size={14} /> VER
                            </button>
                            {withdrawal.status === 'pendente' && (
                              <button
                                onClick={() => setSelectedWithdrawal(withdrawal)}
                                className="px-2 py-1.5 bg-[#D4AF37] text-black text-xs font-bold rounded-lg hover:bg-[#D4AF37]/90 transition-colors"
                              >
                                PROCESSAR
                              </button>
                            )}
                            <button
                              onClick={() => setWithdrawalDeleteModal(withdrawal)}
                              className="px-2 py-1.5 bg-red-500/20 text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/30 transition-colors flex items-center gap-1"
                              title="Deletar solicitação"
                            >
                              <Trash2 size={14} /> DELETAR
                            </button>
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

        {/* Arquivo administrativo dos comprovantes de saque */}
        <div className="bg-[#050505] border border-[#D4AF37]/20 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-black">Arquivo de Comprovantes (30 dias)</h2>
              <p className="text-white/40 text-xs">Lista administrativa de liberação com retenção automática</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePurgeExpiredProofs}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/40 rounded-lg text-red-300 text-[11px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Expurgar expirados
              </button>
              <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold uppercase tracking-widest">
                <Download className="w-4 h-4" />
                {withdrawals.filter(w => w.admin_proof_file_path && w.status === 'concluido').length}
              </div>
            </div>
          </div>

          {withdrawals.filter(w => w.admin_proof_file_path && w.status === 'concluido').length === 0 ? (
            <div className="text-center py-8 text-white/40 text-sm">
              Nenhum comprovante arquivado no momento
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-white/50 border-b border-white/10">
                  <tr>
                    <th className="py-3">Usuário</th>
                    <th className="py-3">Valor</th>
                    <th className="py-3">Arquivo</th>
                    <th className="py-3">Expira em</th>
                    <th className="py-3">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals
                    .filter(w => w.admin_proof_file_path && w.status === 'concluido')
                    .sort((a, b) => new Date(b.processed_at || b.requested_at) - new Date(a.processed_at || a.requested_at))
                    .map((withdrawal) => {
                      const expiresAt = withdrawal.proof_expires_at ? new Date(withdrawal.proof_expires_at) : null;
                      const isExpired = expiresAt ? expiresAt.getTime() <= Date.now() : false;

                      return (
                        <tr key={`proof-${withdrawal.id}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 pr-4 text-white/80 font-semibold">{withdrawal.profiles?.full_name || '—'}</td>
                          <td className="py-3 pr-4 text-[#D4AF37] font-bold">{formatMoney(withdrawal.amount)}</td>
                          <td className="py-3 pr-4 text-white/60 text-xs">{withdrawal.proof_original_filename || 'comprovante'}</td>
                          <td className={`py-3 pr-4 text-xs font-semibold ${isExpired ? 'text-red-400' : 'text-blue-300'}`}>
                            {expiresAt ? formatDate(expiresAt.toISOString()) : '—'}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleDownloadAdminProof(withdrawal)}
                                disabled={isExpired || downloadingProofId === withdrawal.id}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#D4AF37]/20 border border-[#D4AF37]/50 rounded-lg text-[#D4AF37] text-xs font-bold hover:bg-[#D4AF37]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {downloadingProofId === withdrawal.id ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Abrindo...
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3.5 h-3.5" />
                                    Baixar
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setProofDeleteModal(withdrawal)}
                                disabled={deletingProofId === withdrawal.id}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/40 rounded-lg text-red-300 text-xs font-bold hover:bg-red-500/20 transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remover
                              </button>
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

        <div className="bg-[#050505] border border-[#D4AF37]/20 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-black">Auditoria Unificada</h2>
              <p className="text-white/40 text-xs">Entradas e saídas do cofre central</p>
            </div>
            <div className="flex items-center gap-2">
              {['all', 'venda', 'troca'].map((type) => (
                <button
                  key={type}
                  onClick={() => setLedgerFilter(type)}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                    ledgerFilter === type
                      ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                      : 'bg-black/60 text-white/60 border-white/10 hover:border-[#D4AF37]/40'
                  }`}
                >
                  {type === 'all' ? 'Todos' : type}
                </button>
              ))}
            </div>
          </div>

          {ledgerEntries.length === 0 ? (
            <div className="text-center py-10 text-white/40">
              Nenhuma movimentacao registrada ainda
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-white/50 border-b border-white/10">
                  <tr>
                    <th className="py-3">Tipo</th>
                    <th className="py-3">Evento</th>
                    <th className="py-3">Valor</th>
                    <th className="py-3">Usuario</th>
                    <th className="py-3">Data</th>
                    <th className="py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries
                    .filter((entry) => ledgerFilter === 'all' || entry.source_type === ledgerFilter)
                    .map((entry) => (
                      <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 pr-4 text-white/60 uppercase text-[10px] font-bold">{entry.source_type}</td>
                        <td className="py-3 pr-4 text-white/80">{entry.entry_type}</td>
                        <td className="py-3 pr-4 text-[#D4AF37] font-bold">{formatMoney(entry.amount)}</td>
                        <td className="py-3 pr-4 text-white/60 text-xs">{entry.user_id || 'Cofre Central'}</td>
                        <td className="py-3 text-white/60 text-xs">{formatDate(entry.created_at)}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setLedgerDetailsModal(entry)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/40 text-blue-300 text-[10px] font-bold uppercase hover:bg-blue-500/20"
                            >
                              <Eye className="w-3 h-3" /> Ver
                            </button>
                            <button
                              onClick={() => setLedgerDeleteModal(entry)}
                              disabled={deletingLedgerId === entry.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/40 text-red-300 text-[10px] font-bold uppercase hover:bg-red-500/20 disabled:opacity-50"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {proofDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg bg-[#050505] border border-red-500/30 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-black text-white uppercase">Remover Comprovante</h3>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm space-y-2">
              <p className="text-white/80"><strong>Usuário:</strong> {proofDeleteModal.profiles?.full_name || '—'}</p>
              <p className="text-white/80"><strong>Arquivo:</strong> {proofDeleteModal.proof_original_filename || 'comprovante'}</p>
              <p className="text-white/80"><strong>Valor:</strong> {formatMoney(proofDeleteModal.amount)}</p>
            </div>
            <p className="text-yellow-200 text-xs uppercase font-bold">Ação irreversível para o arquivo</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setProofDeleteModal(null)}
                className="px-4 py-2 text-xs font-black uppercase rounded-lg border border-white/20 text-white/70"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAdminProof}
                disabled={deletingProofId === proofDeleteModal.id}
                className="px-4 py-2 text-xs font-black uppercase rounded-lg bg-red-600/30 border border-red-600/40 text-red-300 hover:bg-red-600/40 disabled:opacity-50"
              >
                {deletingProofId === proofDeleteModal.id ? 'Removendo...' : 'Confirmar Remoção'}
              </button>
            </div>
          </div>
        </div>
      )}

      {ledgerDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg bg-[#050505] border border-red-500/30 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-black text-white uppercase">Excluir Lançamento</h3>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm space-y-2">
              <p className="text-white/80"><strong>ID:</strong> {ledgerDeleteModal.id}</p>
              <p className="text-white/80"><strong>Evento:</strong> {ledgerDeleteModal.entry_type}</p>
              <p className="text-white/80"><strong>Valor:</strong> {formatMoney(ledgerDeleteModal.amount)}</p>
              <p className="text-white/80"><strong>Data:</strong> {formatDate(ledgerDeleteModal.created_at)}</p>
            </div>
            <p className="text-yellow-200 text-xs uppercase font-bold">Ação irreversível na auditoria</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setLedgerDeleteModal(null)}
                className="px-4 py-2 text-xs font-black uppercase rounded-lg border border-white/20 text-white/70"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteLedgerEntry}
                disabled={deletingLedgerId === ledgerDeleteModal.id}
                className="px-4 py-2 text-xs font-black uppercase rounded-lg bg-red-600/30 border border-red-600/40 text-red-300 hover:bg-red-600/40 disabled:opacity-50"
              >
                {deletingLedgerId === ledgerDeleteModal.id ? 'Excluindo...' : 'Confirmar Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {ledgerDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl bg-[#050505] border border-[#D4AF37]/30 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white uppercase">Detalhes do Lançamento</h3>
              <button onClick={() => setLedgerDetailsModal(null)} className="text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <p className="text-white/50 text-xs uppercase">ID</p>
                <p className="text-white break-all">{ledgerDetailsModal.id}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <p className="text-white/50 text-xs uppercase">Tipo</p>
                <p className="text-white">{ledgerDetailsModal.source_type}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <p className="text-white/50 text-xs uppercase">Evento</p>
                <p className="text-white">{ledgerDetailsModal.entry_type}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <p className="text-white/50 text-xs uppercase">Valor</p>
                <p className="text-white font-bold">{formatMoney(ledgerDetailsModal.amount)}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <p className="text-white/50 text-xs uppercase">Usuário</p>
                <p className="text-white break-all">{ledgerDetailsModal.user_id || 'Cofre Central'}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <p className="text-white/50 text-xs uppercase">Data</p>
                <p className="text-white">{formatDate(ledgerDetailsModal.created_at)}</p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm">
              <p className="text-white/50 text-xs uppercase mb-2">Metadata (JSON)</p>
              <pre className="text-white/80 whitespace-pre-wrap break-all text-xs">{JSON.stringify(ledgerDetailsModal.metadata || {}, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Processar Saque */}
      {selectedWithdrawal && (
        <WithdrawalProcessModal
          isOpen={!!selectedWithdrawal}
          onClose={() => setSelectedWithdrawal(null)}
          withdrawal={selectedWithdrawal}
          onSuccess={() => {
            setSelectedWithdrawal(null);
            fetchAdminData();
          }}
        />
      )}

      {/* Modal: Detalhes de Solicitação de Saque */}
      <WithdrawalDetailsModal
        isOpen={!!withdrawalDetailsModal}
        onClose={() => setWithdrawalDetailsModal(null)}
        withdrawal={withdrawalDetailsModal}
      />

      {/* Modal: Deletar Solicitação de Saque */}
      <WithdrawalDeleteModal
        isOpen={!!withdrawalDeleteModal}
        onClose={() => setWithdrawalDeleteModal(null)}
        withdrawal={withdrawalDeleteModal}
        onDelete={handleDeleteWithdrawal}
        isDeleting={deletingWithdrawalId === withdrawalDeleteModal?.id}
      />
    </div>
  );
}

// Modal de Processamento de Saque
function WithdrawalProcessModal({ isOpen, onClose, withdrawal, onSuccess }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [proofFile, setProofFile] = useState(null);
  const fileInputRef = useRef(null);

  const brcode = useMemo(() => {
    if (!withdrawal) return null;
    return generatePixBrcode(withdrawal.pix_key, withdrawal.amount, {
      merchantName: 'RAREGROOVE',
      merchantCity: 'BRASIL',
      txid: '***'
    });
  }, [withdrawal]);

  if (!isOpen || !withdrawal) return null;

  const handleProcess = async (newStatus) => {
    if (!['concluido', 'cancelado'].includes(newStatus)) return;

    // Exigir comprovante apenas quando aprovar (concluido)
    if (newStatus === 'concluido' && !proofFile) {
      toast.error('COMPROVANTE OBRIGATÓRIO', {
        description: 'Anexe o comprovante do PIX (PDF ou imagem) antes de aprovar o saque.',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }

    toast(newStatus === 'concluido' ? 'CONFIRMAR LIBERAÇÃO DE SAQUE' : 'CONFIRMAR CANCELAMENTO DE SAQUE', {
      description: newStatus === 'concluido'
        ? `Valor ${formatMoney(withdrawal.amount)} para ${withdrawal.profiles?.full_name || 'usuário'}.`
        : `Cancelar saque de ${formatMoney(withdrawal.amount)}.`,
      style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      action: {
        label: 'CONFIRMAR',
        onClick: () => executeProcess(newStatus),
      },
      cancel: {
        label: 'VOLTAR',
      },
      duration: 10000,
    });
  };

  const executeProcess = async (newStatus) => {
    setIsProcessing(true);

    try {
      let proofPayload = null;

      // Se aprovar, fazer upload do comprovante
      if (newStatus === 'concluido' && proofFile) {
        proofPayload = await uploadWithdrawalProof({
          userId: withdrawal.user_id,
          withdrawalId: withdrawal.id,
          file: proofFile,
        });
        
        if (!proofPayload) {
          setIsProcessing(false);
          return; // Erro no upload já foi mostrado por toast
        }
      }

      // Chamar função SQL para processar o saque
      const { data, error } = await supabase.rpc('process_withdrawal', {
        withdrawal_uuid: withdrawal.id,
        new_status: newStatus,
        admin_notes: newStatus === 'cancelado' ? 'Cancelado pelo administrador' : null,
        proof_user_path: proofPayload?.userProofPath || null,
        proof_admin_path: proofPayload?.adminProofPath || null,
        proof_filename: proofPayload?.originalFilename || null,
        proof_expires_at: proofPayload?.expiresAt || null
      });

      if (error) throw error;

      const result = data[0];

      if (result.success) {
        if (newStatus === 'concluido') {
          toast.success('PAGAMENTO CONFIRMADO', {
            description: result.message,
            style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
          });
        } else {
          toast.success(result.message, {
            style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
          });
        }
        onSuccess?.();
      } else {
        toast.error(result.message, {
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
      }
    } catch (error) {
      console.error('Erro ao processar saque:', error);
      toast.error('Erro ao processar: ' + error.message, {
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatMoney = (value) => Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#050505] border border-[#D4AF37]/30 rounded-lg w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#D4AF37]/20">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-[#D4AF37]" />
            <h2 className="text-xl font-bold text-white">Processar Saque</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={isProcessing}
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Informações do Saque */}
          <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-4 space-y-4">
            <div>
              <p className="text-[#D4AF37]/70 text-xs uppercase font-bold">Usuário</p>
              <p className="text-white font-semibold">{maskName(withdrawal.profiles?.full_name) || '—'}</p>
              <p className="text-white/60 text-xs">{maskEmail(withdrawal.profiles?.email)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[#D4AF37]/70 text-xs uppercase font-bold">Valor</p>
                <p className="text-[#D4AF37] font-black text-2xl">{formatMoney(withdrawal.amount)}</p>
              </div>
              <div>
                <p className="text-[#D4AF37]/70 text-xs uppercase font-bold mb-2">Chave PIX Atualizada</p>
                {withdrawal.pix_key ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {getPixTypeIcon(validatePixKey(withdrawal.pix_key).type)}
                      </span>
                      <p className="text-white/80 font-mono text-xs break-all">
                        {maskPixKeyDisplay(withdrawal.pix_key)}
                      </p>
                    </div>
                    <p className="text-[#D4AF37]/70 text-xs">
                      {validatePixKey(withdrawal.pix_key).message}
                    </p>
                  </div>
                ) : (
                  <p className="text-red-400 text-sm font-semibold">
                    ⚠️ Chave não encontrada
                  </p>
                )}
              </div>
            </div>

            {/* Aviso se a chave PIX foi alterada */}
            {withdrawal.pix_key_changed && (
              <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-200">
                  <p className="font-bold mb-1">🔄 Chave PIX Atualizada</p>
                  <p className="text-blue-300/80">
                    O usuário alterou sua chave PIX após a solicitação.<br/>
                    <strong>Original:</strong> <span className="font-mono">{maskPixKeyDisplay(withdrawal.original_pix_key)}</span>
                  </p>
                </div>
              </div>
            )}

            {/* QR Code PIX */}
            <div className="bg-black/40 border border-[#D4AF37]/20 rounded-lg p-4 flex flex-col items-center gap-3">
              <p className="text-[#D4AF37]/70 text-xs uppercase font-bold">QR Code PIX</p>
              <div className="bg-white p-3 rounded-lg">
                <QRCodeCanvas
                  value={brcode || withdrawal.pix_key}
                  size={192}
                  level="M"
                  includeMargin={true}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                />
              </div>
              <p className="text-white/60 text-xs text-center">
                {withdrawal.pix_key_changed 
                  ? '✅ QR Code gerado com a chave PIX ATUALIZADA do usuário' 
                  : 'Leia com seu app bancário ou copie a chave acima'}
              </p>
            </div>
          </div>

          {/* Campo de Comprovante do PIX - Upload de Arquivo */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              <Upload className="w-4 h-4 inline mr-2" />
              Comprovante do PIX (obrigatório para aprovação)
            </label>
            
            {!proofFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#D4AF37]/40 rounded-lg p-6 cursor-pointer hover:border-[#D4AF37]/60 hover:bg-[#D4AF37]/5 transition-all text-center"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setProofFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                  disabled={isProcessing}
                />
                <Upload className="w-8 h-8 text-[#D4AF37]/60 mx-auto mb-2" />
                <p className="text-white font-semibold mb-1">Selecione o comprovante</p>
                <p className="text-gray-400 text-xs">PDF, JPG, PNG, WebP ou GIF (máx. 5MB)</p>
              </div>
            ) : (
              <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="bg-[#D4AF37]/20 rounded p-2 mt-1">
                      {proofFile.type.startsWith('image/') ? (
                        <span className="text-lg">🖼️</span>
                      ) : (
                        <span className="text-lg">📄</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{proofFile.name}</p>
                      <p className="text-gray-400 text-xs">
                        {(proofFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProofFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    disabled={isProcessing}
                    className="text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {proofFile.type.startsWith('image/') && (
                  <div className="mt-3 pt-3 border-t border-[#D4AF37]/20">
                    <img
                      src={URL.createObjectURL(proofFile)}
                      alt="Preview"
                      className="max-h-40 rounded mx-auto object-contain"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Aviso */}
          <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-yellow-200">
              <p className="font-bold mb-1">Atenção:</p>
              <p className="text-yellow-300/80">
                Ao aprovar, certifique-se de que o pagamento foi realmente enviado para a chave PIX do usuário.
                Esta ação não pode ser desfeita.
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleProcess('cancelado')}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 font-semibold hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  CANCELAR SAQUE
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleProcess('concluido')}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 bg-[#D4AF37] text-black font-semibold rounded-lg hover:bg-[#D4AF37]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  APROVAR SAQUE
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// Modal de Detalhes de Solicitação de Saque
function WithdrawalDetailsModal({ isOpen, onClose, withdrawal }) {
  if (!isOpen || !withdrawal) return null;

  const { formatMoney, formatDate } = {
    formatMoney: (value) => Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }),
    formatDate: (value) => {
      if (!value) return '—';
      return new Date(value).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const statusColors = {
    pendente: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    processando: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    concluido: 'bg-green-500/20 text-green-400 border-green-500/30',
    cancelado: 'bg-red-500/20 text-red-400 border-red-500/30'
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#050505] border border-[#D4AF37]/30 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#050505] border-b border-[#D4AF37]/20 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">DETALHES DA SOLICITAÇÃO</h2>
            <p className="text-white/40 text-xs mt-1">ID: {withdrawal.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Seção Usuário */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-[#D4AF37] uppercase">Solicitante</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-white/40 text-xs">Nome</p>
                <p className="text-white font-semibold">{withdrawal.profiles?.full_name || '—'}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs">E-mail</p>
                <p className="text-white/60 text-sm font-mono">{maskEmail(withdrawal.profiles?.email, true)}</p>
              </div>
            </div>
          </div>

          {/* Seção Valores */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-[#D4AF37] uppercase">Valores</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-white/40 text-xs">Valor do Saque</p>
                <p className="text-white font-bold text-lg">{formatMoney(withdrawal.amount)}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs">Status</p>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase border ${statusColors[withdrawal.status]}`}>
                  {withdrawal.status}
                </span>
              </div>
            </div>
          </div>

          {/* Seção PIX */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-[#D4AF37] uppercase">Dados PIX</h3>
            <div>
              <p className="text-white/40 text-xs">Chave PIX</p>
              <p className="text-white font-mono text-sm break-all">{withdrawal.pix_key || '—'}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs">Documentação</p>
              <p className="text-white text-sm">{withdrawal.pix_accountholder_name || '—'}</p>
            </div>
          </div>

          {/* Seção Datas */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-[#D4AF37] uppercase">Cronologia</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-white/40 text-xs">Solicitado em</p>
                <p className="text-white text-sm">{formatDate(withdrawal.requested_at)}</p>
              </div>
              {withdrawal.processed_at && (
                <div>
                  <p className="text-white/40 text-xs">Processado em</p>
                  <p className="text-white text-sm">{formatDate(withdrawal.processed_at)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Seção Comprovante */}
          {withdrawal.admin_proof_file_path && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#D4AF37] uppercase">Comprovante</h3>
              <p className="text-white/60 text-xs font-mono break-all">{withdrawal.proof_original_filename || '—'}</p>
              {withdrawal.proof_expires_at && (
                <p className="text-white/40 text-xs">
                  Expira em: {new Date(withdrawal.proof_expires_at).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-[#050505] border-t border-[#D4AF37]/20 p-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition-colors"
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal de Confirmação de Deleção de Solicitação de Saque
function WithdrawalDeleteModal({ isOpen, onClose, withdrawal, onDelete, isDeleting }) {
  if (!isOpen || !withdrawal) return null;

  const { formatMoney } = {
    formatMoney: (value) => Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    })
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#050505] border border-red-500/30 rounded-2xl max-w-md w-full">
        <div className="border-b border-red-500/20 p-6">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-400" />
            DELETAR SOLICITAÇÃO
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-3">
            <p className="text-white font-semibold">Usuário: {withdrawal.profiles?.full_name}</p>
            <p className="text-[#D4AF37] font-bold text-lg">Valor: {formatMoney(withdrawal.amount)}</p>
            <p className="text-white/60 text-sm">Status: <span className="font-semibold text-white">{withdrawal.status}</span></p>
          </div>

          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
            <p className="text-red-400 font-bold text-xs uppercase">⚠ AÇÃO IRREVERSÍVEL PARA A SOLICITAÇÃO</p>
            <p className="text-white/60 text-xs mt-2">
              Esta ação não pode ser desfeita. A solicitação será permanentemente removida do sistema.
            </p>
          </div>
        </div>

        <div className="border-t border-red-500/20 p-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-3 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50"
          >
            CANCELAR
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="flex-1 px-4 py-3 bg-red-500/20 text-red-400 font-semibold rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deletando...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                CONFIRMAR DELEÇÃO
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
