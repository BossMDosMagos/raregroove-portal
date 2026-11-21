import React from 'react';
export const CompareTable = () => (
  <div className="overflow-x-auto bg-black/20 rounded-xl border border-[#D4AF37]/10">
    <table className="w-full text-base text-left">
      <thead>
        <tr className="bg-[#D4AF37]/10 text-[#D4AF37] text-[14px] uppercase font-black">
          <th className="px-4 py-4 italic">Feature</th>
          <th className="px-4 py-4 bg-[#D4AF37]/5">RareGroove</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#D4AF37]/10 text-[14px]">
        <tr><td className="px-4 py-3 text-white">Processamento via PSP</td><td className="px-4 py-3 text-green-400 font-bold">✓ Licenciado pelo Banco Central</td></tr>
        <tr><td className="px-4 py-3 text-white">Split automático de pagamento</td><td className="px-4 py-3 text-green-400 font-bold">✓ Comissão descontada no repasse</td></tr>
        <tr><td className="px-4 py-3 text-white">Prazo de garantia</td><td className="px-4 py-3 text-green-400 font-bold">✓ 7 dias após entrega (CDC Art. 49)</td></tr>
        <tr><td className="px-4 py-3 text-white">Não recebimento</td><td className="px-4 py-3 text-green-400 font-bold">✓ Estorno integral em até 30 dias</td></tr>
      </tbody>
    </table>
  </div>
);
