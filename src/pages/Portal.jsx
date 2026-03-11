import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, FileText, Lock, Truck, Users, AlertTriangle,
  ChevronDown, ChevronRight, ExternalLink, Mail, LogOut
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useI18n } from '../contexts/I18nContext.jsx';

// Importando nossos componentes modulares
import { Section, SubSection, Li, InfoBox, Pill } from '../components/UIComponents';
import { CompareTable } from '../components/CompareTable';

// ── Componente FAQ Accordion ──────────────────────────────────────────────────
function FAQ({ q, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#D4AF37]/20 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left text-white font-semibold hover:bg-[#D4AF37]/5 transition-colors">
        {q}
        {open ? <ChevronDown size={16} className="text-[#D4AF37]" /> : <ChevronRight size={16} className="text-[#D4AF37]" />}
      </button>
      {open && <div className="px-4 pb-4 text-[#C0C0C0]/70 text-sm border-t border-[#D4AF37]/10 pt-4">{children}</div>}
    </div>
  );
}

const DOC_SECTIONS = [
  { id: 'sobre', label: 'Sobre a Plataforma', icon: Shield },
  { id: 'termos', label: 'Termos de Serviço', icon: FileText },
  { id: 'privacidade', label: 'Privacidade & LGPD', icon: Lock },
  { id: 'comunidade', label: 'Política da Comunidade', icon: Users },
  { id: 'envios', label: 'Política de Envios', icon: Truck },
  { id: 'dmca', label: 'DMCA & Direitos Autorais', icon: AlertTriangle },
];

