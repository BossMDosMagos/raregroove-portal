import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { fetchProfile } from '../../utils/profileService';
import { Pill } from '../../components/UIComponents';
import { Input, AuthButton } from '../../components/AuthComponents';
import { validateDoubleHoneyPot, validateFormTiming } from '../../utils/security';
import { useI18n } from '../../contexts/I18nContext.jsx';

export default function CompleteSignUp() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [user, setUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [countryCode, setCountryCode] = useState('BR');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [rg, setRg] = useState('');
  const [addressSecondary, setAddressSecondary] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [formStartedAt] = useState(Date.now());
  const [step, setStep] = useState('verifying'); // 'verifying' | 'completing' | 'success'

  const isBrazil = countryCode === 'BR';
  const doc1Label = isBrazil ? (t('auth.form.cpf') || 'CPF/CNPJ') : (t('auth.form.taxId') || 'Tax ID / National ID');
  const doc2Label = isBrazil ? (t('auth.form.rg') || 'RG') : (t('auth.form.passport') || 'Passport / ID Number');
  const doc1Placeholder = isBrazil ? (t('auth.form.cpf.placeholder') || '000.000.000-00 ou 00.000.000/0000-00') : (t('auth.form.taxId.placeholder') || 'A1B2C3');
  const doc2Placeholder = isBrazil ? (t('auth.form.rg.placeholder') || '00.000.000-0') : (t('auth.form.passport.placeholder') || 'X1234567');

  const countryOptions = [
    { value: 'BR', label: t('country.br') || 'Brasil' },
    { value: 'US', label: t('country.us') || 'Estados Unidos' },
    { value: 'CA', label: t('country.ca') || 'Canadá' },
    { value: 'GB', label: t('country.gb') || 'Reino Unido' },
    { value: 'PT', label: t('country.pt') || 'Portugal' },
    { value: 'ES', label: t('country.es') || 'Espanha' },
    { value: 'FR', label: t('country.fr') || 'França' },
    { value: 'DE', label: t('country.de') || 'Alemanha' },
    { value: 'AR', label: t('country.ar') || 'Argentina' },
    { value: 'MX', label: t('country.mx') || 'México' },
    { value: 'OTHER', label: t('country.other') || 'Outro' },
  ];

  const normalizeDoc = (value) => (value || '').replace(/\D/g, '');

  const normalizeForeignDoc = (value) => {
    const cleaned = String(value || '')
      .trim()
      .replace(/[^a-zA-Z0-9._/\s-]/g, '')
      .replace(/\s+/g, ' ')
      .toUpperCase();
    return cleaned;
  };

  const isValidForeignDoc = (value) => {
    const cleaned = normalizeForeignDoc(value);
    if (!cleaned) return false;
    if (cleaned.length < 3 || cleaned.length > 32) return false;
    return /[A-Z0-9]/.test(cleaned);
  };

  // Validação real de CPF com dígitos verificadores
  const isValidCPF = (cpf) => {
    const digits = normalizeDoc(cpf);
    
    // Verifica tamanho
    if (digits.length !== 11) return false;
    
    // Verifica se todos os dígitos são iguais (CPF inválido)
    if (/^(\d)\1{10}$/.test(digits)) return false;
    
    // Valida primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(digits.charAt(i)) * (10 - i);
    }
    let firstDigit = 11 - (sum % 11);
    if (firstDigit >= 10) firstDigit = 0;
    if (firstDigit !== parseInt(digits.charAt(9))) return false;
    
    // Valida segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(digits.charAt(i)) * (11 - i);
    }
    let secondDigit = 11 - (sum % 11);
    if (secondDigit >= 10) secondDigit = 0;
    if (secondDigit !== parseInt(digits.charAt(10))) return false;
    
    return true;
  };

  // Validação de CNPJ
  const isValidCNPJ = (cnpj) => {
    const digits = normalizeDoc(cnpj);
    
    if (digits.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(digits)) return false;
    
    // Validação dos dígitos verificadores
    let size = digits.length - 2;
    let numbers = digits.substring(0, size);
    const digitsCheck = digits.substring(size);
    let sum = 0;
    let pos = size - 7;
    
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digitsCheck.charAt(0))) return false;
    
    size = size + 1;
    numbers = digits.substring(0, size);
    sum = 0;
    pos = size - 7;
    
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digitsCheck.charAt(1))) return false;
    
    return true;
  };

  const isValidCpfCnpj = (value) => {
    if (countryCode !== 'BR') return isValidForeignDoc(value);
    const digits = normalizeDoc(value);
    if (digits.length === 11) return isValidCPF(value);
    if (digits.length === 14) return isValidCNPJ(value);
    return false;
  };

  const isValidRg = (value) => {
    if (countryCode !== 'BR') return isValidForeignDoc(value);
    const digits = normalizeDoc(value);
    return digits.length >= 7 && digits.length <= 12;
  };

  // Verificar se token no URL é válido e confirmar email
  useEffect(() => {
    const verifyToken = async () => {
      try {
        setVerifying(true);
        
        // Supabase deve ter processado o token automaticamente
        // Verificar se usuário está autenticado agora
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          // Token inválido ou expirado
          toast.error('LINK INVÁLIDO OU EXPIRADO', {
            description: 'Seu link de confirmação expirou. Faça login e solicite novo link.',
            duration: 7000,
            style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' }
          });
          setTimeout(() => navigate('/'), 3000);
          setLoading(false);
          return;
        }

        // Usuário autenticado! Buscar perfil
        const profile = await fetchProfile(session.user.id);
        setUser(session.user);
        setProfileData(profile);

        // Pré-preencher campos se já tiverem dados
        if (profile?.country_code) setCountryCode(profile.country_code);
        if (profile?.cpf_cnpj) setCpfCnpj(profile.cpf_cnpj);
        if (profile?.rg) setRg(profile.rg);

        setStep('completing');
        setLoading(false);

      } catch (error) {
        console.error('Erro ao verificar token:', error);
        toast.error('ERRO NA VERIFICAÇÃO', {
          description: 'Ocorreu um erro ao processar seu link',
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' }
        });
        setTimeout(() => navigate('/'), 3000);
        setLoading(false);
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [navigate]);

  const handleComplete = async (e) => {
    e.preventDefault();
    setVerifying(true);

    try {
      if (!validateFormTiming(formStartedAt, { minMs: 1800 })) {
        toast.error('ACESSO NEGADO', {
          description: 'Atividade suspeita detectada. Tente novamente.',
          duration: 6000,
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' }
        });
        setVerifying(false);
        return;
      }

      if (!validateDoubleHoneyPot([addressSecondary, websiteUrl])) {
        toast.error('ACESSO NEGADO', {
          description: 'Atividade suspeita detectada. Acesso bloqueado.',
          duration: 6000,
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' }
        });
        setVerifying(false);
        return;
      }

      // Validar documentos
      if (!isValidCpfCnpj(cpfCnpj)) {
        if (countryCode === 'BR') {
          const digitCount = normalizeDoc(cpfCnpj).length;
          toast.error('CPF/CNPJ inválido', {
            description: digitCount === 11 
              ? 'CPF inválido. Verifique os dígitos verificadores.' 
              : digitCount === 14 
              ? 'CNPJ inválido. Verifique os dígitos verificadores.'
              : `Você digitou ${digitCount} dígitos. CPF precisa de 11, CNPJ de 14.`,
            duration: 6000
          });
        } else {
          toast.error(t('auth.form.taxId.invalid') || 'Documento inválido', {
            description: t('auth.form.taxId.invalidDesc') || 'Informe um Tax ID / National ID válido.',
            duration: 6000
          });
        }
        setVerifying(false);
        return;
      }

      if (!isValidRg(rg)) {
        if (countryCode === 'BR') {
          toast.error('RG inválido', {
            description: 'Informe um RG válido com 7 a 12 dígitos.'
          });
        } else {
          toast.error(t('auth.form.passport.invalid') || 'Documento inválido', {
            description: t('auth.form.passport.invalidDesc') || 'Informe um Passport / ID Number válido.',
            duration: 6000
          });
        }
        setVerifying(false);
        return;
      }

      const normalizedCpf = countryCode === 'BR' ? normalizeDoc(cpfCnpj) : normalizeForeignDoc(cpfCnpj);
      const normalizedRg = countryCode === 'BR' ? normalizeDoc(rg) : normalizeForeignDoc(rg);

      // Atualizar perfil com dados completos
      const { error } = await supabase
        .from('profiles')
        .update({
          country_code: countryCode,
          cpf_cnpj: normalizedCpf,
          rg: normalizedRg,
          updated_at: new Date()
        })
        .eq('id', user.id);

      if (error) {
        console.error('Erro ao atualizar perfil:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          fullError: error
        });
        
        if (error.code === '23505') {
          // Violação de constraint (documento duplicado)
          const errorMsg = error.message?.toLowerCase() || '';
          if (errorMsg.includes('cpf_cnpj')) {
            toast.error('CPF/CNPJ JÁ CADASTRADO', {
              description: 'Este CPF/CNPJ já está vinculado a outro perfil',
              duration: 6000
            });
          } else if (errorMsg.includes('rg')) {
            toast.error('RG JÁ CADASTRADO', {
              description: 'Este RG já está vinculado a outro perfil',
              duration: 6000
            });
          } else {
            toast.error('DOCUMENTO DUPLICADO', {
              description: 'Este documento já está cadastrado no sistema',
              duration: 6000
            });
          }
        } else if (error.code === '42501' || error.message?.includes('new row violates row-level security policy')) {
          // Erro de RLS
          toast.error('ERRO AO ATUALIZAR', {
            description: 'Não foi possível salvar seu perfil. Tente fazer login novamente.',
            duration: 6000
          });
        } else if (error.message?.includes('not found') || error.code === '404') {
          // Perfil não encontrado
          toast.error('PERFIL NÃO ENCONTRADO', {
            description: 'Seu perfil não foi criado corretamente. Tente fazer signup novamente.',
            duration: 6000
          });
        } else {
          // Erro genérico
          toast.error('ERRO AO SALVAR', {
            description: error.message || 'Não foi possível salvar seu perfil. Tente novamente.',
            duration: 6000
          });
        }
        setVerifying(false);
        return;
      }

      // Sucesso!
      setStep('success');
      toast.success('CADASTRO COMPLETO', {
        description: 'Bem-vindo ao Rare Groove!',
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' }
      });

      // Redirecionar para Portal
      setTimeout(() => {
        navigate('/portal');
      }, 2000);

    } catch (error) {
      console.error('Erro ao completar cadastro:', error);
      toast.error('ERRO INESPERADO', {
        description: 'Tente novamente',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' }
      });
      setVerifying(false);
    }
  };

  // Tela de verificação
  if (loading || step === 'verifying') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-bold text-[#D4AF37] tracking-wider mb-2">
            RAREGROOVE
          </h1>
          <p className="text-gray-400 text-sm tracking-widest">COFRE DIGITAL</p>
        </div>

        <div className="w-full max-w-md bg-zinc-900 rounded-lg border border-zinc-800 p-8 text-center">
          <div className="flex justify-center mb-6">
            <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Verificando seu acesso...</h2>
          <p className="text-gray-400 text-sm">Processando seu link de confirmação</p>
        </div>
      </div>
    );
  }

  // Tela de sucesso
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-bold text-[#D4AF37] tracking-wider mb-2">
            RAREGROOVE
          </h1>
          <p className="text-gray-400 text-sm tracking-widest">COFRE DIGITAL</p>
        </div>

        <div className="w-full max-w-md bg-zinc-900 rounded-lg border border-zinc-800 p-8 text-center">
          <div className="flex justify-center mb-6">
            <CheckCircle className="w-16 h-16 text-[#D4AF37]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Cadastro Completo!</h2>
          <p className="text-gray-400 text-sm mb-4">Bem-vindo ao Rare Groove, colecionador!</p>
          <p className="text-gray-500 text-xs">Redirecionando para o Portal...</p>
        </div>
      </div>
    );
  }

  // Tela de completar cadastro
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="text-5xl font-bold text-[#D4AF37] tracking-wider mb-2">
          RAREGROOVE
        </h1>
        <p className="text-gray-400 text-sm tracking-widest">COFRE DIGITAL</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-zinc-900 rounded-lg border border-zinc-800 p-8">
        {/* Status - Email Confirmado */}
        <div className="flex items-center gap-2 mb-6 p-3 bg-green-950 border border-green-700 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-green-400 text-sm font-semibold">Email Confirmado! ✓</p>
            <p className="text-green-300 text-xs truncate">{profileData?.email}</p>
          </div>
        </div>

        {/* Título */}
        <h2 className="text-2xl font-bold text-white mb-2">Completar Cadastro</h2>
        <p className="text-gray-400 text-sm mb-6">
          Informe seus documentos para acessar o Rare Groove
        </p>

        {/* Formulário */}
        <form onSubmit={handleComplete} className="space-y-4">
          <input
            type="text"
            name="address_secondary_field"
            value={addressSecondary}
            onChange={(e) => setAddressSecondary(e.target.value)}
            autoComplete="off"
            tabIndex="-1"
            aria-hidden="true"
            className="absolute left-[-9999px] w-px h-1 opacity-0 pointer-events-none"
          />
          <input
            type="text"
            name="website_url_field"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            autoComplete="off"
            tabIndex="-1"
            aria-hidden="true"
            className="absolute left-[-9999px] w-px h-1 opacity-0 pointer-events-none"
          />
          <div>
            <label className="block text-[#D4AF37] text-xs font-bold mb-2 tracking-widest">
              {t('auth.form.country') || 'País'} *
            </label>
            <select
              value={countryCode}
              onChange={(e) => {
                const next = e.target.value;
                setCountryCode(next);
                setCpfCnpj('');
                setRg('');
              }}
              disabled={verifying}
              required
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#D4AF37]"
            >
              {countryOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#050505]">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {/* CPF/CNPJ */}
          <div>
            <label className="block text-[#D4AF37] text-xs font-bold mb-2 tracking-widest">
              {doc1Label} *
            </label>
            <Input
              type="text"
              placeholder={doc1Placeholder}
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
              maxLength={isBrazil ? '18' : '32'}
              disabled={verifying}
              required
              autoFocus
            />
            <p className="text-gray-500 text-xs mt-1">
              {isBrazil
                ? (cpfCnpj.length === 0
                  ? '📝 CPF (11) ou CNPJ (14 dígitos)'
                  : normalizeDoc(cpfCnpj).length === 11
                  ? '✓ CPF - ' + normalizeDoc(cpfCnpj).length + ' dígitos'
                  : normalizeDoc(cpfCnpj).length === 14
                  ? '✓ CNPJ - ' + normalizeDoc(cpfCnpj).length + ' dígitos'
                  : '⚠️ Formato incompleto: ' + normalizeDoc(cpfCnpj).length + ' dígitos (11 ou 14)')
                : (cpfCnpj.length === 0 ? (t('auth.form.taxId.hint') || '📝 Documento nacional (Tax ID)') : '✓ ' + cpfCnpj.length + ' caracteres')}
            </p>
            {cpfCnpj.length > 0 && !isValidCpfCnpj(cpfCnpj) && (
              <p className="text-red-400 text-xs mt-1">❌ Documento inválido</p>
            )}
            {cpfCnpj.length > 0 && isValidCpfCnpj(cpfCnpj) && (
              <p className="text-green-400 text-xs mt-1">✅ Documento válido</p>
            )}
          </div>

          {/* RG */}
          <div>
            <label className="block text-[#D4AF37] text-xs font-bold mb-2 tracking-widest">
              {doc2Label} *
            </label>
            <Input
              type="text"
              placeholder={doc2Placeholder}
              value={rg}
              onChange={(e) => setRg(e.target.value)}
              maxLength={isBrazil ? '14' : '32'}
              disabled={verifying}
              required
            />
            <p className="text-gray-500 text-xs mt-1">
              {isBrazil
                ? (rg.length === 0 ? '📝 7 a 12 dígitos' : '✓ ' + normalizeDoc(rg).length + ' dígitos')
                : (rg.length === 0 ? (t('auth.form.passport.hint') || '📝 Documento (Passaporte/ID)') : '✓ ' + rg.length + ' caracteres')}
            </p>
            {rg.length > 0 && !isValidRg(rg) && (
              <p className="text-red-400 text-xs mt-1">❌ Documento inválido</p>
            )}
            {rg.length > 0 && isValidRg(rg) && (
              <p className="text-green-400 text-xs mt-1">✅ Documento válido</p>
            )}
          </div>

          {/* Dados do Perfil (Read-only) */}
          <div className="p-3 bg-zinc-800 rounded-lg border border-zinc-700 mt-6">
            <p className="text-gray-400 text-xs font-bold mb-2 tracking-wider">DADOS DO PERFIL</p>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-gray-500">Nome:</span>{' '}
                <span className="text-white font-semibold">{profileData?.full_name || '—'}</span>
              </p>
              <p>
                <span className="text-gray-500">Email:</span>{' '}
                <span className="text-white font-semibold text-xs truncate">{profileData?.email || '—'}</span>
              </p>
              <p>
                <span className="text-gray-500">ID:</span>{' '}
                <span className="text-white font-mono text-xs truncate">{user?.id?.slice(0, 8)}...</span>
              </p>
            </div>
          </div>

          {/* Aviso de Segurança */}
          <div className="p-3 bg-blue-950 border border-blue-700 rounded-lg text-xs text-blue-200">
            <p>🔒 Seus dados estão protegidos pela segurança Rare Groove</p>
          </div>

          {/* Botão */}
          <AuthButton
            type="submit"
            disabled={verifying || !isValidCpfCnpj(cpfCnpj) || !isValidRg(rg)}
            className="!mt-6"
          >
            {verifying ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Salvando...
              </>
            ) : (
              'COMPLETAR CADASTRO'
            )}
          </AuthButton>
        </form>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-4">
          Você será redirecionado para o Portal após conclusão
        </p>
      </div>
    </div>
  );
}
