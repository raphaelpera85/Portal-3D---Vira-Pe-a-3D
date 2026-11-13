import { getBrazilianCalendarDate } from "./maintenance-reminders";

export type MakerPrinterInput = {
  nickname: string;
  catalogModelId: string | null;
  manufacturer: string | null;
  model: string | null;
  purchasedAt: string | null;
  purchasePriceBrl: number | null;
  residualValueBrl: number | null;
  usefulLifeHours: number | null;
  accumulatedHours: number;
  installedNozzle: string | null;
  modifications: string;
  averagePowerWatts: number | null;
  powerConditions: string | null;
  energyTariffPerKwh: number | null;
  status: "available" | "maintenance" | "inactive";
};

export type MaintenanceEntryInput = {
  performedAt: string;
  maintenanceType: "preventive" | "corrective" | "nozzle_replacement" | "belt_replacement" | "lubrication" | "bed_replacement" | "component_replacement" | "other";
  component: string;
  costBrl: number;
  hoursAtEvent: number | null;
  notes: string;
  nextDueAt: string | null;
  nextDueHours: number | null;
};

export type EquipmentRateInput = { purchasePriceBrl?: number | string | null; residualValueBrl?: number | string | null; usefulLifeHours?: number | string | null; averagePowerWatts?: number | string | null; energyTariffPerKwh?: number | string | null; maintenanceCostBrl?: number | string | null; accumulatedHours?: number | string | null };
export type EquipmentRates = { averagePowerWatts: number | null; energyTariffPerKwh: number | null; depreciationPerHour: number | null; maintenancePerHour: number | null };

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const numeric = (value: unknown) => {
  const raw = text(value);
  if (!raw) return null;
  if (!/^\d{1,9}(?:[,.]\d{1,2})?$/.test(raw)) return Number.NaN;
  return Number(raw.replace(",", "."));
};
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).valueOf()) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function deriveEquipmentRates(values: EquipmentRateInput): EquipmentRates {
  const amount = (value: number | string | null | undefined) => value == null || value === "" ? null : Number(value);
  const purchase = amount(values.purchasePriceBrl);
  const residual = amount(values.residualValueBrl);
  const usefulLife = amount(values.usefulLifeHours);
  const averagePowerWatts = amount(values.averagePowerWatts);
  const energyTariffPerKwh = amount(values.energyTariffPerKwh);
  const maintenanceCost = amount(values.maintenanceCostBrl);
  const accumulatedHours = amount(values.accumulatedHours);
  const hasDepreciationInputs = [purchase, residual, usefulLife].every((value) => value != null && Number.isFinite(value) && value >= 0);
  const depreciationPerHour = hasDepreciationInputs && usefulLife! > 0 && purchase! >= residual!
    ? (Math.round(purchase! * 100) - Math.round(residual! * 100)) / 100 / usefulLife!
    : null;
  const maintenancePerHour = maintenanceCost != null && Number.isFinite(maintenanceCost) && maintenanceCost >= 0
    && accumulatedHours != null && Number.isFinite(accumulatedHours) && accumulatedHours > 0
    ? Math.round(maintenanceCost * 100) / 100 / accumulatedHours
    : null;
  return {
    averagePowerWatts: averagePowerWatts != null && Number.isFinite(averagePowerWatts) && averagePowerWatts > 0 ? averagePowerWatts : null,
    energyTariffPerKwh: energyTariffPerKwh != null && Number.isFinite(energyTariffPerKwh) && energyTariffPerKwh >= 0 ? energyTariffPerKwh : null,
    depreciationPerHour,
    maintenancePerHour,
  };
}

