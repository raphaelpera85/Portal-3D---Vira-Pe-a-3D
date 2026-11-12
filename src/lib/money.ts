const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBrl(value: number | string) {
  return brl.format(Number(value));
}

export function formatBrlTotal(unitPrice: number | string, quantity: number) {
  const cents = Math.round(Number(unitPrice) * 100) * quantity;
  return brl.format(cents / 100);
}
