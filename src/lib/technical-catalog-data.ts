import type { CompatibilityStatus, MaterialSupportEntry } from "./compatibility";
import type { MaterialEntry, NozzleEntry, PrinterEntry } from "./technical-catalog";

type Row = Record<string, unknown>;
const text = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const number = (value: unknown): number | null => value == null || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const boolean = (value: unknown): boolean | null => typeof value === "boolean" ? value : null;
const object = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const status = (value: unknown): CompatibilityStatus =>
  value === "compatible" || value === "conditional" || value === "incompatible" ? value : "unverified";
const source = (row: Row) => {
  const url = text(row.source_url || row.documentation_url);
  return url ? [{ label: text(row.manufacturer) || text(row.product) || text(row.model) || "Documentação do fabricante", url, checkedAt: text(row.verified_at) }] : [];
};
const range = (min: unknown, max: unknown) => {
  const lower = number(min);
  const upper = number(max);
  return lower == null || upper == null ? null : { min: lower, max: upper };
};
const statuses = new Set<CompatibilityStatus>(["compatible", "conditional", "incompatible", "unverified"]);
export function mapTechnicalCatalog(
  printerRows: Row[], materialRows: Row[], nozzleRows: Row[], materialLinks: Row[], nozzleLinks: Row[],
) {
  const materials: MaterialEntry[] = materialRows.map((row) => {
    const properties = object(row.technical_properties);
    const colors = Array.isArray(row.colors) ? row.colors.flatMap((entry) => {
      const color = object(entry);
      return typeof color.name === "string" && (typeof color.hex === "string" || color.hex === null) ? [{ name: color.name, hex: color.hex }] : [];
    }) : [];
    const drying = row.drying_required == null ? null : {
      required: boolean(row.drying_required) ?? false,
      temperatureC: number(row.drying_temperature_c),
      hours: number(row.drying_hours),
    };
    return {
      id: text(row.id), name: text(row.product), brand: text(row.manufacturer), family: text(row.family),
      process: row.process === "resin" ? "resin" : "filament",
      filamentDiameterMm: number(row.filament_diameter_mm), densityGPerCm3: number(row.density_g_cm3),
      nozzleTemperatureC: range(row.nozzle_temperature_min_c, row.nozzle_temperature_max_c),
      bedTemperatureC: range(row.bed_temperature_min_c, row.bed_temperature_max_c),
      nozzleDiametersMm: Array.isArray(properties.nozzleDiametersMm) ? properties.nozzleDiametersMm.map(number).filter((item): item is number => item != null) : null,
      enclosureRequired: boolean(row.requires_enclosure), abrasive: boolean(row.abrasive),
      multicolorCompatible: boolean(row.multicolor_compatible), printSpeedMaximumMmPerSecond: number(row.max_print_speed_mm_s),
      drying, colors, resinWavelengthNm: number(row.resin_wavelength_nm),
      resinExposureSeconds: number(row.resin_exposure_seconds), technicalProperties: properties, sources: source(row),
    };
  });
  const printers: PrinterEntry[] = printerRows.map((row) => {
    const supportedMaterials: Record<string, MaterialSupportEntry> = {};
    materialLinks.filter((link) => link.printer_id === row.id).forEach((link) => {
      const materialId = text(link.material_id);
      if (materialId) supportedMaterials[materialId] = { status: status(link.compatibility), conditions: text(link.conditions) || null };
    });
    const x = number(row.build_volume_x_mm), y = number(row.build_volume_y_mm), z = number(row.build_volume_z_mm);
    const buildVolumeMm = x != null && y != null && z != null ? { x, y, z } : null;
    const properties = object(row.technical_properties);
    const toolheadSpeed = number(properties.maxToolheadSpeedMmPerSecond);
    return {
      id: text(row.id), name: [text(row.manufacturer), text(row.model), text(row.variant)].filter(Boolean).join(" "),
      brand: text(row.manufacturer), model: text(row.model), variant: text(row.variant, "standard"),
      buildVolumeDescription: text(properties.buildVolumeDescription) || null,
      technology: row.technology === "SLA" || row.technology === "MSLA" || row.technology === "DLP" ? row.technology : "FDM",
      buildVolumeMm, extruders: number(row.extruder_count), filamentDiameterMm: number(row.filament_diameter_mm),
      maxNozzleTemperatureC: number(row.max_nozzle_temperature_c), maxBedTemperatureC: number(row.max_bed_temperature_c),
      heatedBed: boolean(row.heated_bed), enclosure: boolean(row.enclosure), maximumSpeedMmPerSecond: number(row.max_print_speed_mm_s),
      maximumSpeedDescription: toolheadSpeed == null ? null : `${toolheadSpeed} mm/s de deslocamento do cabeçote; velocidade de impressão não informada`,
      maximumPowerWatts: number(row.maximum_power_w), measuredAveragePowerWatts: number(row.measured_average_power_w),
      multicolorSlots: number(row.multicolor_filament_count), multicolorSystem: text(row.multicolor_system) || null,
      technicalProperties: properties,
      supportedMaterials, sources: source(row),
    };
  });
  const nozzleRelations = new Map<string, Record<string, CompatibilityStatus>>();
  nozzleLinks.forEach((link) => {
    const byPrinter = nozzleRelations.get(text(link.nozzle_id)) ?? {};
    if (statuses.has(link.fit as CompatibilityStatus)) byPrinter[text(link.printer_id)] = status(link.fit);
    nozzleRelations.set(text(link.nozzle_id), byPrinter);
  });
  const nozzles: NozzleEntry[] = nozzleRows.map((row) => ({
    id: text(row.id), name: text(row.model), brand: text(row.manufacturer), diameterMm: number(row.diameter_mm) ?? 0,
    material: text(row.body_material) || null, maxTemperatureC: number(row.max_temperature_c),
    abrasionResistant: boolean(row.abrasion_resistant), printerCompatibility: nozzleRelations.get(text(row.id)) ?? null,
    original: boolean(row.original) ?? boolean(object(row.technical_properties).original) ?? false, sources: source(row),
  }));
  return { printers, materials, nozzles };
}
