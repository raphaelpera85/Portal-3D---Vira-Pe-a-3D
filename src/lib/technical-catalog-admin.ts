const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses = ["draft", "published", "archived"];
const optionalNumber = (value: unknown, min: number, max: number): number | null | undefined => {
  const raw = text(value);
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) && number >= min && number <= max ? number : undefined;
};
const optionalBoolean = (value: unknown): boolean | null | undefined =>
  value === "true" || value === true || value === "on" ? true
    : value === "false" || value === false ? false
      : value == null || value === "" ? null : undefined;
const isHttpsUrl = (value: string) => {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
};
const isValidDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value <= new Date().toISOString().slice(0, 10);
};
function parseObject(value: unknown): Record<string, unknown> | null {
  const raw = text(value);
  if (raw.length > 20000) return null;
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}
function sourceFields(sourceUrl: string, documentationUrl: string, verifiedAt: string, status: string) {
  return (sourceUrl.length <= 2048 && (!sourceUrl || isHttpsUrl(sourceUrl)))
    && (documentationUrl.length <= 2048 && (!documentationUrl || isHttpsUrl(documentationUrl)))
    && (!verifiedAt || isValidDate(verifiedAt))
    && (status !== "published" || Boolean(sourceUrl && verifiedAt));
}

export function validateMaterialCatalogInput(values: Record<string, unknown>) {
  const manufacturer = text(values.manufacturer);
  const product = text(values.product);
  const family = text(values.family);
  const process = text(values.process);
  const catalogStatus = text(values.catalogStatus);
  const sourceUrl = text(values.sourceUrl);
  const documentationUrl = text(values.documentationUrl);
  const verifiedAt = text(values.verifiedAt);
  const filamentDiameter = optionalNumber(values.filamentDiameter, 0.01, 999.99);
  const density = optionalNumber(values.density, 0.0001, 999.9999);
  const nozzleMin = optionalNumber(values.nozzleMin, 0.01, 9999.99);
  const nozzleMax = optionalNumber(values.nozzleMax, 0.01, 9999.99);
  const bedMin = optionalNumber(values.bedMin, 0, 9999.99);
  const bedMax = optionalNumber(values.bedMax, 0, 9999.99);
  const dryingTemperature = optionalNumber(values.dryingTemperature, 0.01, 9999.99);
  const dryingHours = optionalNumber(values.dryingHours, 0.01, 9999.99);
  const maxPrintSpeed = optionalNumber(values.maxPrintSpeed, 0.01, 999999.99);
  const resinWavelength = optionalNumber(values.resinWavelength, 0.01, 99999.99);
  const resinExposure = optionalNumber(values.resinExposure, 0.01, 99999.99);
  const requiresEnclosure = optionalBoolean(values.enclosure);
  const abrasive = optionalBoolean(values.abrasive);
  const multicolorCompatible = optionalBoolean(values.multicolorCompatible);
  const dryingRequired = optionalBoolean(values.dryingRequired);
  const technicalProperties = parseObject(values.technicalProperties);
  const colorsRaw = text(values.colors);
  let colors: { name: string; hex: string }[];
  try {
    if (colorsRaw.length > 20000) return null;
    const parsed: unknown = JSON.parse(colorsRaw || "[]");
    if (!Array.isArray(parsed) || parsed.length > 100 || parsed.some((item) => !item || typeof item !== "object"
      || typeof item.name !== "string" || !text(item.name) || text(item.name).length > 80
      || typeof item.hex !== "string" || !/^#[\da-f]{6}$/i.test(item.hex))) return null;
    colors = parsed.map((item) => ({ name: text(item.name), hex: item.hex.toUpperCase() }));
  } catch { return null; }

  if (!manufacturer || manufacturer.length > 100 || !product || product.length > 120 || !family || family.length > 80
    || !["filament", "resin"].includes(process) || !statuses.includes(catalogStatus)
    || [filamentDiameter, density, nozzleMin, nozzleMax, bedMin, bedMax, dryingTemperature, dryingHours, maxPrintSpeed, resinWavelength, resinExposure].includes(undefined)
    || [requiresEnclosure, abrasive, multicolorCompatible, dryingRequired].includes(undefined)
    || (nozzleMin != null && nozzleMax != null && nozzleMax < nozzleMin)
    || (bedMin != null && bedMax != null && bedMax < bedMin)
    || !technicalProperties || !sourceFields(sourceUrl, documentationUrl, verifiedAt, catalogStatus)) return null;

  const nozzleDiameters = technicalProperties.nozzleDiametersMm;
  if (nozzleDiameters != null && (!Array.isArray(nozzleDiameters) || nozzleDiameters.length > 32
    || nozzleDiameters.some((value) => typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 999.99))) return null;

  return {
    manufacturer, product, family, process, catalog_status: catalogStatus, filament_diameter_mm: filamentDiameter,
    density_g_cm3: density, colors, nozzle_temperature_min_c: nozzleMin, nozzle_temperature_max_c: nozzleMax,
    bed_temperature_min_c: bedMin, bed_temperature_max_c: bedMax, requires_enclosure: requiresEnclosure,
    abrasive, multicolor_compatible: multicolorCompatible, drying_required: dryingRequired,
    drying_temperature_c: dryingTemperature, drying_hours: dryingHours, max_print_speed_mm_s: maxPrintSpeed,
    resin_wavelength_nm: resinWavelength, resin_exposure_seconds: resinExposure,
    technical_properties: technicalProperties, documentation_url: documentationUrl || null,
    source_url: sourceUrl || null, verified_at: verifiedAt || null,
  };
}

export function validateNozzleCatalogInput(values: Record<string, unknown>) {
  const manufacturer = text(values.manufacturer);
  const model = text(values.model);
  const interfaceValue = text(values.interface);
  const bodyMaterial = text(values.bodyMaterial);
  const diameter = optionalNumber(values.diameter, 0.01, 999.99);
  const maxTemperature = optionalNumber(values.maxTemperature, 0.01, 9999.99);
  const abrasionResistant = optionalBoolean(values.abrasionResistant);
  const catalogStatus = text(values.catalogStatus);
  const sourceUrl = text(values.sourceUrl);
  const documentationUrl = text(values.documentationUrl);
  const verifiedAt = text(values.verifiedAt);
  const technicalProperties = parseObject(values.technicalProperties);
  const original = optionalBoolean(values.original);

  if (!manufacturer || manufacturer.length > 100 || !model || model.length > 120 || interfaceValue.length > 120
    || bodyMaterial.length > 120 || diameter === undefined || diameter === null || maxTemperature === undefined
    || abrasionResistant === undefined || original === undefined || !statuses.includes(catalogStatus)
    || !technicalProperties || !sourceFields(sourceUrl, documentationUrl, verifiedAt, catalogStatus)) return null;

  return {
    manufacturer, model, interface: interfaceValue || null, diameter_mm: diameter,
    body_material: bodyMaterial || null, max_temperature_c: maxTemperature, abrasion_resistant: abrasionResistant,
    original: original ?? false, catalog_status: catalogStatus, technical_properties: technicalProperties,
    documentation_url: documentationUrl || null, source_url: sourceUrl || null, verified_at: verifiedAt || null,
  };
}

function validateRelationship(values: Record<string, unknown>) {
  const printerId = text(values.printerId);
  const entityId = text(values.entityId);
  const status = text(values.catalogStatus);
  const sourceUrl = text(values.sourceUrl);
  const verifiedAt = text(values.verifiedAt);
  const conditions = text(values.conditions);
  if (!uuidPattern.test(printerId) || !uuidPattern.test(entityId) || !statuses.includes(status)
    || conditions.length > 1000 || !sourceFields(sourceUrl, "", verifiedAt, status)) return null;
  return { printer_id: printerId, entity_id: entityId, conditions: conditions || null, source_url: sourceUrl || null, verified_at: verifiedAt || null, catalog_status: status };
}

export function validateMaterialCompatibilityInput(values: Record<string, unknown>) {
  const relationship = validateRelationship(values);
  const compatibility = text(values.compatibility);
  if (!relationship || !["compatible", "conditional", "incompatible", "unverified"].includes(compatibility)) return null;
  const { entity_id, ...rest } = relationship;
  return { ...rest, material_id: entity_id, compatibility };
}

export function validateNozzleCompatibilityInput(values: Record<string, unknown>) {
  const relationship = validateRelationship(values);
  const fit = text(values.fit);
  if (!relationship || !["compatible", "conditional", "incompatible", "unverified"].includes(fit)) return null;
  const { entity_id, ...rest } = relationship;
  return { ...rest, nozzle_id: entity_id, fit };
}
