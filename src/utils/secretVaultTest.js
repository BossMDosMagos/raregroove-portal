/**
 * 🔐 Script de Teste - Cofre Invisível
 * Valida que as variáveis públicas estão carregando corretamente
 * 
 * Adicione isto ao seu App.jsx ou main.jsx para testar na startup
 */

export function validateSecretVault() {
  console.group('🔐 COFRE INVISÍVEL - Validação de Variáveis');
  
  const requiredVars = {
    'VITE_STRIPE_PUBLISHABLE_KEY': 'pk_',
    'VITE_MP_PUBLIC_KEY': 'APP_USR-',
    'VITE_PAYPAL_CLIENT_ID': 'AX'
  };

  let allValid = true;

  Object.entries(requiredVars).forEach(([varName, expectedPrefix]) => {
    const value = import.meta.env[varName];
    const isValid = value && value.startsWith(expectedPrefix);
    
    console.log(`${isValid ? '✅' : '❌'} ${varName}:`, {
      configured: !!value,
      startsWithPrefix: isValid,
      preview: value ? `${value.substring(0, 20)}...` : 'undefined',
      fullValue: value
    });

    if (!isValid) {
      allValid = false;
    }
  });

  console.log(`\n${allValid ? '✅ TUDO OK' : '❌ ERRO'} - Cofre Invisível ${allValid ? 'operacional' : 'incompleto'}`);
  
  // Verificar que chaves secretas NÃO estão no frontend
  const secretPatterns = [/sk_test_/, /sk_live_/, /whsec_/, /APP_USR.*secret/i];
  const allEnvVars = Object.keys(import.meta.env).join(' ');
  
  const hasSecrets = secretPatterns.some(pattern => pattern.test(allEnvVars));
  console.log(`\n🔒 Validação de Segurança:`, {
    temChaveSecretaNoFrontend: hasSecrets ? '❌ CRÍTICO!' : '✅ Seguro',
    mensagem: hasSecrets ? 'REMOVER chaves secretas do .env.local!' : 'Nenhuma chave secreta encontrada'
  });
  
  console.groupEnd();
  
  return allValid && !hasSecrets;
}

/**
 * Uso em App.jsx:
 * 
 * import { validateSecretVault } from './utils/secretVaultTest';
 * 
 * export default function App() {
 *   useEffect(() => {
 *     const isValid = validateSecretVault();
 *     if (!isValid) {
 *       console.error('Cofre Invisível: Configuração incompleta!');
 *       // Mostrar alerta ao usuário ou bloquear funcionalidade
 *     }
 *   }, []);
 * 
 *   return (...)
 * }
 */
