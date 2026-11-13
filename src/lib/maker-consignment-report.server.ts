import "server-only";
import type { MakerConsignmentReportItem } from "./maker-consignment-report";
import type { ConsignmentMovement } from "./consignment";

const PAGE_SIZE = 500;
const ITEM_BATCH_SIZE = 100;
type ConsignmentItemRow = Omit<MakerConsignmentReportItem, "movements">;
type ConsignmentMovementRow = { item_id: string; movement_type: ConsignmentMovement["movementType"]; quantity: number };

export async function loadMakerConsignmentItems(supabase: any, storeId: string) {
  const items: ConsignmentItemRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.from("maker_consignment_items")
      .select("id, establishment, product_name, unit_cost_brl, sale_price_brl, commission_percent, commission_fixed_fee_brl, created_at")
      .eq("store_id", storeId).order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (error) return { items: [] as MakerConsignmentReportItem[], error: true };
    const page = data ?? [];
    items.push(...page as ConsignmentItemRow[]);
    if (page.length < PAGE_SIZE) break;
  }

  const movements = new Map<string, ConsignmentMovementRow[]>();
  for (let start = 0; start < items.length; start += ITEM_BATCH_SIZE) {
    const ids = items.slice(start, start + ITEM_BATCH_SIZE).map((item) => item.id);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase.from("maker_consignment_movements")
        .select("item_id, movement_type, quantity").in("item_id", ids)
        .order("created_at", { ascending: true }).range(from, from + PAGE_SIZE - 1);
      if (error) return { items: [] as MakerConsignmentReportItem[], error: true };
      const page = data ?? [];
      for (const movement of page) movements.set(movement.item_id, [...(movements.get(movement.item_id) ?? []), movement]);
      if (page.length < PAGE_SIZE) break;
    }
  }
  return { items: items.map((item) => ({ ...item, movements: movements.get(item.id) ?? [] })), error: false };
}
