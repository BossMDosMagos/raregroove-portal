import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export default function DebugPayments() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const addLog = (message, type = 'info') => {
    setResults(prev => [...prev, { message, type, time: new Date().toLocaleTimeString() }]);
  };

  const runDiagnosis = async () => {
    setResults([]);
    setLoading(true);
    addLog('🚀 Iniciando diagnóstico completo...');

    try {
      // 1. Verificar transações
      addLog('📦 1. Verificando transações recentes...');
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('id, payment_id, status, created_at, total_amount, buyer_id, seller_id, item_id')
        .order('created_at', { ascending: false })
        .limit(5);

      if (txError) {
        addLog(`❌ Erro ao buscar transações: ${txError.message}`, 'error');
      } else if (transactions.length === 0) {
        addLog('⚠️ NENHUMA TRANSAÇÃO ENCONTRADA', 'warning');
      } else {
        addLog(`✅ ${transactions.length} transações encontradas:`, 'success');
        transactions.forEach(tx => {
          addLog(`  TX ${tx.id.substring(0, 8)}: R$ ${tx.total_amount || 0} | ${tx.status} | ${new Date(tx.created_at).toLocaleString()}`);
        });
      }

      // 2. Verificar ledger
      addLog('💰 2. Verificando ledger financeiro...');
      const { data: ledger, error: ledgerError } = await supabase
        .from('financial_ledger')
        .select('id, entry_type, amount, created_at, source_id')
        .order('created_at', { ascending: false })
        .limit(5);

      if (ledgerError) {
        addLog(`❌ Erro ao buscar ledger: ${ledgerError.message}`, 'error');
      } else if (ledger.length === 0) {
        addLog('⚠️ NENHUM REGISTRO NO LEDGER', 'warning');
      } else {
        addLog(`✅ ${ledger.length} registros no ledger:`, 'success');
        ledger.forEach(entry => {
          addLog(`  ${entry.entry_type}: R$ ${entry.amount} | ${new Date(entry.created_at).toLocaleString()}`);
        });
      }

      // 3. Verificar itens vendidos
      addLog('🎵 3. Verificando itens marcados como vendidos...');
      const { data: soldItems, error: itemsError } = await supabase
        .from('items')
        .select('id, title, is_sold, sold_date, sold_to_id')
        .eq('is_sold', true)
        .order('sold_date', { ascending: false })
        .limit(5);

      if (itemsError) {
        addLog(`❌ Erro ao buscar itens: ${itemsError.message}`, 'error');
      } else if (soldItems.length === 0) {
        addLog('⚠️ NENHUM ITEM MARCADO COMO VENDIDO', 'warning');
      } else {
        addLog(`✅ ${soldItems.length} itens vendidos:`, 'success');
        soldItems.forEach(item => {
          addLog(`  ${item.title.substring(0, 40)}: vendido em ${new Date(item.sold_date).toLocaleString()}`);
        });
      }

      // 4. Verificar session
      addLog('👤 4. Verificando autenticação...');
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        addLog(`✅ Usuário autenticado: ${session.user.email}`, 'success');
      } else {
        addLog('❌ Usuário NÃO autenticado', 'error');
      }

      // 5. Testar edge function (com dados válidos se disponíveis)
      addLog('🔧 5. Testando edge function process-transaction...');
      if (transactions && transactions.length > 0 && transactions[0].buyer_id) {
        const testPayload = {
          transactionType: 'venda',
          buyerId: transactions[0].buyer_id,
          sellerId: transactions[0].seller_id || null,
          itemId: transactions[0].item_id,
          itemPrice: 50,
          shippingCost: 0,
          insuranceCost: 0,
          platformFee: 5,
          processingFee: 2.5,
          gatewayFee: 0,
          totalAmount: 57.5,
          netAmount: 45,
          paymentId: `DEBUG-TEST-${Date.now()}`,
          paymentProvider: 'debug'
        };

        addLog('⚠️ Teste DESABILITADO - dados simulados poderiam criar registros duplicados', 'warning');
        addLog(`Payload seria: ${JSON.stringify(testPayload, null, 2)}`);
      } else {
        addLog('⚠️ Sem dados reais para teste - necessário ter pelo menos 1 transação', 'warning');
      }

      addLog('✅ Diagnóstico completo!', 'success');
    } catch (error) {
      addLog(`❌ ERRO CRÍTICO: ${error.message}`, 'error');
      console.error('[DEBUG] Erro completo:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      default: return <AlertCircle className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4 md:px-6 pt-20">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black">🔍 Debug Payments</h1>
          <p className="text-white/60">Diagnóstico do fluxo de pagamento e transações</p>
        </div>

        <button
          onClick={runDiagnosis}
          disabled={loading}
          className="bg-[#D4AF37] text-black px-6 py-3 rounded-lg font-bold hover:bg-[#D4AF37]/90 disabled:opacity-50"
        >
          {loading ? '⏳ Executando...' : '▶️ Executar Diagnóstico'}
        </button>

        {results.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-2 font-mono text-sm">
            {results.map((result, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <span className="text-white/40 text-xs">{result.time}</span>
                {getIcon(result.type)}
                <span className={
                  result.type === 'error' ? 'text-red-400' :
                  result.type === 'warning' ? 'text-yellow-400' :
                  result.type === 'success' ? 'text-green-400' :
                  'text-white/80'
                }>{result.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
