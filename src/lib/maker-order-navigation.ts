const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getMakerOrderActionHref(result: string, orderId: unknown, anchor = "pedidos") {
  const params = new URLSearchParams({ resultado: result });
  if (typeof orderId === "string" && uuidPattern.test(orderId)) params.set("pedido", orderId);
  return `/painel/maker?${params.toString()}#${anchor}`;
}
