import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, ShieldCheck, DollarSign, Users, CheckCircle, XCircle } from 'lucide-react';
import { maskEmail } from '../utils/sensitiveDataMask';
import { useI18n } from '../contexts/I18nContext.jsx';

export default function SwapSimulator() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [swaps, setSwaps] = useState([]);
  const [settings, setSettings] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'detail', 'create', 'simulator'
  
  // Estado para simulador
  const [simulatorData, setSimulatorData] = useState({
    guaranteeFee: 10,
    portalKeepPct: 100,
    user1Paid: false,
    user2Paid: false,
    user1Confirmed: false,
    user2Confirmed: false,
  });

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (cancelled) return;

      setSession(s);
      if (!s) {
        navigate('/login');
        return;
      }

      const { data: adminRow } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', s.user.id)
        .single();

      if (cancelled) return;
      const adminFlag = Boolean(adminRow?.is_admin);
      setIsAdmin(adminFlag);
      await fetchData(s.user.id, adminFlag);
    };

    init();
    return () => { cancelled = true; };
  }, [navigate]);

  async function fetchData(userId, adminFlag) {
    setLoading(true);
    
    // Buscar configurações
    const { data: settingsData } = await supabase
      .from('platform_settings')
      .select('*')
      .eq('id', 1)
      .single();
    
    setSettings(settingsData);
    
    if (settingsData) {
      setSimulatorData(prev => ({
        ...prev,
        guaranteeFee: Number(settingsData.swap_guarantee_fee_fixed),
        portalKeepPct: Number(settingsData.swap_guarantee_portal_pct),
      }));
    }

    // Buscar swaps do usuário ou todos se admin
    let query = supabase
      .from('swaps')
      .select(`
        *,
        user1:user_1_id(email, profiles(username)),
        user2:user_2_id(email, profiles(username)),
        item1:item_1_id(title, condition, image_url),
        item2:item_2_id(title, condition, image_url)
      `)
      .order('created_at', { ascending: false });

    if (!adminFlag) {
      query = query.or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`);
    }

    const { data: swapsData } = await query;
    setSwaps(swapsData || []);
    setLoading(false);
  }

  async function handlePayGuarantee(swapId) {
    try {
      const { data, error } = await supabase.rpc('pay_swap_guarantee', {
        p_swap_id: swapId
      });

      if (error) throw error;

      if (data.success) {
        alert(`✅ ${t('swaps.alerts.guaranteePaid')}`);
        fetchData(session.user.id, isAdmin);
      } else {
        alert(`❌ ${data.message}`);
      }
    } catch (error) {
      console.error('Erro ao pagar garantia:', error);
      alert(`${t('swaps.errors.payment')}: ${error.message}`);
    }
  }

  async function handleConfirmReceipt(swapId) {
    try {
      const { data, error } = await supabase.rpc('confirm_swap_receipt', {
        p_swap_id: swapId
      });

      if (error) throw error;

      if (data.success) {
        alert(`✅ ${t('swaps.alerts.receiptConfirmed')}`);
        fetchData(session.user.id, isAdmin);
      } else {
        alert(`❌ ${data.message}`);
      }
    } catch (error) {
      console.error('Erro ao confirmar recebimento:', error);
      alert(`${t('swaps.errors.confirm')}: ${error.message}`);
    }
  }

  async function handleCancelSwap(swapId) {
    if (!confirm(t('swaps.confirm.cancel'))) return;

    try {
      const { error } = await supabase
        .from('swaps')
        .update({ 
          status: 'cancelado',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('swap_id', swapId);

      if (error) throw error;

      alert(t('swaps.alerts.swapCancelled'));
      fetchData(session.user.id, isAdmin);
    } catch (error) {
      console.error('Erro ao cancelar swap:', error);
      alert(`${t('swaps.errors.cancel')}: ${error.message}`);
    }
  }

  // Cálculos do simulador
  const simulatorResults = useMemo(() => {
    const totalGuarantee = simulatorData.guaranteeFee * 2;
    const portalKeep = (totalGuarantee * simulatorData.portalKeepPct) / 100;
    const userRefund = totalGuarantee - portalKeep;
    const perUserRefund = userRefund / 2;

    return {
      totalGuarantee,
      portalKeep,
      userRefund,
      perUserRefund,
      bothPaid: simulatorData.user1Paid && simulatorData.user2Paid,
      bothConfirmed: simulatorData.user1Confirmed && simulatorData.user2Confirmed,
      readyToShip: simulatorData.user1Paid && simulatorData.user2Paid,
      completed: simulatorData.user1Paid && simulatorData.user2Paid && 
                 simulatorData.user1Confirmed && simulatorData.user2Confirmed,
    };
  }, [simulatorData]);

  const getStatusBadge = (status) => {
    const badges = {
      'proposta_criada': { color: 'bg-[#C0C0C0]/20 border border-[#C0C0C0]/40 text-[#C0C0C0]' },
      'aguardando_checkin': { color: 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-400' },
      'checkin_parcial': { color: 'bg-orange-500/20 border border-orange-500/40 text-orange-400' },
      'etiquetas_liberadas': { color: 'bg-blue-500/20 border border-blue-500/40 text-blue-400' },
      'em_transito': { color: 'bg-purple-500/20 border border-purple-500/40 text-purple-400' },
      'aguardando_confirmacao_recebimento': { color: 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400' },
      'concluida': { color: 'bg-green-500/20 border border-green-500/40 text-green-400' },
      'sinistro_aberto': { color: 'bg-red-500/20 border border-red-500/40 text-red-400' },
      'sinistro_em_analise': { color: 'bg-red-600/20 border border-red-600/40 text-red-300' },
      'sinistro_resolvido_venda_reversa': { color: 'bg-amber-500/20 border border-amber-500/40 text-amber-300' },
      'cancelada': { color: 'bg-red-500/20 border border-red-500/40 text-red-400' },

      // Legado
      'aguardando_taxas': { color: 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-400' },
      'autorizado_envio': { color: 'bg-blue-500/20 border border-blue-500/40 text-blue-400' },
      'em_troca': { color: 'bg-purple-500/20 border border-purple-500/40 text-purple-400' },
      'concluido': { color: 'bg-green-500/20 border border-green-500/40 text-green-400' },
      'cancelado': { color: 'bg-red-500/20 border border-red-500/40 text-red-400' },
    };
    
    const badge = badges[status] || { color: 'bg-[#C0C0C0]/20 border border-[#C0C0C0]/40 text-[#C0C0C0]' };
    const labelKey = `swaps.status.${status}`;
    const label = t(labelKey);
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
        {label === labelKey ? status : label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#D4AF37] mx-auto mb-4"></div>
          <p className="text-[#C0C0C0]/60">{t('swaps.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal-deep text-white py-12 px-4 md:px-8 pt-28 selection:bg-gold-premium/30 selection:text-gold-light">
      <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-1000">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gold-premium/10 border border-gold-premium/30 rounded-full text-gold-premium text-xs font-semibold mb-4">
              <RefreshCw size={12} className="animate-spin-slow" /> {t('swaps.badge')}
            </div>
            <div>
              <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase leading-none text-luxury">
                {t('swaps.title.prefix')} <span className="text-gold-premium">{t('swaps.title.highlight')}</span>
              </h1>
              <p className="text-silver-premium/60 text-lg font-medium tracking-wide mt-1">
                {t('swaps.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/portal')}
            className="flex items-center justify-center gap-3 bg-charcoal-mid/50 text-gold-premium border border-gold-premium/20 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-gold-premium hover:text-charcoal-deep transition-all duration-500 shadow-xl active:scale-95"
          >
            <ArrowLeft size={16} /> {t('swaps.backToPortal')}
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-3 mt-8">
          <button
            onClick={() => setViewMode('list')}
            className={`px-6 py-3 rounded-xl font-semibold transition ${
              viewMode === 'list'
                ? 'bg-[#D4AF37] text-black'
                : 'bg-black/40 border border-[#D4AF37]/20 text-[#C0C0C0] hover:border-[#D4AF37]/40 hover:text-white'
            }`}
          >
            📋 {t('swaps.tabs.list')}
          </button>
          <button
            onClick={() => setViewMode('simulator')}
            className={`px-6 py-3 rounded-xl font-semibold transition ${
              viewMode === 'simulator'
                ? 'bg-[#D4AF37] text-black'
                : 'bg-black/40 border border-[#D4AF37]/20 text-[#C0C0C0] hover:border-[#D4AF37]/40 hover:text-white'
            }`}
          >
            🧮 {t('swaps.tabs.simulator')}
          </button>
          {isAdmin && (
            <button
              onClick={() => setViewMode('create')}
              className={`px-6 py-3 rounded-xl font-semibold transition ${
                viewMode === 'create'
                  ? 'bg-[#D4AF37] text-black'
                  : 'bg-black/40 border border-[#D4AF37]/20 text-[#C0C0C0] hover:border-[#D4AF37]/40 hover:text-white'
              }`}
            >
              ➕ {t('swaps.tabs.create')}
            </button>
          )}
        </div>

        {/* Lista de Swaps */}
        {viewMode === 'list' && (
          <div className="space-y-6">
            {swaps.length === 0 ? (
              <div className="bg-black/40 border border-[#D4AF37]/20 rounded-2xl p-12 text-center">
                <div className="text-6xl mb-4">🔄</div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  {t('swaps.empty.title')}
                </h3>
                <p className="text-[#C0C0C0]/60">
                  {t('swaps.empty.desc')}
                </p>
              </div>
            ) : (
              swaps.map((swap) => {
                const isUser1 = session.user.id === swap.user_1_id;
                const isUser2 = session.user.id === swap.user_2_id;
                const isParticipant = isUser1 || isUser2;
                const myFeePaid = isUser1 ? swap.guarantee_fee_1_paid : swap.guarantee_fee_2_paid;
                const myConfirmed = isUser1 ? swap.user_1_confirmed : swap.user_2_confirmed;

                return (
                  <div key={swap.swap_id} className="bg-black/40 border border-[#D4AF37]/20 rounded-2xl p-8">
                    {/* Header do Swap */}
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-2xl font-bold text-white">
                            Swap #{swap.swap_id.slice(0, 8)}
                          </h3>
                          {getStatusBadge(swap.status)}
                        </div>
                        <p className="text-[#C0C0C0]/50 text-sm">
                          {t('swaps.createdAt')} {new Date(swap.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      {isParticipant && swap.status !== 'concluido' && swap.status !== 'cancelado' && (
                          <button
                          onClick={() => handleCancelSwap(swap.swap_id)}
                          className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/20 hover:border-red-500/50 transition"
                        >
                            {t('swaps.actions.cancel')}
                        </button>
                      )}
                    </div>

                    {/* Participantes e Itens */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      {/* Usuário 1 */}
                      <div className="border border-[#D4AF37]/30 rounded-xl p-4 bg-black/20">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 bg-[#D4AF37] rounded-full flex items-center justify-center text-black font-bold">
                            {swap.user1?.profiles?.username?.[0]?.toUpperCase() || 'U1'}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-white">
                              {swap.user1?.profiles?.username || maskEmail(swap.user1?.email)}
                            </h4>
                            <div className="flex gap-2 mt-1">
                              {swap.guarantee_fee_1_paid ? (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                  ✓ {t('swaps.labels.feePaid')}
                                </span>
                              ) : (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                                  ⏳ {t('swaps.labels.feePending')}
                                </span>
                              )}
                              {swap.user_1_confirmed && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                  ✓ {t('swaps.labels.confirmed')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {swap.item1 && (
                          <div className="bg-black/30 border border-[#D4AF37]/10 rounded-lg p-3">
                            <div className="text-sm font-semibold text-white mb-1">
                              {swap.item1.title}
                            </div>
                            <div className="text-xs text-[#C0C0C0]/50">
                              {t('swaps.labels.condition')}: {swap.item1.condition}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Usuário 2 */}
                      <div className="border border-[#D4AF37]/30 rounded-xl p-4 bg-black/20">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 bg-[#C0C0C0] rounded-full flex items-center justify-center text-black font-bold">
                            {swap.user2?.profiles?.username?.[0]?.toUpperCase() || 'U2'}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-white">
                              {swap.user2?.profiles?.username || maskEmail(swap.user2?.email)}
                            </h4>
                            <div className="flex gap-2 mt-1">
                              {swap.guarantee_fee_2_paid ? (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                  ✓ {t('swaps.labels.feePaid')}
                                </span>
                              ) : (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                                  ⏳ {t('swaps.labels.feePending')}
                                </span>
                              )}
                              {swap.user_2_confirmed && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                  ✓ {t('swaps.labels.confirmed')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {swap.item2 && (
                          <div className="bg-black/30 border border-[#D4AF37]/10 rounded-lg p-3">
                            <div className="text-sm font-semibold text-white mb-1">
                              {swap.item2.title}
                            </div>
                            <div className="text-xs text-[#C0C0C0]/50">
                              {t('swaps.labels.condition')}: {swap.item2.condition}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Informações Financeiras */}
                    <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-xl p-4 mb-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-[#D4AF37]">
                            R$ {Number(swap.guarantee_fee_amount).toFixed(2)}
                          </div>
                          <div className="text-xs text-[#C0C0C0]/60">{t('swaps.fee.perPerson')}</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-[#F4E4BC]">
                            R$ {(Number(swap.guarantee_fee_amount) * 2).toFixed(2)}
                          </div>
                          <div className="text-xs text-[#C0C0C0]/60">{t('swaps.fee.totalInCustody')}</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-400">
                            {settings && (
                              <>R$ {(Number(swap.guarantee_fee_amount) * 2 * (100 - Number(settings.swap_guarantee_portal_pct)) / 100).toFixed(2)}</>
                            )}
                          </div>
                          <div className="text-xs text-[#C0C0C0]/60">{t('swaps.fee.totalRefund')}</div>
                        </div>
                      </div>
                    </div>

                    {/* Ações do Participante */}
                    {isParticipant && swap.status !== 'concluido' && swap.status !== 'cancelado' && (
                      <div className="flex gap-3">
                        {!myFeePaid && swap.status === 'aguardando_taxas' && (
                          <button
                            onClick={() => handlePayGuarantee(swap.swap_id)}
                            className="flex-1 px-6 py-3 bg-[#D4AF37] text-black rounded-xl font-semibold hover:bg-[#B8860B] transition"
                          >
                            💳 {t('swaps.actions.payGuarantee')}
                          </button>
                        )}
                        {myFeePaid && !myConfirmed && swap.status !== 'aguardando_taxas' && (
                          <button
                            onClick={() => handleConfirmReceipt(swap.swap_id)}
                            className="flex-1 px-6 py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition"
                          >
                            ✅ {t('swaps.actions.confirmReceipt')}
                          </button>
                        )}
                        {myFeePaid && myConfirmed && (
                          <div className="flex-1 px-6 py-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl font-semibold text-center">
                            ⏳ {t('swaps.status.waitingOtherParty')}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Status de Conclusão */}
                    {swap.status === 'concluido' && (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                        <div className="text-green-400 font-semibold">
                          ✅ {t('swaps.completedAt')} {new Date(swap.completed_at).toLocaleDateString('pt-BR')}
                        </div>
                        {settings && (
                          <div className="text-sm text-[#C0C0C0]/60 mt-2">
                            {t('swaps.fee.individualRefundLabel')} R$ {(Number(swap.guarantee_fee_amount) * (100 - Number(settings.swap_guarantee_portal_pct)) / 100).toFixed(2)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Simulador */}
        {viewMode === 'simulator' && (
          <div className="bg-black/40 border border-[#D4AF37]/20 rounded-2xl p-8">
            <h2 className="text-3xl font-bold text-white mb-6">
              🧮 {t('swaps.simulator.title')}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Controles */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    {t('swaps.simulator.guaranteeFeePerPerson')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={simulatorData.guaranteeFee}
                    onChange={(e) => setSimulatorData({ ...simulatorData, guaranteeFee: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-black/40 border border-[#D4AF37]/30 rounded-xl focus:border-[#D4AF37] outline-none text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    {t('swaps.simulator.portalKeepPct')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={simulatorData.portalKeepPct}
                    onChange={(e) => setSimulatorData({ ...simulatorData, portalKeepPct: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-black/40 border border-[#D4AF37]/30 rounded-xl focus:border-[#D4AF37] outline-none text-white"
                  />
                </div>

                <div className="border-t border-[#D4AF37]/20 pt-6">
                  <h3 className="font-semibold text-white mb-4">{t('swaps.simulator.paymentStatus')}</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={simulatorData.user1Paid}
                        onChange={(e) => setSimulatorData({ ...simulatorData, user1Paid: e.target.checked })}
                        className="w-5 h-5 text-[#D4AF37]"
                      />
                      <span className="text-[#C0C0C0]">{t('swaps.simulator.user1Paid')}</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={simulatorData.user2Paid}
                        onChange={(e) => setSimulatorData({ ...simulatorData, user2Paid: e.target.checked })}
                        className="w-5 h-5 text-[#D4AF37]"
                      />
                      <span className="text-[#C0C0C0]">{t('swaps.simulator.user2Paid')}</span>
                    </label>
                  </div>
                </div>

                <div className="border-t border-[#D4AF37]/20 pt-6">
                  <h3 className="font-semibold text-white mb-4">{t('swaps.simulator.confirmationStatus')}</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={simulatorData.user1Confirmed}
                        onChange={(e) => setSimulatorData({ ...simulatorData, user1Confirmed: e.target.checked })}
                        className="w-5 h-5 text-green-500"
                        disabled={!simulatorResults.bothPaid}
                      />
                      <span className={simulatorResults.bothPaid ? 'text-[#C0C0C0]' : 'text-[#C0C0C0]/40'}>
                        {t('swaps.simulator.user1Confirmed')}
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={simulatorData.user2Confirmed}
                        onChange={(e) => setSimulatorData({ ...simulatorData, user2Confirmed: e.target.checked })}
                        className="w-5 h-5 text-green-500"
                        disabled={!simulatorResults.bothPaid}
                      />
                      <span className={simulatorResults.bothPaid ? 'text-[#C0C0C0]' : 'text-[#C0C0C0]/40'}>
                        {t('swaps.simulator.user2Confirmed')}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Resultados */}
              <div className="space-y-6">
                <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-xl p-6">
                  <h3 className="font-semibold text-white mb-4">💰 {t('swaps.simulator.financialCalc')}</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-[#C0C0C0]/70">{t('swaps.simulator.feePerPerson')}:</span>
                      <span className="font-bold text-white">
                        R$ {simulatorData.guaranteeFee.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#C0C0C0]/70">{t('swaps.simulator.totalInCustody')}:</span>
                      <span className="font-bold text-[#D4AF37]">
                        R$ {simulatorResults.totalGuarantee.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-[#D4AF37]/20 pt-2">
                      <span className="text-[#C0C0C0]/70">{t('swaps.simulator.portalKeeps')} ({simulatorData.portalKeepPct}%):</span>
                      <span className="font-bold text-red-400">
                        R$ {simulatorResults.portalKeep.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#C0C0C0]/70">{t('swaps.simulator.totalRefund')}:</span>
                      <span className="font-bold text-green-400">
                        R$ {simulatorResults.userRefund.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#C0C0C0]/70">{t('swaps.simulator.refundPerPerson')}:</span>
                      <span className="font-bold text-green-400">
                        R$ {simulatorResults.perUserRefund.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6">
                  <h3 className="font-semibold text-white mb-4">📊 {t('swaps.simulator.swapStatus')}</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${simulatorResults.bothPaid ? 'bg-green-500' : 'bg-[#C0C0C0]/20'}`}></div>
                      <span className="text-[#C0C0C0]">{t('swaps.simulator.bothPaid')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${simulatorResults.readyToShip ? 'bg-green-500' : 'bg-[#C0C0C0]/20'}`}></div>
                      <span className="text-[#C0C0C0]">{t('swaps.simulator.readyToShip')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${simulatorResults.bothConfirmed ? 'bg-green-500' : 'bg-[#C0C0C0]/20'}`}></div>
                      <span className="text-[#C0C0C0]">{t('swaps.simulator.bothConfirmed')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${simulatorResults.completed ? 'bg-green-500' : 'bg-[#C0C0C0]/20'}`}></div>
                      <span className="text-[#C0C0C0]">{t('swaps.simulator.completed')}</span>
                    </div>
                  </div>
                </div>

                {simulatorResults.completed && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6">
                    <div className="text-center">
                      <div className="text-4xl mb-2">✅</div>
                      <div className="font-bold text-green-400 text-lg mb-2">
                        {t('swaps.simulator.successTitle')}
                      </div>
                      <div className="text-sm text-[#C0C0C0]/70">
                        {t('swaps.simulator.successDescPrefix')} R$ {simulatorResults.perUserRefund.toFixed(2)} {t('swaps.simulator.successDescSuffix')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Admin: Criar Swap */}
        {viewMode === 'create' && isAdmin && (
          <div className="bg-black/40 border border-[#D4AF37]/20 rounded-2xl p-8">
            <h2 className="text-3xl font-bold text-white mb-6">
              ➕ {t('swaps.adminCreate.title')}
            </h2>
            <p className="text-[#C0C0C0]/70 mb-6">
              {t('swaps.adminCreate.desc')}
            </p>
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6">
              <h3 className="font-semibold text-[#4A9EFF] mb-2">💡 {t('swaps.adminCreate.howItWorks')}</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-[#C0C0C0]/70">
                <li>{t('swaps.adminCreate.steps.1')}</li>
                <li>{t('swaps.adminCreate.steps.2')}</li>
                <li>{t('swaps.adminCreate.steps.3')} (R$ {settings?.swap_guarantee_fee_fixed || 10})</li>
                <li>{t('swaps.adminCreate.steps.4')}</li>
                <li>{t('swaps.adminCreate.steps.5')}</li>
                <li>{t('swaps.adminCreate.steps.6')} {settings ? (100 - Number(settings.swap_guarantee_portal_pct)) : 0}%</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
