const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const formatMoney = (n: number) => money.format(n);

const eur = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });

export const formatEur = (n: number) => eur.format(n);

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
