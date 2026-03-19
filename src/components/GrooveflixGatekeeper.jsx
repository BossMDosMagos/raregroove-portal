import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';
import { useSubscription } from '../contexts/SubscriptionContext.jsx';

export default function GrooveflixGatekeeper({ children }) {
  const location = useLocation();
  const { loading: subLoading, profile, settings, refresh } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const allowed = useMemo(() => {
    const lvl = Number(profile?.user_level || 0);
    const status = String(profile?.subscription_status || '').toLowerCase();
    
    if (profile?.is_admin) return true;
    if (lvl <= 0) return false;
    if (status === 'active') return true;
    if (status !== 'trialing') return false;
    const endsAt = profile?.subscription_trial_ends_at ? new Date(profile.subscription_trial_ends_at).getTime() : 0;
    if (!(endsAt > Date.now())) return false;

    const limitGb = Number(settings?.trial_data_limit_gb || 0);
    const usedGb = Number(profile?.subscription_data_used_gb || 0);
    if (limitGb > 0 && usedGb >= limitGb) return false;

    return true;
  }, [profile, settings?.trial_data_limit_gb]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) return;
        
        const { data: profileData } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single();
        
        setIsAdmin(Boolean(profileData?.is_admin));
        await refresh();
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [location.pathname, refresh]);

  if (loading || subLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-400" />
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/plans?restricted=1" replace />;
  }

  return children;
}
