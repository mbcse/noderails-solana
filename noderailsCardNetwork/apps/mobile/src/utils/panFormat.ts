/** Groups PAN digits as `1234 5678 …` for card UI */
export function formatPanDigitsForDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (!d) return '';
  return d.replace(/(.{4})/g, '$1 ').trim();
}

/** Masked PAN line for premium card when API mask is absent (last four only). */
export function formatMaskedPanPlaceholder(panLastFour: string): string {
  const last = panLastFour.replace(/\D/g, '').slice(-4).padStart(4, '0');
  return `•••• •••• •••• ${last}`;
}
