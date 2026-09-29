/**
 * Formats a numeric(12,2) money column. Currency defaults to BDT.
 * @param {unknown} amount
 * @param {string} [currency]
 * @returns {string}
 */
export function formatMoney(amount, currency = "BDT") {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";

  const code = /^[A-Z]{3}$/.test(currency) ? currency : "BDT";
  try {
    return new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
}
