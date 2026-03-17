import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreditCard, Crown, Gem, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import PaymentGateway from '../components/PaymentGateway';
import { useI18n } from '../contexts/I18nContext.jsx';
import { useSubscription } from '../contexts/SubscriptionContext.jsx';

export default function CheckoutDynamic() {
  const { t, formatCurrency, exchangeRate, locale } = useI18n();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const mode = (searchParams.get('mode') || 'acervo').toLowerCase();
  const planId = (searchParams.get('plan') || localStorage.getItem('rg_plan_tier_v1') || '').toLowerCase();
  const itemId = searchParams.get('itemId') || searchParams.get('item_id');

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const { plans: dbPlans, profile, refresh } = useSubscription();

  const [paying, setPaying] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState(null);
  const [availableGateways, setAvailableGateways] = useState([]);

  const prefersUsd = useMemo(() => {
    const country = String(profile?.country_code || '').toUpperCase();
    if (country && country !== 'BR') return true;
    if (locale === 'en-US') return true;
    return false;
  }, [locale, profile?.country_code]);

  const currency = prefersUsd ? 'USD' : 'BRL';

  const plan = useMemo(() => {
    const db = (dbPlans || []).find((p) => p.plan_id === planId);
    if (!db) return null;

    const icon = db.plan_id === 'high_guardian' ? Crown : db.plan_id === 'keeper' ? Gem : Gem;
    const accent =
      db.plan_id === 'high_guardian'
        ? 'from-purple-500/30 to-fuchsia-500/15 border-purple-500/40'
        : db.plan_id === 'keeper'
        ? 'from-fuchsia-500/30 to-purple-500/20 border-fuchsia-500/40'
        : 'from-white/10 to-white/5 border-white/20';

    const amountBRL = Number(db.price_brl || 0);
    const amountUSD = Number(db.price_usd || 0);

    let displayAmount = amountBRL;
    if (currency === 'USD') {
      if (amountUSD > 0) displayAmount = amountUSD;
      else {
        const rate = Number(exchangeRate || 0);
        displayAmount = rate > 0 ? amountBRL / rate : 0;
      }
    }

    return {
      id: db.plan_id,
      title: String(db.name || '').toUpperCase() || db.plan_id.toUpperCase(),
      label: db.name || db.plan_id.toUpperCase(),
      description: db.description || '',
      userLevel: Number(db.user_level || 0),
      amount: displayAmount,
      icon,
      accent
    };
  }, [currency, dbPlans, exchangeRate, planId]);

  const isSubscription = mode === 'subscription';

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          toast.error('Faça login para continuar');
          navigate('/');
          return;
        }
        setUser(authUser);

        if (!isSubscription) {
          if (itemId) navigate(`/checkout/${itemId}`);
          else navigate('/catalogo');
          return;
        }

        if (!plan) {
          toast.error(t('plans.selectFirst') || 'Selecione um plano para continuar.');
          navigate('/plans');
          return;
        }
        await refresh();

        const { data: settingsData } = await supabase
          .from('platform_settings')
          .select('*')
          .single();

        const finalSettings = settingsData || {
          gateway_provider: 'stripe',
          gateway_mode: 'sandbox'
        };

        const available = [];
        const isSandbox = finalSettings.gateway_mode !== 'production';

        // Stripe
        const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
        if ((!finalSettings.gateway_provider || finalSettings.gateway_provider === 'stripe') && stripeKey) {
          available.push({
            id: 'stripe',
            name: isSandbox ? 'Stripe (Teste)' : 'Cartão de Crédito',
            icon: CreditCard
          });
        }

        // Mercado Pago
        const mpKey = import.meta.env.VITE_MP_PUBLIC_KEY;
        if (finalSettings.gateway_provider === 'mercado_pago' && mpKey) {
          available.push({
            id: 'mercado_pago',
            name: isSandbox ? 'Mercado Pago (Teste)' : 'Mercado Pago',
            icon: CreditCard
          });
        }

        // PayPal
        const paypalKey = import.meta.env.VITE_PAYPAL_CLIENT_ID;
        if (finalSettings.gateway_provider === 'paypal' && paypalKey) {
          available.push({
            id: 'paypal',
            name: isSandbox ? 'PayPal (Teste)' : 'PayPal',
            icon: CreditCard
          });
        }

        setAvailableGateways(available);
        if (available.length > 0) setSelectedGateway(available[0].id);
      } catch (e) {
        toast.error('Erro ao iniciar checkout', { description: e.message });
        navigate('/plans');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [isSubscription, itemId, navigate, plan, refresh, t]);

  const displayedGateways = useMemo(() => {
    if (!availableGateways || availableGateways.length === 0) return [];
    if (!selectedGateway) return availableGateways;
    const g = availableGateways.find((x) => x.id === selectedGateway);
    return g ? [g] : availableGateways;
  }, [availableGateways, selectedGateway]);

  const amount = useMemo(() => {
    if (!plan) return 0;
    return plan.amount;
  }, [plan]);

  const transactionId = useMemo(() => {
    if (!user?.id || !plan?.id) return null;
    return `SUBS-${plan.id}-${user.id}-${Date.now()}`;
  }, [user?.id, plan?.id]);

  const handlePaymentSuccess = async (paymentData) => {
    setPaying(true);
    try {
      toast.success(t('checkout.subscription.success.title') || 'PAGAMENTO CONFIRMADO', {
        description: t('checkout.subscription.success.desc') || 'Liberando acesso ao Sarcófago...',
        duration: 5000,
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });

      const params = new URLSearchParams({
        mode: 'subscription',
        plan: plan.id,
        payment_provider: paymentData.provider || 'stripe',
        payment_id: paymentData.paymentId || '',
        external_reference: transactionId || ''
      });

      navigate(`/payment/success?${params.toString()}`);
    } finally {
      setPaying(false);
    }
  };

  const handlePaymentError = (error) => {
    toast.error(t('checkout.subscription.error.title') || 'ERRO NO PAGAMENTO', {
      description: error?.message || t('checkout.subscription.error.desc') || 'Tente novamente.',
      style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-400" />
      </div>
    );
  }

  const Icon = plan?.icon || Gem;

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-12">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute -top-40 -left-40 w-[560px] h-[560px] bg-fuchsia-600/15 blur-[140px]" />
        <div className="absolute top-10 right-[-160px] w-[680px] h-[680px] bg-purple-600/14 blur-[160px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 md:px-6 space-y-10">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-fuchsia-500/30 bg-white/5 text-[10px] font-black uppercase tracking-[0.22em]">
            <Sparkles className="w-4 h-4 text-fuchsia-400" />
            {t('checkout.subscription.badge') || 'CHECKOUT GROOVEFLIX'}
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter">
            {t('checkout.subscription.title') || 'Finalizando seu'}{' '}
            <span className="text-fuchsia-400">{t('checkout.subscription.title2') || 'Ritual de Guardião'}</span>
          </h1>
          <p className="text-white/55 text-sm max-w-2xl">
            {t('checkout.subscription.subtitle') || 'Confirme o plano e finalize o pagamento. Assim que aprovado, a catraca libera o Sarcófago.'}
          </p>
        </header>

        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-8 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/60">
                  <Icon className="w-4 h-4 text-fuchsia-400" />
                  {t('checkout.subscription.planLabel') || 'Plano Selecionado'}
                </div>
                <div className="text-2xl font-black tracking-tight">
                  {plan.label}
                </div>
              </div>
              <div className="text-right">
                <div className="text-white/50 text-[10px] font-black uppercase tracking-widest">
                  {t('checkout.subscription.total') || 'Total'}
                </div>
                <div className="text-3xl font-black text-white">
                  {formatCurrency(amount, currency)}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/50">
                {t('checkout.subscription.gateway') || 'Método de Pagamento'}
              </div>
              <div className="flex flex-wrap gap-2">
                {availableGateways.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGateway(g.id)}
                    className={`px-4 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition ${
                      selectedGateway === g.id
                        ? 'bg-gradient-to-r from-fuchsia-500/20 to-purple-500/10 border-fuchsia-500/40 text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>

            {!showPayment && (
              <button
                type="button"
                disabled={displayedGateways.length === 0 || paying}
                onClick={() => setShowPayment(true)}
                className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.22em] text-xs border transition bg-gradient-to-r ${plan.accent} hover:opacity-95 disabled:opacity-30`}
              >
                <CreditCard className="inline mr-2 w-5 h-5" />
                {t('checkout.subscription.cta') || 'Confirmar e Pagar'}
              </button>
            )}

            {showPayment && (
              <div className="space-y-4">
                <PaymentGateway
                  amount={amount}
                  selectedGateway={selectedGateway}
                  currency={currency}
                  metadata={{
                    transactionType: 'subscription',
                    plan_id: plan.id,
                    user_level: plan.userLevel,
                    buyerId: user?.id,
                    buyerEmail: user?.email,
                    itemTitle: `GROOVEFLIX • ${plan.title}`,
                    transactionId,
                    currency
                  }}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
                <button
                  type="button"
                  onClick={() => setShowPayment(false)}
                  className="w-full text-white/60 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
                >
                  {t('checkout.subscription.back') || 'Voltar'}
                </button>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-8 space-y-4">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/50">
              {t('checkout.subscription.noteTitle') || 'Aviso'}
            </div>
            <p className="text-white/60 text-sm">
              {t('checkout.subscription.noteBody') || 'A liberação do acesso ocorre automaticamente após a confirmação do gateway. Se demorar alguns segundos, o sistema faz sincronização via webhook.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
