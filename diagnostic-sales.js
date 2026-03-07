// Script de diagnóstico para AdminSales
// Execute no console do navegador após estar logado

(async () => {
  const { createClient } = window.supabase;
  
  // Use a URL pública do Supabase do seu index.html
  const supabaseUrl = 'https://gyhftjzqqzmwuhvqtvja.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5aGZ0anpxcXptd3VodnF0dmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQwMTAwMjksImV4cCI6MjA0OTU4NjAyOX0.q4Yq3BRzj_RJz8FVPm4pN_zpWJzQ_QMmN39d6LuI3js';
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('1️⃣ Buscando transações SEM filtro de status...');
  const { data: allTx, error: allError } = await supabase
    .from('transactions')
    .select('id, status, created_at, total_amount, buyer_id, seller_id')
    .limit(10);
  
  if (allError) {
    console.error('❌ Erro:', allError);
  } else {
    console.log('✅ Transações encontradas:', allTx?.length);
    if (allTx?.length > 0) {
      console.log('Status encontrados:', [...new Set(allTx.map(t => t.status))]);
      console.log('Exemplo de transação:', allTx[0]);
    }
  }
  
  console.log('\n2️⃣ Buscando transações com status "pago_em_custodia"...');
  const { data: custodyTx, error: custodyError } = await supabase
    .from('transactions')
    .select('id, status, created_at')
    .eq('status', 'pago_em_custodia');
  
  if (custodyError) {
    console.error('❌ Erro:', custodyError);
  } else {
    console.log('✅ Transações pago_em_custodia:', custodyTx?.length);
  }
  
  console.log('\n3️⃣ Verificando se tabela items existe...');
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select('id, title')
    .limit(1);
  
  if (itemsError) {
    console.error('❌ Erro:', itemsError);
  } else {
    console.log('✅ Items encontrados:', items?.length);
  }
})();
