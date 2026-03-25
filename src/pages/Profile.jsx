import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { fetchProfile, upsertProfile, uploadAvatar } from '../utils/profileService';
import { fetchUserAddresses, createAddress, updateAddress, deleteAddress, setAddressAsDefault, validateAddress } from '../utils/addressService';
import Avatar from '../components/Avatar';
import { RatingDisplay, EliteBadge, ReviewCard, RatingStats } from '../components/RatingComponents';
import { WishlistModal, WishlistCard, WishlistEmptyState } from '../components/WishlistComponents';
import { FinancialDashboard } from '../components/FinancialComponents';
import { InfoBox, Pill } from '../components/UIComponents';
import {
  User, Star, RefreshCw, ShoppingBag, Settings, LogOut, Loader2, Gift,
  MapPin, Phone, Edit3, Save, X, Disc, Heart, MessageSquare, CreditCard, Users, Camera, Plus, Trash2, CheckCircle2, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '../contexts/I18nContext.jsx';
import { useSubscription } from '../contexts/SubscriptionContext.jsx';

const GoldInput = ({ label, ...props }) => (
  <div className="flex flex-col gap-2 group">
    {label && <label className="text-[10px] text-gold-premium/50 font-black uppercase tracking-[0.2em] ml-1 group-focus-within:text-gold-premium transition-colors">{label}</label>}
    <input
      {...props}
      className="bg-charcoal-deep/50 border border-gold-premium/10 rounded-2xl px-5 py-4 text-white text-sm
                 focus:outline-none focus:border-gold-premium/50 focus:ring-4 focus:ring-gold-premium/5 transition-all placeholder:text-white/10 w-full shadow-inner"
    />
  </div>
);

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between items-center py-4 border-b border-gold-premium/5 last:border-0 group">
    <span className="text-silver-premium/40 text-xs font-bold uppercase tracking-wider group-hover:text-silver-premium/60 transition-colors">{label}</span>
    <span className="text-white text-sm font-medium tracking-tight">{value || '—'}</span>
  </div>
);

const StatCard = ({ label, value, icon: Icon }) => {
  const valueSize = value?.toString().length > 15 ? 'text-xs' : value?.toString().length > 8 ? 'text-base' : 'text-3xl';
  
  return (
    <div className="glass-card rounded-[2rem] p-6 flex items-center gap-5 hover:border-gold-premium/30 transition-all duration-500 group shadow-xl">
      <div className="w-14 h-14 rounded-2xl bg-gold-premium/5 border border-gold-premium/10 flex items-center justify-center text-gold-premium shrink-0 group-hover:bg-gold-premium group-hover:text-charcoal-deep transition-all duration-500 shadow-lg">
        <Icon size={24} className="group-hover:scale-110 transition-transform" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className={`font-black text-luxury ${valueSize} truncate leading-none`}>{value}</p>
        <p className="text-silver-premium/30 text-[10px] font-black uppercase tracking-widest leading-tight">{label}</p>
      </div>
    </div>
  );
};

// ─── Funções de Formatação ──────────────────────────────
const formatCPF = (value) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
};

const formatPhone = (value) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  if (cleaned.length <= 11) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  return `+55 (${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
};

const formatCEP = (value) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 5) return cleaned;
  return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 8)}`;
};

