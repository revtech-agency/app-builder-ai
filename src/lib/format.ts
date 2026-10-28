const eur = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });

// HubSpot amounts (prices, line items, orders) are in the portal currency, EUR.
export const formatMoney = (n: number) => eur.format(n);

export const formatEur = (n: number) => eur.format(n);

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
