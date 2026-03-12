import React, { useEffect, useMemo, useState } from 'react';
import { Save, Loader2, Sparkles, Settings, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const toastSuccessStyle = { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' };
const toastErrorStyle = { background: '#050505', border: '1px solid #ef4444', color: '#FFF' };

export default function AdminSubscriptions() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState([]);
  const [settingsRow, setSettingsRow] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: plansData, error: plansError }, { data: settingsData, error: settingsError }] = await Promise.all([
          supabase
            .from('subscription_plans')
            .select('*')
            .order('user_level', { ascending: true }),
          supabase
            .from('subscription_settings')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle(),
        ]);

        if (plansError) throw plansError;
        if (settingsError) throw settingsError;

        setPlans((plansData || []).map((p) => ({
          ...p,
          price_brl: Number(p.price_brl || 0),
          price_usd: Number(p.price_usd || 0),
        })));
        setSettingsRow(settingsData || null);
      } catch (e) {
        toast.error('ERRO AO CARREGAR ASSINATURAS', { description: e.message, style: toastErrorStyle });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const canSave = useMemo(() => {
    if (!settingsRow) return false;
    if (!Array.isArray(plans) || plans.length === 0) return false;
    return true;
  }, [plans, settingsRow]);

  const updatePlan = (planId, patch) => {
    setPlans((prev) => prev.map((p) => (p.plan_id === planId ? { ...p, ...patch } : p)));
  };

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const { error: plansError } = await supabase
        .from('subscription_plans')
        .upsert(
          plans.map((p) => ({
            plan_id: p.plan_id,
            name: String(p.name || '').trim(),
            description: String(p.description || '').trim(),
            price_brl: Number(p.price_brl || 0),
            price_usd: Number(p.price_usd || 0),
            user_level: Number(p.user_level || 0),
            is_active: Boolean(p.is_active),
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'plan_id' }
        );

      if (plansError) throw plansError;

      const { error: settingsError } = await supabase
        .from('subscription_settings')
        .upsert(
          {
            id: settingsRow.id,
            trial_days: Number(settingsRow.trial_days || 0),
            trial_data_limit_gb: Number(settingsRow.trial_data_limit_gb || 0),
            block_downloads_on_trial: Boolean(settingsRow.block_downloads_on_trial),
            limit_audio_quality_on_trial: Boolean(settingsRow.limit_audio_quality_on_trial),
            max_trial_quality: String(settingsRow.max_trial_quality || 'preview'),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (settingsError) throw settingsError;

      toast.success('CONFIGURAÇÃO SALVA', { description: 'As mudanças entram em vigor imediatamente.', style: toastSuccessStyle });
    } catch (e) {
      toast.error('ERRO AO SALVAR', { description: e.message, style: toastErrorStyle });
    } finally {
      setSaving(false);
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-300 text-xs font-bold uppercase tracking-widest">
              <Sparkles className="w-4 h-4" /> Gestão de Assinaturas
            </div>
            <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter mt-4 uppercase">
              Central de <span className="text-fuchsia-400">Comando</span>
            </h1>
            <p className="text-white/40 text-sm mt-2">
              Controle total de planos, trial e travas de segurança
            </p>
          </div>

          <button
            type="button"
            disabled={!canSave || saving}
            onClick={save}
            className="inline-flex items-center justify-center gap-2 bg-fuchsia-500/10 text-fuchsia-200 border border-fuchsia-500/40 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-fuchsia-500/80 hover:bg-fuchsia-500/15 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </button>
        </div>

        <div className="bg-[#050505] border border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/50">
            <Settings className="w-4 h-4 text-[#D4AF37]" /> Regras de Trial e Travas
          </div>

          {!settingsRow ? (
            <div className="text-white/40 text-sm">
              Nenhuma linha de configuração encontrada em subscription_settings.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/50">Dias de Trial</label>
                <input
                  value={settingsRow.trial_days ?? 0}
                  onChange={(e) => setSettingsRow((s) => ({ ...s, trial_days: Number(e.target.value || 0) }))}
                  type="number"
                  min={0}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/50">Limite de Tráfego no Trial (GB)</label>
                <input
                  value={settingsRow.trial_data_limit_gb ?? 0}
                  onChange={(e) => setSettingsRow((s) => ({ ...s, trial_data_limit_gb: Number(e.target.value || 0) }))}
                  type="number"
                  min={0}
                  step="0.1"
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
                />
              </div>

              <div className="space-y-3 md:col-span-2">
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-3 text-white/70 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(settingsRow.block_downloads_on_trial)}
                      onChange={(e) => setSettingsRow((s) => ({ ...s, block_downloads_on_trial: e.target.checked }))}
                      className="accent-fuchsia-500"
                    />
                    Bloquear Downloads no Trial
                  </label>
                  <label className="flex items-center gap-3 text-white/70 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(settingsRow.limit_audio_quality_on_trial)}
                      onChange={(e) => setSettingsRow((s) => ({ ...s, limit_audio_quality_on_trial: e.target.checked }))}
                      className="accent-fuchsia-500"
                    />
                    Limitar Qualidade de Áudio no Trial
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/50">Qualidade Máxima no Trial</label>
                  <select
                    value={String(settingsRow.max_trial_quality || 'preview')}
                    onChange={(e) => setSettingsRow((s) => ({ ...s, max_trial_quality: e.target.value }))}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
                  >
                    <option value="preview" className="bg-[#050505]">Preview</option>
                    <option value="hifi" className="bg-[#050505]">Hi‑Fi</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#050505] border border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/50">
            <Shield className="w-4 h-4 text-[#D4AF37]" /> Planos
          </div>

          {plans.length === 0 ? (
            <div className="text-white/40 text-sm">Nenhum plano cadastrado.</div>
          ) : (
            <div className="space-y-4">
              {plans.map((p) => (
                <div key={p.plan_id} className="grid grid-cols-1 md:grid-cols-6 gap-3 bg-black/40 border border-white/10 rounded-2xl p-4">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/50">Nome</label>
                    <input
                      value={p.name || ''}
                      onChange={(e) => updatePlan(p.plan_id, { name: e.target.value })}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/50">Descrição</label>
                    <input
                      value={p.description || ''}
                      onChange={(e) => updatePlan(p.plan_id, { description: e.target.value })}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/50">Preço BRL</label>
                    <input
                      value={p.price_brl}
                      onChange={(e) => updatePlan(p.plan_id, { price_brl: Number(e.target.value || 0) })}
                      type="number"
                      step="0.01"
                      min={0}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/50">Preço USD</label>
                    <input
                      value={p.price_usd}
                      onChange={(e) => updatePlan(p.plan_id, { price_usd: Number(e.target.value || 0) })}
                      type="number"
                      step="0.01"
                      min={0}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
                    />
                  </div>

                  <div className="md:col-span-6 flex flex-wrap items-center justify-between gap-4 pt-2">
                    <div className="flex items-center gap-4 text-xs text-white/50">
                      <span className="uppercase tracking-widest font-black">Plan ID: {p.plan_id}</span>
                      <span className="uppercase tracking-widest font-black">Nível: {p.user_level}</span>
                    </div>
                    <label className="flex items-center gap-3 text-white/70 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(p.is_active)}
                        onChange={(e) => updatePlan(p.plan_id, { is_active: e.target.checked })}
                        className="accent-fuchsia-500"
                      />
                      Ativo
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

