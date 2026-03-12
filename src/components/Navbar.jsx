import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Search, ShoppingCart, LogOut, User, Settings, Wallet, Home, Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useUnreadMessages } from '../contexts/UnreadMessagesContext';
import { useI18n } from '../contexts/I18nContext.jsx';
import { useCart } from '../contexts/CartContext.jsx';
import NixieTubes from './NixieTubes.jsx';
import AcrylicLedClock from './AcrylicLedClock.jsx';
import logoRareGroove from '../assets/LogoRareGroove.png';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount: unreadMessagesCount } = useUnreadMessages();
  const { locale, setLocale, t } = useI18n();
  const { cartItem, setOpen } = useCart();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const notificationsRef = useRef(null);

  const cartCount = cartItem?.itemId ? 1 : 0;
  const unreadNotificationsCount = notifications.filter(n => !n.is_read).length;
  const totalUnreadCount = unreadNotificationsCount + unreadMessagesCount;

  const loadNotifications = async (userId) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    setNotifications(data || []);
  };

  // ── Carregar dados do usuário ──────────────────────────────────────────────
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      if (authUser?.id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, is_admin')
          .eq('id', authUser.id)
          .single();
        setProfile(profileData);
        setIsAdmin(Boolean(profileData?.is_admin));

        // Carregar notificações
        loadNotifications(authUser.id);
      } else {
        // Limpar dados quando não há usuário autenticado
        setProfile(null);
        setIsAdmin(false);
        setNotifications([]);
      }
    };

    // Carregar usuário inicial
    loadUser();

    // Escutar mudanças no estado de autenticação (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUser();
      } else {
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setNotifications([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Marcar notificação como lida ───────────────────────────────────────────
  const markAsRead = async (notificationId) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
  };

  // ── Fechar dropdown ao clicar fora ───────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Sessão encerrada', {
      description: 'A porta do cofre foi trancada com sucesso.',
    });
    navigate('/');
  };

  // ── Buscar itens ─────────────────────────────────────────────────────────
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/catalogo?search=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
      setSearchOpen(false);
    }
  };

  // ── Links de navegação ───────────────────────────────────────────────────
  const navLinks = [
    { label: t('nav.explore'), path: '/catalogo', icon: Home },
    { label: t('nav.grooveflix'), path: '/grooveflix', icon: null },
    { label: t('nav.plans'), path: '/plans', icon: null },
    { label: t('nav.myItems'), path: '/meu-acervo', icon: null },
    { label: t('nav.swaps'), path: '/swaps', icon: null },
    { label: t('nav.community'), path: '/mensagens', icon: null },
  ];

  const isActive = (path) => location.pathname === path;

  // ── Se não está autenticado, não mostrar ──────────────────────────────────
  if (!user) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      {/* Barra Principal - Glassmorphism */}
      <div
        className="hifi-panel border-b border-[#D4AF37]/20"
      >
        <div className="hifi-display-left">
          <div className="pointer-events-auto">
            <NixieTubes digits={6} />
          </div>
        </div>

        <div className="hifi-display-right">
          <div className="pointer-events-auto">
            <AcrylicLedClock />
          </div>
        </div>

        <div className="relative z-20 max-w-7xl mx-auto px-4 md:px-6 md:pl-[170px] md:pr-[190px] h-16 flex items-center justify-between">
          
          <div className="flex items-center gap-6">
            <Link
              to="/portal"
              className="flex-shrink-0 flex items-center gap-2 group hover:opacity-80 transition-opacity"
            >
              <img 
                src={logoRareGroove}
                alt="Rare Groove" 
                className="hidden md:block h-10 w-auto object-contain"
              />
              <img 
                src={logoRareGroove}
                alt="Rare Groove" 
                className="md:hidden h-10 w-10 object-contain"
              />
            </Link>
          </div>

          {/* ── CENTRO: Links de Navegação (Desktop) ───────────────────────── */}
          <div className="hidden md:flex items-center gap-12">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`relative text-[11px] font-black uppercase tracking-[0.24em] transition-colors py-2 ${
                  isActive(link.path)
                    ? 'text-[#D4AF37]'
                    : 'text-gray-300 hover:text-[#D4AF37]'
                }`}
              >
                {link.label}
                {isActive(link.path) && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#D4AF37] to-transparent rounded-full" />
                )}
              </Link>
            ))}
          </div>

          {/* ── LADO DIREITO: Ações ─────────────────────────────────────────── */}
          <div className="flex items-center gap-4 md:gap-6">
            
            {/* Busca (Desktop) */}
            <div className="hidden lg:block">
              {searchOpen ? (
                <form onSubmit={handleSearch} className="flex">
                  <input
                    type="text"
                    placeholder={t('nav.search.placeholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="bg-[#1a1a1a] text-white placeholder-gray-500 px-4 py-2 rounded-l-lg border border-[#D4AF37]/30 text-sm w-48 focus:outline-none focus:border-[#D4AF37]"
                  />
                  <button
                    type="submit"
                    className="bg-[#D4AF37] text-black px-4 py-2 rounded-r-lg font-medium text-sm hover:bg-[#F4E4BC] transition-colors"
                  >
                    {t('nav.search.submit')}
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="p-2 hover:bg-[#D4AF37]/10 rounded-lg transition-colors text-gray-300 hover:text-[#D4AF37]"
                  title={t('nav.search.submit')}
                >
                  <Search size={20} />
                </button>
              )}
            </div>

            {/* Carrinho */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="md:hidden relative p-2 hover:bg-[#D4AF37]/10 rounded-lg transition-colors text-gray-300 hover:text-[#D4AF37]"
              title="Carrinho"
            >
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 w-5 h-5 rounded-full bg-[#ef4444] text-white text-xs font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Notificações */}
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 hover:bg-[#D4AF37]/10 rounded-lg transition-colors text-gray-300 hover:text-[#D4AF37]"
                title="Notificações"
              >
                <Bell size={20} />
                {totalUnreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 rounded-full bg-[#D4AF37] text-black text-xs font-bold flex items-center justify-center animate-pulse">
                    {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown de Notificações */}
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[#1a1a1a] border border-[#D4AF37]/30 rounded-lg shadow-2xl overflow-hidden animate-in fade-in z-50">
                  
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-[#D4AF37]/20 bg-black/60">
                    <p className="text-white font-semibold text-sm">
                      Notificações
                    </p>
                  </div>

                  {/* Lista de notificações */}
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-gray-400 text-sm">
                        Nenhuma notificação
                      </div>
                    ) : (
                      notifications.slice(0, 5).map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => {
                            markAsRead(notif.id);
                            setNotificationsOpen(false);
                            if (notif.related_id && String(notif.title || '').toUpperCase().includes('DISPUTA')) {
                              navigate(`/disputas/${notif.related_id}`);
                            } else if (notif.item_id) {
                              navigate(`/item/${notif.item_id}`);
                            }
                          }}
                          className={`px-4 py-2.5 border-b border-[#D4AF37]/10 cursor-pointer transition-colors ${
                            notif.is_read ? 'bg-black/20' : 'bg-[#D4AF37]/5 hover:bg-[#D4AF37]/10'
                          }`}
                        >
                          <p className={`text-xs font-semibold ${notif.is_read ? 'text-gray-500' : 'text-white'}`}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                            {notif.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Link para mensagens se houver */}
                  {unreadMessagesCount > 0 && (
                    <div
                      onClick={() => {
                        navigate('/mensagens');
                        setNotificationsOpen(false);
                      }}
                      className="px-4 py-2.5 bg-black/40 border-t border-[#D4AF37]/20 cursor-pointer hover:bg-[#D4AF37]/10 transition-colors text-sm text-[#D4AF37] font-semibold"
                    >
                      {unreadMessagesCount} mensagem(ns) nova(s) →
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Admin Link (Desktop) - Só aparece para administradores */}
            {isAdmin && (
              <Link
                to="/admin"
                className="hidden md:block px-4 py-2 rounded-lg bg-black/60 border border-blue-400/30 text-blue-400 font-semibold text-sm hover:bg-blue-400/10 hover:border-blue-400/50 transition-all duration-300"
              >
                Admin
              </Link>
            )}

            {/* Avatar com Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="p-1 hover:bg-[#D4AF37]/10 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center text-black font-bold text-sm overflow-hidden">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    profile?.full_name?.[0] || 'U'
                  )}
                </div>
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#1a1a1a] border border-[#D4AF37]/30 rounded-lg shadow-2xl overflow-hidden animate-in fade-in">
                  
                  {/* Header do Dropdown */}
                  <div className="px-4 py-3 border-b border-[#D4AF37]/20">
                    <p className="text-white font-semibold text-sm">
                      {profile?.full_name || 'Usuário'}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {user?.email}
                    </p>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    <Link
                      to="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-gray-300 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] transition-colors"
                    >
                      <User size={16} />
                      <span className="text-sm">{t('nav.dropdown.profile')}</span>
                    </Link>

                    <Link
                      to="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-gray-300 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] transition-colors"
                    >
                      <Wallet size={16} />
                      <span className="text-sm">{t('nav.dropdown.balance')}</span>
                    </Link>

                    <Link
                      to="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-gray-300 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] transition-colors"
                    >
                      <Settings size={16} />
                      <span className="text-sm">{t('nav.dropdown.settings')}</span>
                    </Link>

                    <div className="px-4 py-2.5 border-t border-[#D4AF37]/10">
                      <p className="text-xs text-gray-400 mb-2">{t('nav.dropdown.language')}</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setLocale('pt-BR')}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                            locale === 'pt-BR'
                              ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40'
                              : 'bg-white/5 text-white/70 border border-white/10 hover:text-white'
                          }`}
                        >
                          Português
                        </button>
                        <button
                          onClick={() => setLocale('en-US')}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                            locale === 'en-US'
                              ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40'
                              : 'bg-white/5 text-white/70 border border-white/10 hover:text-white'
                          }`}
                        >
                          English
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-[#D4AF37]/20 py-2">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut size={16} />
                      <span className="text-sm">{t('nav.dropdown.logout')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Menu Hamburger (Mobile) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-300 hover:text-[#D4AF37]"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Menu Mobile ────────────────────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="md:hidden backdrop-blur-xl bg-[rgba(13,13,13,0.95)] border-b border-[#D4AF37]/20">
          <div className="px-4 py-4 space-y-3">
            
            {/* Admin Link (Mobile) - Só aparece para administradores */}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full px-4 py-2.5 rounded-lg bg-black/60 border border-blue-400/30 text-blue-400 font-semibold text-sm hover:bg-blue-400/10 hover:border-blue-400/50 transition-all text-center"
              >
                Admin
              </Link>
            )}

            {/* Links de Navegação */}
            <div className="space-y-2 border-t border-[#D4AF37]/20 pt-3">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg transition-colors ${
                    isActive(link.path)
                      ? 'bg-[#D4AF37]/20 text-[#D4AF37] font-semibold'
                      : 'text-gray-300 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Busca Mobile */}
            <div className="border-t border-[#D4AF37]/20 pt-3">
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Buscar CDs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-[#1a1a1a] text-white placeholder-gray-500 px-4 py-2 rounded-lg border border-[#D4AF37]/30 text-sm focus:outline-none focus:border-[#D4AF37]"
                />
                <button
                  type="submit"
                  className="bg-[#D4AF37] text-black px-4 py-2 rounded-lg font-medium text-sm hover:bg-[#F4E4BC] transition-colors"
                >
                  <Search size={16} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
