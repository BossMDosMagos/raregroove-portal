import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

export default function GrooveflixGatekeeper({ children }) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [accessData, setAccessData] = useState(null);

  useEffect(() => {
    const checkAccess = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('check_grooveflix_access');
        
        if (error) {
          setAccessData({ allowed: false, reason: 'error' });
          return;
        }
        
        setAccessData(data);
      } catch {
        setAccessData({ allowed: false, reason: 'exception' });
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-400" />
      </div>
    );
  }

  if (!accessData?.allowed) {
    return <Navigate to="/plans?restricted=1" replace />;
  }

  return children;
}
