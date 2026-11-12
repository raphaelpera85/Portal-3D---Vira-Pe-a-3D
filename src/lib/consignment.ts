export const MAX_CONSIGNMENT_QUANTITY = 100_000;
export const MAX_CONSIGNMENT_AMOUNT_BRL = 1_000_000;

export type ConsignmentMovementType = "delivered" | "sold" | "returned" | "lost";
export type ConsignmentItemInput = {
  establishment: string;
  productName: string;
  productId: string | null;
  quantity: number;
  unitCostBrl: number;
  salePriceBrl: number;
  commissionPercent: number;
  commissionFixedFeeBrl: number;
};
export type ConsignmentMovementInput = { movementType: ConsignmentMovementType; quantity: number; notes: string };
export type ConsignmentMovement = { movementType: ConsignmentMovementType; quantity: number };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

function amount(value: unknown) {
  const raw = typeof value === "number" ? String(value) : text(value).replace(",", ".");
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed <= MAX_CONSIGNMENT_AMOUNT_BRL ? parsed : null;
}

export function validateConsignmentInput(values: Record<string, unknown>): ConsignmentItemInput | null {
  const establishment = text(values.establishment);
  const productName = text(values.productName);
  const rawQuantity = text(values.quantity);
  const unitCostBrl = amount(values.unitCostBrl);
  const salePriceBrl = amount(values.salePriceBrl);
  const commissionPercent = amount(values.commissionPercent);
  const commissionFixedFeeBrl = values.commissionFixedFeeBrl == null || text(values.commissionFixedFeeBrl) === ""
    ? 0
    : amount(values.commissionFixedFeeBrl);
  const productId = text(values.productId) || null;
  if (establishment.length < 2 || establishment.length > 120 || (!productId && productName.length < 2) || productName.length > 200
    || !/^\d{1,6}$/.test(rawQuantity) || unitCostBrl == null || salePriceBrl == null || salePriceBrl <= 0
    || commissionPercent == null || commissionPercent > 100 || commissionFixedFeeBrl == null
    || (productId && !uuidPattern.test(productId))) return null;
  const quantity = Number(rawQuantity);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_CONSIGNMENT_QUANTITY) return null;
  return { establishment, productName, productId, quantity, unitCostBrl, salePriceBrl, commissionPercent, commissionFixedFeeBrl };
}

export function validateConsignmentMovement(values: Record<string, unknown>): ConsignmentMovementInput | null {
  const movementType = values.movementType;
  const rawQuantity = text(values.quantity);
  const notes = text(values.notes);
  if (!(movementType === "delivered" || movementType === "sold" || movementType === "returned" || movementType === "lost")
    || !/^\d{1,6}$/.test(rawQuantity) || notes.length > 500) return null;
  const quantity = Number(rawQuantity);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_CONSIGNMENT_QUANTITY) return null;
  return { movementType, quantity, notes };
}

export function summarizeConsignment(
  item: { unitCostBrl: number; salePriceBrl: number; commissionPercent: number; commissionFixedFeeBrl?: number },
  movements: ConsignmentMovement[],
) {
  const total = (type: ConsignmentMovementType) => movements.reduce((sum, movement) => sum + (movement.movementType === type ? movement.quantity : 0), 0);
  const delivered = total("delivered");
  const sold = total("sold");
  const returned = total("returned");
  const lost = total("lost");
  const grossSalesCents = Math.round(item.salePriceBrl * 100) * sold;
  const commissionCents = Math.round(grossSalesCents * item.commissionPercent / 100)
    + Math.round((item.commissionFixedFeeBrl ?? 0) * 100) * sold;
  const receivableCents = grossSalesCents - commissionCents;
  const estimatedResultCents = receivableCents - Math.round(item.unitCostBrl * 100) * (sold + lost);
  return {
    delivered, sold, returned, lost, inStock: delivered - sold - returned - lost,
    grossSalesCents, commissionCents, receivableCents, estimatedResultCents,
  };
}
