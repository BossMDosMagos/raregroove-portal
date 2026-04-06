const EXCHANGE_RATE_API = 'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL';

let cachedRates = null;
let lastFetchTime = 0;
const CACHE_DURATION = 10 * 60 * 1000;

export async function getExchangeRates() {
  const now = Date.now();
  if (cachedRates && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedRates;
  }

  try {
    const response = await fetch(EXCHANGE_RATE_API);
    if (!response.ok) throw new Error('Failed to fetch exchange rates');
    const data = await response.json();
    
    cachedRates = {
      USD: parseFloat(data.USDBRL?.bid || 5.0),
      EUR: parseFloat(data.EURBRL?.bid || 5.5),
      timestamp: now,
    };
    
    return cachedRates;
  } catch (error) {
    console.error('Exchange rate fetch error:', error);
    return { USD: 5.0, EUR: 5.5, timestamp: now };
  }
}

export function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export async function convertToBRL(amount, currency = 'USD') {
  const rates = await getExchangeRates();
  const rate = rates[currency] || rates.USD;
  return amount * rate;
}