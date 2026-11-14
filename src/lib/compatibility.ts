export type PrinterTechnology = "FDM" | "SLA" | "MSLA" | "DLP";
export type MaterialProcess = "filament" | "resin";
export type CompatibilityStatus = "compatible" | "conditional" | "incompatible" | "unverified";
export type MaterialSupport = "recommended" | "not-recommended" | CompatibilityStatus;
export type MaterialSupportEntry = MaterialSupport | { status: MaterialSupport; conditions?: string | null };

export type CatalogPrinter = {
  id: string;
  name: string;
  technology: PrinterTechnology;
  buildVolumeMm: { x: number; y: number; z: number } | null;
  filamentDiameterMm: number | null;
  maxNozzleTemperatureC: number | null;
  maxBedTemperatureC: number | null;
  heatedBed: boolean | null;
  enclosure: boolean | null;
  multicolorSupported?: boolean | null;
  multicolorSlots: number | null;
  supportedMaterials: Record<string, MaterialSupportEntry>;
  commercialStatus?: "available" | "in_production" | "discontinued" | "announced" | "unknown";
  commercialStatusSource?: { label: string; url: string; checkedAt: string } | null;
};

export type CatalogMaterial = {
  id: string;
  name: string;
  family: string;
  process: MaterialProcess;
  filamentDiameterMm: number | null;
  nozzleTemperatureC: { min: number; max: number } | null;
  bedTemperatureC: { min: number; max: number } | null;
  nozzleDiametersMm: number[] | null;
  enclosureRequired: boolean | null;
  abrasive: boolean | null;
  multicolorCompatible: boolean | null;
  resinWavelengthNm?: number | null;
  resinExposureSeconds?: number | null;
};

export type CatalogNozzle = {
  id: string;
  name: string;
  diameterMm: number;
  material: string | null;
  maxTemperatureC: number | null;
  abrasionResistant: boolean | null;
  printerCompatibility: Record<string, CompatibilityStatus> | null;
};

export type CompatibilityCheck = {
  key: string;
  label: string;
  status: CompatibilityStatus;
  detail: string;
};

export function evaluateBuildVolume(
  buildVolumeMm: CatalogPrinter["buildVolumeMm"],
  dimensions: { x: number; y: number; z: number },
): CompatibilityCheck {
  if (![dimensions.x, dimensions.y, dimensions.z].every((value) => Number.isFinite(value) && value > 0)) {
    return { key: "volume", label: "Volume de impressão", status: "unverified", detail: "Informe três dimensões positivas em milímetros." };
  }
  if (buildVolumeMm == null) {
    return { key: "volume", label: "Volume de impressão", status: "unverified", detail: "O volume útil da impressora não está cadastrado." };
  }
  const part = [dimensions.x, dimensions.y, dimensions.z].sort((a, b) => b - a);
  const volume = [buildVolumeMm.x, buildVolumeMm.y, buildVolumeMm.z].sort((a, b) => b - a);
  return part.some((size, index) => size > volume[index])
    ? { key: "volume", label: "Volume de impressão", status: "incompatible", detail: "A peça excede o volume útil cadastrado, mesmo após orientar seus eixos." }
    : { key: "volume", label: "Volume de impressão", status: "compatible", detail: "As dimensões informadas cabem no volume útil." };
}

type CompatibilityOptions = {
  partDimensionsMm?: { x: number; y: number; z: number };
  useMulticolor?: boolean;
};

const processForTechnology = (technology: PrinterTechnology): MaterialProcess =>
  technology === "FDM" ? "filament" : "resin";

function overallStatus(checks: CompatibilityCheck[]): CompatibilityStatus {
  if (checks.some(({ status }) => status === "incompatible")) return "incompatible";
  if (checks.some(({ status }) => status === "unverified")) return "unverified";
  if (checks.some(({ status }) => status === "conditional")) return "conditional";
  return "compatible";
}

