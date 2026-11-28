import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Disc, CreditCard, Lock } from 'lucide-react';
import { getGatewayConfig, createStripePaymentIntent } from '../utils/paymentGateway';

/**
 * Formulário Stripe — carregado SOMENTE se o comprador selecionar Stripe.
 * Mantido para assinaturas/fluxos internos; não é oferecido no checkout do marketplace.
 */
function StripePaymentForm({ amount, selectedGateway, metadata, onSuccess, onError, currency = 'BRL' }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    getGatewayConfig(selectedGateway).then(setConfig);
  }, [selectedGateway]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || !config) return;

    try {
      setProcessing(true);
      const { clientSecret, paymentIntentId } = await createStripePaymentIntent(amount, metadata, config, currency);
      const cardNumberElement = elements.getElement(CardNumberElement);
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardNumberElement },
        return_url: `${window.location.origin.includes('localhost') ? 'https://portalraregroove.com' : window.location.origin}/payment/success`,
      });
      if (error) throw new Error(error.message);
      if (paymentIntent.status === 'succeeded') {
        onSuccess({ paymentId: paymentIntent.id, provider: 'stripe', status: 'succeeded' });
      } else {
        throw new Error('Pagamento não foi aprovado');
      }
    } catch (error) {
      onError(error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard size={20} className="text-[#D4AF37]" />
          <label className="text-sm text-white/80 font-semibold">Dados do Cartão</label>
          <Lock size={14} className="text-green-400 ml-auto" />
          <span className="text-xs text-green-400">Criptografado</span>
        </div>
        <div>
          <label className="text-xs text-white/60 uppercase font-bold tracking-widest block mb-2">Número do Cartão</label>
          <div className="bg-gray-900 border border-white/10 rounded-lg p-4">
            <CardNumberElement options={{ style: { base: { fontSize: '16px', color: '#fff', fontFamily: "'Inter', sans-serif" } }, placeholder: '1234 5678 9012 3456' }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/60 uppercase font-bold tracking-widest block mb-2">Validade</label>
            <div className="bg-gray-900 border border-white/10 rounded-lg p-4">
              <CardExpiryElement options={{ style: { base: { fontSize: '16px', color: '#fff' } }, placeholder: 'MM / YY' }} />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/60 uppercase font-bold tracking-widest block mb-2">CVC</label>
            <div className="bg-gray-900 border border-white/10 rounded-lg p-4">
              <CardCvcElement options={{ style: { base: { fontSize: '16px', color: '#fff' } }, placeholder: '123' }} />
            </div>
          </div>
        </div>
      </div>
      <button type="submit" disabled={!stripe || processing} className="w-full bg-[#D4AF37] text-black py-4 rounded-2xl font-black uppercase text-sm disabled:opacity-50 flex items-center justify-center gap-2">
        {processing ? <><Disc className="animate-spin" size={18} /> Processando...</> : <><CreditCard size={18} /> Pagar R$ {amount.toFixed(2)}</>}
      </button>
    </form>
  );
}

export default function StripeElementsForm(props) {
  const [stripePromise, setStripePromise] = useState(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const cfg = await getGatewayConfig(props.selectedGateway);
      if (!cfg?.publishableKey || !ativo) return;
      const { loadStripe: load } = await import('@stripe/stripe-js');
      if (ativo) setStripePromise(load(cfg.publishableKey));
    })();
    return () => { ativo = false; };
  }, [props.selectedGateway]);

  if (!stripePromise) return <div className="py-8 text-center text-white/50">Carregando Stripe...</div>;

  return <Elements stripe={stripePromise}><StripePaymentForm {...props} /></Elements>;
}
