// Script para testar Edge Function do Mercado Pago manualmente
const supabaseUrl = 'https://hlfirfukbrisfpebaaur.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsZmlyZnVrYnJpc2ZwZWJhYXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNzIwNTUsImV4cCI6MjA4Njg0ODA1NX0.vXadY-YLsKGuWXEb2UmHAqoDEx0vD_FpFkrTs55CiuU';

async function testEdgeFunction() {
  console.log('🚀 Iniciando teste da Edge Function mp-create-preference...');

  const payload = {
    item: {
      title: 'Item de Teste Rare Groove',
      unit_price: 10.00,
      quantity: 1,
      currency_id: 'BRL'
    },
    payer: {
      email: 'comprador_teste@example.com',
      name: 'Comprador',
      surname: 'Teste'
    },
    back_urls: {
      success: 'http://localhost:5173/success',
      failure: 'http://localhost:5173/failure',
      pending: 'http://localhost:5173/pending'
    },
    external_reference: `TEST-${Date.now()}`
  };

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/mp-create-preference`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log(`📡 Status Code: ${response.status} ${response.statusText}`);

    const text = await response.text();
    console.log('📦 Resposta Bruta:', text);

    try {
      const json = JSON.parse(text);
      console.log('✅ Resposta JSON:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('⚠️ Resposta não é JSON válido');
    }

  } catch (error) {
    console.error('❌ Erro na requisição:', error);
  }
}

testEdgeFunction();