export function evaluateCompatibility(
  printer: CatalogPrinter,
  material: CatalogMaterial,
  nozzle?: CatalogNozzle,
  options: CompatibilityOptions = {},
) {
  const checks: CompatibilityCheck[] = [];
  const add = (key: string, label: string, status: CompatibilityStatus, detail: string) =>
    checks.push({ key, label, status, detail });

  if (processForTechnology(printer.technology) !== material.process) {
    add("technology", "Tecnologia", "incompatible", "A impressora e o material usam processos diferentes.");
  } else {
    add("technology", "Tecnologia", "compatible", "O processo do material corresponde à impressora.");
  }

  const supportEntry = printer.supportedMaterials[material.id] ?? printer.supportedMaterials[material.family.toLocaleUpperCase("pt-BR")];
  const support = typeof supportEntry === "string" ? supportEntry : supportEntry?.status;
  const conditions = typeof supportEntry === "string" ? null : supportEntry?.conditions;
  const supportDetail = conditions ? ` Condições do fabricante: ${conditions}` : "";
  if (support === "recommended" || support === "compatible") add("material", "Material", "compatible", `O catálogo confirma este material para a impressora.${supportDetail}`);
  else if (support === "not-recommended" || support === "conditional") add("material", "Material", "conditional", `O catálogo indica condições ou restrições para este material.${supportDetail}`);
  else if (support === "incompatible") add("material", "Material", "incompatible", `O catálogo indica que este material não é compatível com a impressora.${supportDetail}`);
  else add("material", "Material", "unverified", "O catálogo não confirma este material para a impressora.");

  if (material.process === "filament") {
    if (material.filamentDiameterMm == null || printer.filamentDiameterMm == null) {
      add("filament-diameter", "Diâmetro do filamento", "unverified", "Falta confirmar o diâmetro do filamento ou da impressora.");
    } else if (material.filamentDiameterMm !== printer.filamentDiameterMm) {
      add("filament-diameter", "Diâmetro do filamento", "incompatible", "O diâmetro do filamento não corresponde à impressora.");
    } else {
      add("filament-diameter", "Diâmetro do filamento", "compatible", `Filamento de ${material.filamentDiameterMm} mm.`);
    }
  }

  if (material.process === "filament" && nozzle) {
    const nozzleFit = nozzle.printerCompatibility?.[printer.id];
    if (nozzleFit == null || nozzleFit === "unverified") {
      add("nozzle-fit", "Encaixe do bico", "unverified", "O encaixe deste bico ainda não foi confirmado para a impressora.");
    } else if (nozzleFit === "compatible") {
      add("nozzle-fit", "Encaixe do bico", "compatible", "O bico está listado para este modelo.");
    } else if (nozzleFit === "conditional") {
      add("nozzle-fit", "Encaixe do bico", "conditional", "O encaixe deste bico depende das condições cadastradas.");
    } else {
      add("nozzle-fit", "Encaixe do bico", "incompatible", "O catálogo indica que este bico não se encaixa na impressora.");
    }

    if (material.nozzleDiametersMm && !material.nozzleDiametersMm.includes(nozzle.diameterMm)) {
      add("nozzle-diameter", "Diâmetro do bico", "incompatible", "O fabricante do material não recomenda este diâmetro de bico.");
    }
  }

  if (material.process === "filament" && material.nozzleTemperatureC) {
    if (printer.maxNozzleTemperatureC == null) {
      add("hotend-temperature", "Temperatura do hotend", "unverified", "A temperatura máxima do hotend não está cadastrada.");
    } else if (material.nozzleTemperatureC.min > printer.maxNozzleTemperatureC) {
      add("hotend-temperature", "Temperatura do hotend", "incompatible", "O hotend não atinge a faixa mínima recomendada pelo material.");
    } else if (material.nozzleTemperatureC.max > printer.maxNozzleTemperatureC) {
      add("hotend-temperature", "Temperatura do hotend", "conditional", `O hotend alcança parte da faixa (${material.nozzleTemperatureC.min}–${material.nozzleTemperatureC.max} °C), mas sua temperatura máxima é ${printer.maxNozzleTemperatureC} °C.`);
    } else {
      add("hotend-temperature", "Temperatura do hotend", "compatible", `Até ${printer.maxNozzleTemperatureC} °C; mínimo recomendado de ${material.nozzleTemperatureC.min} °C.`);
    }
    if (nozzle?.maxTemperatureC != null && material.nozzleTemperatureC.min > nozzle.maxTemperatureC) {
      add("nozzle-temperature", "Temperatura do bico", "incompatible", "O limite deste bico está abaixo da faixa mínima do material.");
    }
  }

  if (material.process === "filament" && material.bedTemperatureC) {
    if (printer.heatedBed === false) {
      add("heated-bed", "Mesa aquecida", "incompatible", "O material requer mesa aquecida e a impressora não possui esse recurso.");
    } else if (printer.heatedBed == null || printer.maxBedTemperatureC == null) {
      add("heated-bed", "Mesa aquecida", "unverified", "O catálogo não confirma a mesa aquecida ou seu limite de temperatura.");
    } else if (material.bedTemperatureC.min > printer.maxBedTemperatureC) {
      add("heated-bed", "Temperatura da mesa", "incompatible", "A mesa não alcança a faixa mínima indicada para o material.");
    } else if (material.bedTemperatureC.max > printer.maxBedTemperatureC) {
      add("heated-bed", "Temperatura da mesa", "conditional", `A mesa alcança parte da faixa (${material.bedTemperatureC.min}–${material.bedTemperatureC.max} °C), mas sua temperatura máxima é ${printer.maxBedTemperatureC} °C.`);
    } else {
      add("heated-bed", "Temperatura da mesa", "compatible", `Limite da mesa: ${printer.maxBedTemperatureC} °C.`);
    }
  }

  if (material.process === "filament" && material.enclosureRequired === true) {
    if (printer.enclosure === false) add("enclosure", "Câmara fechada", "conditional", "O material pede câmara fechada; use uma impressora ou acessório adequado.");
    else if (printer.enclosure == null) add("enclosure", "Câmara fechada", "unverified", "O catálogo não confirma se há câmara fechada.");
  }

  if (material.process === "filament" && material.abrasive === true && nozzle) {
    if (nozzle.abrasionResistant === false) add("abrasion", "Resistência à abrasão", "conditional", "Troque por um bico resistente à abrasão antes de imprimir este material.");
    else if (nozzle.abrasionResistant == null) add("abrasion", "Resistência à abrasão", "unverified", "A resistência deste bico à abrasão não foi informada.");
  }

  if (options.partDimensionsMm) {
    checks.push(evaluateBuildVolume(printer.buildVolumeMm, options.partDimensionsMm));
  }

  if (options.useMulticolor && material.process === "filament") {
    if (printer.multicolorSupported === false) {
      add("multicolor", "Sistema multicolorido", "incompatible", "Esta configuração não oferece impressão multicolorida.");
    } else if (printer.multicolorSlots == null) {
      add("multicolor", "Sistema multicolorido", "unverified", "A capacidade do sistema multicolorido não está cadastrada.");
    } else if (printer.multicolorSlots < 2) {
      add("multicolor", "Sistema multicolorido", "incompatible", "A configuração cadastrada não permite múltiplos filamentos.");
    } else if (material.multicolorCompatible === false) {
      add("multicolor", "Sistema multicolorido", "conditional", "Use o suporte externo de filamento; este material não é recomendado no alimentador multicolorido.");
    } else if (material.multicolorCompatible == null) {
      add("multicolor", "Sistema multicolorido", "unverified", "A compatibilidade do material com o alimentador não foi informada.");
    } else {
      add("multicolor", "Sistema multicolorido", "compatible", `Até ${printer.multicolorSlots} filamentos conforme a configuração cadastrada.`);
    }
  }

  return { status: overallStatus(checks), checks };
}

export function evaluateMaterialCompatibility(printer: CatalogPrinter, material: CatalogMaterial, nozzle?: CatalogNozzle) {
  return evaluateCompatibility(printer, material, nozzle);
}
