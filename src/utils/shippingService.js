import { supabase } from '../lib/supabase';

/**
 * Serviço de Integração com APIs de Frete
 * Suporta: Melhor Envio, Correios
 */

// Dummy shipping estimates - Replace com integração real
export const estimateShipping = async (fromCep, toCep, weightKg) => {
  const estimates = [
    {
      id: 'sedex',
      carrier: 'Correios',
      service: 'SEDEX',
      estimatedCost: calculateEstimateCost(weightKg, 'sedex'),
      estimatedDays: 3,
      icon: '🚚'
    },
    {
      id: 'pac',
      carrier: 'Correios',
      service: 'PAC',
      estimatedCost: calculateEstimateCost(weightKg, 'pac'),
      estimatedDays: 8,
      icon: '📦'
    },
    {
      id: 'loggi',
      carrier: 'Loggi',
      service: 'Express',
      estimatedCost: calculateEstimateCost(weightKg, 'loggi'),
      estimatedDays: 2,
      icon: '🚗'
    }
  ];

  return estimates;
};

/**
 * Calcular custo estimado baseado no peso
 * Fórmula simples: R$ 5 base + R$ 2 por kg
 */
const calculateEstimateCost = (weightKg, service) => {
  const baseRate = {
    sedex: 5.0,
    pac: 3.0,
    loggi: 4.0
  };

  const basePrice = baseRate[service] || 5.0;
  const totalCost = basePrice + (weightKg * 2);

  return parseFloat(totalCost.toFixed(2));
};

/**
 * Gerar etiqueta de envio pré-paga
 * Integra com Melhor Envio ou Correios
 */
export const generateShippingLabel = async (shippingId, carrierType, toAddress) => {
  try {
    // TODO: Integrar com API de geração de etiqueta
    // Por agora, retorna mock

    const labelData = {
      tracking_code: generateTrackingCode(),
      label_url: 'https://via.placeholder.com/600x400?text=Etiqueta',
      label_pdf_url: 'https://via.placeholder.com/pdf',
      carrier: carrierType,
      status: 'generated',
      generated_at: new Date().toISOString()
    };

    return labelData;
  } catch (error) {
    console.error('Erro ao gerar etiqueta:', error);
    throw error;
  }
};

/**
 * Gerar código de rastreamento único
 */
const generateTrackingCode = () => {
  // Formato: XX999999999XX (Padrão Correios/Internacional)
  const prefix = Math.random().toString(36).substring(2, 4).toUpperCase();
  const numbers = Math.floor(Math.random() * 9999999999).toString().padStart(9, '0');
  const suffix = 'BR';
  return `${prefix}${numbers}${suffix}`;
};

/**
 * Calcular valor de seguro
 */
export const calculateInsurance = (itemValue, insurancePercentage = 5) => {
  return parseFloat((itemValue * insurancePercentage / 100).toFixed(2));
};

/**
 * Buscar referência de CEP (validar se existe)
 */
export const validateCEP = async (cep) => {
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json();

    if (data.erro) {
      throw new Error('CEP inválido');
    }

    return {
      cep: data.cep,
      city: data.localidade,
      state: data.uf,
      address: data.logradouro,
      valid: true
    };
  } catch (error) {
    console.error('Erro ao validar CEP:', error);
    return { valid: false, error: error.message };
  }
};

/**
 * Buscar plataforma_settings para dados de frete
 */
export const getShippingConfig = async () => {
  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('default_shipping_from_cep, insurance_percentage, shipping_api_provider')
      .eq('id', 1)
      .single();

    if (error) throw error;

    return {
      defaultFromCep: data?.default_shipping_from_cep || '01311100', // Default São Paulo
      insurancePercentage: data?.insurance_percentage || 5.0,
      apiProvider: data?.shipping_api_provider || 'melhor_envio'
    };
  } catch (error) {
    console.error('Erro ao buscar configuração de frete:', error);
    return {
      defaultFromCep: '01311100',
      insurancePercentage: 5.0,
      apiProvider: 'melhor_envio'
    };
  }
};

/**
 * Salvar pré-avaliação de frete no banco
 */
export const saveShippingEstimate = async (transactionId, estimate, toCep, toAddress, hasInsurance) => {
  try {
    const { data, error } = await supabase
      .from('shipping')
      .insert([
        {
          transaction_id: transactionId,
          to_cep: toCep,
          to_address: toAddress,
          estimated_cost: estimate.estimatedCost,
          has_insurance: hasInsurance,
          carrier: estimate.carrier,
          status: 'awaiting_label'
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao salvar estimativa de frete:', error);
    throw error;
  }
};

export default {
  estimateShipping,
  generateShippingLabel,
  calculateInsurance,
  validateCEP,
  getShippingConfig,
  saveShippingEstimate
};
