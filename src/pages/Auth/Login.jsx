import React, { useEffect, useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // 1. Importado
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { createProfileOnSignUp } from '../../utils/profileService';
import { Pill } from '../../components/UIComponents';
import { Input, AuthButton } from '../../components/AuthComponents';
import { checkLoginLockout, recordFailedLogin, clearLoginAttempts, validateHoneyPot } from '../../utils/security';
import { useI18n } from '../../contexts/I18nContext.jsx';

export default function Login() {
  const { t } = useI18n();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [rg, setRg] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);
  const [signUpCooldown, setSignUpCooldown] = useState(0); // Cooldown para rate limit
  const [lockoutInfo, setLockoutInfo] = useState(null); // Estado de bloqueio local
  
  // 🍯 HONEY POT: Campo oculto anti-bot
  const [addressSecondary, setAddressSecondary] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState(''); // Honeypot extra para login

  const navigate = useNavigate(); // 2. Inicializado

  useEffect(() => {
    // Verificar bloqueio ao carregar
    const lockout = checkLoginLockout();
    if (lockout.isLocked) {
      setLockoutInfo(lockout);
    }
    
    const savedRemember = localStorage.getItem('rg_remember_email') === 'true';
    const savedEmail = localStorage.getItem('rg_login_email') || '';

    if (savedRemember && savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);

  useEffect(() => {
    if (!isLogin) return;

    if (rememberEmail) {
      localStorage.setItem('rg_remember_email', 'true');
      localStorage.setItem('rg_login_email', email);
    } else {
      localStorage.removeItem('rg_remember_email');
      localStorage.removeItem('rg_login_email');
    }
  }, [rememberEmail, email, isLogin]);

  // Cooldown para rate limit: conta para baixo a cada segundo
  useEffect(() => {
    if (signUpCooldown <= 0) return;
    
    const timer = setInterval(() => {
      setSignUpCooldown(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [signUpCooldown]);

  const normalizeDoc = (value) => (value || '').replace(/\D/g, '');

  const isValidCpfCnpj = (value) => {
    const digits = normalizeDoc(value);
    return digits.length === 11 || digits.length === 14;
  };

  const isValidRg = (value) => {
    const digits = normalizeDoc(value);
    return digits.length >= 7 && digits.length <= 12;
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    // 🔒 RATE LIMIT: Verificar bloqueio local
    const lockout = checkLoginLockout();
    if (lockout.isLocked) {
      toast.error('BLOQUEIO DE SEGURANÇA', {
        description: lockout.message,
        duration: 8000,
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      setLockoutInfo(lockout);
      setLoading(false);
      return;
    }

    // 🍯 HONEY POT: Detectar bots preenchendo campo oculto
    if (addressSecondary || websiteUrl) {
      console.warn('🚨 BOT DETECTADO: Campo honey pot preenchido');
      toast.error('ACESSO NEGADO', {
        description: 'Atividade suspeita detectada. Acesso bloqueado.',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
          // 🔒 REGISTRAR FALHA DE LOGIN
          const result = recordFailedLogin();
          if (result.isLocked) {
            setLockoutInfo(result);
            toast.error('BLOQUEIO ATIVADO', {
              description: result.message,
              duration: 8000,
              style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
            });
            setLoading(false);
            return;
          }

          // Detectar erro de email não confirmado
          if (error.message?.toLowerCase().includes('email not confirmed')) {
            toast.error('CONTA NÃO ATIVADA', {
              description: 'Sua conta ainda não foi ativada. Por favor, confirme seu e-mail.',
              duration: 7000,
              style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
            });
            setLoading(false);
            return;
          }
          throw error;
        }

        // Sucesso: Limpar tentativas falhas
        clearLoginAttempts();
        
        // Verificar se o perfil existe
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('status, suspension_end, id')
          .eq('id', authData.user.id)
          .single();

        if (profileError || !profile) {
          await supabase.auth.signOut();
          toast.error('CADASTRO NÃO ENCONTRADO', {
            description: 'Este perfil foi removido. Crie um novo cadastro.',
            style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
          });
          setLoading(false);
          return;
        }

        if (!profileError && profile) {
          // Verificar se está banido
          if (profile.status === 'banned') {
            await supabase.auth.signOut();
            toast.error('ACESSO NEGADO', {
              description: 'Sua conta está sob análise do Portal Rare Groove',
              style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
            });
            setLoading(false);
            return;
          }

          // Verificar se está suspenso
          if (profile.status === 'suspended' && profile.suspension_end) {
            const suspensionDate = new Date(profile.suspension_end);
            const now = new Date();
            
            if (suspensionDate > now) {
              await supabase.auth.signOut();
              toast.error('ACESSO TEMPORARIAMENTE BLOQUEADO', {
                description: 'Sua conta está sob análise do Portal Rare Groove',
                style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
              });
              setLoading(false);
              return;
            }
          }
        }
        
        // Notificação de Sucesso Elite
        toast.success('ACESSO AUTORIZADO', {
          description: 'Bem-vindo ao Rare Groove, colecionador.',
          style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
        });
        
        navigate('/portal'); 
      } else {
        if (!isValidCpfCnpj(cpfCnpj)) {
          toast.error('CPF/CNPJ inválido', {
            description: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.'
          });
          setLoading(false);
          return;
        }

        if (!isValidRg(rg)) {
          toast.error('RG inválido', {
            description: 'Informe um RG válido com 7 a 12 dígitos.'
          });
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { 
            data: { full_name: fullName },
            emailRedirectTo: 'http://localhost:5173/complete-signup'
          }
        });
        
        if (error) {
          // Tratamento específico para rate limit
          if (error.message?.toLowerCase().includes('rate limit') || error.message?.toLowerCase().includes('too many')) {
            toast.error('MUITOS CADASTROS', {
              description: 'Aguarde 1 minuto antes de tentar novamente. Limite de segurança do Supabase.',
              duration: 7000,
              style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
            });
            setSignUpCooldown(60); // 60 segundos
            setLoading(false);
            return;
          }
          
          // Tratamento específico para email já cadastrado
          if (error.message?.includes('already registered') || error.message?.includes('already been registered')) {
            toast.error('EMAIL JÁ CADASTRADO', {
              description: 'Este email já possui uma conta. Use "Entrar" ou recupere sua senha.',
              style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
            });
            setLoading(false);
            return;
          }
          throw error;
        }

        // Criar perfil na tabela profiles
        if (data?.user) {
          console.log('Usuário criado no auth, criando perfil...', {
            userId: data.user.id,
            email: email,
            fullName: fullName,
            cpf_cnpj: normalizeDoc(cpfCnpj),
            rg: normalizeDoc(rg)
          });
          
          const result = await createProfileOnSignUp({
            id: data.user.id,
            email: email,
            user_metadata: { full_name: fullName },
            cpf_cnpj: normalizeDoc(cpfCnpj),
            rg: normalizeDoc(rg)
          });

          if (!result?.success) {
            let errorTitle = 'ERRO AO CRIAR CADASTRO';
            let errorDescription = 'Não foi possível completar o registro';

            if (result?.error?.code === '23505') {
              const errorMsg = result?.error?.message?.toLowerCase() || '';
              if (errorMsg.includes('cpf_cnpj')) {
                errorTitle = 'CPF/CNPJ JÁ CADASTRADO';
                errorDescription = 'Este CPF/CNPJ já está vinculado a outro perfil';
              } else if (errorMsg.includes('rg')) {
                errorTitle = 'RG JÁ CADASTRADO';
                errorDescription = 'Este RG já está vinculado a outro perfil';
              } else if (errorMsg.includes('email')) {
                errorTitle = 'EMAIL JÁ CADASTRADO';
                errorDescription = 'Este email já está em uso por outro usuário';
              } else {
                errorTitle = 'DOCUMENTO DUPLICADO';
                errorDescription = 'Este documento já está cadastrado no sistema';
              }
            } else {
              errorDescription = result?.error?.message || 'Tente novamente';
            }

            toast.error(errorTitle, {
              description: errorDescription,
              style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
            });
            await supabase.auth.signOut();
            setLoading(false);
            return;
          }
        }

        // Sucesso: Mostrar mensagem e limpar campos
        toast.success('E-MAIL DE ATIVAÇÃO ENVIADO', {
          description: 'Verifique sua caixa de entrada para acessar o Rare Groove',
          duration: 8000,
          style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
        });
        
        // Ativar cooldown curto (5s) para evitar duplo-clique
        setSignUpCooldown(5);
        
        // Limpar campos e trocar para modo login
        setEmail('');
        setPassword('');
        setFullName('');
        setCpfCnpj('');
        setRg('');
        setIsLogin(true);
      }
    } catch (error) {
      // Notificação de Erro com mais contexto
      console.error('Erro completo de autenticação:', error);
      
      let errorTitle = 'FALHA NA AUTENTICAÇÃO';
      let errorDescription = error.message;
      
      // Detectar erros específicos
      if (error.message?.toLowerCase().includes('email') && error.message?.toLowerCase().includes('already')) {
        errorTitle = 'EMAIL JÁ CADASTRADO';
        errorDescription = 'Este email já está em uso. Tente fazer login ou recuperar sua senha.';
      } else if (error.code === '23505' || error.message?.toLowerCase().includes('duplicate key')) {
        errorTitle = 'DADOS DUPLICADOS';
        errorDescription = 'CPF, RG ou Email já cadastrados no sistema.';
      }
      
      toast.error(errorTitle, {
        description: errorDescription,
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal-deep flex items-center justify-center p-6 relative overflow-hidden selection:bg-gold-premium/30 selection:text-gold-light">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold-premium/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold-premium/5 rounded-full blur-[120px] animate-pulse delay-1000" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in duration-1000">
        <div className="text-center mb-12 space-y-4">
          <Pill color="gold">{isLogin ? t('auth.login.badge') || "ACESSO RESTRITO" : t('auth.signup.badge') || "NOVO MEMBRO"}</Pill>
          <div className="space-y-1">
            <h2 className="text-5xl font-black tracking-tighter text-luxury uppercase leading-none">
              RAREGROOVE<span className="text-gold-premium">.</span>
            </h2>
            <p className="text-silver-premium/30 text-[10px] uppercase tracking-[0.4em] font-black italic">
              {t('auth.subtitle') || "O COFRE DOS COLECIONADORES"}
            </p>
          </div>
        </div>

        <div className="glass-card rounded-[3rem] p-10 border-gold-premium/10 shadow-2xl relative overflow-hidden group">
          {loading && (
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold-premium to-transparent animate-shimmer" />
          )}
          
          <form onSubmit={handleAuth} className="space-y-6">
            {!isLogin && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-500">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gold-premium/60 ml-1">
                  {t('auth.form.fullName') || "Nome Completo"}
                </label>
                <input 
                  required
                  className="w-full bg-charcoal-deep/50 border border-gold-premium/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-gold-premium/50 focus:ring-4 focus:ring-gold-premium/5 transition-all placeholder:text-white/10"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                />
              </div>
            )}

            {!isLogin && (
              <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-500 delay-75">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gold-premium/60 ml-1">
                    {t('auth.form.cpf') || "CPF/CNPJ"}
                  </label>
                  <input 
                    required
                    className="w-full bg-charcoal-deep/50 border border-gold-premium/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-gold-premium/50 focus:ring-4 focus:ring-gold-premium/5 transition-all placeholder:text-white/10"
                    value={cpfCnpj}
                    onChange={(e) => setCpfCnpj(e.target.value)}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gold-premium/60 ml-1">
                    RG
                  </label>
                  <input 
                    required
                    className="w-full bg-charcoal-deep/50 border border-gold-premium/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-gold-premium/50 focus:ring-4 focus:ring-gold-premium/5 transition-all placeholder:text-white/10"
                    value={rg}
                    onChange={(e) => setRg(e.target.value)}
                    placeholder="00.000.000-0"
                    inputMode="numeric"
                  />
                </div>
              </div>
            )}
            
            {/* 🍯 HONEY POT: Signup */}
            {!isLogin && (
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
            )}

            {/* 🍯 HONEY POT: Login */}
            {isLogin && (
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
            )}
            
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gold-premium/60 ml-1">
                {t('auth.form.email') || "Email de Acesso"}
              </label>
              <input 
                required
                type="email"
                className="w-full bg-charcoal-deep/50 border border-gold-premium/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-gold-premium/50 focus:ring-4 focus:ring-gold-premium/5 transition-all placeholder:text-white/10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gold-premium/60 ml-1">
                {t('auth.form.password') || "Senha Criptografada"}
              </label>
              <input 
                required
                type="password"
                className="w-full bg-charcoal-deep/50 border border-gold-premium/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-gold-premium/50 focus:ring-4 focus:ring-gold-premium/5 transition-all placeholder:text-white/10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {isLogin && (
              <div className="flex items-center justify-between px-1">
                <label className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-silver-premium/40 cursor-pointer group/check">
                  <div className={`w-5 h-5 rounded-lg border border-gold-premium/20 flex items-center justify-center transition-all duration-300 ${rememberEmail ? 'bg-gold-premium border-gold-premium shadow-lg' : 'bg-charcoal-deep/50 group-hover/check:border-gold-premium/50'}`}>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={rememberEmail}
                      onChange={(e) => setRememberEmail(e.target.checked)}
                    />
                    {rememberEmail && <ShieldCheck size={12} className="text-charcoal-deep" />}
                  </div>
                  {t('auth.form.remember') || "LEMBRE-SE DE MIM"}
                </label>
                
                <button type="button" className="text-[10px] font-black uppercase tracking-widest text-gold-premium/40 hover:text-gold-premium transition-colors">
                  {t('auth.form.forgot') || "ESQUECI A SENHA"}
                </button>
              </div>
            )}
            
            <div className="pt-4 space-y-6">
              <button 
                disabled={loading || (signUpCooldown > 0 && !isLogin)}
                className="w-full py-5 bg-gold-premium text-charcoal-deep rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all duration-500 hover:shadow-[0_0_40px_rgba(212,175,55,0.4)] hover:scale-[1.02] disabled:opacity-30 disabled:grayscale active:scale-95 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    {isLogin ? (t('auth.login.processing') || 'ENTRANDO...') : (t('auth.signup.processing') || 'CRIANDO...')}
                  </>
                ) : signUpCooldown > 0 && !isLogin ? (
                  `AGUARDE ${signUpCooldown}S`
                ) : (
                  isLogin ? (t('auth.login.submit') || "ENTRAR NO COFRE") : (t('auth.signup.submit') || "CRIAR CREDENCIAIS")
                )}
              </button>
              
              <button 
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setSignUpCooldown(0);
                }}
                className="w-full text-[10px] text-silver-premium/30 hover:text-gold-premium transition-all duration-500 uppercase font-black tracking-[0.2em] py-2"
              >
                {isLogin ? (t('auth.login.toggle') || "NÃO POSSUI CONTA? CADASTRE-SE") : (t('auth.signup.toggle') || "JÁ POSSUI CONTA? ENTRE")}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 animate-in fade-in duration-1000 delay-500">
          <div className="flex items-center gap-3 grayscale opacity-30 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
            <ShieldCheck size={16} className="text-gold-premium" />
            <span className="text-[9px] font-black uppercase tracking-widest text-silver-premium/60">RareGroove Security Protocol v3.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
