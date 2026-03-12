import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

export default function GrooveflixGatekeeper({ children }) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
          setAllowed(false);
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('user_level, subscription_status')
          .eq('id', user.id)
          .single();

        if (error) {
          setAllowed(false);
          return;
        }

        const lvl = Number(profile?.user_level || 0);
        const status = String(profile?.subscription_status || '').toLowerCase();
        setAllowed(lvl > 0 && status === 'active');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [location.pathname]);

  if (loading) {
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

