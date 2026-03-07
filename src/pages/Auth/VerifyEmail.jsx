import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Mail, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

export default function VerifyEmail() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef([]);
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';

  useEffect(() => {
    // Focar no primeiro input ao carregar
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    // Cooldown para reenvio
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleChange = (index, value) => {
    // Aceitar apenas números
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focar no próximo input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Backspace: voltar para input anterior
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    // Enter: submeter se estiver completo
    if (e.key === 'Enter') {
      const fullCode = code.join('');
      if (fullCode.length === 6) {
        handleVerify();
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData.length === 6) {
      const newCode = pastedData.split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join('');
    
    if (fullCode.length !== 6) {
      toast.error('CÓDIGO INCOMPLETO', {
        description: 'Digite todos os 6 dígitos do código',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' }
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email,
        token: fullCode,
        type: 'signup'
      });

      if (error) {
        console.error('Erro na verificação:', error);
        
        if (error.message?.includes('expired')) {
          toast.error('CÓDIGO EXPIRADO', {
            description: 'Solicite um novo código de verificação',
            style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' }
          });
        } else if (error.message?.includes('invalid')) {
          toast.error('CÓDIGO INVÁLIDO', {
            description: 'Verifique os dígitos e tente novamente',
            style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' }
          });
          setCode(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
        } else {
          toast.error('ERRO NA VERIFICAÇÃO', {
            description: error.message || 'Tente novamente',
            style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' }
          });
        }
        setLoading(false);
        return;
      }

      // Sucesso!
      toast.success('EMAIL VERIFICADO', {
        description: 'Bem-vindo ao Rare Groove!',
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' }
      });

      // Redirecionar para completar cadastro (preencher dados obrigatórios)
      setTimeout(() => {
        navigate('/complete-signup');
      }, 500);

    } catch (error) {
      console.error('Erro ao verificar:', error);
      toast.error('ERRO INESPERADO', {
        description: 'Tente novamente em alguns instantes',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' }
      });
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setResendLoading(true);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      });

      if (error) {
        toast.error('ERRO AO REENVIAR', {
          description: error.message || 'Tente novamente',
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' }
        });
      } else {
        toast.success('CÓDIGO REENVIADO', {
          description: 'Verifique seu email',
          style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' }
        });
        setResendCooldown(60); // 60 segundos de cooldown
      }
    } catch (error) {
      console.error('Erro ao reenviar:', error);
      toast.error('ERRO INESPERADO', {
        description: 'Tente novamente',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' }
      });
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="text-5xl font-bold text-[#D4AF37] tracking-wider mb-2">
          RAREGROOVE
        </h1>
        <p className="text-gray-400 text-sm tracking-widest">COFRE DIGITAL</p>
      </div>

      {/* Card de Verificação */}
      <div className="w-full max-w-md bg-zinc-900 rounded-lg border border-zinc-800 p-8">
        {/* Ícone e Título */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-[#D4AF37]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Verifique seu Email</h2>
          <p className="text-gray-400 text-center text-sm">
            Enviamos um código de 6 dígitos para
          </p>
          <p className="text-[#D4AF37] font-semibold mt-1">{email}</p>
        </div>

        {/* Inputs de Código */}
        <div className="flex gap-2 justify-center mb-6">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={el => inputRefs.current[index] = el}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              className="w-12 h-14 bg-black border-2 border-zinc-700 rounded-lg text-center text-2xl font-bold text-white focus:border-[#D4AF37] focus:outline-none transition-colors"
              disabled={loading}
            />
          ))}
        </div>

        {/* Botão Verificar */}
        <button
          onClick={handleVerify}
          disabled={loading || code.join('').length !== 6}
          className="w-full bg-[#D4AF37] hover:bg-[#B8941F] disabled:bg-zinc-700 disabled:cursor-not-allowed text-black font-bold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 mb-4"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Verificando...
            </>
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" />
              Verificar Código
            </>
          )}
        </button>

        {/* Botão Reenviar */}
        <button
          onClick={handleResend}
          disabled={resendLoading || resendCooldown > 0}
          className="w-full text-gray-400 hover:text-[#D4AF37] text-sm transition-colors disabled:cursor-not-allowed disabled:hover:text-gray-400"
        >
          {resendCooldown > 0 ? (
            `Reenviar código em ${resendCooldown}s`
          ) : resendLoading ? (
            'Enviando...'
          ) : (
            'Não recebeu? Reenviar código'
          )}
        </button>

        {/* Voltar */}
        <button
          onClick={() => navigate('/login')}
          className="w-full mt-6 text-gray-500 hover:text-gray-300 text-sm transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para login
        </button>
      </div>

      {/* Rodapé */}
      <div className="mt-8 text-center">
        <p className="text-gray-600 text-xs flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          PROTEGIDO PELA SEGURANÇA RARE GROOVE
        </p>
      </div>
    </div>
  );
}