export function validateMakerPrinter(values: Record<string, unknown>, today = new Date().toISOString().slice(0, 10)): MakerPrinterInput | null {
  const nickname = text(values.nickname);
  const catalogModelId = text(values.catalogModelId) || null;
  const customManufacturer = text(values.customManufacturer);
  const customModel = text(values.customModel);
  const purchasePriceBrl = numeric(values.purchasePriceBrl);
  const residualValueBrl = numeric(values.residualValueBrl);
  const usefulLifeHours = numeric(values.usefulLifeHours);
  const accumulatedHours = numeric(values.accumulatedHours) ?? 0;
  const averagePowerWatts = numeric(values.averagePowerWatts);
  const energyTariffPerKwh = numeric(values.energyTariffPerKwh);
  const purchasedAt = text(values.purchasedAt) || null;
  const installedNozzle = text(values.installedNozzle);
  const modifications = text(values.modifications);
  const powerConditions = text(values.powerConditions);
  const status = values.status;
  if (nickname.length < 2 || nickname.length > 80) return null;
  if (catalogModelId ? !uuid.test(catalogModelId) || customManufacturer || customModel : customManufacturer.length < 2 || customManufacturer.length > 80 || customModel.length < 1 || customModel.length > 80) return null;
  if ([purchasePriceBrl, residualValueBrl, usefulLifeHours, accumulatedHours, averagePowerWatts, energyTariffPerKwh].some((value) => value != null && (!Number.isFinite(value) || value < 0))) return null;
  if ((purchasePriceBrl != null && purchasePriceBrl <= 0) || (usefulLifeHours != null && usefulLifeHours <= 0) || (averagePowerWatts != null && averagePowerWatts <= 0)) return null;
  if (purchasePriceBrl != null && residualValueBrl != null && residualValueBrl > purchasePriceBrl) return null;
  if (purchasedAt && (!validDate(purchasedAt) || purchasedAt > today)) return null;
  if (installedNozzle.length > 100 || modifications.length > 1000 || powerConditions.length > 500) return null;
  if (averagePowerWatts != null && powerConditions.length < 5) return null;
  if (status !== "available" && status !== "maintenance" && status !== "inactive") return null;
  return {
    nickname, catalogModelId, manufacturer: catalogModelId ? null : customManufacturer, model: catalogModelId ? null : customModel,
    purchasedAt, purchasePriceBrl, residualValueBrl, usefulLifeHours, accumulatedHours,
    installedNozzle: installedNozzle || null, modifications, averagePowerWatts, powerConditions: powerConditions || null,
    energyTariffPerKwh, status,
  };
}

export function validateMaintenanceEntry(values: Record<string, unknown>, today = getBrazilianCalendarDate(), currentHours = 0): MaintenanceEntryInput | null {
  const performedAt = text(values.performedAt);
  const maintenanceType = values.maintenanceType;
  const component = text(values.component);
  const costBrl = numeric(values.costBrl);
  const hoursAtEvent = numeric(values.hoursAtEvent);
  const notes = text(values.notes);
  const nextDueAt = text(values.nextDueAt) || null;
  const nextDueHours = numeric(values.nextDueHours);
  const types = ["preventive", "corrective", "nozzle_replacement", "belt_replacement", "lubrication", "bed_replacement", "component_replacement", "other"] as const;
  if (!validDate(performedAt) || performedAt > today || !types.includes(maintenanceType as typeof types[number])) return null;
  if (component.length < 2 || component.length > 100 || notes.length > 1000) return null;
  if (costBrl == null || !Number.isFinite(costBrl) || costBrl < 0 || (hoursAtEvent != null && (!Number.isFinite(hoursAtEvent) || hoursAtEvent < 0))) return null;
  if (nextDueAt && (!validDate(nextDueAt) || nextDueAt < performedAt)) return null;
  if (nextDueHours != null && (!Number.isFinite(nextDueHours) || nextDueHours <= currentHours || nextDueHours > 99_999_999.99)) return null;
  return { performedAt, maintenanceType: maintenanceType as MaintenanceEntryInput["maintenanceType"], component, costBrl, hoursAtEvent, notes, nextDueAt, nextDueHours };
}
