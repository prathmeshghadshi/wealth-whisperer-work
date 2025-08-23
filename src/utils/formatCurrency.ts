export const formatCurrency = (amount: number, currency: string = 'USD') => {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'C$',
    AUD: 'A$',
    INR: '₹',
    // Add more if needed from your CURRENCY_OPTIONS
  };
  const symbol = symbols[currency] || '$'; // Default to USD if unknown
  return `${symbol}${amount.toFixed(2)}`;
};