const formatRG = (value) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 5) return `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
  if (cleaned.length <= 8) return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5)}`;
  return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}-${cleaned.slice(8, 9)}`;
};

const formatPixKey = (value) => {
  // Usa a função centralizada de formatação
  return formatPixKeyDisplay(value);
};

const fetchAddressByCEP = async (cep) => {
  const cleaned = cep.replace(/\D/g, '');
  if (cleaned.length !== 8) return null;
  
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
    const data = await response.json();
    
    if (data.erro) return null;
    
    return {
      address: data.logradouro,
      city: data.localidade,
      state: data.uf
    };
  } catch (error) {
    return null;
  }
};

export default function Profile() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { profile: subscriptionProfile } = useSubscription();
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cepLoading, setCepLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);
  const lastPixKeyRef = useRef('');
  const [editData, setEditData] = useState({
    email: '',
    full_name: '',
    cpf_cnpj: '',
    rg: '',
    phone: '',
    cep: '',
    address: '',
    number: '',
    complement: '',
    city: '',
    state: '',
    avatar_url: ''
  });
  const [items, setItems] = useState([]);
  const [messages, setMessages] = useState([]);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [ratingStats, setRatingStats] = useState(null);
  const [isElite, setIsElite] = useState(false);
  const [showWishlistModal, setShowWishlistModal] = useState(false);
  const [editingWish, setEditingWish] = useState(null);
  const [managingSubscription, setManagingSubscription] = useState(false);
  
  // States para gerenciar endereços
  const [userAddresses, setUserAddresses] = useState([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [addressFormData, setAddressFormData] = useState({
    label: '',
    full_name: '',
    phone: '',
    cep: '',
    address: '',
    number: '',
    complement: '',
    city: '',
    state: ''
  });
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressCepLoading, setAddressCepLoading] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        toast.error('SESSÃO EXPIRADA', {
          description: 'Por favor, faça login novamente',
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
        navigate('/');
        return;
      }

      setCurrentUser(user);

      // Fetch profile data from profiles table
      const profileData = await fetchProfile(user.id);
      
      setEditData({
        email: user.email || '',
        full_name: profileData?.full_name || user.user_metadata?.full_name || '',
        cpf_cnpj: formatCPF(profileData?.cpf_cnpj || ''),
        rg: formatRG(profileData?.rg || ''),
        phone: formatPhone(profileData?.phone || ''),
        cep: formatCEP(profileData?.cep || ''),
        address: profileData?.address || '',
        number: profileData?.number || '',
        complement: profileData?.complement || '',
        city: profileData?.city || '',
        state: profileData?.state || '',
        avatar_url: profileData?.avatar_url || ''
      });

      // Fetch user's items
      const { data: itemsData } = await supabase
        .from('items')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      setItems(itemsData || []);

      // Carregar endereços do usuário
      const addressesData = await fetchUserAddresses(user.id);
      setUserAddresses(addressesData);

      // Load wishlist items from database
      const { data: wishlistData } = await supabase
        .from('wishlist')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      setWishlistItems(wishlistData || []);

      // Fetch user's messages
      const { data: messagesData } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      setMessages(messagesData || []);

      // Fetch user's reviews (Top 3 most recent)
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select(`
          *,
          reviewer_profile:profiles!reviews_reviewer_id_fkey(id, full_name, avatar_url)
        `)
        .eq('reviewed_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      setReviews(reviewsData || []);

      // Fetch rating statistics
      const { data: statsData } = await supabase
        .rpc('get_user_rating', { user_uuid: user.id })
        .single();

      setRatingStats(statsData);

      // Verificar se é Elite Seller (com guarda de segurança)
      const userId = user?.id;
      if (userId) {
        try {
          const { data: eliteData, error } = await supabase
            .rpc('is_elite_seller', { user_uuid: userId });
          
          if (error) {
            if (error.code !== 'PGRST202' && error.code !== '42883') {
              setIsElite(false);
            }
          } else {
            setIsElite(Boolean(eliteData?.is_elite));
          }
        } catch (e) {
          setIsElite(false);
        }
      } else {
        setIsElite(false);
      }

      setIsLoading(false);
    };

    loadProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleManageSubscription = async () => {
    const provider = String(subscriptionProfile?.subscription_provider || '').toLowerCase();
    if (!provider) {
      navigate('/plans');
      return;
    }

    if (provider !== 'stripe') {
      toast.message('GERENCIAR ASSINATURA', {
        description: 'Para Mercado Pago, a gestão é feita via suporte. Abra um chamado no chat e informe seu email.',
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
      return;
    }

    setManagingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-create-billing-portal', {
        body: { return_url: `${window.location.origin}/profile` }
      });
      if (error) throw error;
      const url = data?.url ? String(data.url) : '';
      if (!url) throw new Error('Billing portal indisponível');
      window.location.href = url;
    } catch (e) {
      toast.error('ERRO AO ABRIR PORTAL', {
        description: e.message,
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setManagingSubscription(false);
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    const publicUrl = await uploadAvatar(currentUser.id, file);
    
    if (publicUrl) {
      setEditData(prev => ({ ...prev, avatar_url: publicUrl }));
      toast.success('AVATAR ATUALIZADO', {
        description: 'Sua foto foi salva com sucesso',
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
    }
    
    setAvatarUploading(false);
  };

  const handleSaveProfile = async () => {
    try {
      // Validações básicas
      if (!editData.full_name.trim()) {
        toast.error('CAMPO OBRIGATÓRIO', {
          description: 'Nome completo não pode estar vazio',
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
        return;
      }
      
      const cpfValidation = editData.cpf_cnpj.replace(/\D/g, '');
      if (cpfValidation.length !== 11 && cpfValidation.length !== 14) {
        toast.error('CPF/CNPJ INVÁLIDO', {
          description: 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos',
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
        return;
      }

      // Salvar na tabela profiles (update direto)
      await upsertProfile(currentUser.id, {
        email: editData.email,
        full_name: editData.full_name,
        cpf_cnpj: editData.cpf_cnpj,
        rg: editData.rg,
        phone: editData.phone,
        cep: editData.cep,
        address: editData.address,
        number: editData.number,
        complement: editData.complement,
        city: editData.city,
        state: editData.state
      });

      toast.success('PERFIL ATUALIZADO', {
        description: 'Todas as alterações foram salvas com sucesso',
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
      setEditing(false);
      
      // Recarregar perfil atualizado
      const updatedProfile = await fetchProfile(currentUser.id);
      if (updatedProfile) {
        setEditData({
          email: updatedProfile.email || '',
          full_name: updatedProfile.full_name || '',
          cpf_cnpj: formatCPF(updatedProfile.cpf_cnpj || ''),
          rg: formatRG(updatedProfile.rg || ''),
          phone: formatPhone(updatedProfile.phone || ''),
          cep: formatCEP(updatedProfile.cep || ''),
          address: updatedProfile.address || '',
          number: updatedProfile.number || '',
          complement: updatedProfile.complement || '',
          city: updatedProfile.city || '',
          state: updatedProfile.state || '',
          avatar_url: updatedProfile.avatar_url || ''
        });
      }
    } catch (error) {
      // Tratamento específico de erros
      let errorTitle = 'ERRO AO ATUALIZAR';
      let errorDescription = 'Não foi possível salvar seu perfil';
      
      if (error.code === '23505') {
        // Violação de constraint (duplicação)
        const errorMsg = error.message?.toLowerCase() || '';
        if (errorMsg.includes('cpf_cnpj')) {
          errorTitle = 'CPF/CNPJ JÁ CADASTRADO';
          errorDescription = 'Este CPF/CNPJ já está vinculado a outro perfil';
        } else if (errorMsg.includes('rg')) {
          errorTitle = 'RG JÁ CADASTRADO';
          errorDescription = 'Este RG já está vinculado a outro perfil';
        } else if (errorMsg.includes('email')) {
          errorTitle = 'EMAIL JÁ CADASTRADO';
          errorDescription = 'Este email já está vinculado a outro perfil';
        }
      } else if (error.code === '42501' || error.message?.includes('row-level security')) {
        errorTitle = 'ERRO DE PERMISSÃO';
        errorDescription = 'Sua sessão pode ter expirado. Tente fazer login novamente.';
      } else if (error.message) {
        errorDescription = error.message;
      }
      
      toast.error(errorTitle, {
        description: errorDescription,
        duration: 6000,
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    }
  };

  const handleCEPChange = async (cep) => {
    const formatted = formatCEP(cep);
    setEditData({ ...editData, cep: formatted });
    
    const cleaned = formatted.replace(/\D/g, '');
    if (cleaned.length === 8) {
      setCepLoading(true);
      const addressData = await fetchAddressByCEP(cleaned);
      setCepLoading(false);
      
      if (addressData) {
        setEditData(prev => ({
          ...prev,
          address: addressData.address,
          city: addressData.city,
          state: addressData.state
        }));
        toast.success('ENDEREÇO PREENCHIDO', {
          description: 'Dados carregados automaticamente via CEP',
          style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
        });
      } else {
        toast.error('CEP NÃO ENCONTRADO', {
          description: 'Verifique o CEP e tente novamente',
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
      }
    }
  };

  // ========== FUNÇÕES DE GERENCIAMENTO DE ENDEREÇOS ==========

  const handleAddressCEPChange = async (cep) => {
    const formatted = formatCEP(cep);
    setAddressFormData({ ...addressFormData, cep: formatted });
    
    const cleaned = formatted.replace(/\D/g, '');
    if (cleaned.length === 8) {
      setAddressCepLoading(true);
      const addressData = await fetchAddressByCEP(cleaned);
      setAddressCepLoading(false);
      
      if (addressData) {
        setAddressFormData(prev => ({
          ...prev,
          address: addressData.address,
          city: addressData.city,
          state: addressData.state.toUpperCase()
        }));
        toast.success('ENDEREÇO PREENCHIDO', {
          description: 'Dados carregados automaticamente via CEP',
          style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
        });
      } else {
        toast.error('CEP NÃO ENCONTRADO', {
          description: 'Verifique o CEP e tente novamente',
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
      }
    }
  };

  const handleSaveAddress = async () => {
    const validation = validateAddress(addressFormData);
    
    if (!validation.isValid) {
      validation.errors.forEach(error => {
        toast.error('ERRO NA VALIDAÇÃO', {
          description: error,
          duration: 4000,
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
      });
      return;
    }

    setAddressLoading(true);

    try {
      if (editingAddress) {
        // Atualizar endereço existente
        const updated = await updateAddress(editingAddress.id, addressFormData);
        setUserAddresses(prev => prev.map(a => a.id === updated.id ? updated : a));
        toast.success('ENDEREÇO ATUALIZADO', {
          description: addressFormData.label,
          style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
        });
      } else {
        // Criar novo endereço
        const newAddress = await createAddress(currentUser.id, addressFormData);
        setUserAddresses(prev => [newAddress, ...prev]);
        toast.success('ENDEREÇO ADICIONADO', {
          description: addressFormData.label,
          style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
        });
      }
      
      // Limpar formulário e fechar modal
      setAddressFormData({
        label: '',
        full_name: '',
        phone: '',
        cep: '',
        address: '',
        number: '',
        complement: '',
        city: '',
        state: ''
      });
      setEditingAddress(null);
      setShowAddressModal(false);
    } catch (error) {
      toast.error('ERRO AO SALVAR', {
        description: error.message || 'Não foi possível salvar o endereço',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setAddressLoading(false);
    }
  };

  const handleDeleteAddress = async (addressId) => {
    if (!confirm('Tem certeza que deseja deletar este endereço?')) return;

    try {
      await deleteAddress(addressId);
      setUserAddresses(prev => prev.filter(a => a.id !== addressId));
      toast.success('ENDEREÇO REMOVIDO', {
        description: 'Endereço foi deletado com sucesso',
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
    } catch (error) {
      toast.error('ERRO AO REMOVER', {
        description: 'Não foi possível remover o endereço',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    }
  };

  const handleSetDefaultAddress = async (addressId) => {
    try {
      await setAddressAsDefault(addressId);
      const updated = await fetchUserAddresses(currentUser.id);
      setUserAddresses(updated);
      toast.success('ENDEREÇO PRINCIPAL DEFINIDO', {
        description: 'Endereço será usado como padrão para recebimentos',
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
    } catch (error) {
      toast.error('ERRO AO ATUALIZAR', {
        description: 'Não foi possível definir como endereço principal',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    }
  };

  const handleEditAddress = (address) => {
    setEditingAddress(address);
    setAddressFormData({
      label: address.label,
      full_name: address.full_name,
      phone: address.phone || '',
      cep: address.cep,
      address: address.address,
      number: address.number,
      complement: address.complement || '',
      city: address.city,
      state: address.state
    });
    setShowAddressModal(true);
  };

  const handleOpenNewAddressModal = () => {
    setEditingAddress(null);
    // Pré-preencher com dados do perfil if not saved yet
    setAddressFormData({
      label: '',
      full_name: editData.full_name || '',
      phone: editData.phone || '',
      cep: '',
      address: '',
      number: '',
      complement: '',
      city: '',
      state: ''
    });
    setShowAddressModal(true);
  };

  if (isLoading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-[#D4AF37] animate-spin" />
    </div>
  );

  const tabs = [
    { id: 'overview', label: t('profile.tabs.overview'), icon: User },
    { id: 'addresses', label: t('profile.tabs.addresses'), icon: MapPin },
    { id: 'financial', label: t('profile.tabs.financial'), icon: CreditCard },
    { id: 'swaps', label: t('profile.tabs.swaps'), icon: RefreshCw },
    { id: 'purchases', label: t('profile.tabs.purchases'), icon: ShoppingBag },
    { id: 'wishlist', label: t('profile.tabs.wishlist'), icon: Heart },
    { id: 'settings', label: t('profile.tabs.settings'), icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-charcoal-deep text-white py-12 px-4 md:px-8 pt-28 selection:bg-gold-premium/30 selection:text-gold-light">
      <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-1000">
        
        {/* Profile Header Card */}
        <div className="glass-card rounded-[3rem] p-8 md:p-12 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gold-premium/5 rounded-full -mr-48 -mt-48 blur-3xl" />
          
          <div className="flex flex-col md:flex-row items-center gap-10 relative">
            <div className="relative group">
              <Avatar 
                src={editData.avatar_url} 
                name={editData.full_name}
                size="2xl" 
                className="rounded-[3rem] ring-4 ring-gold-premium/20 shadow-2xl group-hover:ring-gold-premium/40 transition-all duration-500"
              />
              <button 
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 bg-gold-premium text-charcoal-deep p-4 rounded-2xl shadow-2xl hover:scale-110 transition-transform active:scale-95"
              >
                {avatarUploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
              </button>
              <input 
                type="file" 
                ref={avatarInputRef} 
                onChange={handleAvatarUpload} 
                accept="image/*" 
                className="hidden" 
              />
            </div>

            <div className="flex-1 text-center md:text-left space-y-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                  <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase text-luxury">{editData.full_name || 'Colecionador'}</h1>
                  {isElite && <EliteBadge />}
                </div>
                <p className="text-silver-premium/40 font-medium uppercase tracking-[0.3em] text-xs">{editData.email}</p>
              </div>

              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <StatCard label={t('profile.reputation.title')} value={ratingStats?.avg_rating?.toFixed(1) || '0.0'} icon={Star} />
                <StatCard label="CDs Listados" value={items.length} icon={Disc} />
                <StatCard label="Conversas" value={messages.length} icon={MessageSquare} />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {subscriptionProfile?.subscription_provider && (
                <button
                  onClick={handleManageSubscription}
                  disabled={managingSubscription}
                  className="flex items-center justify-center gap-3 bg-charcoal-mid/50 text-fuchsia-200 border border-fuchsia-500/20 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-fuchsia-500/10 hover:border-fuchsia-500/40 transition-all duration-500 shadow-xl disabled:opacity-50"
                >
                  {managingSubscription ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
                  Gerenciar assinatura
                </button>
              )}
              <button 
                onClick={() => setEditing(!editing)}
                className="flex items-center justify-center gap-3 bg-charcoal-mid/50 text-gold-premium border border-gold-premium/20 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-gold-premium hover:text-charcoal-deep transition-all duration-500 shadow-xl"
              >
                {editing ? <><X size={16} /> {t('profile.form.cancel')}</> : <><Edit3 size={16} /> {t('profile.settings.edit')}</>}
              </button>
              <button 
                onClick={handleLogout}
                className="flex items-center justify-center gap-3 bg-danger/5 text-danger border border-danger/20 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-danger hover:text-white transition-all duration-500"
              >
                <LogOut size={16} /> {t('profile.logout')}
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto gap-2 pb-4 no-scrollbar scroll-smooth">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-8 py-5 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-500
                ${activeTab === tab.id 
                  ? 'bg-gold-premium text-charcoal-deep shadow-[0_0_30px_rgba(212,175,55,0.2)] scale-105' 
                  : 'text-silver-premium/40 hover:text-gold-premium hover:bg-gold-premium/5 border border-transparent hover:border-gold-premium/10'
                }`}
            >
              <tab.icon size={16} className={activeTab === tab.id ? 'animate-pulse' : ''} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-10">
                {/* Personal Data Section */}
                <div className="glass-card rounded-[2.5rem] p-10 space-y-8">
                  <div className="flex items-center justify-between border-b border-gold-premium/5 pb-6">
                    <h2 className="text-xl font-black uppercase tracking-tighter text-luxury flex items-center gap-3">
                      <User className="text-gold-premium" size={20} /> {t('profile.personalData.title')}
                    </h2>
                  </div>
                  
                  {editing ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <GoldInput label={t('profile.personalData.fullName')} value={editData.full_name} onChange={e => setEditData({ ...editData, full_name: e.target.value })} />
                      <GoldInput label={t('profile.personalData.cpf')} value={editData.cpf_cnpj} onChange={e => setEditData({ ...editData, cpf_cnpj: formatCPF(e.target.value) })} />
                      <GoldInput label="RG" value={editData.rg} onChange={e => setEditData({ ...editData, rg: formatRG(e.target.value) })} />
                      <GoldInput label={t('profile.personalData.phone')} value={editData.phone} onChange={e => setEditData({ ...editData, phone: formatPhone(e.target.value) })} />
                      <div className="md:col-span-2 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          <div className="relative">
                            <GoldInput label="CEP" value={editData.cep} onChange={e => handleCEPChange(e.target.value)} />
                            {cepLoading && <Loader2 className="absolute right-4 bottom-4 animate-spin text-gold-premium" size={16} />}
                          </div>
                          <div className="md:col-span-2">
                            <GoldInput label="Endereço" value={editData.address} onChange={e => setEditData({ ...editData, address: e.target.value })} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                          <GoldInput label="Número" value={editData.number} onChange={e => setEditData({ ...editData, number: e.target.value })} />
                          <GoldInput label="Complemento" value={editData.complement} onChange={e => setEditData({ ...editData, complement: e.target.value })} />
                          <GoldInput label="Cidade" value={editData.city} onChange={e => setEditData({ ...editData, city: e.target.value })} />
                          <GoldInput label="Estado" value={editData.state} onChange={e => setEditData({ ...editData, state: e.target.value.toUpperCase() })} maxLength={2} />
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                          <p className="text-amber-300 text-xs font-bold uppercase tracking-wider">PIX do Portal</p>
                          <p className="text-white/60 text-sm mt-1">
                            O PIX para recebimento de vendas é gerenciado pelo portal. Configure em Configurações Financeiras.
                          </p>
                        </div>
                      </div>
                      <div className="md:col-span-2 pt-6">
                        <button onClick={handleSaveProfile} className="w-full bg-gold-premium text-charcoal-deep py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all active:scale-[0.98]">
                          <Save size={18} className="inline mr-2" /> {t('profile.form.save')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
                      <div className="space-y-1">
                        <InfoRow label={t('profile.personalData.fullName')} value={editData.full_name} />
                        <InfoRow label={t('profile.personalData.cpf')} value={editData.cpf_cnpj} />
                        <InfoRow label="RG" value={editData.rg} />
                        <InfoRow label={t('profile.personalData.phone')} value={editData.phone} />
                      </div>
                      <div className="space-y-1">
                        <InfoRow label="Endereço" value={`${editData.address}, ${editData.number}`} />
                        <InfoRow label="Cidade/UF" value={`${editData.city} - ${editData.state}`} />
                        <InfoRow label="CEP" value={editData.cep} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Listed Items Preview */}
                <div className="glass-card rounded-[2.5rem] p-10 space-y-8">
                  <div className="flex items-center justify-between border-b border-gold-premium/5 pb-6">
                    <h2 className="text-xl font-black uppercase tracking-tighter text-luxury flex items-center gap-3">
                      <Disc className="text-gold-premium" size={20} /> {t('profile.myListedCds')}
                    </h2>
                    <button onClick={() => setActiveTab('inventory')} className="text-gold-premium/60 text-[10px] font-black uppercase tracking-widest hover:text-gold-premium transition-colors">
                      {t('profile.viewAll')}
                    </button>
                  </div>
                  
                  {items.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                      {items.slice(0, 3).map(item => (
                        <div key={item.id} className="group cursor-pointer" onClick={() => navigate(`/item/${item.id}`)}>
                          <div className="aspect-square rounded-3xl overflow-hidden mb-3 border border-gold-premium/10 group-hover:border-gold-premium/40 transition-all duration-500 shadow-lg">
                            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                          </div>
                          <p className="text-white text-xs font-bold truncate tracking-tight uppercase">{item.title}</p>
                          <p className="text-gold-premium font-black text-xs">R$ {item.price}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center space-y-4">
                      <Disc className="mx-auto text-silver-premium/10" size={48} />
                      <p className="text-silver-premium/40 text-xs font-bold uppercase tracking-widest">{t('profile.noListed')}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-10">
                {/* Reputation Stats */}
                <div className="glass-card rounded-[2.5rem] p-10">
                  <h2 className="text-xl font-black uppercase tracking-tighter text-luxury mb-8 flex items-center gap-3">
                    <Star className="text-gold-premium" size={20} /> {t('profile.reputation.title')}
                  </h2>
                  <RatingStats stats={ratingStats} />
                </div>

                {/* Latest Reviews */}
                <div className="glass-card rounded-[2.5rem] p-10">
                  <h2 className="text-xl font-black uppercase tracking-tighter text-luxury mb-8 flex items-center gap-3">
                    <MessageSquare className="text-gold-premium" size={20} /> {t('profile.latestReviews')}
                  </h2>
                  <div className="space-y-6">
                    {reviews.length > 0 ? (
                      reviews.map(review => (
                        <ReviewCard key={review.id} review={review} compact />
                      ))
                    ) : (
                      <p className="text-silver-premium/30 text-xs font-bold uppercase tracking-widest text-center py-8">{t('profile.noComments')}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FINANCEIRO */}
          {activeTab === 'financial' && (
            <div className="glass-card rounded-[2.5rem] p-10 space-y-8">
              <h2 className="text-xl font-black uppercase tracking-tighter text-luxury flex items-center gap-3">
                <CreditCard className="text-gold-premium" size={20} /> {t('profile.financial.title')}
              </h2>
              <FinancialDashboard userId={currentUser?.id} />
            </div>
          )}

          {/* TROCAS */}
          {activeTab === 'swaps' && (
            <div className="glass-card rounded-[2.5rem] p-10 space-y-8">
              <h2 className="text-xl font-black uppercase tracking-tighter text-luxury flex items-center gap-3">
                <RefreshCw className="text-gold-premium" size={20} /> {t('profile.swaps.title')}
              </h2>
              <div className="py-16 text-center space-y-4">
                <RefreshCw className="mx-auto text-silver-premium/10" size={48} />
                <p className="text-silver-premium/40 text-xs font-bold uppercase tracking-widest">{t('profile.swaps.empty')}</p>
                <button
                  onClick={() => navigate('/catalogo')}
                  className="px-8 py-4 glass-card border-gold-premium/20 text-gold-premium/60 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-gold-premium hover:border-gold-premium transition-all duration-500"
                >
                  {t('profile.exploreCatalog')}
                </button>
              </div>
            </div>
          )}

          {/* COMPRAS */}
          {activeTab === 'purchases' && (
            <div className="glass-card rounded-[2.5rem] p-10 space-y-8">
              <h2 className="text-xl font-black uppercase tracking-tighter text-luxury flex items-center gap-3">
                <ShoppingBag className="text-gold-premium" size={20} /> {t('profile.purchases.title')}
              </h2>
              <div className="py-16 text-center space-y-4">
                <ShoppingBag className="mx-auto text-silver-premium/10" size={48} />
                <p className="text-silver-premium/40 text-xs font-bold uppercase tracking-widest">{t('profile.purchases.empty')}</p>
                <button
                  onClick={() => navigate('/catalogo')}
                  className="px-8 py-4 glass-card border-gold-premium/20 text-gold-premium/60 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-gold-premium hover:border-gold-premium transition-all duration-500"
                >
                  {t('profile.exploreCatalog')}
                </button>
              </div>
            </div>
          )}

          {/* LISTA DE DESEJOS */}
          {activeTab === 'wishlist' && (
            <div className="glass-card rounded-[2.5rem] p-10 space-y-8">
              <div className="flex items-center justify-between border-b border-gold-premium/5 pb-6">
                <h2 className="text-xl font-black uppercase tracking-tighter text-luxury flex items-center gap-3">
                  <Heart className="text-gold-premium" size={20} /> {t('profile.wishlist.title')} ({wishlistItems.length})
                </h2>
                <button
                  onClick={() => {
                    setEditingWish(null);
                    setShowWishlistModal(true);
                  }}
                  className="flex items-center gap-3 bg-gold-premium text-charcoal-deep px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] hover:scale-105 transition-all duration-500"
                >
                  <Plus size={16} /> {t('profile.wishlist.add')}
                </button>
              </div>
              
              {wishlistItems.length === 0 ? (
                <WishlistEmptyState onAddWish={() => setShowWishlistModal(true)} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {wishlistItems.map(wish => (
                    <WishlistCard
                      key={wish.id}
                      wish={wish}
                      onEdit={(w) => {
                        setEditingWish(w);
                        setShowWishlistModal(true);
                      }}
                      onDelete={(id) => {
                        setWishlistItems(prev => prev.filter(w => w.id !== id));
                      }}
                      onToggleActive={(id) => {
                        setWishlistItems(prev => prev.map(w => 
                          w.id === id ? { ...w, active: !w.active } : w
                        ));
                      }}
                    />
                  ))}
                </div>
              )}
              
              <WishlistModal
                isOpen={showWishlistModal}
                onClose={() => {
                  setShowWishlistModal(false);
                  setEditingWish(null);
                }}
                editingWish={editingWish}
                onWishAdded={async () => {
                  // Recarregar wishlist
                  const { data } = await supabase
                    .from('wishlist')
                    .select('*')
                    .eq('user_id', currentUser.id)
                    .order('created_at', { ascending: false });
                  setWishlistItems(data || []);
                }}
              />
            </div>
          )}

          {/* CONFIGURAÇÕES */}
          {activeTab === 'settings' && (
            <div className="glass-card rounded-[2.5rem] p-10 space-y-8 max-w-4xl mx-auto">
              <div className="flex items-center justify-between border-b border-gold-premium/5 pb-6">
                <h2 className="text-xl font-black uppercase tracking-tighter text-luxury flex items-center gap-3">
                  <Settings className="text-gold-premium" size={20} /> {t('profile.settings.title')}
                </h2>
                {editing && (
                  <button onClick={() => setEditing(false)} className="text-silver-premium/40 hover:text-gold-premium transition-colors">
                    <X size={20} />
                  </button>
                )}
              </div>

              {!editing ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-card rounded-2xl p-5 border-gold-premium/10">
                      <p className="text-silver-premium/40 text-[10px] uppercase font-black tracking-widest mb-1">{t('profile.personalData.fullName')}</p>
                      <p className="text-white font-medium">{editData.full_name || '—'}</p>
                    </div>
                    <div className="glass-card rounded-2xl p-5 border-gold-premium/10">
                      <p className="text-silver-premium/40 text-[10px] uppercase font-black tracking-widest mb-1">Email</p>
                      <p className="text-white font-medium truncate">{editData.email || '—'}</p>
                    </div>
                    <div className="glass-card rounded-2xl p-5 border-gold-premium/10">
                      <p className="text-silver-premium/40 text-[10px] uppercase font-black tracking-widest mb-1">{t('profile.personalData.cpf')}</p>
                      <p className="text-white font-medium font-mono">{editData.cpf_cnpj || '—'}</p>
                    </div>
                    <div className="glass-card rounded-2xl p-5 border-gold-premium/10">
                      <p className="text-silver-premium/40 text-[10px] uppercase font-black tracking-widest mb-1">RG</p>
                      <p className="text-white font-medium font-mono">{editData.rg || '—'}</p>
                    </div>
                    <div className="glass-card rounded-2xl p-5 border-gold-premium/10">
                      <p className="text-silver-premium/40 text-[10px] uppercase font-black tracking-widest mb-1">{t('profile.personalData.phone')}</p>
                      <p className="text-white font-medium">{editData.phone || '—'}</p>
                    </div>
                    <div className="glass-card rounded-2xl p-5 border-gold-premium/10">
                      <p className="text-silver-premium/40 text-[10px] uppercase font-black tracking-widest mb-1">CEP</p>
                      <p className="text-white font-medium font-mono">{editData.cep || '—'}</p>
                    </div>
                    <div className="glass-card rounded-2xl p-5 border-gold-premium/10 md:col-span-2">
                      <p className="text-silver-premium/40 text-[10px] uppercase font-black tracking-widest mb-1">Endereço</p>
                      <p className="text-white font-medium">{editData.address || '—'}</p>
                    </div>
                    <div className="glass-card rounded-2xl p-5 border-gold-premium/10">
                      <p className="text-silver-premium/40 text-[10px] uppercase font-black tracking-widest mb-1">Número</p>
                      <p className="text-white font-medium">{editData.number || '—'}</p>
                    </div>
                    <div className="glass-card rounded-2xl p-5 border-gold-premium/10 md:col-span-2">
                      <p className="text-silver-premium/40 text-[10px] uppercase font-black tracking-widest mb-1">Complemento</p>
                      <p className="text-white font-medium">{editData.complement || '—'}</p>
                    </div>
                    <div className="glass-card rounded-2xl p-5 border-gold-premium/10">
                      <p className="text-silver-premium/40 text-[10px] uppercase font-black tracking-widest mb-1">Cidade</p>
                      <p className="text-white font-medium">{editData.city || '—'}</p>
                    </div>
                    <div className="glass-card rounded-2xl p-5 border-gold-premium/10">
                      <p className="text-silver-premium/40 text-[10px] uppercase font-black tracking-widest mb-1">Estado</p>
                      <p className="text-white font-medium">{editData.state || '—'}</p>
                    </div>
                  </div>
                  <div className="pt-4">
                    <button
                      onClick={() => setEditing(true)}
                      className="flex items-center gap-3 bg-gold-premium text-charcoal-deep px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] hover:scale-105 transition-all duration-500"
                    >
                      <Edit3 size={16} /> {t('profile.settings.edit')}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveProfile();
                }} className="space-y-6">
                  <InfoBox type="warning">
                    <AlertCircle size={18} className="inline mr-2" /> {t('profile.form.notice')}
                  </InfoBox>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <GoldInput
                      label={t('profile.personalData.fullName')}
                      value={editData.full_name || ''}
                      onChange={e => setEditData({ ...editData, full_name: e.target.value })}
                      placeholder={t('profile.form.fullNamePlaceholder')}
                      required
                    />
                    <GoldInput
                      label="Email"
                      value={editData.email || ''}
                      onChange={e => setEditData({ ...editData, email: e.target.value })}
                      placeholder="seu@email.com"
                      type="email"
                      disabled
                    />
                    <GoldInput
                      label={t('profile.personalData.cpf')}
                      value={editData.cpf_cnpj || ''}
                      onChange={e => setEditData({ ...editData, cpf_cnpj: formatCPF(e.target.value) })}
                      placeholder="000.000.000-00"
                      required
                    />
                    <GoldInput
                      label="RG"
                      value={editData.rg || ''}
                      onChange={e => setEditData({ ...editData, rg: formatRG(e.target.value) })}
                      placeholder="00.000.000-0"
                      required
                    />
                    <GoldInput
                      label={t('profile.personalData.phone')}
                      value={editData.phone || ''}
                      onChange={e => setEditData({ ...editData, phone: formatPhone(e.target.value) })}
                      placeholder="+55 (00) 00000-0000"
                    />
                    <GoldInput
                      label="CEP"
                      value={editData.cep || ''}
                      onChange={e => handleCEPChange(formatCEP(e.target.value))}
                      placeholder="00000-000"
                      disabled={cepLoading}
                    />
                  </div>

                  {cepLoading && (
                    <div className="flex items-center gap-3 p-4 glass-card border-gold-premium/20 text-gold-premium animate-pulse rounded-2xl">
                      <Loader2 size={20} className="animate-spin" />
                      {t('profile.form.fetchingAddress')}
                    </div>
                  )}

                  <GoldInput
                    label={t('profile.form.address')}
                    value={editData.address || ''}
                    onChange={e => setEditData({ ...editData, address: e.target.value })}
                    placeholder={t('profile.form.addressPlaceholder')}
                    disabled={cepLoading}
                  />

                  <GoldInput
                    label={t('profile.form.number')}
                    value={editData.number || ''}
                    onChange={e => setEditData({ ...editData, number: e.target.value })}
                    placeholder={t('profile.form.numberPlaceholder')}
                  />

                  <GoldInput
                    label={t('profile.form.complement')}
                    value={editData.complement || ''}
                    onChange={e => setEditData({ ...editData, complement: e.target.value })}
                    placeholder={t('profile.form.complementPlaceholder')}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <GoldInput
                      label={t('profile.form.city')}
                      value={editData.city || ''}
                      onChange={e => setEditData({ ...editData, city: e.target.value })}
                      placeholder={t('profile.form.cityPlaceholder')}
                      disabled={cepLoading}
                    />
                    <GoldInput
                      label={t('profile.form.state')}
                      value={editData.state || ''}
                      onChange={e => setEditData({ ...editData, state: e.target.value.toUpperCase() })}
                      placeholder="SP"
                      maxLength="2"
                      disabled={cepLoading}
                    />
                  </div>

                  <InfoBox type="info">
                    <p className="font-semibold text-gold-premium mb-2">{t('profile.form.dataInfoTitle')}</p>
                    <ul className="list-disc list-inside space-y-1 text-silver-premium/70 text-sm">
                      <li>{t('profile.form.dataInfo.nameCpf')}</li>
                      <li>{t('profile.form.dataInfo.phone')}</li>
                      <li>{t('profile.form.dataInfo.address')}</li>
                      <li>{t('profile.form.dataInfo.pixKey')}</li>
                    </ul>
                  </InfoBox>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="submit"
                      className="flex items-center gap-3 bg-gold-premium text-charcoal-deep px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] hover:scale-105 transition-all duration-500"
                    >
                      <Save size={16} /> {t('profile.form.save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="px-8 py-4 glass-card border-gold-premium/20 text-gold-premium/60 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:text-gold-premium hover:border-gold-premium transition-all duration-500"
                    >
                      {t('profile.form.cancel')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* MEUS ENDEREÇOS */}
          {activeTab === 'addresses' && (
            <div className="glass-card rounded-[2.5rem] p-10 space-y-8 max-w-4xl mx-auto">
              <div className="flex items-center justify-between border-b border-gold-premium/5 pb-6">
                <h2 className="text-xl font-black uppercase tracking-tighter text-luxury flex items-center gap-3">
                  <MapPin className="text-gold-premium" size={20} /> {t('profile.addresses.title')}
                </h2>
                <button
                  onClick={handleOpenNewAddressModal}
                  className="flex items-center gap-3 bg-gold-premium text-charcoal-deep px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] hover:scale-105 transition-all duration-500"
                >
                  <Plus size={16} /> {t('profile.addresses.add')}
                </button>
              </div>

              {addressLoading && (
                <div className="flex items-center justify-center p-12">
                  <Loader2 size={48} className="text-gold-premium animate-spin" />
                </div>
              )}

              {!addressLoading && userAddresses.length === 0 && (
                <div className="py-16 text-center space-y-4">
                  <MapPin className="mx-auto text-silver-premium/10" size={48} />
                  <p className="text-silver-premium/40 text-xs font-bold uppercase tracking-widest mb-4">{t('profile.addresses.none')}</p>
                  <button
                    onClick={handleOpenNewAddressModal}
                    className="px-8 py-4 glass-card border-gold-premium/20 text-gold-premium/60 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-gold-premium hover:border-gold-premium transition-all duration-500"
                  >
                    {t('profile.addresses.first')}
                  </button>
                </div>
              )}

              {!addressLoading && userAddresses.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {userAddresses.map(address => (
                    <div
                      key={address.id}
                      className="glass-card rounded-2xl p-6 hover:border-gold-premium/30 transition-colors relative shadow-lg"
                    >
                      {address.is_default && (
                        <div className="absolute top-4 right-4 bg-gold-premium/20 border border-gold-premium rounded-full p-2 shadow-xl">
                          <CheckCircle2 size={18} className="text-gold-premium" />
                        </div>
                      )}

                      <div className="pr-12 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-gold-premium font-bold text-base tracking-tight">{address.label}</p>
                          {address.is_default && (
                            <span className="px-3 py-1 bg-gold-premium/10 text-gold-premium text-[10px] rounded-full font-bold uppercase tracking-widest">
                              {t('profile.addresses.defaultBadge')}
                            </span>
                          )}
                        </div>
                        <p className="text-white font-medium text-sm mb-1">{address.full_name}</p>
                        <p className="text-silver-premium/70 text-sm">
                          {address.address}, {address.number}
                        </p>
                        {address.complement && (
                          <p className="text-silver-premium/50 text-sm">{address.complement}</p>
                        )}
                        <p className="text-silver-premium/70 text-sm">
                          {address.city}, {address.state} — {address.cep.replace(/(\d{5})(\d{3})/, '$1-$2')}
                        </p>
                        {address.phone && (
                          <p className="text-silver-premium/50 text-sm mt-2">{address.phone}</p>
                        )}
                      </div>

                      <div className="flex gap-3 pt-4 border-t border-gold-premium/5">
                        <button
                          onClick={() => handleEditAddress(address)}
                          className="flex-1 px-4 py-2 glass-card border-gold-premium/20 text-gold-premium/60 text-xs font-black uppercase tracking-widest rounded-xl hover:text-gold-premium hover:border-gold-premium transition-all duration-300"
                        >
                          {t('profile.addresses.btn.edit')}
                        </button>
                        {!address.is_default && (
                          <button
                            onClick={() => handleSetDefaultAddress(address.id)}
                            className="flex-1 px-4 py-2 glass-card border-gold-premium/20 text-gold-premium/60 text-xs font-black uppercase tracking-widest rounded-xl hover:text-gold-premium hover:border-gold-premium transition-all duration-300"
                          >
                            {t('profile.addresses.btn.default')}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteAddress(address.id)}
                          className="flex-1 px-4 py-2 bg-danger/5 border border-danger/20 text-danger text-xs font-black uppercase tracking-widest rounded-xl hover:bg-danger hover:text-white transition-all duration-300"
                        >
                          {t('profile.addresses.btn.delete')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MODAL PARA ADICIONAR/EDITAR ENDEREÇO */}
          {showAddressModal && (
            <div className="fixed inset-0 bg-charcoal-deep/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
              <div className="glass-card rounded-[2.5rem] max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-500">
                <div className="p-8 border-b border-gold-premium/10 flex items-center justify-between sticky top-0 bg-charcoal-deep/80 backdrop-blur-md rounded-t-[2.5rem] z-10">
                  <h3 className="text-2xl font-black text-luxury">
                    {editingAddress ? t('profile.addresses.modal.edit') : t('profile.addresses.modal.new')}
                  </h3>
                  <button
                    onClick={() => {
                      setShowAddressModal(false);
                      setEditingAddress(null);
                    }}
                    className="text-silver-premium/40 hover:text-gold-premium transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveAddress();
                  }}
                  className="p-8 space-y-6"
                >
                  <GoldInput
                    label={t('profile.addresses.modal.label')}
                    value={addressFormData.label || ''}
                    onChange={e => setAddressFormData({ ...addressFormData, label: e.target.value })}
                    placeholder={t('profile.addresses.modal.labelPlaceholder')}
                  />

                  <GoldInput
                    label={t('profile.addresses.modal.name')}
                    value={addressFormData.full_name || ''}
                    onChange={e => setAddressFormData({ ...addressFormData, full_name: e.target.value })}
                    placeholder={t('profile.addresses.modal.namePlaceholder')}
                  />

                  <GoldInput
                    label={t('profile.addresses.modal.phone')}
                    value={addressFormData.phone || ''}
                    onChange={e => setAddressFormData({ ...addressFormData, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />

                  <GoldInput
                    label={t('profile.addresses.modal.cep')}
                    value={addressFormData.cep || ''}
                    onChange={e => handleAddressCEPChange(e.target.value)}
                    placeholder="00000-000"
                    disabled={addressCepLoading}
                  />

                  {addressCepLoading && (
                    <div className="flex items-center gap-3 p-4 glass-card border-gold-premium/20 text-gold-premium animate-pulse rounded-2xl">
                      <Loader2 size={20} className="animate-spin" />
                      {t('profile.form.fetchingAddress')}
                    </div>
                  )}

                  <GoldInput
                    label={t('profile.addresses.modal.address')}
                    value={addressFormData.address || ''}
                    onChange={e => setAddressFormData({ ...addressFormData, address: e.target.value })}
                    placeholder={t('profile.addresses.modal.addressPlaceholder')}
                    disabled={addressCepLoading}
                  />

                  <GoldInput
                    label={t('profile.addresses.modal.number')}
                    value={addressFormData.number || ''}
                    onChange={e => setAddressFormData({ ...addressFormData, number: e.target.value })}
                    placeholder={t('profile.addresses.modal.numberPlaceholder')}
                  />

                  <GoldInput
                    label={t('profile.addresses.modal.complement')}
                    value={addressFormData.complement || ''}
                    onChange={e => setAddressFormData({ ...addressFormData, complement: e.target.value })}
                    placeholder={t('profile.addresses.modal.complementPlaceholder')}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <GoldInput
                      label={t('profile.addresses.modal.city')}
                      value={addressFormData.city || ''}
                      onChange={(e) => setAddressFormData({ ...addressFormData, city: e.target.value })}
                      placeholder={t('profile.addresses.modal.cityPlaceholder')}
                      disabled={addressCepLoading}
                    />
                    <GoldInput
                      label={t('profile.addresses.modal.state')}
                      value={addressFormData.state || ''}
                      onChange={(e) => setAddressFormData({ ...addressFormData, state: e.target.value.toUpperCase() })}
                      placeholder="SP"
                      maxLength="2"
                      disabled={addressCepLoading}
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="submit"
                      disabled={addressLoading}
                      className="flex items-center gap-3 bg-gold-premium text-charcoal-deep px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] hover:scale-105 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {addressLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          {t('profile.addresses.modal.saving')}
                        </>
                      ) : (
                        <>
                          <Save size={16} /> {t('profile.addresses.modal.save')}
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddressModal(false);
                        setEditingAddress(null);
                      }}
                      className="px-8 py-4 glass-card border-gold-premium/20 text-gold-premium/60 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:text-gold-premium hover:border-gold-premium transition-all duration-500"
                    >
                      {t('profile.addresses.modal.cancel')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
