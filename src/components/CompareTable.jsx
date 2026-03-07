import React from 'react';
export const CompareTable = () => (
  <div className="overflow-x-auto bg-black/20 rounded-xl border border-[#D4AF37]/10">
    <table className="w-full text-base text-left">
      <thead>
        <tr className="bg-[#D4AF37]/10 text-[#D4AF37] text-[14px] uppercase font-black">
          <th className="px-4 py-4 italic">Feature</th>
          <th className="px-4 py-4 bg-[#D4AF37]/5">RAREGROOVE</th>
          <th className="px-4 py-4 opacity-40">Outros</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#D4AF37]/10 text-[14px]">
        <tr><td className="px-4 py-3 text-white">Custódia (Escrow)</td><td className="px-4 py-3 text-green-400 font-bold">✓ Total</td><td className="px-4 py-3 opacity-40 text-red-500">✗ Não</td></tr>
        <tr><td className="px-4 py-3 text-white">Garantia Autenticidade</td><td className="px-4 py-3 text-green-400 font-bold">✓ 100%</td><td className="px-4 py-3 opacity-40">▲ Limitada</td></tr>
      </tbody>
    </table>
  </div>
);