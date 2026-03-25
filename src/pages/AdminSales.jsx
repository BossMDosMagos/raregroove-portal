import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, Filter, Download, Calendar, User, Eye, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { maskEmail } from '../utils/sensitiveDataMask';

export default function AdminSales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', '7days', '30days'
  const [selectedSeller, setSelectedSeller] = useState('all');
  const [sellers, setSellers] = useState([]);
  const [busySaleId, setBusySaleId] = useState(null);
  const [deleteSaleModal, setDeleteSaleModal] = useState(null);
  const [detailsSaleModal, setDetailsSaleModal] = useState(null);

  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    portalRevenue: 0,
    marketplaceCommissions: 0,
    averageTicket: 0
  });

  useEffect(() => {
    loadSalesData();
  }, [dateFilter, selectedSeller]);

  const getDateFilter = () => {
    const now = new Date();
    switch (dateFilter) {
      case 'today':
        now.setHours(0, 0, 0, 0);
        return now.toISOString();
      case '7days':
        now.setDate(now.getDate() - 7);
        return now.toISOString();
      case '30days':
        now.setDate(now.getDate() - 30);
        return now.toISOString();
      default:
        return '2000-01-01';
    }
  };

  const loadSalesData = async () => {
    try {
      setLoading(true);

      const dateFrom = getDateFilter();

      // Tentar buscar com múltiplos statuses que podem ser equivalentes
      const possibleStatuses = ['pago_em_custodia', 'pago', 'pago_custodia', 'aprovado', 'concluido'];
      let transactions = [];
      let foundStatus = null;
      
      for (const status of possibleStatuses) {
        const { data, error } = await supabase
          .from('transactions')
          .select('id, created_at, total_amount, platform_fee, status, seller_id, buyer_id, item_id')
          .eq('status', status)
          .gte('created_at', dateFrom)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          transactions = data;
          foundStatus = status;
          break;
        }
      }

      if (transactions.length === 0) {
        setSales([]);
        setSellers([]);
        setStats({
          totalSales: 0,
          totalRevenue: 0,
          portalRevenue: 0,
          marketplaceCommissions: 0,
          averageTicket: 0
        });
        toast.info('NENHUMA VENDA AINDA');
        setLoading(false);
        return;
      }

      // Aplicar filtro de vendedor se necessário
      if (selectedSeller !== 'all') {
        transactions = transactions.filter(t => t.seller_id === selectedSeller);
      }

      // Extrair IDs únicos
      const itemIds = Array.from(new Set(transactions.map(t => t.item_id).filter(Boolean)));
      const buyerIds = Array.from(new Set(transactions.map(t => t.buyer_id).filter(Boolean)));
      const sellerIds = Array.from(new Set(transactions.map(t => t.seller_id).filter(Boolean)));

      // Buscar itens
      let itemMap = {};
      if (itemIds.length > 0) {
        const { data: items } = await supabase
          .from('items')
          .select('id, title, artist, price, image_url, condition, format, seller_id')
          .in('id', itemIds);
        
        itemMap = (items || []).reduce((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {});
      }

      // Buscar buyers
      let buyerMap = {};
      if (buyerIds.length > 0) {
        const { data: buyers } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', buyerIds);
        
        buyerMap = (buyers || []).reduce((acc, p) => {
          acc[p.id] = { full_name: p.full_name, email: p.email };
          return acc;
        }, {});
      }

      // Buscar sellers
      let sellerMap = {};
      let sellerList = [];
      if (sellerIds.length > 0) {
        const { data: sellers_list } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', sellerIds);
        
        sellerMap = (sellers_list || []).reduce((acc, p) => {
          acc[p.id] = { full_name: p.full_name, email: p.email };
          return acc;
        }, {});
        sellerList = sellers_list.map(s => ({ id: s.id, name: s.full_name || s.email }));
      }

      // Enriquecer transações
      const enrichedTransactions = transactions.map(tx => ({
        ...tx,
        items: itemMap[tx.item_id] || { title: '—', artist: '—', price: 0 },
        buyer: buyerMap[tx.buyer_id] || { full_name: '—', email: '—' },
        seller: tx.seller_id ? (sellerMap[tx.seller_id] || { full_name: '—', email: '—' }) : null
      }));

      setSales(enrichedTransactions);
      setSellers(sellerList);

      // Calcular estatísticas
      const portalSales = enrichedTransactions.filter(tx => !tx.seller_id);
      const marketplaceSales = enrichedTransactions.filter(tx => tx.seller_id);

      const portalRevenue = portalSales.reduce((sum, tx) => sum + (parseFloat(tx.total_amount) || 0), 0);
      const commissionRevenue = marketplaceSales.reduce((sum, tx) => sum + (parseFloat(tx.platform_fee) || 0), 0);
      const totalRevenue = portalRevenue + commissionRevenue;

      setStats({
        totalSales: enrichedTransactions.length,
        totalRevenue,
        portalRevenue,
        marketplaceCommissions: commissionRevenue,
        averageTicket: enrichedTransactions.length > 0 ? totalRevenue / enrichedTransactions.length : 0
      });
    } catch (error) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Data', 'Item', 'Artista', 'Comprador', 'Vendedor', 'Preço', 'Taxa', 'Status'];
    const rows = sales.map(sale => [
      new Date(sale.created_at).toLocaleDateString('pt-BR'),
      sale.items?.title || 'N/A',
      sale.items?.artist || 'N/A',
      sale.buyer?.full_name || maskEmail(sale.buyer?.email) || 'N/A',
      sale.seller?.full_name || maskEmail(sale.seller?.email) || 'Portal',
      `R$ ${parseFloat(sale.total_amount || 0).toFixed(2)}`,
      `R$ ${parseFloat(sale.platform_fee || 0).toFixed(2)}`,
      sale.status
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
    element.setAttribute('download', `vendas-${new Date().toISOString().split('T')[0]}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Arquivo exportado com sucesso!');
  };

  const handleDeleteSale = async () => {
    if (!deleteSaleModal) return;

    try {
      setBusySaleId(deleteSaleModal.id);

      const { data: deletedRows, error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', deleteSaleModal.id)
        .select('id');

      if (error) throw error;

      if (!deletedRows || deletedRows.length === 0) {
        throw new Error('Nenhuma venda foi removida. Verifique a policy RLS de DELETE para administradores em transactions.');
      }

      toast.success('VENDA EXCLUÍDA', {
        description: 'Transação removida com sucesso.',
      });

      setDeleteSaleModal(null);
      await loadSalesData();
    } catch (error) {
      console.error('❌ Erro ao deletar venda:', error);
      toast.error('DELETE NÃO EFETIVADO', {
        description: error.message || 'Não foi possível excluir a venda.',
      });
    } finally {
      setBusySaleId(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4 md:px-6 pt-20">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-[#D4AF37]" size={32} />
            <h1 className="text-4xl font-black italic tracking-tighter">Gerenciador de Vendas</h1>
          </div>
          <p className="text-white/60">Administre todas as transações de vendas, com opção de exclusão total.</p>
        </div>

        {/* Stats Grid */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Total de Vendas */}
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-2xl p-6 space-y-2">
              <p className="text-blue-300/70 text-xs uppercase font-bold tracking-widest">Total de Vendas</p>
              <p className="text-3xl font-black text-blue-300">{stats.totalSales}</p>
              <p className="text-xs text-white/40">Período selecionado</p>
            </div>

            {/* Receita Total */}
            <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 rounded-2xl p-6 space-y-2">
              <p className="text-green-300/70 text-xs uppercase font-bold tracking-widest">Receita Total</p>
              <p className="text-3xl font-black text-green-300">R$ {stats.totalRevenue.toFixed(2)}</p>
              <p className="text-xs text-white/40">Portal + Marketplace</p>
            </div>

            {/* Receita Portal */}
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-2xl p-6 space-y-2">
              <p className="text-amber-300/70 text-xs uppercase font-bold tracking-widest">Portal (100%)</p>
              <p className="text-3xl font-black text-amber-300">R$ {stats.portalRevenue.toFixed(2)}</p>
              <p className="text-xs text-white/40">Vendas diretas</p>
            </div>

            {/* Comissões Marketplace */}
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-2xl p-6 space-y-2">
              <p className="text-purple-300/70 text-xs uppercase font-bold tracking-widest">Marketplace Fee</p>
              <p className="text-3xl font-black text-purple-300">R$ {stats.marketplaceCommissions.toFixed(2)}</p>
              <p className="text-xs text-white/40">Taxas de intermediação</p>
            </div>

            {/* Ticket Médio */}
            <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border border-indigo-500/20 rounded-2xl p-6 space-y-2">
              <p className="text-indigo-300/70 text-xs uppercase font-bold tracking-widest">Ticket Médio</p>
              <p className="text-3xl font-black text-indigo-300">R$ {stats.averageTicket.toFixed(2)}</p>
              <p className="text-xs text-white/40">Por venda</p>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={20} className="text-[#D4AF37]" />
            <h2 className="font-bold">Filtros</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Data */}
            <div className="space-y-2">
              <label className="text-xs text-white/60 uppercase font-bold tracking-widest block">
                <Calendar size={14} className="inline mr-2" />
                Período
              </label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full bg-gray-900 border border-white/10 rounded-lg px-4 py-2 text-white"
              >
                <option value="all">Todas as datas</option>
                <option value="today">Hoje</option>
                <option value="7days">Últimos 7 dias</option>
                <option value="30days">Últimos 30 dias</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabela de Vendas */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#D4AF37]"></div>
                <p className="text-white/60 mt-4">Carregando vendas...</p>
              </div>
            ) : sales.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-white/60">Nenhuma venda encontrada com os filtros selecionados</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs uppercase font-bold tracking-widest text-white/60">Data</th>
                    <th className="px-6 py-4 text-left text-xs uppercase font-bold tracking-widest text-white/60">Item</th>
                    <th className="px-6 py-4 text-left text-xs uppercase font-bold tracking-widest text-white/60">Comprador</th>
                    <th className="px-6 py-4 text-left text-xs uppercase font-bold tracking-widest text-white/60">Vendedor</th>
                    <th className="px-6 py-4 text-center text-xs uppercase font-bold tracking-widest text-white/60">Preço</th>
                    <th className="px-6 py-4 text-center text-xs uppercase font-bold tracking-widest text-white/60">Taxa</th>
                    <th className="px-6 py-4 text-center text-xs uppercase font-bold tracking-widest text-white/60">Status</th>
                    <th className="px-6 py-4 text-center text-xs uppercase font-bold tracking-widest text-white/60">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-sm text-white/80">
                        {new Date(sale.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="font-bold text-white">{sale.items?.title || 'N/A'}</p>
                          <p className="text-xs text-white/60">{sale.items?.artist || 'N/A'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-white/80">
                        {sale.buyer?.full_name || maskEmail(sale.buyer?.email) || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={sale.seller_id ? 'text-white/80' : 'text-[#D4AF37] font-bold'}>
                          {sale.seller?.full_name || maskEmail(sale.seller?.email) || '🏢 Portal'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-white">
                        R$ {parseFloat(sale.total_amount || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center text-white/80">
                        R$ {parseFloat(sale.platform_fee || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-block px-3 py-1 bg-green-500/20 border border-green-500/50 rounded-full text-xs font-bold text-green-300">
                          ✓ {sale.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setDetailsSaleModal(sale)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[11px] font-bold uppercase hover:bg-blue-500/30"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver
                          </button>
                          <button
                            disabled={busySaleId === sale.id}
                            onClick={() => setDeleteSaleModal(sale)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600/20 border border-red-600/40 text-red-300 text-[11px] font-bold uppercase hover:bg-red-600/30 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {detailsSaleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-2xl bg-[#050505] border border-[#D4AF37]/30 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black uppercase text-white">Detalhes da Venda</h3>
                <button
                  onClick={() => setDetailsSaleModal(null)}
                  className="text-white/60 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <p className="text-white/50 text-xs uppercase">ID da venda</p>
                  <p className="text-white break-all">{detailsSaleModal.id}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <p className="text-white/50 text-xs uppercase">Data</p>
                  <p className="text-white">{new Date(detailsSaleModal.created_at).toLocaleString('pt-BR')}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <p className="text-white/50 text-xs uppercase">Item</p>
                  <p className="text-white">{detailsSaleModal.items?.title || 'N/A'}</p>
                  <p className="text-white/60 text-xs">{detailsSaleModal.items?.artist || 'N/A'}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <p className="text-white/50 text-xs uppercase">Status</p>
                  <p className="text-white">{detailsSaleModal.status}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <p className="text-white/50 text-xs uppercase">Comprador</p>
                  <p className="text-white">{detailsSaleModal.buyer?.full_name || 'N/A'}</p>
                  <p className="text-white/60 text-xs">{detailsSaleModal.buyer?.email || 'N/A'}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <p className="text-white/50 text-xs uppercase">Vendedor</p>
                  <p className="text-white">{detailsSaleModal.seller?.full_name || 'Portal'}</p>
                  <p className="text-white/60 text-xs">{detailsSaleModal.seller?.email || 'Venda direta do portal'}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <p className="text-white/50 text-xs uppercase">Preço</p>
                  <p className="text-white font-bold">R$ {parseFloat(detailsSaleModal.total_amount || 0).toFixed(2)}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <p className="text-white/50 text-xs uppercase">Taxa plataforma</p>
                  <p className="text-white font-bold">R$ {parseFloat(detailsSaleModal.platform_fee || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {deleteSaleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-lg bg-[#050505] border border-red-500/30 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-black text-white uppercase">Excluir Venda</h3>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-2 text-sm">
                <p className="text-white"><strong>ID:</strong> {deleteSaleModal.id}</p>
                <p className="text-white/80"><strong>Item:</strong> {deleteSaleModal.items?.title || 'N/A'}</p>
                <p className="text-white/80"><strong>Valor:</strong> R$ {parseFloat(deleteSaleModal.total_amount || 0).toFixed(2)}</p>
              </div>
              <p className="text-yellow-200 text-xs uppercase font-bold">Ação irreversível</p>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleteSaleModal(null)}
                  className="px-4 py-2 text-xs font-black uppercase rounded-lg border border-white/20 text-white/70"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteSale}
                  disabled={busySaleId === deleteSaleModal.id}
                  className="px-4 py-2 text-xs font-black uppercase rounded-lg bg-red-600/30 border border-red-600/40 text-red-300 hover:bg-red-600/40 disabled:opacity-50"
                >
                  {busySaleId === deleteSaleModal.id ? 'Excluindo...' : 'Confirmar Exclusão'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-2">
          <p className="text-sm text-white/60">
            <strong>Nota:</strong> Esta página mostra todas as transações com status "pago_em_custodia". Os itens marcados como vendidos não aparecem no catálogo e estão indisponíveis para novos compradores.
          </p>
        </div>
      </div>
    </div>
  );
}
