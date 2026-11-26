import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Shield, Truck, Clock, CheckCircle, AlertCircle, DollarSign,
  Music, Disc, ExternalLink, Mail, ArrowRight, Play
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LEGAL } from '../config/legal.js';
import { ItemCard } from '../components/ItemCard';
import { Section, SubSection, Li, Pill, InfoBox } from '../components/UIComponents';
import { useI18n } from '../contexts/I18nContext.jsx';

export default function Home() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .eq('is_sold', false)
          .neq('status', 'vendido')
          .order('created_at', { ascending: false })
          .limit(8);

        if (!error && data) {
          setItems(data);
        }
      } catch (e) {
        // Silencioso para home pública
      } finally {
        setLoading(false);
      }
    };
    fetchFeatured();
  }, []);

  const handleExplore = () => navigate('/catalogo');
  const handleList = () => navigate('/login?redirect=' + encodeURIComponent('/meu-acervo'));

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-gold-premium/30 selection:text-gold-light">
      {/* ===== HEADER PÚBLICO (acesso único para todos) ===== */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/70 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/img/LogoRareGrooveSymbol.svg" alt="RareGroove" className="h-8 w-auto" />
            <span className="text-sm font-black uppercase tracking-widest">RareGroove</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/catalogo"
              className="hidden sm:inline-block px-4 py-2 text-xs font-bold uppercase tracking-wider text-silver-premium/60 hover:text-white transition-colors"
            >
              Acervo
            </Link>
            <Link
              to={'/login?redirect=' + encodeURIComponent('/portal')}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-gold-premium border border-gold-premium/30 rounded-xl hover:bg-gold-premium/10 transition-colors"
            >
              Entrar
            </Link>
          </div>
        </div>
      </header>

      {/* ======================================== */}
      {/* SEÇÃO 1 - HERO */}
      {/* ======================================== */}
      <section className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-charcoal-deep to-charcoal-deep pt-32 md:pt-40 pb-20 md:pb-32 px-4">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, #D4AF37 0%, transparent 60%), radial-gradient(circle at 80% 20%, #D4AF37 0%, transparent 40%)'
        }} />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <Pill color="gold">Marketplace de Mídias Físicas Raras</Pill>
          <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter leading-tight text-luxury">
            Compre e venda CDs raros e vinis<br />
            com pagamento protegido até a entrega
          </h1>
          <p className="text-silver-premium/70 text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
            Marketplace especializado em mídias físicas raras. Seu pagamento é retido por parceiro
            licenciado pelo Banco Central e só é repassado ao vendedor após confirmação de entrega
            e decurso do prazo de garantia de 7 dias.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={handleExplore}
              className="w-full sm:w-auto px-8 py-4 bg-gold-premium text-charcoal-deep rounded-2xl font-black uppercase tracking-[0.2em] text-sm hover:shadow-[0_0_40px_rgba(212,175,55,0.4)] transition-all duration-500"
            >
              Explorar Acervo <ArrowRight size={18} />
            </button>
            <button
              onClick={handleList}
              className="w-full sm:w-auto px-8 py-4 border border-white/10 bg-white/5 rounded-2xl font-black uppercase tracking-[0.2em] text-sm hover:border-white/20 transition-all duration-500"
            >
              Anunciar Meu Item
            </button>
          </div>
          <div className="mt-12 flex items-center justify-center gap-6 text-xs text-silver-premium/40 uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-gold-premium" />
              <span>Pagamento via PSP licenciado pelo Banco Central</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck size={14} className="text-gold-premium" />
              <span>Rastreio obrigatório em todo envio</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-gold-premium" />
              <span>7 dias para conferência após entrega</span>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================== */}
      {/* SEÇÃO 2 - COMO FUNCIONA (3 PASSOS) */}
      {/* ======================================== */}
      <section className="py-20 md:py-32 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">Como Funciona em 3 Passos</h2>
            <p className="text-silver-premium/60 text-sm">Fluxo seguro do marketplace, do anúncio ao repasse.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-charcoal-deep/30 border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gold-premium/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-gold-premium/10 transition-colors" />
              <div className="relative z-10 flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-gold-premium/10 text-gold-premium flex items-center justify-center font-black text-xl">1</div>
                <span className="text-gold-premium font-bold text-xs uppercase tracking-wider">Compra Segura</span>
              </div>
              <h3 className="text-xl font-black mb-3">Pagamento retido via PSP oficial</h3>
              <p className="text-silver-premium/60 text-sm leading-relaxed mb-6">
                Seu pagamento é processado e retido por um parceiro de pagamentos licenciado pelo Banco Central.
                A RareGroove não é instituição financeira.
              </p>
              <div className="flex items-center gap-2 text-xs text-gold-premium/60 font-bold uppercase tracking-wider">
                <CheckCircle size={12} /> Até a confirmação de entrega
              </div>
            </div>
            <div className="p-8 rounded-3xl bg-charcoal-deep/30 border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gold-premium/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-gold-premium/10 transition-colors" />
              <div className="relative z-10 flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-gold-premium/10 text-gold-premium flex items-center justify-center font-black text-xl">2</div>
                <span className="text-gold-premium font-bold text-xs uppercase tracking-wider">Entrega</span>
              </div>
              <h3 className="text-xl font-black mb-3">Envio com rastreio obrigatório</h3>
              <p className="text-silver-premium/60 text-sm leading-relaxed mb-6">
                O vendedor posta o item com código de rastreio em até 3 dias úteis após confirmação do pagamento.
                Você acompanha a entrega em tempo real.
              </p>
              <div className="flex items-center gap-2 text-xs text-gold-premium/60 font-bold uppercase tracking-wider">
                <Truck size={12} /> Rastreio obrigatório
              </div>
            </div>
            <div className="p-8 rounded-3xl bg-charcoal-deep/30 border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gold-premium/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-gold-premium/10 transition-colors" />
              <div className="relative z-10 flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-gold-premium/10 text-gold-premium flex items-center justify-center font-black text-xl">3</div>
                <span className="text-gold-premium font-bold text-xs uppercase tracking-wider">Confirmação</span>
              </div>
              <h3 className="text-xl font-black mb-3">7 dias para conferir antes do repasse</h3>
              <p className="text-silver-premium/60 text-sm leading-relaxed mb-6">
                Após a entrega confirmada, você tem 7 dias corridos para conferir o item e abrir disputa, se necessário.
                O repasse ao vendedor ocorre só no 8º dia, se não houver disputa aberta.
              </p>
              <div className="flex items-center gap-2 text-xs text-gold-premium/60 font-bold uppercase tracking-wider">
                <Clock size={12} /> CDC Art. 49 — 7 dias
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================== */}
      {/* SEÇÃO 3 - VITRINE / DESTAQUES DO ACERVO */}
      {/* ======================================== */}
      <section className="py-20 md:py-32 px-4 border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-black mb-2 tracking-tight">Destaques do Acervo</h2>
              <p className="text-silver-premium/60 text-sm">Itens reais cadastrados por colecionadores</p>
            </div>
            <Link
              to="/catalogo"
              className="text-gold-premium text-xs font-bold uppercase tracking-wider hover:text-gold-premium/80 transition-colors"
            >
              Ver todo o acervo <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {loading ? (
              <>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="aspect-square rounded-2xl bg-charcoal-deep/30 border border-white/5 animate-pulse" />
                ))}
              </>
            ) : items.length > 0 ? (
              items.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))
            ) : (
              <div className="col-span-6 text-center py-20">
                <p className="text-silver-premium/50 text-sm">Nenhum item disponível no momento.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ======================================== */}
      {/* SEÇÃO 4 - SEGURANÇA E CRITÉRIOS */}
      {/* ======================================== */}
      <section className="py-20 md:py-32 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">Segurança e Critérios de Colecionador</h2>
            <p className="text-silver-premium/60 text-sm">Classificação objetiva, proteção contra extravio e mediação especializada.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-8 rounded-3xl bg-charcoal-deep/30 border border-white/5">
              <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                <Music size={20} className="text-gold-premium" />
                Classificação de Estado (Padrão Goldmine)
              </h3>
              <ul className="space-y-3">
                <Li><span className="text-emerald-400 font-bold uppercase text-[10px]">MINT / NM</span>Lacrado ou praticamente novo, sem sinais de uso.</Li>
                <Li><span className="text-yellow-400 font-bold uppercase text-[10px]">VG+ / VG</span>Sinais leves de uso, som perfeito ou clique mínimo.</Li>
                <Li><span className="text-orange-400 font-bold uppercase text-[10px]">G / F</span>Mais desgastado, cliques notáveis, ainda tocável.</Li>
              </ul>
            </div>
            <div className="p-8 rounded-3xl bg-charcoal-deep/30 border border-white/5">
              <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                <Shield size={20} className="text-gold-premium" />
                Proteção contra Extravio e Mediação
              </h3>
              <ul className="space-y-3">
                <Li>Rastreio obrigatório em todos os envios</Li>
                <Li>Estorno integral se o item não chegar em 30 dias</Li>
                <Li>Mediação especializada em caso de divergência (até 16 dias)</Li>
                <Li>Pagamento só é repassado após seu aceite ou fim do prazo de garantia</Li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================== */}
      {/* SEÇÃO 5 - TRANSPARÊNCIA DE TAXAS E FAQ */}
      {/* ======================================== */}
      <section className="py-20 md:py-32 px-4 bg-[#0a0a0a]/50 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16">
            <div>
              <h2 className="text-3xl md:text-4xl font-black mb-6 tracking-tight">Transparência de Taxas</h2>
              <InfoBox type="info">
                <p className="text-silver-premium/70 text-sm leading-relaxed">
                  <strong className="text-white">Comissão da Plataforma:</strong> {LEGAL.comissaoPct}% sobre o valor da venda, descontada automaticamente no split de pagamento pelo PSP.<br /><br />
                  <strong className="text-white">Nota Fiscal:</strong> Emissão de Nota Fiscal de serviço referente à intermediação pela plataforma.<br /><br />
                  <strong className="text-white">Responsabilidade Fiscal:</strong> do vendedor pelo produto comercializado.
                </p>
              </InfoBox>
              <div className="mt-8 space-y-4">
                <div className="p-6 rounded-2xl bg-charcoal-deep/30 border border-white/5">
                  <h4 className="text-white font-bold text-sm mb-2 uppercase tracking-wider">Quanto custa vender?</h4>
                  <p className="text-silver-premium/60 text-sm">Apenas a comissão da plataforma sobre o valor da venda, retida automaticamente no repasse. Sem mensalidade para anunciar.</p>
                </div>
                <div className="p-6 rounded-2xl bg-charcoal-deep/30 border border-white/5">
                  <h4 className="text-white font-bold text-sm mb-2 uppercase tracking-wider">Quem paga o frete?</h4>
                  <p className="text-silver-premium/60 text-sm">O frete de envio é por conta do vendedor (ou conforme acordado no chat). Arrependimento: frete de devolução por conta do comprador. Avaria/divergência: por conta do vendedor.</p>
                </div>
                <div className="p-6 rounded-2xl bg-charcoal-deep/30 border border-white/5">
                  <h4 className="text-white font-bold text-sm mb-2 uppercase tracking-wider">E se houver disputa?</h4>
                  <p className="text-silver-premium/60 text-sm">Você tem 7 dias corridos após confirmação de entrega para abrir disputa. O PSP retém os valores até a resolução.</p>
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-black mb-6 tracking-tight">Perguntas Rápidas</h2>
              <div className="space-y-4">
                <details className="group">
                  <summary className="cursor-pointer list-none text-sm font-bold text-gold-premium/90 flex justify-between py-4 border-b border-white/5 hover:text-gold-premium transition-colors">
                    <span>O que é o RareGroove?</span>
                    <span>+</span>
                  </summary>
                  <p className="text-silver-premium/60 text-sm py-4 border-b border-white/5 last:border-0">Marketplace especializado em CDs raros e discos de vinil (LPs), com pagamento protegido por PSP licenciado pelo Banco Central.</p>
                </details>
                <details className="group">
                  <summary className="cursor-pointer list-none text-sm font-bold text-gold-premium/90 flex justify-between py-4 border-b border-white/5 hover:text-gold-premium transition-colors">
                    <span>Qual o prazo de entrega?</span>
                    <span>+</span>
                  </summary>
                  <p className="text-silver-premium/60 text-sm py-4 border-b border-white/5 last:border-0">O vendedor posta em até 3 dias úteis após confirmação do pagamento. O prazo de entrega depende do Correios/transportadora.</p>
                </details>
                <details className="group">
                  <summary className="cursor-pointer list-none text-sm font-bold text-gold-premium/90 flex justify-between py-4 border-b border-white/5 hover:text-gold-premium transition-colors">
                    <span>Posso devolver o item?</span>
                    <span>+</span>
                  </summary>
                  <p className="text-silver-premium/60 text-sm py-4 border-b border-white/5 last:border-0">Sim. Você tem 7 dias corridos após confirmação de entrega para exercer o arrependimento (CDC Art. 49) ou abrir disputa por divergência.</p>
                </details>
                <details className="group">
                  <summary className="cursor-pointer list-none text-sm font-bold text-gold-premium/90 flex justify-between py-4 border-b border-white/5 hover:text-gold-premium transition-colors">
                    <span>Quando o vendedor recebe?</span>
                    <span>+</span>
                  </summary>
                  <p className="text-silver-premium/60 text-sm py-4 border-b border-white/5 last:border-0">No 8º dia corrido após confirmação de entrega, desde que não haja disputa aberta. Os valores são processados pelo PSP.</p>
                </details>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================== */}
      {/* RODAPÉ - LINKS JURÍDICOS */}
      {/* ======================================== */}
      <footer className="border-t border-white/10 bg-black pt-12 pb-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-10">
            <div className="flex items-center gap-3">
              <img src="/img/LogoRareGrooveSymbol.svg" alt="Rare Groove" className="h-8 w-auto" />
              <span className="text-xs font-black uppercase tracking-widest text-silver-premium/40">RareGroove</span>
            </div>
            <div className="text-[10px] text-silver-premium/40">
              <p>© 2026 {LEGAL.razaoSocial} · CNPJ: {LEGAL.cnpj}</p>
              <p>Endereço: {LEGAL.endereco} · SAC: {LEGAL.sac}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 mb-10">
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-gold-premium mb-3">Plataforma</h4>
              <Link to="/catalogo" className="text-xs text-silver-premium/50 hover:text-white transition-colors">Explorar Acervo</Link>
              <Link to="/plans" className="text-xs text-silver-premium/50 hover:text-white transition-colors">Planos</Link>
              <Link to="/portal" className="text-xs text-silver-premium/50 hover:text-white transition-colors">Portal do Colecionador</Link>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-gold-premium mb-3">Jurídico</h4>
              <Link to="/portal#termos" className="text-xs text-silver-premium/50 hover:text-white transition-colors">Termos de Uso</Link>
              <Link to="/portal#privacidade" className="text-xs text-silver-premium/50 hover:text-white transition-colors">Política de Privacidade</Link>
              <Link to="/portal#privacidade" className="text-xs text-silver-premium/50 hover:text-white transition-colors">Política de Cookies</Link>
              <Link to="/portal#trocas" className="text-xs text-silver-premium/50 hover:text-white transition-colors">Trocas e Devoluções</Link>
              <Link to="/portal#transparencia" className="text-xs text-silver-premium/50 hover:text-white transition-colors">Transparência Comercial</Link>
              <Link to="/portal#dmca" className="text-xs text-silver-premium/50 hover:text-white transition-colors">Canal de Direitos Autorais (Marco Civil)</Link>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-gold-premium mb-3">Suporte</h4>
              <a href="mailto:raregroovecdseswapsafe@gmail.com" className="text-xs text-silver-premium/50 hover:text-white transition-colors">contato@raregroove.com</a>
              <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="text-xs text-silver-premium/50 hover:text-white transition-colors">WhatsApp Oficial</a>
              <div className="flex items-center gap-2 text-[10px] text-silver-premium/40 mt-4">
                <Mail size={12} />
                <span>DPO: {LEGAL.dpoEmail}</span>
              </div>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center text-[10px] text-silver-premium/40">
            <p>RareGroove é um marketplace de mídias físicas raras. Pagamentos processados por PSP licenciado pelo Banco Central.</p>
            <p className="md:ml-auto">Idade mínima para cadastro e transações: 18 anos.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
