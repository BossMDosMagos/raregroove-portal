import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster, toast } from 'sonner';
import { supabase } from './lib/supabase';
import { UnreadMessagesProvider } from './contexts/UnreadMessagesContext';
import { CartProvider } from './contexts/CartContext.jsx';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import CartDrawer from './components/CartDrawer.jsx';
import GrooveflixGatekeeper from './components/GrooveflixGatekeeper.jsx';
import { GlobalPlayerProvider, useGlobalPlayer } from './hooks/useGlobalAudioPlayer.jsx';
import { validateSecretVault } from './utils/secretVaultTest';

// Componentes de carregamento
const LoadingFallback = () => (
  <div className="min-h-screen bg-[#050505] flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#D4AF37]"></div>
  </div>
);

// Páginas Públicas e Essenciais (Carregamento Imediato)
import Login from './pages/Auth/Login';
import VerifyEmail from './pages/Auth/VerifyEmail';
import CompleteSignUp from './pages/Auth/CompleteSignUp';
import Portal from './pages/Portal';
import Catalogo from './pages/Catalogo';
import ItemDetails from './pages/ItemDetails';
import Checkout from './pages/Checkout';
import CheckoutDynamic from './pages/CheckoutDynamic';
import PaymentSuccess from './pages/PaymentSuccess';
import NotFound from './pages/NotFound';
import Maintenance from './pages/Maintenance';

// Páginas Administrativas e Pesadas (Lazy Loading)
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const FeeManagement = lazy(() => import('./pages/FeeManagement'));
const AdminSales = lazy(() => import('./pages/AdminSales'));
const DebugPayments = lazy(() => import('./pages/DebugPayments'));
const AdminSwapsManagement = lazy(() => import('./pages/AdminSwapsManagement'));
const AdminDisputes = lazy(() => import('./pages/AdminDisputes'));
const AdminEscrowSla = lazy(() => import('./pages/AdminEscrowSla'));
const AdminRefundTasks = lazy(() => import('./pages/AdminRefundTasks'));
const SwapSimulator = lazy(() => import('./pages/SwapSimulator'));
const AdminSubscriptions = lazy(() => import('./pages/AdminSubscriptions'));
const AdminUpload = lazy(() => import('./pages/AdminUpload'));
const AdminTrash = lazy(() => import('./pages/AdminTrash'));
const ShippingLabelCard = lazy(() => import('./components/ShippingLabelCard'));
const ShippingLabelPage = lazy(() => import('./pages/ShippingLabel'));

