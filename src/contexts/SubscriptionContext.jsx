import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [plans, setPlans] = useState([]);
  const [settings, setSettings] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        setProfile(null);
        setPlans([]);
        setSettings(null);
        return;
      }

      const [{ data: prof }, { data: plansData }, { data: settingsData }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, country_code, user_level, subscription_status, subscription_plan, subscription_date, subscription_trial_ends_at, subscription_trial_started_at, subscription_data_used_gb')
          .eq('id', user.id)
          .single(),
        supabase
          .from('subscription_plans')
          .select('*')
          .eq('is_active', true)
          .order('user_level', { ascending: true }),
        supabase
          .from('subscription_settings')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      setProfile(prof || null);
      setPlans(plansData || []);
      setSettings(settingsData || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel('subscription-config')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscription_plans' },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscription_settings' },
        () => refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const value = useMemo(() => ({
    loading,
    profile,
    plans,
    settings,
    refresh,
    isActive: String(profile?.subscription_status || '').toLowerCase() === 'active',
    isTrialing: String(profile?.subscription_status || '').toLowerCase() === 'trialing',
  }), [loading, plans, profile, refresh, settings]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
