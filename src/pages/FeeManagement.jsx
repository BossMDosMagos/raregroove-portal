import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator, Save, Settings, Shield, Sliders, Wallet, Globe, Lock, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const defaultSettings = {
  sale_fee_pct: '5.00',
  processing_fee_fixed: '2.00',
  swap_guarantee_fee_fixed: '10.00',
  swap_guarantee_portal_pct: '100.00',
  gateway_provider: 'stripe',
  gateway_mode: 'sandbox',
  base_portal_url: 'https://raregroove.com'
};

export default function FeeManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(defaultSettings);
  const [simValue, setSimValue] = useState('100');

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('platform_settings')
          .select('*')
          .eq('id', 1)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data) {
          setSettings({
            sale_fee_pct: String(data.sale_fee_pct ?? defaultSettings.sale_fee_pct),
            processing_fee_fixed: String(data.processing_fee_fixed ?? defaultSettings.processing_fee_fixed),
            swap_guarantee_fee_fixed: String(data.swap_guarantee_fee_fixed ?? defaultSettings.swap_guarantee_fee_fixed),
            swap_guarantee_portal_pct: String(data.swap_guarantee_portal_pct ?? defaultSettings.swap_guarantee_portal_pct),
            gateway_provider: data.gateway_provider ?? defaultSettings.gateway_provider,
            gateway_mode: data.gateway_mode ?? defaultSettings.gateway_mode,
            base_portal_url: data.base_portal_url ?? defaultSettings.base_portal_url
          });
        }
      } catch (error) {
        console.error('Erro ao carregar settings:', error);
        toast.error('Erro ao carregar configurações');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const formatMoney = (value) => Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  const simulator = useMemo(() => {
    const price = parseFloat(simValue || '0') || 0;
    const feePct = parseFloat(settings.sale_fee_pct || '0') || 0;
    const processing = parseFloat(settings.processing_fee_fixed || '0') || 0;

    const platformFee = Number((price * feePct) / 100);
    const buyerTotal = price + platformFee + processing;
    const sellerNet = price - platformFee - processing;

    return {
      price,
      platformFee,
      processing,
      buyerTotal,
      sellerNet
    };
  }, [simValue, settings.sale_fee_pct, settings.processing_fee_fixed]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const parseFee = (value) => {
        const cleaned = String(value || '0').replace(',', '.');
        const parsed = parseFloat(cleaned);
        return Number.isNaN(parsed) ? 0 : parsed;
      };

      const payload = {
        id: 1,
        sale_fee_pct: parseFee(settings.sale_fee_pct),
        processing_fee_fixed: parseFee(settings.processing_fee_fixed),
        swap_guarantee_fee_fixed: parseFee(settings.swap_guarantee_fee_fixed),
        swap_guarantee_portal_pct: parseFee(settings.swap_guarantee_portal_pct),
        gateway_provider: settings.gateway_provider,
        gateway_mode: settings.gateway_mode,
        base_portal_url: settings.base_portal_url || null,
        updated_by: user?.id || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('platform_settings')
        .upsert([payload], { onConflict: 'id' });

      if (error) {
        throw new Error(error.message || 'Erro ao salvar no banco de dados');
      }

      toast.success('Configurações salvas', {
        description: 'Taxas e gateway atualizados com sucesso'
      });
    } catch (error) {
      console.error('Erro ao salvar settings:', error);
      toast.error('Erro ao salvar configurações', {
        description: error.message || 'Verifique se o SQL foi executado corretamente'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Settings className="w-8 h-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4 md:px-6 pt-20">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-bold uppercase tracking-widest">
              <Shield className="w-4 h-4" /> Settings Hub Financeiro
            </div>
            <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter mt-4 uppercase">
              Central de <span className="text-[#D4AF37]">Taxas & Gateway</span>
            </h1>
            <p className="text-white/40 text-sm mt-2">Controle total das regras financeiras do Rare Groove</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/70 rounded-xl text-[11px] font-black uppercase tracking-widest hover:border-[#D4AF37]/50 hover:text-[#D4AF37] transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar ao Banco
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-[#D4AF37] text-black rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#C09E28] transition-all disabled:opacity-60"
            >
              <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#050505] border border-[#D4AF37]/20 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2 text-[#D4AF37]">
              <Sliders className="w-5 h-5" />
              <h2 className="text-lg font-black">Taxas de Venda</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/50 mb-2">Taxa de Venda (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={settings.sale_fee_pct}
                  onChange={(e) => setSettings({ ...settings, sale_fee_pct: e.target.value })}
                  className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-white/50 mb-2">Taxa de Processamento (Fixo R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.processing_fee_fixed}
                  onChange={(e) => setSettings({ ...settings, processing_fee_fixed: e.target.value })}
                  className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>

            <div className="border-t border-white/10 pt-5">
              <div className="flex items-center gap-2 text-[#D4AF37] mb-4">
                <Wallet className="w-4 h-4" />
                <h3 className="text-sm font-black uppercase tracking-widest">Trocas (Garantia)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-white/50 mb-2">Taxa de Garantia (Fixa R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settings.swap_guarantee_fee_fixed}
                    onChange={(e) => setSettings({ ...settings, swap_guarantee_fee_fixed: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-white/50 mb-2">Percentual Retido pelo Portal (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={settings.swap_guarantee_portal_pct}
                    onChange={(e) => setSettings({ ...settings, swap_guarantee_portal_pct: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#050505] border border-[#D4AF37]/20 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2 text-[#D4AF37]">
              <Globe className="w-5 h-5" />
              <h2 className="text-lg font-black">Configuração de Portal</h2>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-white/50 mb-2">URL Oficial do Portal</label>
              <input
                type="url"
                value={settings.base_portal_url}
                onChange={(e) => setSettings({ ...settings, base_portal_url: e.target.value })}
                className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div className="space-y-2 border-t border-white/10 pt-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-widest">Modo Atual:</h4>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSettings({ ...settings, gateway_mode: 'sandbox' })}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${
                    settings.gateway_mode === 'sandbox'
                      ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                      : 'bg-black/60 text-white/60 border-white/10 hover:border-[#D4AF37]/40'
                  }`}
                >
                  🧪 Sandbox
                </button>
                <button
                  onClick={() => setSettings({ ...settings, gateway_mode: 'production' })}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${
                    settings.gateway_mode === 'production'
                      ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                      : 'bg-black/60 text-white/60 border-white/10 hover:border-[#D4AF37]/40'
                  }`}
                >
                  🚀 Produção
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#050505] border border-[#D4AF37]/20 rounded-2xl p-6 space-y-6 lg:col-span-2">
            <div className="flex items-center gap-2 text-[#D4AF37]">
              <Lock className="w-5 h-5" />
              <h2 className="text-lg font-black">🔐 Cofre Invisível Ativado</h2>
            </div>
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="flex gap-3">
                <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-green-300 space-y-2">
                  <p className="font-bold uppercase tracking-wider">Sistema de Segurança Máxima</p>
                  <p>As chaves secretas (API Secrets) agora são gerenciadas exclusivamente via variáveis de ambiente seguras (Edge Functions).</p>
                  <p>Isso impede que credenciais críticas sejam expostas no painel administrativo ou vazem via inspeção de navegador.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#050005] border border-[#D4AF37]/20 rounded-2xl p-6 space-y-6 lg:col-span-2">
            <div className="flex items-center gap-2 text-[#D4AF37]">
              <Calculator className="w-5 h-5" />
              <h2 className="text-lg font-black">Simulador de Lucro</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1">
                <label className="block text-xs uppercase tracking-widest text-white/50 mb-2">Valor do Item</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={simValue}
                  onChange={(e) => setSimValue(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-black/60 border border-white/10 rounded-lg p-4">
                  <p className="text-xs uppercase tracking-widest text-white/50">Comprador paga</p>
                  <p className="text-[#D4AF37] text-2xl font-black mt-2">{formatMoney(simulator.buyerTotal)}</p>
                </div>
                <div className="bg-black/60 border border-white/10 rounded-lg p-4">
                  <p className="text-xs uppercase tracking-widest text-white/50">Vendedor recebe</p>
                  <p className="text-green-400 text-2xl font-black mt-2">{formatMoney(simulator.sellerNet)}</p>
                </div>
                <div className="bg-black/60 border border-white/10 rounded-lg p-4">
                  <p className="text-xs uppercase tracking-widest text-white/50">Portal retenção</p>
                  <p className="text-blue-400 text-2xl font-black mt-2">{formatMoney(simulator.platformFee)}</p>
                </div>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-black/60 border border-white/10 rounded-lg p-4">
                <p className="text-xs uppercase tracking-widest text-white/50">Taxa Gateway</p>
                <p className="text-white text-lg font-bold mt-2">{formatMoney(simulator.processing)}</p>
              </div>
              <div className="bg-black/60 border border-white/10 rounded-lg p-4">
                <p className="text-xs uppercase tracking-widest text-white/50">Taxa Garantia de Troca</p>
                <p className="text-white text-lg font-bold mt-2">{formatMoney(settings.swap_guarantee_fee_fixed)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
