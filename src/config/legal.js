// Dados legais e institucionais da RareGroove.
// Centralizados aqui para evitar textos provisórios espalhados pela interface.
// O administrador pode preencher os dados reais via variáveis de ambiente VITE_LEGAL_*.
// Enquanto não preenchidos, exibimos textos finais limpos (sem marcadores [INSERIR ...]).

const env = (key, fallback) => {
  try {
    const value = String(import.meta.env?.[key] || '').trim();
    return value || fallback;
  } catch {
    return fallback;
  }
};

export const LEGAL = {
  razaoSocial: env('VITE_LEGAL_RAZAO_SOCIAL', 'COMMAND SOLUÇÕES TECNOLOGIA'),
  cnpj: env('VITE_LEGAL_CNPJ', 'Inscrição no CNPJ da empresa operadora'),
  endereco: env('VITE_LEGAL_ENDERECO', 'Endereço comercial da empresa operadora'),
  sac: env('VITE_LEGAL_SAC', 'raregroovecdseswapsafe@gmail.com'),
  dpoNome: env('VITE_LEGAL_DPO_NOME', 'Encarregado de Dados da RareGroove'),
  dpoEmail: env('VITE_LEGAL_DPO_EMAIL', 'raregroovecdseswapsafe@gmail.com'),
  comissaoPct: env('VITE_LEGAL_COMISSAO_PCT', '10'),
};

export default LEGAL;
