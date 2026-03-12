import React, { useMemo, useState } from 'react';
import { Crown, Gem, Shield, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '../contexts/I18nContext.jsx';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function Plans() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selected, setSelected] = useState(null);
  const [restrictedOpen, setRestrictedOpen] = useState(() => searchParams.get('restricted') === '1');

  const plans = useMemo(() => ([
    {
      id: 'digger',
      title: t('plans.digger.title') || 'DIGGER',
      price: t('plans.digger.price') || 'Grátis',
      badge: t('plans.digger.badge') || 'Entrada',
      accent: 'border-white/10',
      icon: Shield,
      features: [
        t('plans.digger.f1') || 'Acesso ao Marketplace',
        t('plans.digger.f2') || '5 imortalizações de teste',
        t('plans.digger.f3') || 'Biblioteca pessoal (limitada)',
      ],
      cta: t('plans.digger.cta') || 'Entrar no Groove',
    },
    {
      id: 'keeper',
      title: t('plans.keeper.title') || 'KEEPER',
      price: t('plans.keeper.price') || 'Pro',
      badge: t('plans.keeper.badge') || 'Prata',
      accent: 'border-fuchsia-500/30 gf-glow',
      icon: Gem,
      features: [
        t('plans.keeper.f1') || 'Até 100 CDs imortalizados',
        t('plans.keeper.f2') || 'Streaming Hi‑Fi (Mobile)',
        t('plans.keeper.f3') || 'Selo Prata no perfil',
      ],
      cta: t('plans.keeper.cta') || 'Virar Keeper',
      highlight: true,
    },
    {
      id: 'high_guardian',
      title: t('plans.high.title') || 'HIGH GUARDIAN',
      price: t('plans.high.price') || 'Elite',
      badge: t('plans.high.badge') || 'Ouro Neon',
      accent: 'border-purple-500/30',
      icon: Crown,
      features: [
        t('plans.high.f1') || 'CDs ilimitados',
        t('plans.high.f2') || 'Streaming Bit‑Perfect',
        t('plans.high.f3') || 'Ouvir itens públicos da comunidade',
        t('plans.high.f4') || 'Selo Ouro com brilho neon',
      ],
      cta: t('plans.high.cta') || 'Virar Guardian',
    },
  ]), [t]);

  const pick = (planId) => {
    setSelected(planId);
    localStorage.setItem('rg_plan_tier_v1', planId);
    toast.success(t('plans.saved.title') || 'PLANO SELECIONADO', {
      description: t('plans.saved.desc') || 'Checkout de assinatura entra na próxima etapa.',
      style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
    });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] bg-fuchsia-600/12 blur-[120px]" />
        <div className="absolute top-10 right-[-160px] w-[620px] h-[620px] bg-purple-600/10 blur-[140px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 md:px-6 pt-28 pb-20 space-y-10">
        {restrictedOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setRestrictedOpen(false)}
            />
            <div className="relative w-full max-w-lg rounded-3xl border border-fuchsia-500/30 bg-black/90 p-6 md:p-8 gf-glow">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-fuchsia-500/30 bg-white/5 text-[10px] font-black uppercase tracking-[0.22em]">
                <Sparkles className="w-4 h-4 text-fuchsia-400" />
                {t('plans.restricted.badge') || 'ACESSO RESTRITO'}
              </div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-4">
                {t('plans.restricted.title') || 'A Catraca Bloqueou o Sarcófago'}
              </h2>
              <p className="text-white/60 text-sm mt-2">
                {t('plans.restricted.body') || 'Para entrar no Grooveflix, ative um plano Guardião com assinatura ativa.'}
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setRestrictedOpen(false)}
                  className="flex-1 py-3 rounded-2xl font-black uppercase tracking-[0.22em] text-[10px] border border-white/10 text-white/70 hover:text-white hover:border-white/20 transition"
                >
                  {t('plans.restricted.close') || 'Ver Planos'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRestrictedOpen(false);
                    navigate('/checkout?mode=subscription&plan=keeper');
                  }}
                  className="flex-1 py-3 rounded-2xl font-black uppercase tracking-[0.22em] text-[10px] border border-fuchsia-500/40 bg-gradient-to-r from-fuchsia-500/25 to-purple-500/15 text-white hover:border-fuchsia-500/70 transition"
                >
                  {t('plans.restricted.cta') || 'Ativar Keeper'}
                </button>
              </div>
            </div>
          </div>
        )}

        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-fuchsia-500/30 bg-white/5 text-[10px] font-black uppercase tracking-[0.22em]">
            <Sparkles className="w-4 h-4 text-fuchsia-400" />
            {t('plans.badge') || 'GUARDIÕES DO SARCOFÁGO'}
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter">
            {t('plans.title') || 'Assinaturas'} <span className="text-fuchsia-400">GROOVEFLIX</span>
          </h1>
          <p className="text-white/55 text-sm md:text-base max-w-2xl">
            {t('plans.subtitle') || 'Escolha seu nível de Guardião para imortalizar e ouvir sua coleção com estética Hi‑Fi.'}
          </p>
        </header>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((p) => {
            const Icon = p.icon;
            const isSelected = selected === p.id;
            return (
              <div
                key={p.id}
                className={`rounded-3xl border bg-white/5 backdrop-blur-xl p-6 space-y-5 transition ${p.accent} ${p.highlight ? 'bg-gradient-to-b from-fuchsia-500/10 to-black/40' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/60">
                      <Icon className="w-4 h-4 text-fuchsia-400" />
                      {p.badge}
                    </div>
                    <div className="text-2xl font-black tracking-tight">
                      {p.title}
                    </div>
                    <div className="text-white/50 text-sm">
                      {p.price}
                    </div>
                  </div>
                  {p.highlight ? (
                    <div className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-300">
                      {t('plans.recommended') || 'Recomendado'}
                    </div>
                  ) : null}
                </div>

                <ul className="space-y-2 text-sm text-white/70">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-fuchsia-400 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-2 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      pick(p.id);
                      if (p.id !== 'digger') navigate(`/checkout?mode=subscription&plan=${encodeURIComponent(p.id)}`);
                    }}
                    className={`w-full py-4 rounded-2xl font-black uppercase tracking-[0.22em] text-xs border transition ${
                      p.highlight
                        ? 'bg-gradient-to-r from-fuchsia-500/30 to-purple-500/20 border-fuchsia-500/40 hover:border-fuchsia-500/70'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    } ${isSelected ? 'ring-2 ring-fuchsia-500/30' : ''}`}
                  >
                    {p.cta}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/grooveflix')}
                    className="w-full py-3 rounded-2xl font-black uppercase tracking-[0.22em] text-[10px] border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition"
                  >
                    {t('plans.preview') || 'Ver Grooveflix'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-8">
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-white/60 mb-2">
            {t('plans.note.title') || 'Nota'}
          </div>
          <p className="text-white/60 text-sm">
            {t('plans.note.body') || 'O checkout de pagamento e a validação automática de uploads entram na próxima fase. Por enquanto, esta tela define o plano escolhido e libera a navegação do Grooveflix.'}
          </p>
        </div>
      </div>
    </div>
  );
}

