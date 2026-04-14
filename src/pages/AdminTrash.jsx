import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { 
  Trash2, Loader2, Search, Package, CreditCard, RefreshCw, 
  MessageSquare, AlertTriangle, MapPin, Star, Bell, Archive,
  ShoppingCart, DollarSign, Users, FileText, Truck, Webhook,
  BarChart3, Crown, Wallet, CheckCircle, Mail, Heart, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const toastSuccessStyle = { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' };
const toastErrorStyle = { background: '#050505', border: '1px solid #ef4444', color: '#FFF' };

const TABLES = [
  { 
    id: 'items', 
    label: 'Itens/CDs', 
    icon: Package, 
    primary: 'title',
    secondary: 'artist',
    date: 'created_at',
    cascade: true
  },
  { 
    id: 'transactions', 
    label: 'Vendas', 
    icon: CreditCard, 
    primary: 'status',
    secondary: 'total_amount',
    date: 'created_at'
  },
  { 
    id: 'swaps', 
    label: 'Trocas', 
    icon: RefreshCw, 
    primary: 'status',
    secondary: 'initiator_id',
    date: 'created_at'
  },
  { 
    id: 'disputes', 
    label: 'Disputas', 
    icon: AlertTriangle, 
    primary: 'status',
    secondary: 'reason',
    date: 'created_at'
  },
  { 
    id: 'messages', 
    label: 'Mensagens', 
    icon: MessageSquare, 
    primary: 'sender_id',
    secondary: 'content',
    date: 'created_at'
  },
  { 
    id: 'user_addresses', 
    label: 'Endereços', 
    icon: MapPin, 
    primary: 'label',
    secondary: 'street',
    date: 'created_at'
  },
  { 
    id: 'reviews', 
    label: 'Avaliações', 
    icon: Star, 
    primary: 'rating',
    secondary: 'comment',
    date: 'created_at'
  },
  { 
    id: 'notifications', 
    label: 'Notificações', 
    icon: Bell, 
    primary: 'type',
    secondary: 'title',
    date: 'created_at'
  },
  { 
    id: 'withdrawals', 
    label: 'Saques', 
    icon: DollarSign, 
    primary: 'status',
    secondary: 'amount',
    date: 'created_at'
  },
  { 
    id: 'financial_ledger', 
    label: 'Livro Razão', 
    icon: FileText, 
    primary: 'type',
    secondary: 'amount',
    date: 'created_at'
  },
  { 
    id: 'shipping', 
    label: 'Entregas', 
    icon: Truck, 
    primary: 'status',
    secondary: 'tracking_code',
    date: 'created_at'
  },
  { 
    id: 'escrow_sla_events', 
    label: 'Eventos SLA', 
    icon: Clock, 
    primary: 'event_type',
    secondary: 'transaction_id',
    date: 'created_at'
  },
  { 
    id: 'dispute_messages', 
    label: 'Msgs Disputa', 
    icon: MessageSquare, 
    primary: 'dispute_id',
    secondary: 'sender_id',
    date: 'created_at'
  },
  { 
    id: 'dispute_evidence', 
    label: 'Evidências', 
    icon: FileText, 
    primary: 'dispute_id',
    secondary: 'file_name',
    date: 'uploaded_at'
  },
  { 
    id: 'dispute_refund_tasks', 
    label: 'Tasks Refund', 
    icon: CheckCircle, 
    primary: 'status',
    secondary: 'dispute_id',
    date: 'created_at'
  },
  { 
    id: 'subscriptions', 
    label: 'Assinaturas', 
    icon: Crown, 
    primary: 'status',
    secondary: 'plan_id',
    date: 'created_at'
  },
  { 
    id: 'user_balances', 
    label: 'Saldos Usuários', 
    icon: Wallet, 
    primary: 'available_balance',
    secondary: 'user_id',
    date: 'updated_at'
  },
];

export default function AdminTrash() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState('items');
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [deleting, setDeleting] = useState({});
  const [search, setSearch] = useState('');
  const [filterValue, setFilterValue] = useState('');

  const currentTable = TABLES.find(t => t.id === selectedTable);

  useEffect(() => {
    loadRecords();
  }, [selectedTable]);

  const loadRecords = async () => {
    setLoadingRecords(true);
    setRecords([]);
    try {
      const { data, error } = await supabase
        .from(selectedTable)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        if (error.message.includes('does not exist') || error.code === '42P01') {
          toast.error('TABELA NÃO EXISTE', {
            description: `A tabela "${selectedTable}" não existe no banco de dados.`,
            style: toastErrorStyle,
          });
          setRecords([]);
        } else if (error.message.includes('permission denied') || error.code === '42501') {
          toast.error('SEM PERMISSÃO', {
            description: `Sem permissão para acessar "${selectedTable}".`,
            style: toastErrorStyle,
          });
          setRecords([]);
        } else {
          throw error;
        }
      } else {
        setRecords(data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar registros:', error);
      toast.error('ERRO AO CARREGAR', {
        description: error.message,
        style: toastErrorStyle,
      });
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('🚨 ATENÇÃO: Esta ação é IRREVERSÍVEL!\n\nTem certeza que deseja excluir este registro?')) return;
    
    setDeleting((prev) => ({ ...prev, [id]: true }));
    try {
      // Delete directly from the table
      const { error: deleteError } = await supabase
        .from(selectedTable)
        .delete()
        .eq('id', id);
      
      if (deleteError) throw deleteError;

      toast.success('🗑️ EXCLUÍDO', {
        description: 'Registro removido permanentemente.',
        style: toastSuccessStyle,
      });
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('ERRO AO EXCLUIR', {
        description: error.message || 'Erro desconhecido',
        style: toastErrorStyle,
      });
    } finally {
      setDeleting((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('🚨 ATENÇÃO EXTREMA!\n\nIsso vai excluir TODOS os registros desta tabela.\nEsta ação é IRREVERSÍVEL!')) return;
    if (!window.confirm('Você tem CERTEZA ABSOLUTA? Todos os dados serão perdidos para sempre!')) return;

    setLoadingRecords(true);
    try {
      const { error } = await supabase
        .from(selectedTable)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

      toast.success('🗑️ TUDO EXCLUÍDO', {
        description: `Todos os registros de ${currentTable.label} foram removidos.`,
        style: toastSuccessStyle,
      });

      setRecords([]);
    } catch (error) {
      toast.error('ERRO AO EXCLUIR', {
        description: error.message,
        style: toastErrorStyle,
      });
    } finally {
      setLoadingRecords(false);
    }
  };

  const filteredRecords = records.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return Object.values(r).some(v => 
      v && String(v).toLowerCase().includes(s)
    );
  });

  const getValue = (record, field) => {
    const val = record[field];
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
    if (typeof val === 'object') return JSON.stringify(val).slice(0, 50);
    if (field.includes('amount') || field.includes('price')) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    }
    return String(val).slice(0, 50);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  const getColumns = () => {
    if (!records.length) return [];
    return Object.keys(records[0]).slice(0, 8);
  };

  return (
    <div className="min-h-screen bg-charcoal-deep text-white p-6">
      <div className="max-w-[1800px] mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-500/10 border border-red-500/30 rounded-full text-red-400 text-xs font-semibold">
              <Trash2 size={12} /> Admin • Lixeira Total
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase text-luxury">
              🗑️ Lixeira<span className="text-red-500">.</span>
            </h1>
            <p className="text-silver-premium/60 text-sm">
              Controle total: exclua qualquer registro do sistema permanentemente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin')}
              className="px-5 py-3 bg-black/40 border border-white/10 rounded-xl text-white/70 hover:text-white hover:border-white/20 transition"
            >
              Voltar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-white/60 mb-4">Selecione a Tabela</h3>
              <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                {TABLES.map((table) => (
                  <button
                    key={table.id}
                    onClick={() => setSelectedTable(table.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                      selectedTable === table.id
                        ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                        : 'bg-white/5 border border-white/5 text-white/60 hover:bg-white/10 hover:border-white/10'
                    }`}
                  >
                    <table.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{table.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-red-400 mb-2">⚠️ Ação Perigosa</h3>
              <p className="text-white/40 text-xs mb-4">
                Excluir todos os registros desta tabela. Esta ação não pode ser desfeita.
              </p>
              <button
                onClick={handleDeleteAll}
                disabled={loadingRecords || records.length === 0}
                className="w-full py-3 bg-red-500/20 border border-red-500/40 text-red-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-500/30 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Excluir Todos ({records.length})
              </button>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-white/40" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar em todos os campos..."
                  className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/30"
                />
              </div>
              <button
                onClick={loadRecords}
                disabled={loadingRecords}
                className="px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white/70 hover:text-white hover:border-white/20 transition flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loadingRecords ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {currentTable && <currentTable.icon className="w-5 h-5 text-red-400" />}
                  <span className="font-black uppercase tracking-wider text-white">
                    {currentTable?.label || selectedTable}
                  </span>
                </div>
                <span className="text-white/40 text-sm">
                  {filteredRecords.length} registros
                </span>
              </div>

              {loadingRecords ? (
                <div className="p-10 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-red-400" />
                  <p className="text-white/50">Carregando registros...</p>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="p-10 text-center text-white/50">
                  Nenhum registro encontrado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white/5 text-white/60">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-black uppercase">ID</th>
                        {getColumns().slice(1, 6).map((col) => (
                          <th key={col} className="text-left px-4 py-3 text-xs font-black uppercase">
                            {col.replace(/_/g, ' ')}
                          </th>
                        ))}
                        <th className="text-left px-4 py-3 text-xs font-black uppercase">Data</th>
                        <th className="text-center px-4 py-3 text-xs font-black uppercase">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.slice(0, 100).map((record) => (
                        <tr key={record.id} className="border-t border-white/5 hover:bg-white/5 transition">
                          <td className="px-4 py-3">
                            <span className="text-white/50 text-xs font-mono">
                              {record.id?.slice(0, 8)}...
                            </span>
                          </td>
                          {getColumns().slice(1, 6).map((col) => (
                            <td key={col} className="px-4 py-3">
                              <span className="text-white/70 text-xs">
                                {getValue(record, col)}
                              </span>
                            </td>
                          ))}
                          <td className="px-4 py-3">
                            <span className="text-white/40 text-xs">
                              {formatDate(record.created_at || record.updated_at)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center">
                              <button
                                onClick={() => handleDelete(record.id)}
                                disabled={deleting[record.id]}
                                className="px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs font-black uppercase hover:bg-red-500/20 transition disabled:opacity-50 flex items-center gap-2"
                              >
                                {deleting[record.id] ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {filteredRecords.length > 100 && (
                <div className="p-4 border-t border-white/10 text-center text-white/40 text-sm">
                  Mostrando 100 de {filteredRecords.length} registros. Use o filtro para buscar mais específicos.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}