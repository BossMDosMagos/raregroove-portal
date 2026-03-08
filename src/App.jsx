import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { supabase } from './lib/supabase';
import { UnreadMessagesProvider } from './contexts/UnreadMessagesContext';
import Navbar from './components/Navbar';
import { validateSecretVault } from './utils/secretVaultTest';

// Nossas Páginas
import Login from './pages/Auth/Login';
import CompleteSignUp from './pages/Auth/CompleteSignUp';
import Portal from './pages/Portal';
import Catalogo from './pages/Catalogo';
import ItemDetails from './pages/ItemDetails';
import MyItems from './pages/MyItems';
import Profile from './pages/Profile';
import MessagesWithUnread from './pages/MessagesWithUnread';
import ChatThread from './pages/ChatThread';
import NotFound from './pages/NotFound';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import FeeManagement from './pages/FeeManagement';
import AdminSales from './pages/AdminSales';
import DebugPayments from './pages/DebugPayments';
import AdminSwapsManagement from './pages/AdminSwapsManagement';
import SwapSimulator from './pages/SwapSimulator';
import Checkout from './pages/Checkout';
import SwapPayment from './pages/SwapPayment';
import PaymentSuccess from './pages/PaymentSuccess';
import Maintenance from './pages/Maintenance';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true); // Começa true para evitar race condition
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);

  useEffect(() => {
    // 🚧 Buscar status de Manutenção do Banco
    const checkMaintenance = async () => {
      // Timeout de segurança: se o banco não responder em 3s, libera o site
      const timeoutId = setTimeout(() => {
         console.warn('Timeout verificando manutenção - liberando acesso');
         setMaintenanceLoading(false);
      }, 3000);

      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .single();
        
        clearTimeout(timeoutId);
        
        if (data?.value?.enabled) {
          setMaintenanceMode(true);
        } else {
          setMaintenanceMode(false);
        }
      } catch (err) {
        console.error('Erro ao verificar manutenção:', err);
      } finally {
        setMaintenanceLoading(false);
      }
    };

    checkMaintenance();

    // Ouvir mudanças em tempo real (para ativar/desativar na hora)
    const channel = supabase
      .channel('system_settings')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'system_settings', 
        filter: "key=eq.maintenance_mode" 
      }, (payload) => {
        if (payload.new && payload.new.value) {
          setMaintenanceMode(payload.new.value.enabled);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // MODO MANUTENÇÃO (Local ou Remoto)
  const isLocalMaintenance = import.meta.env.VITE_MAINTENANCE_MODE === 'true';
  const isMaintenanceActive = isLocalMaintenance || maintenanceMode;
  
  // Rotas permitidas mesmo em manutenção (Login e Admin)
  const currentPath = window.location.pathname;
  const isWhitelisted = currentPath.startsWith('/admin') || currentPath.startsWith('/login') || currentPath.startsWith('/auth');

  // 1. Evitar "flash" de conteúdo: Se estiver carregando config do banco, mostra tela preta com loading
  if (maintenanceLoading && !isLocalMaintenance) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center flex-col gap-4">
         <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#D4AF37]"></div>
         <p className="text-xs text-[#D4AF37] uppercase tracking-widest">Carregando Sistema...</p>
      </div>
    );
  }

  // 2. Se estiver em manutenção E não for admin E não estiver em rota permitida
  // Importante: Esperar adminLoading terminar para não bloquear admin por engano
  if (isMaintenanceActive && !loading && !adminLoading && !isAdmin && !isWhitelisted) {
    return <Maintenance />;
  }

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

  if (loading) return null; // Opcional: colocar um componente de loading aqui

  return (
    <Router>
      <UnreadMessagesProvider>
        <Toaster position="top-center" expand={false} richColors theme="dark" />
        
        {/* Navbar fixa no topo (Glassmorphism) */}
        <Navbar />
        
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
          
          {/* Rota do Portal (Protegida) */}
          <Route 
            path="/portal" 
            element={session ? <Portal /> : <Navigate to="/" />} 
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

          {/* Rota do Simulador de Swaps (Protegida) */}
          <Route 
            path="/swaps" 
            element={session ? <SwapSimulator /> : <Navigate to="/" />} 
          />

          {/* Rota do Checkout (Protegida) */}
          <Route 
            path="/checkout/:itemId" 
            element={session ? <Checkout /> : <Navigate to="/" />} 
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

          {/* Rota 404 - Catch All */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </UnreadMessagesProvider>
    </Router>
  );
}