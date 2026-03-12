import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Search, Loader2, UserX, Calendar, Edit3, Trash2, KeyRound, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { maskEmail, maskCPF, maskRG } from '../utils/sensitiveDataMask';

export default function AdminUsers() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [subscriptionFilter, setSubscriptionFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editData, setEditData] = useState(null);
  const [suspendUntil, setSuspendUntil] = useState('');
  const [deleteConfirmData, setDeleteConfirmData] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [revokeConfirmData, setRevokeConfirmData] = useState(null);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, cpf_cnpj, rg, phone, cep, address, number, complement, city, state, pix_key, is_admin, status, created_at, suspension_end, user_level, subscription_status, subscription_plan, subscription_provider')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuarios:', error);
      toast.error('ERRO AO CARREGAR', {
        description: 'Não foi possível carregar os usuários',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    let list = users;

    if (subscriptionFilter !== 'all') {
      list = list.filter((user) => {
        const sub = String(user.subscription_status || 'inactive').toLowerCase();
        if (subscriptionFilter === 'active') return sub === 'active';
        if (subscriptionFilter === 'trialing') return sub === 'trialing';
        return true;
      });
    }

    if (!query.trim()) return list;
    const term = query.toLowerCase();
    return list.filter((user) =>
      user.email?.toLowerCase().includes(term) ||
      user.cpf_cnpj?.toLowerCase().includes(term) ||
      user.rg?.toLowerCase().includes(term) ||
      user.full_name?.toLowerCase().includes(term)
    );
  }, [users, query, subscriptionFilter]);

  const getStatusBadge = (status) => {
    if (status === 'banned') {
      return 'bg-red-500/20 text-red-400 border-red-500/40';
    }
    if (status === 'suspended') {
      return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
    }
    return 'bg-green-500/20 text-green-400 border-green-500/40';
  };

  const getSubscriptionBadge = (subscriptionStatus) => {
    const status = String(subscriptionStatus || 'inactive').toLowerCase();
    if (status === 'active') return 'bg-green-500/20 text-green-400 border-green-500/40';
    if (status === 'trialing') return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    if (status === 'expired') return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    if (status === 'canceled') return 'bg-red-500/20 text-red-400 border-red-500/40';
    return 'bg-white/5 text-white/50 border-white/10';
  };

  const formatSubscriptionStatus = (subscriptionStatus) => {
    const status = String(subscriptionStatus || 'inactive').toLowerCase();
    if (status === 'active') return 'active';
    if (status === 'trialing') return 'trialing';
    if (status === 'expired') return 'expired';
    if (status === 'canceled') return 'canceled';
    if (status === 'past_due') return 'past_due';
    return 'inactive';
  };

  const handleBan = async (userId) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'banned', suspension_end: null })
        .eq('id', userId);

      if (error) throw error;
      toast.success('USUÁRIO BANIDO', {
        description: 'Acesso bloqueado permanentemente',
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
      loadUsers();
    } catch (error) {
      toast.error('ERRO AO BANIR', {
        description: error.message,
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    }
  };

  const handleCEPChange = async (cep) => {
    const cleaned = cep.replace(/\D/g, '');
    setEditData(prev => ({ ...prev, cep: cleaned }));
    
    if (cleaned.length === 8) {
      setCepLoading(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
          setEditData(prev => ({
            ...prev,
            address: data.logradouro,
            city: data.localidade,
            state: data.uf,
            complement: data.complemento || prev.complement
          }));
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      } finally {
        setCepLoading(false);
      }
    }
  };

  const handleSuspend = async (userId) => {
    if (!suspendUntil) {
      toast.error('DATA OBRIGATÓRIA', {
        description: 'Defina a data limite da suspensão',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'suspended', suspension_end: suspendUntil })
        .eq('id', userId);

      if (error) throw error;
      toast.success('USUÁRIO SUSPENSO', {
        description: `Bloqueado até ${new Date(suspendUntil).toLocaleDateString('pt-BR')}`,
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
      setSuspendUntil('');
      loadUsers();
    } catch (error) {
      toast.error('ERRO AO SUSPENDER', {
        description: error.message,
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    }
  };

  const handleEdit = async () => {
    if (!editData?.id) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editData.full_name,
          email: editData.email,
          cpf_cnpj: editData.cpf_cnpj,
          rg: editData.rg,
          phone: editData.phone,
          cep: editData.cep,
          address: editData.address,
          number: editData.number,
          complement: editData.complement,
          city: editData.city,
          state: editData.state,
          pix_key: editData.pix_key,
          is_admin: editData.is_admin,
          status: editData.status,
          suspension_end: editData.suspension_end
        })
        .eq('id', editData.id);

      if (error) throw error;
      toast.success('PERFIL ATUALIZADO', {
        description: 'Todas as alterações foram salvas',
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
      setEditData(null);
      loadUsers();
    } catch (error) {
      // Tratamento de erros de duplicação
      let errorTitle = 'ERRO AO ATUALIZAR';
      let errorDescription = 'Não foi possível salvar as alterações';

      if (error.code === '23505') {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('cpf_cnpj')) {
          errorTitle = 'CPF/CNPJ JÁ CADASTRADO';
          errorDescription = 'Este CPF/CNPJ já está vinculado a outro perfil no sistema';
        } else if (errorMsg.includes('rg')) {
          errorTitle = 'RG JÁ CADASTRADO';
          errorDescription = 'Este RG já está vinculado a outro perfil no sistema';
        } else if (errorMsg.includes('email')) {
          errorTitle = 'EMAIL JÁ CADASTRADO';
          errorDescription = 'Este email já está vinculado a outro perfil no sistema';
        } else {
          errorTitle = 'DOCUMENTO DUPLICADO';
          errorDescription = 'Este documento já está cadastrado em outro perfil';
        }
      }

      toast.error(errorTitle, {
        description: errorDescription,
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    }
  };

  const handleDelete = async (userId) => {
    // Abrir modal de confirmação personalizado
    const userToDelete = users.find(u => u.id === userId);
    setDeleteConfirmData(userToDelete);
    setDeleteConfirmText('');
  };

  const confirmDelete = async () => {
    if (!deleteConfirmData) return;
    if (deleteConfirmText !== 'EXCLUIR') {
      toast.error('CONFIRMAÇÃO INVÁLIDA', {
        description: 'Digite "EXCLUIR" para confirmar a exclusão',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }

    try {
      // Usar função RPC para deletar completamente (auth.users + profiles)
      const { data, error } = await supabase
        .rpc('delete_user_completely', { target_user_id: deleteConfirmData.id });

      if (error) throw error;
      
      if (data?.success === false) {
        throw new Error(data?.message || 'Erro ao deletar usuário');
      }
      
      toast.success('CADASTRO EXCLUÍDO', {
        description: 'Usuário removido completamente do sistema',
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
      setDeleteConfirmData(null);
      setDeleteConfirmText('');
      loadUsers();
    } catch (error) {
      toast.error('ERRO NA EXCLUSÃO', {
        description: error.message,
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    }
  };

  const handleResetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      toast.success('EMAIL ENVIADO', {
        description: `Link de recuperação enviado para ${email}`,
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
    } catch (error) {
      toast.error('ERRO AO RESETAR SENHA', {
        description: error.message,
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    }
  };

  const handleRevokeSubscription = async (userId) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          user_level: 0,
          subscription_status: 'canceled',
          subscription_plan: null,
          subscription_provider: null,
          subscription_date: null,
          subscription_trial_ends_at: null
        })
        .eq('id', userId);

      if (error) throw error;

      toast.success('ACESSO REVOGADO', {
        description: 'A assinatura foi cancelada manualmente',
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
      loadUsers();
    } catch (error) {
      toast.error('ERRO AO REVOGAR', {
        description: error.message,
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    }
  };

  const handleAdminOverride = async (userId) => {
    try {
      const { data, error } = await supabase.rpc('admin_set_admin_manual_access', { target_user_id: userId });
      if (error) throw error;
      if (data?.success === false) throw new Error(String(data?.error || 'Erro'));

      toast.success('OVERRIDE ATIVADO', {
        description: 'Acesso total liberado (admin_manual).',
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
      loadUsers();
    } catch (error) {
      toast.error('ERRO NO OVERRIDE', {
        description: error.message,
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4 md:px-6 pt-20">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-400 text-xs font-bold uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4" /> Gestor de Perfis
            </div>
            <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter mt-4 uppercase">
              Central de <span className="text-blue-400">Moderação</span>
            </h1>
            <p className="text-white/40 text-sm mt-2">
              Controle total sobre perfis e usuarios do Portal
            </p>
          </div>
        </div>

        <div className="bg-[#050505] border border-[#D4AF37]/20 rounded-2xl p-5">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Search className="w-4 h-4 text-[#D4AF37]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, email ou documento"
                className="flex-1 bg-transparent text-sm text-white placeholder-white/30 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Filtro</span>
              <select
                value={subscriptionFilter}
                onChange={(e) => setSubscriptionFilter(e.target.value)}
                className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-black uppercase tracking-widest"
              >
                <option value="all">Todos</option>
                <option value="active">Apenas Ativos</option>
                <option value="trialing">Apenas Trials</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-[#050505] border border-[#D4AF37]/20 rounded-2xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-white/50 border-b border-white/10">
                <tr>
                  <th className="py-3">Nome</th>
                  <th className="py-3">Email</th>
                  <th className="py-3">CPF/CNPJ</th>
                  <th className="py-3">RG</th>
                  <th className="py-3">Status</th>
                  <th className="py-3">Assinatura</th>
                  <th className="py-3">Cadastro</th>
                  <th className="py-3">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 pr-4 font-semibold text-white/80">{user.full_name || '—'}</td>
                    <td className="py-3 pr-4 text-white/60">{maskEmail(user.email, true)}</td>
                    <td className="py-3 pr-4 text-white/60">{maskCPF(user.cpf_cnpj, true) || '—'}</td>
                    <td className="py-3 pr-4 text-white/60">{maskRG(user.rg, true) || '—'}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${getStatusBadge(user.status)}`}>
                        {user.status || 'active'}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${getSubscriptionBadge(user.subscription_status)}`}>
                        {formatSubscriptionStatus(user.subscription_status)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-white/60">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleBan(user.id)}
                          className="px-3 py-1 rounded-lg border border-red-500/40 text-red-400 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/10"
                        >
                          <UserX className="w-3 h-3 inline-block mr-1" /> Banir
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setSuspendUntil('');
                          }}
                          className="px-3 py-1 rounded-lg border border-orange-500/40 text-orange-400 text-[10px] font-bold uppercase tracking-widest hover:bg-orange-500/10"
                        >
                          <Calendar className="w-3 h-3 inline-block mr-1" /> Suspender
                        </button>
                        <button
                          onClick={() => setEditData({ ...user })}
                          className="px-3 py-1 rounded-lg border border-blue-500/40 text-blue-400 text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500/10"
                        >
                          <Edit3 className="w-3 h-3 inline-block mr-1" /> Editar
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="px-3 py-1 rounded-lg border border-white/20 text-white/60 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10"
                        >
                          <Trash2 className="w-3 h-3 inline-block mr-1" /> Deletar
                        </button>
                        <button
                          onClick={() => handleResetPassword(user.email)}
                          className="px-3 py-1 rounded-lg border border-[#D4AF37]/40 text-[#D4AF37] text-[10px] font-bold uppercase tracking-widest hover:bg-[#D4AF37]/10"
                        >
                          <KeyRound className="w-3 h-3 inline-block mr-1" /> Resetar senha
                        </button>
                        <button
                          onClick={() => handleAdminOverride(user.id)}
                          className="px-3 py-1 rounded-lg border border-green-500/40 text-green-300 text-[10px] font-bold uppercase tracking-widest hover:bg-green-500/10"
                        >
                          <ShieldCheck className="w-3 h-3 inline-block mr-1" /> Override HG
                        </button>
                        <button
                          onClick={() => setRevokeConfirmData(user)}
                          className="px-3 py-1 rounded-lg border border-fuchsia-500/40 text-fuchsia-300 text-[10px] font-bold uppercase tracking-widest hover:bg-fuchsia-500/10"
                        >
                          <AlertTriangle className="w-3 h-3 inline-block mr-1" /> Revogar acesso
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#050505] border border-[#D4AF37]/30 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-black mb-4">Suspender usuario</h3>
            <p className="text-white/60 text-xs mb-4">
              Defina a data limite para liberar o acesso
            </p>
            <input
              type="date"
              value={suspendUntil}
              onChange={(e) => setSuspendUntil(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            />
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/60"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handleSuspend(selectedUser.id);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 bg-orange-500 text-black text-xs font-bold uppercase tracking-widest rounded-lg"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {editData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#050505] border border-[#D4AF37]/30 rounded-2xl p-6 w-full max-w-2xl my-8">
            <h3 className="text-lg font-black mb-1">Editar perfil completo</h3>
            <p className="text-white/40 text-[10px] uppercase tracking-wider mb-4">Controle total do portal</p>
            
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {/* Dados Pessoais */}
              <div className="border-b border-white/10 pb-4">
                <p className="text-[#D4AF37] text-xs font-black uppercase tracking-widest mb-3">Dados Pessoais</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#C0C0C0] text-xs font-medium uppercase tracking-wider mb-1.5">Nome Completo</label>
                    <input
                      value={editData.full_name || ''}
                      onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                      placeholder="Nome Completo"
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#D4AF37] focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[#C0C0C0] text-xs font-medium uppercase tracking-wider mb-1.5">Email</label>
                    <input
                      value={editData.email || ''}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      placeholder="email@exemplo.com"
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#D4AF37] focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[#C0C0C0] text-xs font-medium uppercase tracking-wider mb-1.5">CPF/CNPJ</label>
                    <input
                      value={editData.cpf_cnpj || ''}
                      onChange={(e) => setEditData({ ...editData, cpf_cnpj: e.target.value })}
                      placeholder="000.000.000-00"
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#D4AF37] focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[#C0C0C0] text-xs font-medium uppercase tracking-wider mb-1.5">RG</label>
                    <input
                      value={editData.rg || ''}
                      onChange={(e) => setEditData({ ...editData, rg: e.target.value })}
                      placeholder="00.000.000-0"
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#D4AF37] focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[#C0C0C0] text-xs font-medium uppercase tracking-wider mb-1.5">Telefone</label>
                    <input
                      value={editData.phone || ''}
                      onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                      placeholder="+55 (00) 00000-0000"
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#D4AF37] focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div className="border-b border-white/10 pb-4">
                <p className="text-[#D4AF37] text-xs font-black uppercase tracking-widest mb-3">Endereco</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#C0C0C0] text-xs font-medium uppercase tracking-wider mb-1.5">CEP</label>
                    <input
                      value={editData.cep || ''}
                      onChange={(e) => handleCEPChange(e.target.value)}
                      placeholder="00000-000"
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#D4AF37] focus:outline-none transition-colors"
                      disabled={cepLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-[#C0C0C0] text-xs font-medium uppercase tracking-wider mb-1.5">Rua/Avenida</label>
                    <input
                      value={editData.address || ''}
                      onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                      placeholder="Rua/Avenida"
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#D4AF37] focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[#C0C0C0] text-xs font-medium uppercase tracking-wider mb-1.5">Número</label>
                    <input
                      value={editData.number || ''}
                      onChange={(e) => setEditData({ ...editData, number: e.target.value })}
                      placeholder="Número"
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#D4AF37] focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[#C0C0C0] text-xs font-medium uppercase tracking-wider mb-1.5">Complemento</label>
                    <input
                      value={editData.complement || ''}
                      onChange={(e) => setEditData({ ...editData, complement: e.target.value })}
                      placeholder="Apto, bloco, etc"
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#D4AF37] focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[#C0C0C0] text-xs font-medium uppercase tracking-wider mb-1.5">Cidade</label>
                    <input
                      value={editData.city || ''}
                      onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                      placeholder="Cidade"
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#D4AF37] focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[#C0C0C0] text-xs font-medium uppercase tracking-wider mb-1.5">Estado (UF)</label>
                    <input
                      value={editData.state || ''}
                      onChange={(e) => setEditData({ ...editData, state: e.target.value })}
                      placeholder="SP"
                      maxLength="2"
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#D4AF37] focus:outline-none transition-colors"
                    />
                  </div>
                </div>
                {cepLoading && (
                  <div className="flex items-center gap-2 p-3 bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-lg text-sm text-[#D4AF37] mt-3">
                    <Loader2 size={16} className="animate-spin" />
                    Buscando endereço...
                  </div>
                )}
              </div>

              {/* Financeiro */}
              <div className="border-b border-white/10 pb-4">
                <p className="text-[#D4AF37] text-xs font-black uppercase tracking-widest mb-3">Dados Financeiros</p>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-[#C0C0C0] text-xs font-medium uppercase tracking-wider mb-1.5">Chave PIX</label>
                    <input
                      value={editData.pix_key || ''}
                      onChange={(e) => setEditData({ ...editData, pix_key: e.target.value })}
                      placeholder="CPF, telefone, email ou chave aleatória"
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#D4AF37] focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Admin e Status */}
              <div className="pb-2">
                <p className="text-[#D4AF37] text-xs font-black uppercase tracking-widest mb-3">Admin & Status</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 bg-black/60 border border-white/10 rounded-lg px-3 py-2">
                    <input
                      type="checkbox"
                      checked={editData.is_admin || false}
                      onChange={(e) => setEditData({ ...editData, is_admin: e.target.checked })}
                      className="w-4 h-4 rounded border-[#D4AF37] bg-black/60 text-[#D4AF37] focus:ring-[#D4AF37]"
                    />
                    <label className="text-white text-sm">Administrador</label>
                  </div>
                  <select
                    value={editData.status || 'active'}
                    onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="active">Ativo</option>
                    <option value="suspended">Suspenso</option>
                    <option value="banned">Banido</option>
                  </select>
                  {editData.status === 'suspended' && (
                    <input
                      type="date"
                      value={editData.suspension_end || ''}
                      onChange={(e) => setEditData({ ...editData, suspension_end: e.target.value })}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditData(null)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/60"
              >
                Cancelar
              </button>
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-[#D4AF37] text-black text-xs font-bold uppercase tracking-widest rounded-lg"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#050505] border border-red-500/40 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-white mb-1">ATENÇÃO!</h3>
                <p className="text-white/60 text-[10px] uppercase tracking-wider">Esta ação é IRREVERSÍVEL</p>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
              <p className="text-white/80 text-xs mb-2">
                Você está prestes a excluir permanentemente:
              </p>
              <p className="text-red-400 text-sm font-bold">
                {deleteConfirmData.full_name}
              </p>
              <p className="text-white/50 text-[10px] mt-1">
                {deleteConfirmData.email}
              </p>
            </div>

            <p className="text-white/60 text-xs mb-4">
              Para confirmar a EXCLUSÃO DEFINITIVA, digite <span className="text-red-400 font-bold">EXCLUIR</span> no campo abaixo:
            </p>

            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Digite EXCLUIR"
              className="w-full bg-black/60 border border-red-500/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setDeleteConfirmData(null);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-widest rounded-lg transition-colors"
              >
                Excluir Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

      {revokeConfirmData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#050505] border border-fuchsia-500/40 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-fuchsia-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-fuchsia-300" />
              </div>
              <div>
                <h3 className="text-base font-black text-white mb-1">CONFIRMAR REVOGAÇÃO</h3>
                <p className="text-white/60 text-[10px] uppercase tracking-wider">Ação imediata no Grooveflix</p>
              </div>
            </div>

            <div className="bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-lg p-3 mb-4">
              <p className="text-white/80 text-xs mb-2">
                Tem certeza que deseja revogar o acesso de:
              </p>
              <p className="text-fuchsia-200 text-sm font-bold">
                {revokeConfirmData.full_name || '—'}
              </p>
              <p className="text-white/50 text-[10px] mt-1">
                Isso cancelará o plano e bloqueará o Grooveflix imediatamente.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                disabled={revokeBusy}
                onClick={() => setRevokeConfirmData(null)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                disabled={revokeBusy}
                onClick={async () => {
                  setRevokeBusy(true);
                  try {
                    await handleRevokeSubscription(revokeConfirmData.id);
                    setRevokeConfirmData(null);
                  } finally {
                    setRevokeBusy(false);
                  }
                }}
                className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs font-bold uppercase tracking-widest rounded-lg transition-colors disabled:opacity-50"
              >
                {revokeBusy ? 'Revogando...' : 'Revogar agora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
