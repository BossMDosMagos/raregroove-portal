import { useState } from 'react';
import { Shield, Download, Copy, Check, Key, Smartphone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

const toastSuccessStyle = { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' };
const toastErrorStyle = { background: '#050505', border: '1px solid #ef4444', color: '#FFF' };

export function TwoFactorSetup({ onComplete }) {
  const [step, setStep] = useState(1);
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateSecret = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase.functions.invoke('twofa-setup', {
        body: { action: 'generate', userId: user.id }
      });

      if (error) throw error;

      setSecret(data.secret);
      setQrCode(data.qrCode);
      setBackupCodes(data.backupCodes);
      setStep(2);
      
      toast.success('Código gerado!', { style: toastSuccessStyle });
    } catch (error) {
      toast.error('Erro ao gerar código', { description: error.message, style: toastErrorStyle });
    } finally {
      setLoading(false);
    }
  };

  const verifyAndEnable = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase.functions.invoke('2fa-verify', {
        body: { action: 'enable', userId: user.id, code: verificationCode }
      });

      if (error) throw error;

      setStep(3);
      toast.success('2FA ativado com sucesso!', { style: toastSuccessStyle });
      
      if (onComplete) onComplete();
    } catch (error) {
      toast.error('Código inválido', { description: error.message, style: toastErrorStyle });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copiado!', { style: toastSuccessStyle });
  };

  const downloadBackupCodes = () => {
    const content = `CÓDIGOS DE BACKUP - RAREGROOVE\n\n${backupCodes.join('\n')}\n\nGuarde estes códigos em local seguro.\nCada código pode ser usado apenas uma vez.`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'raregroove-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-zinc-900 rounded-lg border border-zinc-800">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-amber-500" />
        <div>
          <h2 className="text-xl font-bold text-white">Verificação em Duas Etapas</h2>
          <p className="text-sm text-zinc-400">Proteja sua conta com 2FA</p>
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="p-4 bg-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-amber-500" />
              Por que usar 2FA?
            </h3>
            <ul className="text-sm text-zinc-300 space-y-1">
              <li>• Proteção extra contra acessos não autorizados</li>
              <li>• Obrigatório para administradores</li>
              <li>• Códigos de backup para emergências</li>
            </ul>
          </div>

          <button
            onClick={generateSecret}
            disabled={loading}
            className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Gerando...' : 'Gerar Código QR'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="p-4 bg-zinc-800 rounded-lg text-center">
            <p className="text-sm text-zinc-400 mb-4">Escaneie o QR Code com seu app autenticador:</p>
            <img src={qrCode} alt="QR Code" className="mx-auto w-48 h-48" />
            <p className="text-xs text-zinc-500 mt-4 break-all">{secret}</p>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Código de verificação</label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-center text-2xl tracking-widest font-mono"
              maxLength={6}
            />
          </div>

          <button
            onClick={verifyAndEnable}
            disabled={loading || verificationCode.length !== 6}
            className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Verificar e Ativar'}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg">
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <Check className="w-5 h-5" />
              <span className="font-medium">2FA Ativado!</span>
            </div>
            <p className="text-sm text-zinc-300">
              Sua conta agora está protegida com verificação em duas etapas.
            </p>
          </div>

          <div className="p-4 bg-zinc-800 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-500" />
                Códigos de Backup
              </h3>
              <button
                onClick={downloadBackupCodes}
                className="flex items-center gap-1 text-sm text-amber-500 hover:text-amber-400"
              >
                <Download className="w-4 h-4" />
                Baixar
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, i) => (
                <button
                  key={i}
                  onClick={() => copyToClipboard(code)}
                  className="p-2 bg-zinc-700 rounded text-xs font-mono text-zinc-300 hover:bg-zinc-600 transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 inline mr-1" /> : null}
                  {code}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep(1)}
            className="w-full py-2 text-zinc-400 hover:text-white transition-colors"
          >
            Gerar novos códigos
          </button>
        </div>
      )}
    </div>
  );
}

export function TwoFactorVerify({ onSuccess, onCancel }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase.functions.invoke('2fa-verify', {
        body: { action: 'verify', userId: user.id, code }
      });

      if (error) throw error;

      toast.success('Verificado!', { style: toastSuccessStyle });
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || 'Código inválido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-zinc-900 p-6 rounded-lg border border-zinc-800 max-w-sm w-full mx-4">
        <div className="text-center mb-6">
          <Shield className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white">Verificação em Duas Etapas</h2>
          <p className="text-sm text-zinc-400">Digite o código do seu app autenticador</p>
        </div>

        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          className="w-full px-4 py-4 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-center text-3xl tracking-widest font-mono mb-4"
          maxLength={6}
          autoFocus
        />

        {error && (
          <p className="text-red-500 text-sm text-center mb-4">{error}</p>
        )}

        <button
          onClick={handleVerify}
          disabled={loading || code.length !== 6}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Verificando...' : 'Verificar'}
        </button>

        {onCancel && (
          <button
            onClick={onCancel}
            className="w-full py-2 mt-2 text-zinc-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
