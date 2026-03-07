import React from 'react';
import { CheckCircle, Package, Truck, Home, Clock } from 'lucide-react';

// ========================================
// TIMELINE: Visual do Status da Entrega
// ========================================
export function DeliveryTimeline({ transaction }) {
  const getSteps = () => {
    const allSteps = [
      {
        id: 'pago',
        label: 'Pago',
        icon: CheckCircle,
        status: transaction.status === 'pago' ? 'current' : 
                ['enviado', 'concluido'].includes(transaction.status) ? 'completed' : 'pending',
        date: transaction.created_at
      },
      {
        id: 'enviado',
        label: 'Enviado',
        icon: Package,
        status: transaction.status === 'enviado' && !transaction.delivered_at ? 'current' :
                transaction.status === 'concluido' ? 'completed' : 'pending',
        date: transaction.shipped_at
      },
      {
        id: 'transito',
        label: 'Em Trânsito',
        icon: Truck,
        status: transaction.status === 'enviado' && !transaction.delivered_at ? 'current' :
                transaction.status === 'concluido' ? 'completed' : 'pending',
        date: null
      },
      {
        id: 'entregue',
        label: 'Entregue',
        icon: Home,
        status: transaction.status === 'concluido' ? 'completed' : 'pending',
        date: transaction.delivered_at
      }
    ];

    return allSteps;
  };

  const formatDate = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const steps = getSteps();

  return (
    <div className="bg-black/20 border border-[#D4AF37]/10 rounded-lg p-6">
      <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-6 flex items-center gap-2">
        <Clock className="w-4 h-4 text-[#D4AF37]" />
        Status da Entrega
      </h3>

      <div className="relative">
        {/* Linha de Conexão */}
        <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-[#D4AF37]/20" />

        {/* Steps */}
        <div className="space-y-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = step.status === 'completed';
            const isCurrent = step.status === 'current';
            const isPending = step.status === 'pending';

            return (
              <div key={step.id} className="relative flex items-start gap-4">
                {/* Ícone */}
                <div 
                  className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCompleted 
                      ? 'bg-[#D4AF37] border-[#D4AF37] text-black'
                      : isCurrent
                      ? 'bg-black border-[#D4AF37] text-[#D4AF37] animate-pulse'
                      : 'bg-black border-white/20 text-white/30'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                {/* Conteúdo */}
                <div className="flex-1 pt-1">
                  <div className="flex items-center justify-between">
                    <h4 
                      className={`font-bold text-sm ${
                        isCompleted || isCurrent 
                          ? 'text-white' 
                          : 'text-white/40'
                      }`}
                    >
                      {step.label}
                    </h4>
                    
                    {step.date && (
                      <span className="text-xs text-white/60">
                        {formatDate(step.date)}
                      </span>
                    )}
                  </div>

                  {/* Mensagem de Status */}
                  {isCurrent && (
                    <p className="text-xs text-[#D4AF37] mt-1 font-semibold">
                      {step.id === 'pago' && 'Aguardando envio'}
                      {step.id === 'enviado' && 'Pedido a caminho'}
                      {step.id === 'transito' && 'Rastreie seu pedido'}
                    </p>
                  )}

                  {isCompleted && (
                    <p className="text-xs text-green-400 mt-1">
                      ✓ Concluído
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// ========================================
// COMPACT TIMELINE: Versão Compacta (para cards)
// ========================================
export function CompactTimeline({ status }) {
  const steps = ['pago', 'enviado', 'concluido'];
  const currentIndex = steps.indexOf(status);

  const stepLabels = {
    pago: 'Pago',
    enviado: 'Enviado', 
    concluido: 'Entregue'
  };

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center gap-1">
              <div 
                className={`w-2 h-2 rounded-full transition-all ${
                  isCompleted 
                    ? 'bg-green-400'
                    : isCurrent
                    ? 'bg-[#D4AF37] animate-pulse'
                    : 'bg-white/20'
                }`}
              />
              <span 
                className={`text-[10px] whitespace-nowrap ${
                  isCompleted || isCurrent
                    ? 'text-white/80 font-semibold'
                    : 'text-white/40'
                }`}
              >
                {stepLabels[step]}
              </span>
            </div>
            
            {index < steps.length - 1 && (
              <div 
                className={`flex-1 h-0.5 min-w-[20px] ${
                  index < currentIndex 
                    ? 'bg-green-400/50' 
                    : 'bg-white/10'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default DeliveryTimeline;
