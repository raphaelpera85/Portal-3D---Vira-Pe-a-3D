const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const optionalText = (value: unknown, max: number): string | null | undefined => {
  const result = text(value);
  return result ? result.length <= max ? result : undefined : null;
};
const optionalNumber = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): number | null | undefined => {
  const raw = text(value);
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) && number >= min && number <= max ? number : undefined;
};
const optionalBoolean = (value: unknown): boolean | null => value === "true" || value === true ? true : value === "false" || value === false ? false : null;
const isHttpsUrl = (value: string) => {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
};
const isValidDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value <= new Date().toISOString().slice(0, 10);
};

export function validatePrinterModelInput(values: Record<string, unknown>) {
  const manufacturer = text(values.manufacturer);
  const model = text(values.model);
  const variant = text(values.variant) || "standard";
  const technology = text(values.technology);
  const catalogStatus = text(values.catalogStatus);
  const sourceUrlRaw = text(values.sourceUrl);
  const documentationUrlRaw = text(values.documentationUrl);
  const verifiedAtRaw = text(values.verifiedAt);
  const yearRaw = text(values.modelYear);
  const modelYear = yearRaw ? optionalNumber(yearRaw, 1970, 2100) : null;
  const technicalPropertiesRaw = text(values.technicalProperties);
  let technicalProperties: Record<string, unknown>;
  try {
    if (technicalPropertiesRaw.length > 20000) return null;
    const parsed: unknown = JSON.parse(technicalPropertiesRaw || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    technicalProperties = parsed as Record<string, unknown>;
  } catch { return null; }

  const buildX = optionalNumber(values.buildVolumeX, 0.01, 9999999.99);
  const buildY = optionalNumber(values.buildVolumeY, 0.01, 9999999.99);
  const buildZ = optionalNumber(values.buildVolumeZ, 0.01, 9999999.99);
  const extruders = optionalNumber(values.extruderCount, 1, 32767);
  const filamentDiameter = optionalNumber(values.filamentDiameter, 0.01, 999.99);
  const originalNozzle = optionalNumber(values.originalNozzleDiameter, 0.01, 999.99);
  const nozzleTemperature = optionalNumber(values.maxNozzleTemperature, 0.01, 9999.99);
  const bedTemperature = optionalNumber(values.maxBedTemperature, 0.01, 9999.99);
  const maximumSpeed = optionalNumber(values.maxPrintSpeed, 0.01, 999999.99);
  const maximumPower = optionalNumber(values.maximumPower, 0.01, 9999999.99);
  const averagePower = optionalNumber(values.measuredAveragePower, 0.01, 9999999.99);
  const multicolorCount = optionalNumber(values.multicolorFilamentCount, 2, 32767);
  const optionalTextValues = [
    optionalText(values.nozzleInterface, 120), optionalText(values.averagePowerConditions, 500),
    optionalText(values.multicolorSystem, 100),
  ];
  if (!manufacturer || manufacturer.length > 100 || !model || model.length > 120 || variant.length > 80
    || !["FDM", "SLA", "MSLA", "DLP"].includes(technology) || !["draft", "published", "archived"].includes(catalogStatus)
    || [buildX, buildY, buildZ, extruders, filamentDiameter, originalNozzle, nozzleTemperature, bedTemperature, maximumSpeed, maximumPower, averagePower, multicolorCount].includes(undefined)
    || optionalTextValues.includes(undefined) || (yearRaw && (modelYear === undefined || !Number.isInteger(modelYear)))
    || (extruders != null && !Number.isInteger(extruders)) || (multicolorCount != null && !Number.isInteger(multicolorCount))
    || (sourceUrlRaw && (sourceUrlRaw.length > 2048 || !isHttpsUrl(sourceUrlRaw)))
    || (documentationUrlRaw && (documentationUrlRaw.length > 2048 || !isHttpsUrl(documentationUrlRaw)))
    || (verifiedAtRaw && !isValidDate(verifiedAtRaw))
    || (catalogStatus === "published" && (!sourceUrlRaw || !verifiedAtRaw))) return null;

  return {
    manufacturer, model, variant, model_year: modelYear, technology, catalog_status: catalogStatus,
    build_volume_x_mm: buildX, build_volume_y_mm: buildY, build_volume_z_mm: buildZ,
    extruder_count: extruders, filament_diameter_mm: filamentDiameter,
    nozzle_interface: optionalTextValues[0], original_nozzle_diameter_mm: originalNozzle,
    max_nozzle_temperature_c: nozzleTemperature, max_bed_temperature_c: bedTemperature,
    heated_bed: optionalBoolean(values.heatedBed), enclosure: optionalBoolean(values.enclosure),
    max_print_speed_mm_s: maximumSpeed, maximum_power_w: maximumPower,
    measured_average_power_w: averagePower, average_power_conditions: optionalTextValues[1],
    multicolor_system: optionalTextValues[2], multicolor_filament_count: multicolorCount,
    technical_properties: technicalProperties,
    documentation_url: documentationUrlRaw || null, source_url: sourceUrlRaw || null, verified_at: verifiedAtRaw || null,
  };
}