export default function Portal() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('sobre');
  const [isAdmin, setIsAdmin] = useState(false);
  const { t } = useI18n();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.message('SESSÃO ENCERRADA', {
      description: 'A porta do cofre foi trancada com sucesso.',
    });
  };

  const scrollTo = (id) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const loadAdminFlag = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;

      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      setIsAdmin(Boolean(data?.is_admin));
    };

    loadAdminFlag();
  }, []);

  useEffect(() => {
    const key = 'rg_visit_counted_v1';
    if (sessionStorage.getItem(key) === '1') return;
    sessionStorage.setItem(key, '1');

    const increment = async () => {
      const { data, error } = await supabase.rpc('increment_total_visits');
      if (!error && typeof data === 'number') return;

      const { data: existing, error: readError } = await supabase
        .from('site_stats')
        .select('id, total_visits')
        .eq('id', 1)
        .maybeSingle();

      if (readError) return;

      if (!existing) {
        await supabase.from('site_stats').insert([{ id: 1, total_visits: 1 }]);
        return;
      }

      const next = Number(existing.total_visits || 0) + 1;
      await supabase.from('site_stats').update({ total_visits: next, updated_at: new Date().toISOString() }).eq('id', 1);
    };

    increment();
  }, []);

  return (
    <div className="min-h-screen bg-charcoal-deep text-white selection:bg-gold-premium/30 selection:text-gold-light">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-gold-premium/10 bg-gradient-to-b from-charcoal-mid to-charcoal-deep px-4 md:px-6 py-12 pt-28">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, #D4AF37 0%, transparent 60%), radial-gradient(circle at 80% 20%, #D4AF37 0%, transparent 40%)'
        }} />
        <div className="max-w-4xl mx-auto text-center relative animate-in fade-in zoom-in duration-1000">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold-premium/5 border border-gold-premium/20 rounded-full text-gold-premium text-[11px] font-black uppercase tracking-[0.3em] mb-8 shadow-2xl">
            <Shield size={14} className="animate-pulse" /> {t('portal.hero.badge')}
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter leading-tight text-luxury drop-shadow-2xl">
            RAREGROOVE
          </h1>
          <p className="text-silver-premium/80 text-xl md:text-2xl font-medium mb-4 max-w-2xl mx-auto tracking-tight">
            {t('portal.hero.subtitle1')}
          </p>
          <p className="text-silver-premium/40 text-sm font-light uppercase tracking-widest mb-10">
            {t('portal.hero.subtitle2')}
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <Pill color="green">{t('portal.hero.pill.lgpd')}</Pill>
            <Pill color="gold">{t('portal.hero.pill.dmca')}</Pill>
            <Pill color="blue">{t('portal.hero.pill.custody')}</Pill>
            <Pill color="green">{t('portal.hero.pill.cdc')}</Pill>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-12 py-16 flex flex-col lg:flex-row gap-12">
        {/* Enhanced Sidebar Nav */}
        <aside className="lg:w-72 shrink-0">
          <div className="sticky top-24 space-y-2 glass-card rounded-[2rem] p-6 shadow-2xl">
            <p className="text-[10px] text-gold-premium/50 uppercase tracking-[0.4em] font-black px-4 mb-6">
              {t('portal.sidebar.title')}
            </p>
            <div className="space-y-1.5">
              {DOC_SECTIONS.map(s => (
                <button key={s.id} onClick={() => scrollTo(s.id)}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm transition-all duration-300 group
                    ${activeSection === s.id
                      ? 'bg-gold-premium text-charcoal-deep font-bold shadow-[0_0_20px_rgba(212,175,55,0.3)]'
                      : 'text-silver-premium/50 hover:text-gold-premium hover:bg-gold-premium/5'
                    }`}>
                  <s.icon size={18} className={`${activeSection === s.id ? 'scale-110' : 'group-hover:scale-110'} transition-transform`} />
                  <span className="tracking-tight">{t(`portal.section.${s.id}`)}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 space-y-24 min-w-0">
          {/* SOBRE */}
          <Section id="sobre" icon={Shield} title={t('portal.section.sobre')}>
            <div className="glass-card rounded-[2.5rem] p-8 md:p-12 mb-12 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gold-premium/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-gold-premium/10 transition-colors duration-700" />
              <div className="relative italic text-silver-premium/80 text-center text-lg md:text-xl font-medium leading-relaxed max-w-2xl mx-auto tracking-tight">
                "{t('portal.about.quote')}"
              </div>
            </div>

            <SubSection title={t('portal.about.how.title')}>
              <div className="grid sm:grid-cols-2 gap-6">
                {t('portal.about.how.items').split(';').map((pair, i) => {
                  const [title, desc] = pair.split('|');
                  return (
                    <div key={i} className="glass-card p-6 rounded-3xl hover:border-gold-premium/30 transition-all duration-500 group">
                      <div className="flex items-start gap-5">
                        <span className="w-10 h-10 rounded-2xl bg-gold-premium/10 text-gold-premium text-sm font-black flex items-center justify-center shrink-0 group-hover:bg-gold-premium group-hover:text-charcoal-deep transition-all duration-500 shadow-xl">
                          {i + 1}
                        </span>
                        <div>
                          <h4 className="text-white font-bold mb-1 tracking-tight">{title}</h4>
                          <p className="text-silver-premium/50 text-xs leading-relaxed">{desc}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SubSection>

            <SubSection title={t('portal.about.compare.title')}>
              <CompareTable />
            </SubSection>

            <SubSection title={t('portal.about.compliance.title')}>
              <ul className="space-y-1">
                {t('portal.about.compliance.items').split(';').map((item, i) => <Li key={i}>{item}</Li>)}
              </ul>
            </SubSection>
          </Section>

          {/* TERMOS DE SERVIÇO */}
          <Section id="termos" icon={FileText} title={t('portal.section.termos')}>
            <p className="text-[#C0C0C0]/50 text-xs mb-6">{t('portal.terms.lastUpdate')}</p>

            <InfoBox type="warning">
              <strong>{t('portal.terms.warningTitle')}</strong> {t('portal.terms.warningBody')}
            </InfoBox>

            <SubSection title={t('portal.terms.section1.title')}>
              <p className="text-[#C0C0C0]/70 text-sm">{t('portal.terms.section1.body')}</p>
            </SubSection>

            <SubSection title={t('portal.terms.section2.title')}>
              <ul className="space-y-1">
                <Li>{t('portal.terms.section2.items.custody')}</Li>
                <Li>{t('portal.terms.section2.items.authenticity')}</Li>
                <Li>{t('portal.terms.section2.items.condition')}</Li>
                <Li>{t('portal.terms.section2.items.tracking')}</Li>
                <Li>{t('portal.terms.section2.items.mediation')}</Li>
              </ul>
            </SubSection>

            <SubSection title={t('portal.terms.section3.title')}>
              <ul className="space-y-1">
                <Li>{t('portal.terms.section3.items.scale')}</Li>
                <Li>{t('portal.terms.section3.items.photos')}</Li>
                <Li>{t('portal.terms.section3.items.defects')}</Li>
                <Li>{t('portal.terms.section3.items.shippingTime')}</Li>
                <Li>{t('portal.terms.section3.items.tracking')}</Li>
                <Li>{t('portal.terms.section3.items.counterfeit')}</Li>
              </ul>
            </SubSection>

            <SubSection title={t('portal.terms.section4.title')}>
              <div className="bg-black/40 border border-[#D4AF37]/10 rounded-xl p-4">
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs text-center">
                  {[
                    [t('portal.terms.section4.timeline.day1'), t('portal.terms.section4.timeline.day1.desc'), 'blue'],
                    [t('portal.terms.section4.timeline.days1_3'), t('portal.terms.section4.timeline.days1_3.desc'), 'purple'],
                    [t('portal.terms.section4.timeline.days4_8'), t('portal.terms.section4.timeline.days4_8.desc'), 'orange'],
                    [t('portal.terms.section4.timeline.day8'), t('portal.terms.section4.timeline.day8.desc'), 'green'],
                    [t('portal.terms.section4.timeline.days9_10'), t('portal.terms.section4.timeline.days9_10.desc'), 'green'],
                  ].map(([day, desc, color]) => (
                    <div key={day} className="bg-black/60 border border-[#D4AF37]/10 rounded-lg p-3">
                      <p className="text-[#D4AF37] font-bold mb-1">{day}</p>
                      <p className="text-[#C0C0C0]/60">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </SubSection>

            <SubSection title={t('portal.terms.section5.title')}>
              <ol className="space-y-1 list-none">
                {[
                  t('portal.terms.section5.steps.1'),
                  t('portal.terms.section5.steps.2'),
                  t('portal.terms.section5.steps.3'),
                  t('portal.terms.section5.steps.4'),
                  t('portal.terms.section5.steps.5'),
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-[#C0C0C0]/70">
                    <span className="text-[#D4AF37] font-bold shrink-0">{i + 1}.</span>
                    {item}
                  </li>
                ))}
              </ol>
            </SubSection>

            <SubSection title={t('portal.terms.section6.title')}>
              <p className="text-[#C0C0C0]/70 text-sm mb-2">{t('portal.terms.section6.lead')}</p>
              <ul className="space-y-1">
                <Li>{t('portal.terms.section6.items.suspend')}</Li>
                <Li>{t('portal.terms.section6.items.retain')}</Li>
                <Li>{t('portal.terms.section6.items.ban')}</Li>
                <Li>{t('portal.terms.section6.items.report')}</Li>
              </ul>
            </SubSection>

            <SubSection title={t('portal.terms.section7.title')}>
              <p className="text-[#C0C0C0]/70 text-sm">{t('portal.terms.section7.body')}</p>
            </SubSection>
          </Section>

          {/* PRIVACIDADE */}
          <Section id="privacidade" icon={Lock} title={t('portal.section.privacidade')}>
            <p className="text-[#C0C0C0]/50 text-xs mb-6">{t('portal.privacy.lastUpdate')}</p>

            <SubSection title={t('portal.privacy.section.collect.title')}>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-green-400 text-xs font-semibold mb-2 uppercase">{t('portal.privacy.section.collect.what')}</p>
                  <ul className="space-y-1">
                    <Li>{t('portal.privacy.collect.items.nameEmail')}</Li>
                    <Li>{t('portal.privacy.collect.items.ip')}</Li>
                    <Li>{t('portal.privacy.collect.items.timestamps')}</Li>
                    <Li>{t('portal.privacy.collect.items.ua')}</Li>
                    <Li>{t('portal.privacy.collect.items.history')}</Li>
                  </ul>
                </div>
                <div>
                  <p className="text-red-400 text-xs font-semibold mb-2 uppercase">{t('portal.privacy.section.collect.not')}</p>
                  <ul className="space-y-1">
                    <Li>{t('portal.privacy.collect.not.audio')}</Li>
                    <Li>{t('portal.privacy.collect.not.biometric')}</Li>
                    <Li>{t('portal.privacy.collect.not.browsing')}</Li>
                    <Li>{t('portal.privacy.collect.not.selling')}</Li>
                  </ul>
                </div>
              </div>
            </SubSection>

            <SubSection title={t('portal.privacy.section.share.title')}>
              <InfoBox type="info">
                {t('portal.privacy.share.infobox')}
              </InfoBox>
            </SubSection>

            <SubSection title={t('portal.privacy.section.rights.title')}>
              <ul className="space-y-1">
                <Li>{t('portal.privacy.rights.items.access')}</Li>
                <Li>{t('portal.privacy.rights.items.portability')}</Li>
                <Li>{t('portal.privacy.rights.items.delete')}</Li>
                <Li>{t('portal.privacy.rights.items.rectify')}</Li>
                <Li>{t('portal.privacy.rights.items.consent')}</Li>
              </ul>
              <p className="text-[#C0C0C0]/50 text-xs mt-3">{t('portal.privacy.rights.contactLead')} <a href="mailto:raregroovecdseswapsafe@gmail.com" className="text-[#D4AF37] hover:underline">raregroovecdseswapsafe@gmail.com</a> · {t('portal.privacy.rights.responseTime')}</p>
            </SubSection>

            <SubSection title={t('portal.privacy.section.security.title')}>
              <ul className="space-y-1">
                <Li>{t('portal.privacy.security.items.aes')}</Li>
                <Li>{t('portal.privacy.security.items.tls')}</Li>
                <Li>{t('portal.privacy.security.items.isolation')}</Li>
                <Li>{t('portal.privacy.security.items.passwords')}</Li>
                <Li>{t('portal.privacy.security.items.audit')}</Li>
              </ul>
            </SubSection>
          </Section>

          {/* POLÍTICA DA COMUNIDADE */}
          <Section id="comunidade" icon={Users} title={t('portal.section.comunidade')}>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-green-900/10 border border-green-700/30 rounded-xl p-4">
                <p className="text-green-400 text-xs font-bold uppercase mb-3">{t('portal.community.expected')}</p>
                <ul className="space-y-1">
                  {t('portal.community.expected.items').split(';').map((item, i) => <li key={i} className="text-[#C0C0C0]/70 text-xs flex items-start gap-2"><span className="text-green-400 mt-0.5">•</span>{item}</li>)}
                </ul>
              </div>
              <div className="bg-red-900/10 border border-red-700/30 rounded-xl p-4">
                <p className="text-red-400 text-xs font-bold uppercase mb-3">{t('portal.community.prohibited')}</p>
                <ul className="space-y-1">
                  {t('portal.community.prohibited.items').split(';').map((item, i) => <li key={i} className="text-[#C0C0C0]/70 text-xs flex items-start gap-2"><span className="text-red-400 mt-0.5">•</span>{item}</li>)}
                </ul>
              </div>
            </div>

            <SubSection title={t('portal.community.scale.title')}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {t('portal.community.scale.items').split(';').map((pair) => {
                  const [grade, desc] = pair.split('|');
                  return (
                    <div key={grade} className="bg-black/40 border border-[#D4AF37]/10 rounded-lg p-3">
                      <p className="text-[#D4AF37] text-xs font-bold">{grade}</p>
                      <p className="text-[#C0C0C0]/50 text-xs mt-1">{desc}</p>
                    </div>
                  );
                })}
              </div>
            </SubSection>

            <SubSection title={t('portal.community.punishments.title')}>
              <div className="space-y-2">
                {t('portal.community.punishments.items').split(';').map((pair) => {
                  const [title, desc] = pair.split('|');
                  const color = title.startsWith('🔴') ? 'red' : title.startsWith('🟠') ? 'orange' : 'gold';
                  return (
                    <div key={title} className={`border rounded-xl p-4 ${color === 'red' ? 'border-red-700/30 bg-red-900/10' : color === 'orange' ? 'border-orange-700/30 bg-orange-900/10' : 'border-yellow-700/30 bg-yellow-900/10'}`}>
                      <p className={`font-bold text-sm mb-1 ${color === 'red' ? 'text-red-300' : color === 'orange' ? 'text-orange-300' : 'text-yellow-300'}`}>{title}</p>
                      <p className="text-[#C0C0C0]/60 text-xs">{desc}</p>
                    </div>
                  );
                })}
              </div>
            </SubSection>

            <SubSection title={t('portal.community.appeal.title')}>
              <p className="text-[#C0C0C0]/70 text-sm">{t('portal.community.appeal.body')}</p>
            </SubSection>
          </Section>

          {/* ENVIOS */}
          <Section id="envios" icon={Truck} title={t('portal.section.envios')}>
            <InfoBox type="warning">
              <strong>{t('portal.shipping.disclaimer.title')}</strong> {t('portal.shipping.disclaimer.body')}
            </InfoBox>

            <SubSection title={t('portal.shipping.rules.title')}>
              <ul className="space-y-1">
                {t('portal.shipping.rules.items').split(';').map((item, i) => <Li key={i}>{item}</Li>)}
              </ul>
            </SubSection>

            <SubSection title={t('portal.shipping.modalities.title')}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#D4AF37]/10 text-[#D4AF37] text-xs uppercase">
                      <th className="px-4 py-2 text-left">{t('portal.shipping.modalities.headers.mode')}</th>
                      <th className="px-4 py-2 text-left">{t('portal.shipping.modalities.headers.use')}</th>
                      <th className="px-4 py-2 text-left">{t('portal.shipping.modalities.headers.note')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4AF37]/10">
                    {[t('portal.shipping.modalities.rows.pac'), t('portal.shipping.modalities.rows.sedex'), t('portal.shipping.modalities.rows.carrier')].map((row) => {
                      const [mode, use, note] = row.split('|');
                      return (
                        <tr key={mode} className="hover:bg-[#D4AF37]/5">
                          <td className="px-4 py-2.5 text-white font-medium">{mode}</td>
                          <td className="px-4 py-2.5 text-[#C0C0C0]/70">{use}</td>
                          <td className="px-4 py-2.5 text-[#C0C0C0]/50">{note}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SubSection>

            <SubSection title={t('portal.shipping.damage.title')}>
              <p className="text-[#C0C0C0]/70 text-sm">{t('portal.shipping.damage.body')}</p>
            </SubSection>
          </Section>

          {/* DMCA */}
          <Section id="dmca" icon={AlertTriangle} title={t('portal.section.dmca')}>
            <p className="text-[#C0C0C0]/50 text-xs mb-6">{t('portal.dmca.lastUpdate')}</p>

            <p className="text-[#C0C0C0]/70 text-sm mb-6">{t('portal.dmca.intro')}</p>

            <SubSection title={t('portal.dmca.user.title')}>
              <p className="text-[#C0C0C0]/70 text-sm mb-3">{t('portal.dmca.user.lead')}</p>
              <ul className="space-y-1">
                {t('portal.dmca.user.items').split(';').map((item, i) => <Li key={i}>{item}</Li>)}
              </ul>
            </SubSection>

            <SubSection title={t('portal.dmca.notice.title')}>
              <p className="text-[#C0C0C0]/70 text-sm mb-3">{t('portal.dmca.notice.lead')}</p>
              <ol className="space-y-1 list-none">
                {t('portal.dmca.notice.items').split(';').map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-[#C0C0C0]/70">
                    <span className="text-[#D4AF37] font-bold shrink-0">{i + 1}.</span>
                    {item}
                  </li>
                ))}
              </ol>
              <InfoBox type="danger">
                {t('portal.dmca.notice.warning')}
              </InfoBox>
            </SubSection>

            <SubSection title={t('portal.dmca.response.title')}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#D4AF37]/10 text-[#D4AF37] text-xs uppercase">
                      <th className="px-4 py-2 text-left">{t('portal.dmca.response.headers.type')}</th>
                      <th className="px-4 py-2 text-left">{t('portal.dmca.response.headers.time')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4AF37]/10">
                    {[t('portal.dmca.response.rows.receipt'), t('portal.dmca.response.rows.removal'), t('portal.dmca.response.rows.counter'), t('portal.dmca.response.rows.legal')].map((row) => {
                      const [type, time] = row.split('|');
                      return (
                        <tr key={type} className="hover:bg-[#D4AF37]/5">
                          <td className="px-4 py-2.5 text-white">{type}</td>
                          <td className="px-4 py-2.5 text-[#D4AF37] font-semibold">{time}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SubSection>

            <SubSection title={t('portal.dmca.policy.title')}>
              <ul className="space-y-1">
                {t('portal.dmca.policy.items').split(';').map((item, i) => <Li key={i}>{item}</Li>)}
              </ul>
            </SubSection>

            <div className="bg-black/40 border border-[#D4AF37]/20 rounded-xl p-5 flex items-center gap-4">
              <Mail className="w-6 h-6 text-[#D4AF37] shrink-0" />
              <div>
                <p className="text-white font-semibold text-sm">Contato para Notificações DMCA</p>
                <p className="text-[#C0C0C0]/50 text-xs">Agente Designado para Conformidade DMCA</p>
                <a href="mailto:raregroovecdseswapsafe@gmail.com" className="text-[#D4AF37] text-sm hover:underline flex items-center gap-1 mt-1">
                  raregroovecdseswapsafe@gmail.com <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </Section>

          {/* FAQ */}
          <div className="bg-black/40 border border-[#D4AF37]/20 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-black text-white mb-6">{t('portal.faq.title')}</h2>
            <div className="space-y-3">
              <FAQ q={t('portal.faq.q1.title')}>
                {t('portal.faq.q1.body')}
              </FAQ>
              <FAQ q={t('portal.faq.q2.title')}>
                {t('portal.faq.q2.body')}
              </FAQ>
              <FAQ q={t('portal.faq.q3.title')}>
                {t('portal.faq.q3.body')}
              </FAQ>
              <FAQ q={t('portal.faq.q4.title')}>
                {t('portal.faq.q4.body')}
              </FAQ>
              <FAQ q={t('portal.faq.q5.title')}>
                {t('portal.faq.q5.body')}
              </FAQ>
            </div>
          </div>

        </main>
      </div>

      {/* Banner Footer fininho */}
      <div className="border-t border-[#D4AF37]/20 bg-black/60 backdrop-blur-sm">
        <div className="text-center text-[#C0C0C0]/40 text-xs py-3">
          <p>© 2026 RAREGROOVE · Todos os direitos reservados ·</p>
        </div>
      </div>
    </div>
  );
}
