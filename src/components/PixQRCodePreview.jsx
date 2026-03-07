/**
 * Componente de Preview de QR Code PIX
 * Exibe o QR Code gerado a partir da chave PIX do usuário
 */

import React, { useMemo } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { AlertCircle, Check } from 'lucide-react';
import { generatePixBrcode } from '../utils/pixBrcode';
import { validatePixKey, getPixTypeIcon } from '../utils/pixFormatter';

export function PixQRCodePreview({ pixKey, merchantName = 'RAREGROOVE', merchantCity = 'BRASIL' }) {
  const safePixKey = String(pixKey || '').trim();

  // Validar a chave
  const validation = useMemo(() => validatePixKey(safePixKey), [safePixKey]);

  // Gerar Brcode se válido
  const brcode = useMemo(() => {
    if (!safePixKey || !validation.isValid) return null;
    return generatePixBrcode(safePixKey, 0, {
      merchantName,
      merchantCity,
      txid: '***'
    });
  }, [safePixKey, merchantName, merchantCity, validation.isValid]);

  if (!safePixKey) {
    return null;
  }

  // Se inválido, mostrar erro
  if (!validation.isValid) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-red-400 text-sm font-medium">Chave PIX Inválida</p>
          <p className="text-red-300/70 text-xs mt-1">{validation.message}</p>
        </div>
      </div>
    );
  }

  // Se válido, mostrar QR Code
  if (!brcode) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Informações da chave */}
      <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 flex items-center gap-3">
        <Check size={20} className="text-green-400 flex-shrink-0" />
        <div>
          <p className="text-green-400 text-sm font-medium">
            {getPixTypeIcon(validation.type)} {validation.message}
          </p>
        </div>
      </div>

      {/* Preview do QR Code */}
      <div className="bg-black/40 border border-[#D4AF37]/20 rounded-lg p-4 flex flex-col items-center gap-3">
        <p className="text-[#C0C0C0]/70 text-xs font-semibold uppercase">QR Code Gerado</p>
        
        <div className="bg-white p-3 rounded-lg">
          <QRCodeCanvas
            value={brcode}
            size={200}
            level="H"
            includeMargin={false}
            fgColor="#000000"
            bgColor="#FFFFFF"
          />
        </div>

        <p className="text-[#C0C0C0]/60 text-xs text-center max-w-xs">
          QR Code gerado automaticamente. Ele será salvo quando você atualizar seu perfil.
        </p>

        {/* Detalhes técnicos (colapsível) */}
        <details className="w-full">
          <summary className="text-[#D4AF37]/70 text-xs cursor-pointer hover:text-[#D4AF37] transition-colors">
            ⚙️ Detalhes Técnicos
          </summary>
          <div className="mt-2 bg-black/20 rounded p-2 text-xs text-[#C0C0C0]/50 font-mono break-words">
            <p className="mb-1"><strong>Brcode:</strong> {brcode.substring(0, 50)}...{brcode.substring(brcode.length - 20)}</p>
            <p><strong>Tamanho:</strong> {brcode.length} caracteres</p>
          </div>
        </details>
      </div>
    </div>
  );
}

/**
 * Componente compacto para exibir status do PIX no perfil
 */
export function PixStatusBadge({ pixKey }) {
  if (!pixKey) {
    return (
      <span className="px-2 py-1 bg-red-900/30 border border-red-500/30 rounded text-red-400 text-xs font-medium">
        Não configurado
      </span>
    );
  }

  const validation = validatePixKey(pixKey);
  
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 w-fit ${
      validation.isValid
        ? 'bg-green-900/30 border border-green-500/30 text-green-400'
        : 'bg-yellow-900/30 border border-yellow-500/30 text-yellow-400'
    }`}>
      {getPixTypeIcon(validation.type)} {validation.isValid ? 'Ativo' : 'Inválido'}
    </span>
  );
}
