import React from 'react';

export const Section = ({ id, icon: Icon, title, children }) => (
  <section id={id} className="scroll-mt-24 mb-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
    <div className="flex items-center gap-4 mb-8 border-b border-gold-premium/10 pb-6">
      <div className="p-3 bg-gold-premium/5 rounded-2xl ring-1 ring-gold-premium/20 shadow-[0_0_15px_rgba(212,175,55,0.05)]">
        <Icon className="w-6 h-6 text-gold-premium" />
      </div>
      <h2 className="text-2xl font-black text-luxury uppercase tracking-tighter leading-none">{title}</h2>
    </div>
    <div className="px-1">{children}</div>
  </section>
);

export const SubSection = ({ title, children }) => (
  <div className="mb-10 group">
    <h3 className="text-gold-premium/90 text-sm font-bold uppercase tracking-[0.2em] mb-6 flex items-center gap-4">
      <span className="w-12 h-[1px] bg-gold-premium/20 group-hover:w-16 transition-all duration-500"></span>
      {title}
    </h3>
    <div className="pl-4 border-l border-gold-premium/5">{children}</div>
  </div>
);

export const Li = ({ children }) => (
  <li className="text-silver-premium/60 text-[15px] flex items-start gap-3 mb-3 hover:text-silver-premium/90 transition-colors leading-relaxed">
    <span className="w-1.5 h-1.5 rounded-full bg-gold-premium mt-2 shrink-0 shadow-[0_0_8px_rgba(212,175,55,0.4)]"></span>
    <span>{children}</span>
  </li>
);

export const InfoBox = ({ children, type = 'info' }) => {
  const styles = {
    info: 'border-info/20 bg-info/5 text-info/90 shadow-[0_0_20px_rgba(59,130,246,0.03)]',
    warning: 'border-gold-premium/20 bg-gold-premium/5 text-gold-premium shadow-[0_0_20px_rgba(212,175,55,0.03)]',
    danger: 'border-danger/20 bg-danger/5 text-danger/90 shadow-[0_0_20px_rgba(239,68,68,0.03)]'
  };
  return (
    <div className={`p-5 rounded-2xl border text-[15px] leading-relaxed my-8 animate-in zoom-in-95 duration-500 ${styles[type]}`}>
      {children}
    </div>
  );
};

export const Pill = ({ children, color = 'gold' }) => {
  const colors = {
    gold: 'bg-gold-premium/10 border-gold-premium/30 text-gold-premium',
    green: 'bg-success/10 border-success/30 text-success',
    blue: 'bg-info/10 border-info/30 text-info',
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400'
  };
  return (
    <span className={`px-3 py-1 border rounded-full text-xs font-bold uppercase tracking-widest ${colors[color] || colors.gold} shadow-sm`}>
      {children}
    </span>
  );
};