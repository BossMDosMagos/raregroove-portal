import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Search, Disc3, ArrowLeft } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext.jsx';

export default function NotFound() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center">
        {/* Ícone de Disco Riscado */}
        <div className="relative mb-8">
          <div className="w-48 h-48 mx-auto relative">
            {/* Disco com risco */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 border-4 border-[#D4AF37]/30 flex items-center justify-center">
              <Disc3 className="w-24 h-24 text-[#D4AF37]/40 animate-spin-slow" style={{ animationDuration: '8s' }} />
            </div>
            
            {/* Risco no disco */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-1 bg-red-500/60 rotate-45 shadow-lg shadow-red-500/50"></div>
            </div>
            
            {/* Brilho */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent animate-pulse"></div>
          </div>
        </div>

        {/* Texto 404 */}
        <div className="mb-6">
          <h1 className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-white to-[#D4AF37] mb-4 tracking-tighter">
            404
          </h1>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-2">
            {t('notFound.title')}
          </h2>
          <p className="text-white/40 text-lg font-medium">
            {t('notFound.description')}
          </p>
        </div>

        {/* Mensagem divertida */}
        <div className="bg-black/40 border border-[#D4AF37]/20 rounded-2xl p-6 mb-8">
          <p className="text-white/60 text-sm leading-relaxed">
            {t('notFound.tip')}
            <br />
            {t('notFound.description')}
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-3 px-8 py-4 bg-white/5 border-2 border-white/10 text-white rounded-xl hover:border-[#D4AF37]/50 hover:bg-white/10 transition-all duration-300 font-bold uppercase tracking-wider group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            {t('notFound.ctaBack')}
          </button>

          <button
            onClick={() => navigate('/catalogo')}
            className="flex items-center justify-center gap-3 px-8 py-4 bg-[#D4AF37] text-black rounded-xl hover:bg-[#D4AF37]/90 transition-all duration-300 font-black uppercase tracking-wider shadow-lg hover:shadow-[#D4AF37]/50 group"
          >
            <Search className="w-5 h-5" />
            {t('notFound.ctaExplore')}
          </button>

          <button
            onClick={() => navigate('/portal')}
            className="flex items-center justify-center gap-3 px-8 py-4 bg-white/5 border-2 border-white/10 text-white rounded-xl hover:border-[#D4AF37]/50 hover:bg-white/10 transition-all duration-300 font-bold uppercase tracking-wider group"
          >
            <Home className="w-5 h-5" />
            {t('notFound.ctaPortal')}
          </button>
        </div>

        {/* Linha decorativa */}
        <div className="mt-12 flex items-center gap-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent"></div>
          <Disc3 className="w-6 h-6 text-[#D4AF37]/40" />
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent"></div>
        </div>

        {/* Código de erro técnico */}
        <div className="mt-8">
          <p className="text-white/20 text-xs font-mono uppercase tracking-widest">
            ERROR_CODE: PAGE_NOT_FOUND // 0x404
          </p>
        </div>
      </div>
    </div>
  );
}
