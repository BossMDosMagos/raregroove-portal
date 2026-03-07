// ============================================================================
// TESTE DE EDGE FUNCTION - COPIE E COLE NO CONSOLE DO NAVEGADOR
// ============================================================================
// Cole este código no Console (F12) enquanto estiver na página de checkout

console.log('🧪 [TESTE] Iniciando teste de Edge Function...');

// Teste 1: Chamar a Edge Function diretamente
async function testarEdgeFunction() {
  try {
    console.log('📤 [TESTE] Enviando requisição para mp-create-preference...');
    
    const { data, error } = await supabase.functions.invoke('mp-create-preference', {
      body: {
        items: [
          {
            title: 'Teste',
            quantity: 1,
            unit_price: 100.00,
            currency_id: 'BRL'
          }
        ],
        payer: {
          email: 'teste@example.com',
          name: 'Teste User'
        },
        back_urls: {
          success: window.location.origin,
          failure: window.location.origin,
          pending: window.location.origin
        },
        auto_return: 'approved',
        metadata: { test: true },
        accessToken: 'TEST_TOKEN_HERE'  // ⚠️ USAR UMA CHAVE REAL AQUI
      }
    });

    if (error) {
      console.error('❌ [TESTE] Edge Function retornou erro:', error);
      console.error('📋 Detalhes do erro:', {
        message: error.message,
        name: error.name,
        context: error.context
      });
    } else {
      console.log('✅ [TESTE] Edge Function respondeu:', data);
    }
  } catch (err) {
    console.error('❌ [TESTE] Exceção ao chamar Edge Function:', err);
    console.error('📋 Stack trace:', err.stack);
  }
}

// Execute o teste
testarEdgeFunction();
