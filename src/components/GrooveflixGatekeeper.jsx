import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';
import { useSubscription } from '../contexts/SubscriptionContext.jsx';

export default function GrooveflixGatekeeper({ children }) {
  const location = useLocation();
  const { loading: subLoading, profile, refresh } = useSubscription();
  const [loading, setLoading] = useState(true);
  const allowed = useMemo(() => {
    const lvl = Number(profile?.user_level || 0);
    const status = String(profile?.subscription_status || '').toLowerCase();
    if (lvl <= 0) return false;
    if (status === 'active') return true;
    if (status !== 'trialing') return false;
    const endsAt = profile?.subscription_trial_ends_at ? new Date(profile.subscription_trial_ends_at).getTime() : 0;
    return endsAt > Date.now();
  }, [profile]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) return;
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
