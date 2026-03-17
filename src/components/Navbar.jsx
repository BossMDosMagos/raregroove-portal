import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Search, ShoppingCart, LogOut, User, Settings, Wallet, Home, Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useUnreadMessages } from '../contexts/UnreadMessagesContext';
import { useI18n } from '../contexts/I18nContext.jsx';
import { useCart } from '../contexts/CartContext.jsx';
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
        loadNotifications(authUser.id);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setNotifications([]);
      }
    };

    loadUser();

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

  const markAsRead = async (notificationId) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
  };

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Sessão encerrada');
    navigate('/');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/catalogo?search=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
      setSearchOpen(false);
    }
  };

  const navLinks = [
    { label: 'Explorar', path: '/catalogo' },
    { label: 'Grooveflix', path: '/grooveflix' },
    { label: 'Planos', path: '/plans' },
    { label: 'Meu Acervo', path: '/meu-acervo' },
  ];

  const isActive = (path) => location.pathname === path;

  if (!user) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      {/* Glassmorphism Navbar */}
      <div className="bg-black/70 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* LEFT: Logo */}
          <Link
            to="/portal"
            className="flex-shrink-0 flex items-center gap-3 group"
          >
            <img 
              src={logoRareGroove}
              alt="Rare Groove" 
              className="h-9 w-auto object-contain"
            />
          </Link>

          {/* CENTER: Navigation Links */}
          <div className="hidden md:flex items-center gap-10">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`relative text-xs font-medium uppercase tracking-[0.15em] py-1 transition-all duration-300 group ${
                  isActive(link.path)
                    ? 'text-white'
                    : 'text-white/50 group-hover:text-white'
                }`}
              >
                {link.label}
                <span className={`absolute -bottom-1 left-0 h-[2px] bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-300 ${
                  isActive(link.path) ? 'w-full' : 'w-0 group-hover:w-full'
                }`} />
                {isActive(link.path) && (
                  <span className="absolute -bottom-1 left-0 w-full h-[2px] bg-gradient-to-r from-amber-400 to-amber-600 animate-pulse" />
                )}
              </Link>
            ))}
          </div>

          {/* RIGHT: Actions */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="hidden lg:block">
              {searchOpen ? (
                <form onSubmit={handleSearch} className="flex items-center">
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-40 bg-white/5 border border-white/10 rounded-l-lg px-4 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 transition-all"
                  />
                  <button
                    type="submit"
                    className="bg-amber-500/20 border border-l-0 border-white/10 px-3 py-1.5 rounded-r-lg text-amber-400 hover:bg-amber-500/30 transition-colors"
                  >
                    <Search size={14} />
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all"
                >
                  <Search size={18} />
                </button>
              )}
            </div>

            {/* Cart */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="relative p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all"
            >
              <ShoppingCart size={18} />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Notifications */}
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all"
              >
                <Bell size={18} />
                {totalUnreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
                    {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/10">
                    <p className="text-white text-sm font-medium">Notificações</p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-white/30 text-sm">
                        Nenhuma notificação
                      </div>
                    ) : (
                      notifications.slice(0, 5).map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => {
                            markAsRead(notif.id);
                            setNotificationsOpen(false);
                            if (notif.item_id) navigate(`/item/${notif.item_id}`);
                          }}
                          className={`px-4 py-3 border-b border-white/5 cursor-pointer transition-colors ${
                            notif.is_read ? 'bg-transparent' : 'bg-amber-500/5 hover:bg-amber-500/10'
                          }`}
                        >
                          <p className={`text-sm font-medium ${notif.is_read ? 'text-white/50' : 'text-white'}`}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-white/30 mt-0.5 line-clamp-1">
                            {notif.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Admin */}
            {isAdmin && (
              <Link
                to="/admin"
                className="hidden md:block px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs font-medium uppercase tracking-wider hover:bg-white/10 hover:text-white hover:border-white/20 transition-all"
              >
                Admin
              </Link>
            )}

            {/* Profile Avatar */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="p-0.5 rounded-full hover:bg-white/5 transition-all"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border border-white/20 flex items-center justify-center text-black font-semibold text-sm overflow-hidden shadow-lg">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    profile?.full_name?.[0] || 'U'
                  )}
                </div>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/10">
                    <p className="text-white text-sm font-medium">
                      {profile?.full_name || 'Usuário'}
                    </p>
                    <p className="text-white/40 text-xs truncate">
                      {user?.email}
                    </p>
                  </div>

                  <div className="py-2">
                    <Link
                      to="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <User size={16} />
                      <span className="text-sm">Perfil</span>
                    </Link>
                    <Link
                      to="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Wallet size={16} />
                      <span className="text-sm">Saldo</span>
                    </Link>
                    <Link
                      to="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Settings size={16} />
                      <span className="text-sm">Configurações</span>
                    </Link>
                  </div>

                  <div className="border-t border-white/10 py-2">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut size={16} />
                      <span className="text-sm">Sair</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-white/50 hover:text-white"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#050505]/95 backdrop-blur-xl border-b border-white/10">
          <div className="px-4 py-4 space-y-3">
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-center text-sm font-medium uppercase tracking-wider"
              >
                Admin
              </Link>
            )}
            <div className="space-y-1 border-t border-white/10 pt-3">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.path)
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}