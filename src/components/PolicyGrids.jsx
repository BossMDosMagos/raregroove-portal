import React from 'react';
export const BehaviorGrid = ({ allowed, forbidden }) => (
  <div className="grid md:grid-cols-2 gap-4 mb-6">
    <div className="bg-green-900/10 border border-green-700/30 rounded-xl p-4">
      <p className="text-green-400 text-[14px] font-black uppercase mb-3">✓ Permitido</p>
      <ul className="space-y-1">{allowed.map((item, i) => <li key={i} className="text-[#C0C0C0]/70 text-[14px] flex items-start gap-2"><span>•</span>{item}</li>)}</ul>
    </div>
    <div className="bg-red-900/10 border border-red-700/30 rounded-xl p-4">
      <p className="text-red-400 text-[14px] font-black uppercase mb-3">✗ Proibido</p>
      <ul className="space-y-1">{forbidden.map((item, i) => <li key={i} className="text-[#C0C0C0]/70 text-[14px] flex items-start gap-2"><span>•</span>{item}</li>)}</ul>
    </div>
  </div>
);
export const PunishmentCard = ({ title, desc, color }) => {
  const stl = { red: 'border-red-900/30 bg-red-900/10 text-red-300', orange: 'border-orange-900/30 bg-orange-900/10 text-orange-300', gold: 'border-yellow-900/30 bg-yellow-900/10 text-yellow-300' };
  return <div className={`border rounded-xl p-4 mb-2 ${stl[color]}`}><p className="font-black text-[14px] uppercase mb-1">{title}</p><p className="text-[#C0C0C0]/60 text-[14px]">{desc}</p></div>;
};