// Páginas de Usuário (Lazy Loading)
const MyItems = lazy(() => import('./pages/MyItems'));
const Profile = lazy(() => import('./pages/Profile'));
const MessagesWithUnread = lazy(() => import('./pages/MessagesWithUnread'));
const ChatThread = lazy(() => import('./pages/ChatThread'));
const SwapPayment = lazy(() => import('./pages/SwapPayment'));
const Disputes = lazy(() => import('./pages/Disputes'));
const DisputeDetail = lazy(() => import('./pages/DisputeDetail'));
const Grooveflix = lazy(() => import('./pages/Grooveflix'));
const Plans = lazy(() => import('./pages/Plans'));

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  useEffect(() => {
    // 🔐 Validar Cofre Invisível na startup
    validateSecretVault();

    // Verifica se já existe uma sessão ativa ao abrir o site
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Escuta mudanças no estado de autenticação (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const key = 'rg_visit_counted_v1';
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(key) === '1') return;
    sessionStorage.setItem(key, '1');

    supabase.rpc('increment_total_visits').then(() => void 0).catch(() => void 0);
  }, []);

  useEffect(() => {
    const loadAdminFlag = async () => {
      if (!session?.user?.id) {
        setIsAdmin(false);
        setAdminLoading(false);
        return;
      }

      setAdminLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

      if (!error) {
        setIsAdmin(Boolean(data?.is_admin));
      } else {
        setIsAdmin(false);
      }

      setAdminLoading(false);
    };

    loadAdminFlag();
  }, [session]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const timeoutMinutesRaw = Number(import.meta.env.VITE_SESSION_IDLE_TIMEOUT_MINUTES || 30);
    const warnMinutesRaw = Number(import.meta.env.VITE_SESSION_IDLE_WARN_MINUTES || 2);
    const timeoutMinutes = Number.isFinite(timeoutMinutesRaw) && timeoutMinutesRaw > 0 ? timeoutMinutesRaw : 30;
    const warnMinutes = Number.isFinite(warnMinutesRaw) && warnMinutesRaw > 0 ? warnMinutesRaw : 2;

    const timeoutMs = timeoutMinutes * 60 * 1000;
    const warnMs = Math.min(timeoutMs - 10_000, warnMinutes * 60 * 1000);
    const storageKey = `rg_last_activity:${userId}`;

    let lastWrite = 0;
    let warned = false;

    const writeActivity = () => {
      const now = Date.now();
      if (now - lastWrite < 5000) return;
      lastWrite = now;
      localStorage.setItem(storageKey, String(now));
    };

    const getLastActivity = () => {
      const raw = localStorage.getItem(storageKey);
      const value = Number(raw || 0);
      if (!Number.isFinite(value) || value <= 0) return 0;
      return value;
    };

    const handler = () => writeActivity();
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'pointerdown'];
    events.forEach((evt) => window.addEventListener(evt, handler, { passive: true }));

    const onVisibility = () => {
      if (document.visibilityState === 'visible') writeActivity();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onStorage = (e) => {
      if (e.key !== storageKey) return;
      if (warned) {
        const last = getLastActivity();
        const remaining = timeoutMs - (Date.now() - last);
        if (remaining > warnMs) warned = false;
      }
    };
    window.addEventListener('storage', onStorage);

    writeActivity();

    const interval = setInterval(async () => {
      const last = getLastActivity();
      if (!last) {
        writeActivity();
        return;
      }

      const elapsed = Date.now() - last;
      const remaining = timeoutMs - elapsed;

      if (remaining <= 0) {
        clearInterval(interval);
        events.forEach((evt) => window.removeEventListener(evt, handler));
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('storage', onStorage);
        await supabase.auth.signOut();
        toast.error('SESSÃO EXPIRADA', {
          description: 'Por segurança, sua sessão foi encerrada por inatividade.',
          duration: 8000,
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
        return;
      }

      if (!warned && warnMs > 0 && remaining <= warnMs) {
        warned = true;
        const seconds = Math.max(1, Math.ceil(remaining / 1000));
        toast.message('AVISO DE SEGURANÇA', {
          description: `Sua sessão expira em ~${seconds}s por inatividade.`,
          duration: 7000,
          style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
        });
      }
    }, 15_000);

    return () => {
      clearInterval(interval);
      events.forEach((evt) => window.removeEventListener(evt, handler));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
    };
  }, [session?.user?.id]);

  if (loading) {
    return <LoadingFallback />;
  }

  return (
    <HelmetProvider>
      <ErrorBoundary>
        <Router>
          <UnreadMessagesProvider>
            <CartProvider>
              <Toaster position="top-center" expand={false} richColors theme="dark" />
              
              <div className="min-h-screen bg-[#050505] text-white">
                <Navbar />
                <CartDrawer />
                
                <Suspense fallback={<LoadingFallback />}>
                  <Routes>
          {/* Se estiver logado, manda pro Portal. Se não, manda pro Login */}
          <Route 
            path="/" 
            element={session ? <Navigate to="/portal" /> : <Login />} 
          />

          {/* Rota de Login explícita */}
          <Route 
            path="/login" 
            element={session ? <Navigate to="/portal" /> : <Login />} 
          />

          {/* Rota de Completar Cadastro (Pública - após clicar email) */}
          <Route 
            path="/complete-signup" 
            element={<CompleteSignUp />} 
          />

          <Route
            path="/verify-email"
            element={<VerifyEmail />}
          />
          
          {/* Rota do Portal (Protegida) */}
          <Route 
            path="/portal" 
            element={session ? <Portal /> : <Navigate to="/" />} 
          />

          <Route
            path="/grooveflix"
            element={session ? (
              <GlobalPlayerProvider>
                <GrooveflixGatekeeper><Grooveflix /></GrooveflixGatekeeper>
              </GlobalPlayerProvider>
            ) : <Navigate to="/" />}
          />

          <Route
            path="/plans"
            element={session ? <Plans /> : <Navigate to="/" />}
          />
          
          {/* Rota do Catálogo (Protegida) */}
          <Route 
            path="/catalogo" 
            element={session ? <Catalogo /> : <Navigate to="/" />} 
          />

          {/* Rota do Meu Acervo (Protegida) */}
          <Route 
            path="/meu-acervo" 
            element={session ? <MyItems /> : <Navigate to="/" />} 
          />
          
          {/* Rota do Item Details (Protegida) */}
          <Route 
            path="/item/:id" 
            element={session ? <ItemDetails /> : <Navigate to="/" />} 
          />

          {/* Rota das Mensagens (Protegida) */}
          <Route 
            path="/mensagens" 
            element={session ? <MessagesWithUnread /> : <Navigate to="/" />} 
          />

          {/* Rota da Thread de Conversa (Protegida) */}
          <Route 
            path="/chat/:itemId" 
            element={session ? <ChatThread /> : <Navigate to="/" />} 
          />

          {/* Rota do Perfil (Protegida) */}
          <Route 
            path="/profile" 
            element={session ? <Profile /> : <Navigate to="/" />} 
          />

          {/* Rota de Disputas (Protegida) */}
          <Route
            path="/disputas"
            element={session ? <Disputes /> : <Navigate to="/" />}
          />
          <Route
            path="/disputas/:disputeId"
            element={session ? <DisputeDetail /> : <Navigate to="/" />}
          />

          {/* Rota do Simulador de Swaps (Protegida) */}
          <Route 
            path="/swaps" 
            element={session ? <SwapSimulator /> : <Navigate to="/" />} 
          />

          {/* Rota do Checkout de CDs (Protegida) */}
          <Route
            path="/checkout"
            element={session ? <Checkout key={location.pathname} /> : <Navigate to="/" />}
          />
          <Route 
            path="/checkout/:itemId" 
            element={session ? <Checkout key={location.pathname} /> : <Navigate to="/" />} 
          />

          {/* Rota de Pagamento de Taxa de Swap (Protegida) */}
          <Route 
            path="/swap-payment/:swapId" 
            element={session ? <SwapPayment /> : <Navigate to="/" />} 
          />

          {/* Rotas de retorno do pagamento (Públicas para garantir callback) */}
          <Route 
            path="/payment/success" 
            element={<PaymentSuccess />} 
          />
          <Route 
            path="/payment/failure" 
            element={<PaymentSuccess />} 
          />
          <Route 
            path="/payment/pending" 
            element={<PaymentSuccess />} 
          />

          {/* Rota Admin (Protegida + Admin) */}
          <Route
            path="/admin"
            element={
              session
                ? adminLoading
                  ? null
                  : isAdmin
                  ? <AdminDashboard />
                  : <Navigate to="/" />
                : <Navigate to="/" />
            }
          />

          {/* Rota Admin Users (Protegida + Admin) */}
          <Route
            path="/admin/users"
            element={
              session
                ? adminLoading
                  ? null
                  : isAdmin
                  ? <AdminUsers />
                  : <Navigate to="/" />
                : <Navigate to="/" />
            }
          />

          {/* Rota Admin Fees (Protegida + Admin) */}
          <Route
            path="/admin/fees"
            element={
              session
                ? adminLoading
                  ? null
                  : isAdmin
                  ? <FeeManagement />
                  : <Navigate to="/" />
                : <Navigate to="/" />
            }
          />

          {/* Rota Admin Assinaturas (Protegida + Admin) */}
          <Route
            path="/admin/subscriptions"
            element={
              session
                ? adminLoading
                  ? null
                  : isAdmin
                  ? <AdminSubscriptions />
                  : <Navigate to="/" />
                : <Navigate to="/" />
            }
          />

          {/* Rota Admin Upload (Protegida + Admin) */}
          <Route
            path="/admin/upload"
            element={
              session
                ? adminLoading
                  ? null
                  : isAdmin
                  ? <AdminUpload />
                  : <Navigate to="/" />
                : <Navigate to="/" />
            }
          />

          {/* Rota Admin Sales (Protegida + Admin) */}
          <Route
            path="/admin/sales"
            element={
              session
                ? adminLoading
                  ? null
                  : isAdmin
                  ? <AdminSales />
                  : <Navigate to="/" />
                : <Navigate to="/" />
            }
          />

          {/* Rota Admin Disputas (Protegida + Admin) */}
          <Route
            path="/admin/disputes"
            element={
              session
                ? adminLoading
                  ? null
                  : isAdmin
                  ? <AdminDisputes />
                  : <Navigate to="/" />
                : <Navigate to="/" />
            }
          />

          {/* Rota Admin Escrow SLA (Protegida + Admin) */}
          <Route
            path="/admin/escrow-sla"
            element={
              session
                ? adminLoading
                  ? null
                  : isAdmin
                  ? <AdminEscrowSla />
                  : <Navigate to="/" />
                : <Navigate to="/" />
            }
          />

          {/* Rota Admin Reembolsos (Protegida + Admin) */}
          <Route
            path="/admin/refunds"
            element={
              session
                ? adminLoading
                  ? null
                  : isAdmin
                  ? <AdminRefundTasks />
                  : <Navigate to="/" />
                : <Navigate to="/" />
            }
          />

          {/* Rota Admin Trocas (Protegida + Admin) */}
          <Route
            path="/admin/swaps"
            element={
              session
                ? adminLoading
                  ? null
                  : isAdmin
                  ? <AdminSwapsManagement />
                  : <Navigate to="/" />
                : <Navigate to="/" />
            }
          />

          {/* Rota Debug Payments (Protegida + Admin) */}
          <Route
            path="/admin/debug-payments"
            element={
              session
                ? adminLoading
                  ? null
                  : isAdmin
                  ? <DebugPayments />
                  : <Navigate to="/" />
                : <Navigate to="/" />
            }
          />

          {/* Rota Admin Lixeira Total (Protegida + Admin) */}
          <Route
            path="/admin/trash"
            element={
              session
                ? adminLoading
                  ? null
                  : isAdmin
                  ? <AdminTrash />
                  : <Navigate to="/" />
                : <Navigate to="/" />
            }
          />

          {/* Rota Gerar Etiqueta */}
          <Route
            path="/shipping/:transactionId"
            element={
              session
                ? <ShippingLabelPage />
                : <Navigate to="/login" />
            }
          />

          {/* Rota 404 - Catch All */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  </CartProvider>
</UnreadMessagesProvider>
</Router>
</ErrorBoundary>
</HelmetProvider>
  );
}
