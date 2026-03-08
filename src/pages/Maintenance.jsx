import React from 'react';
import Logo from '../assets/LogoRareGroove.png';
import { Disc, Radio } from 'lucide-react';

export default function Maintenance() {
  return (
    <div className="min-h-screen bg-charcoal-deep flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gold-premium/5 via-transparent to-transparent opacity-50 animate-pulse"></div>
      <div className="absolute top-10 left-10 text-gold-premium/10 animate-spin-slow">
        <Disc size={200} />
      </div>
      <div className="absolute bottom-10 right-10 text-gold-premium/10 animate-spin-slow" style={{ animationDirection: 'reverse' }}>
        <Disc size={300} />
      </div>

      <div className="z-10 text-center space-y-8 max-w-lg mx-auto glass-card p-12 rounded-[3rem] border-gold-premium/20 shadow-2xl">
        <div className="flex justify-center mb-6 relative">
          <div className="absolute inset-0 bg-gold-premium/20 blur-3xl rounded-full"></div>
          <img 
            src={Logo} 
            alt="Rare Groove Logo" 
            className="h-24 w-auto relative z-10 drop-shadow-[0_0_15px_rgba(212,175,55,0.5)]" 
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3 text-gold-premium animate-bounce">
            <Radio size={24} />
            <span className="font-black uppercase tracking-widest text-xs">Sinal Interrompido</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter leading-tight">
            Sintonizando as <span className="text-gold-premium">Frequências</span>...
          </h1>
          
          <p className="text-silver-premium/80 font-medium text-sm md:text-base leading-relaxed">
            O Portal Rare Groove está passando por ajustes finos para garantir a melhor experiência sonora.
          </p>
        </div>

        <div className="pt-4 border-t border-white/5">
          <p className="text-gold-premium font-bold uppercase tracking-widest text-xs animate-pulse">
            Voltamos em breve!
          </p>
        </div>
      </div>

      <div className="absolute bottom-6 text-center w-full">
        <p className="text-[10px] text-white/20 font-mono uppercase tracking-[0.2em]">
          Rare Groove Security Protocol v3.0 // System Maintenance
        </p>
      </div>
    </div>
  );
}
