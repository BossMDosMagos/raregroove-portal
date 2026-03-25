import { useState, useEffect } from 'react';
import { TrendingUp, Users, Package, DollarSign, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const CHART_COLORS = ['#D4AF37', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#10B981', '#F97316'];

export function MetricsDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    fetchMetrics();
  }, [period]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('metrics', {
        body: { period }
      });

      if (error) throw error;
      setMetrics(data);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12 text-zinc-400">
        <AlertCircle className="w-12 h-12 mx-auto mb-4" />
        <p>Não foi possível carregar as métricas.</p>
      </div>
    );
  }

  const { overview, charts } = metrics;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Dashboard de Métricas</h2>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
        >
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="90d">Últimos 90 dias</option>
          <option value="all">Todo o período</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total de Usuários"
          value={overview.users.total}
          subtitle={`+${overview.users.new} novos`}
          icon={Users}
          trend={overview.users.active}
          trendLabel="ativos"
        />
        <MetricCard
          title="Volume de Vendas"
          value={formatCurrency(overview.transactions.volume)}
          subtitle={`${overview.transactions.total} transações`}
          icon={DollarSign}
        />
        <MetricCard
          title="Itens no Catálogo"
          value={overview.items.total}
          subtitle={`${overview.items.available} disponíveis`}
          icon={Package}
        />
        <MetricCard
          title="Taxas da Plataforma"
          value={formatCurrency(overview.platform.fees)}
          subtitle={`${overview.platform.pendingSwaps} trocas pendentes`}
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Volume de Vendas por Dia</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.dailyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                <XAxis dataKey="date" stroke="#71717A" fontSize={12} />
                <YAxis stroke="#71717A" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181B', border: '1px solid #3F3F46' }}
                  labelStyle={{ color: '#FAFAFA' }}
                  formatter={(value) => [`R$ ${value.toFixed(2)}`, 'Volume']}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#D4AF37"
                  strokeWidth={2}
                  dot={{ fill: '#D4AF37', strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Distribuição por Gênero</h3>
          <div className="h-64 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.genreDistribution}
                  dataKey="count"
                  nameKey="genre"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ genre, percent }) => `${genre} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {charts.genreDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181B', border: '1px solid #3F3F46' }}
                  labelStyle={{ color: '#FAFAFA' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Top Vendedores</h3>
          <div className="space-y-3">
            {metrics.topSellers.slice(0, 5).map((seller, index) => (
              <div key={seller.id} className="flex items-center gap-3">
                <span className="text-amber-500 font-bold w-6">#{index + 1}</span>
                <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                  {seller.avatar_url ? (
                    <img src={seller.avatar_url} alt="" className="w-full h-full rounded-full" />
                  ) : (
                    <span className="text-lg font-bold text-white">
                      {seller.full_name?.charAt(0) || '?'}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{seller.full_name || 'Anônimo'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Itens Recentes</h3>
          <div className="space-y-3">
            {metrics.topItems.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded bg-zinc-700 flex items-center justify-center">
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="w-full h-full rounded object-cover" />
                  ) : (
                    <Package className="w-6 h-6 text-zinc-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{item.title}</p>
                  <p className="text-sm text-zinc-400 truncate">{item.artist}</p>
                </div>
                <span className="text-amber-500 font-bold">{formatCurrency(item.price)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon: Icon, trend, trendLabel }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-zinc-400 text-sm">{title}</span>
        <Icon className="w-5 h-5 text-amber-500" />
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-zinc-500">{subtitle}</p>
        {trend !== undefined && (
          <div className="flex items-center gap-1 text-sm text-green-500">
            <ArrowUpRight className="w-4 h-4" />
            <span>{trend} {trendLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
