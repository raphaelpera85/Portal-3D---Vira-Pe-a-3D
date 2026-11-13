import type { CatalogMaterial, CatalogNozzle, CatalogPrinter, MaterialSupport } from "./compatibility";

export type CatalogSource = { label: string; url: string; checkedAt: string };
export type PrinterEntry = CatalogPrinter & {
  brand: string;
  model: string;
  variant: string;
  buildVolumeDescription?: string | null;
  extruders: number | null;
  maximumSpeedMmPerSecond: number | null;
  maximumSpeedDescription?: string | null;
  maximumPowerWatts: number | null;
  measuredAveragePowerWatts: number | null;
  multicolorSystem: string | null;
  technicalProperties?: Record<string, unknown>;
  sources: CatalogSource[];
};
export type MaterialEntry = CatalogMaterial & {
  brand: string;
  densityGPerCm3: number | null;
  printSpeedMaximumMmPerSecond: number | null;
  drying: { required: boolean; temperatureC: number | null; hours: number | null } | null;
  resinWavelengthNm: number | null;
  resinExposureSeconds: number | null;
  colors: { name: string; hex: string | null }[];
  technicalProperties?: Record<string, unknown>;
  sources: CatalogSource[];
};
export type NozzleEntry = CatalogNozzle & {
  brand: string;
  original: boolean;
  printerCompatibilityConditions?: Record<string, string> | null;
  sources: CatalogSource[];
};

const machineSource = {
  label: "Bambu Lab — Quick Start A1 mini Combo",
  url: "https://cdn1.bambulab.com/documentation/Quick%20Start%20Guide%20for%20A1%20mini%20Combo.pdf",
  checkedAt: "2026-11-12",
};
const crealityK2PlusSource = {
  label: "Creality — K2 Plus specifications",
  url: "https://www.creality.com/eu/products/k2-series-3d-printer",
  checkedAt: "2026-11-13",
};
const bambuP2sSource = {
  label: "Bambu Lab — P2S specifications",
  url: "https://blog.bambulab.com/the-icon-redefined-meet-the-p2s-a-completely-reengineered-version-of-the-ultra-productive-p1-series/",
  checkedAt: "2026-11-13",
};
const bambuH2sSource = {
  label: "Bambu Lab — H2S specifications",
  url: "https://blog.bambulab.com/h2s-the-ultimate-single-nozzle-3d-printer-now-bigger-than-ever/",
  checkedAt: "2026-11-13",
};
const plaSource = {
  label: "Bambu Lab — PLA Basic",
  url: "https://bambulab-us.myshopify.com/products/pla-basic-filament",
  checkedAt: "2026-11-12",
};
const ppaSource = {
  label: "Bambu Lab — PPA-CF",
  url: "https://bambulab-us.myshopify.com/products/ppa-cf",
  checkedAt: "2026-11-12",
};

export const printers: PrinterEntry[] = [{
  id: "bambu-a1-mini-ams-lite",
  name: "Bambu Lab A1 mini + AMS lite",
  brand: "Bambu Lab",
  model: "A1 mini",
  variant: "Combo",
  buildVolumeDescription: null,
  technology: "FDM",
  buildVolumeMm: { x: 180, y: 180, z: 180 },
  extruders: null,
  filamentDiameterMm: 1.75,
  maxNozzleTemperatureC: 300,
  maxBedTemperatureC: 80,
  heatedBed: true,
  enclosure: null,
  maximumSpeedMmPerSecond: null,
  maximumSpeedDescription: "500 mm/s de deslocamento do cabeçote; velocidade de impressão não informada",
  maximumPowerWatts: 150,
  measuredAveragePowerWatts: null,
  multicolorSlots: 4,
  multicolorSystem: "AMS lite",
  supportedMaterials: {
    PLA: "recommended",
    PETG: "recommended",
    TPU: "recommended",
    PVA: "recommended",
    ABS: "not-recommended",
    ASA: "not-recommended",
    PC: "not-recommended",
    PA: "not-recommended",
    PET: "not-recommended",
    "PPA-CF": "not-recommended",
  } satisfies Record<string, MaterialSupport>,
  sources: [machineSource],
}, {
  id: "creality-k2-plus",
  name: "Creality K2 Plus",
  brand: "Creality",
  model: "K2 Plus",
  variant: "standard",
  buildVolumeDescription: null,
  technology: "FDM",
  buildVolumeMm: { x: 350, y: 350, z: 350 },
  extruders: 1,
  filamentDiameterMm: 1.75,
  maxNozzleTemperatureC: 350,
  maxBedTemperatureC: 120,
  heatedBed: true,
  enclosure: true,
  maximumSpeedMmPerSecond: 600,
  maximumPowerWatts: 1200,
  measuredAveragePowerWatts: null,
  multicolorSlots: 16,
  multicolorSystem: "Creality CFS (até quatro unidades)",
  technicalProperties: {
    maxAccelerationMmPerSecondSquared: 30000,
    maximumChamberTemperatureC: 60,
    activeChamberHeater: true,
    comboDimensionsMm: { x: 495, y: 515, z: 916 },
    supportedNozzleDiametersMm: [0.2, 0.4, 0.6, 0.8],
  },
  supportedMaterials: {
    "creality-hyper-pla": { status: "compatible", conditions: "Perfil K2 Plus: bico 220 °C, mesa 50 °C, câmara 35 °C, velocidade volumétrica máxima 23 mm³/s, flow ratio 0,95." },
    "creality-hyper-abs": { status: "compatible", conditions: "Perfil K2 Plus: bico 260 °C, mesa 80 °C, câmara 50 °C, velocidade volumétrica máxima 23 mm³/s, flow ratio 0,95. Use a impressora totalmente fechada." },
    "creality-hyper-petg": { status: "compatible", conditions: "Perfil K2 Plus: bico 240 °C, mesa 70 °C, câmara 35 °C, velocidade volumétrica máxima 23 mm³/s, flow ratio 0,98." },
    "creality-hp-asa": { status: "compatible", conditions: "Perfil K2 Plus: bico 260 °C, mesa 90 °C, câmara 50 °C, velocidade volumétrica máxima 14 mm³/s, flow ratio 0,95. Use a impressora totalmente fechada." },
    "creality-hp-tpu": { status: "conditional", conditions: "Perfil K2 Plus: bico 220 °C, mesa 40 °C, câmara 35 °C, velocidade volumétrica máxima 3 mm³/s. Não use CFS; use TPU com dureza mínima 85A e alimente diretamente o extrusor." },
  },
  sources: [crealityK2PlusSource],
}, {
  id: "bambu-p2s",
  name: "Bambu Lab P2S",
  brand: "Bambu Lab",
  model: "P2S",
  variant: "standard",
  buildVolumeDescription: null,
  technology: "FDM",
  buildVolumeMm: { x: 256, y: 256, z: 256 },
  extruders: null,
  filamentDiameterMm: null,
  maxNozzleTemperatureC: 300,
  maxBedTemperatureC: 110,
  heatedBed: true,
  enclosure: true,
  maximumSpeedMmPerSecond: null,
  maximumSpeedDescription: null,
  maximumPowerWatts: null,
  measuredAveragePowerWatts: null,
  multicolorSlots: null,
  multicolorSystem: null,
  technicalProperties: { supportedNozzleDiametersMm: [0.2, 0.4, 0.6, 0.8], quickSwapHotend: true },
  supportedMaterials: {},
  sources: [bambuP2sSource],
}, {
  id: "bambu-h2s",
  name: "Bambu Lab H2S",
  brand: "Bambu Lab",
  model: "H2S",
  variant: "standard",
  buildVolumeDescription: null,
  technology: "FDM",
  buildVolumeMm: { x: 340, y: 320, z: 340 },
  extruders: null,
  filamentDiameterMm: null,
  maxNozzleTemperatureC: 350,
  maxBedTemperatureC: null,
  heatedBed: null,
  enclosure: true,
  maximumSpeedMmPerSecond: null,
  maximumSpeedDescription: "1.000 mm/s de deslocamento do cabeçote; velocidade de impressão não informada",
  maximumPowerWatts: null,
  measuredAveragePowerWatts: null,
  multicolorSlots: null,
  multicolorSystem: null,
  technicalProperties: {
    activeChamberHeating: true,
    maximumChamberTemperatureC: 65,
    maxToolheadSpeedMmPerSecond: 1000,
    maxToolheadAccelerationMmPerSecondSquared: 20000,
  },
  supportedMaterials: {},
  sources: [bambuH2sSource],
}, {
  id: "bambu-h2s-ams-2-pro-combo",
  name: "Bambu Lab H2S + AMS 2 Pro",
  brand: "Bambu Lab",
  model: "H2S",
  variant: "AMS 2 Pro Combo",
  buildVolumeDescription: null,
  technology: "FDM",
  buildVolumeMm: { x: 340, y: 320, z: 340 },
  extruders: null,
  filamentDiameterMm: null,
  maxNozzleTemperatureC: 350,
  maxBedTemperatureC: null,
  heatedBed: null,
  enclosure: true,
  maximumSpeedMmPerSecond: null,
  maximumSpeedDescription: "1.000 mm/s de deslocamento do cabeçote; velocidade de impressão não informada",
  maximumPowerWatts: null,
  measuredAveragePowerWatts: null,
  multicolorSlots: null,
  multicolorSystem: "AMS 2 Pro",
  technicalProperties: {
    activeChamberHeating: true,
    maximumChamberTemperatureC: 65,
    maxToolheadSpeedMmPerSecond: 1000,
    maxToolheadAccelerationMmPerSecondSquared: 20000,
    ams2ProIncluded: true,
  },
  supportedMaterials: {},
  sources: [bambuH2sSource],
}];

export const materials: MaterialEntry[] = [
  {
    id: "bambu-pla-basic",
    name: "PLA Basic",
    brand: "Bambu Lab",
    family: "PLA",
    process: "filament",
    filamentDiameterMm: 1.75,
    densityGPerCm3: 1.24,
    nozzleTemperatureC: { min: 190, max: 230 },
    bedTemperatureC: { min: 35, max: 45 },
    nozzleDiametersMm: null,
    enclosureRequired: false,
    abrasive: false,
    multicolorCompatible: true,
    printSpeedMaximumMmPerSecond: 300,
    drying: { required: false, temperatureC: 55, hours: 8 },
    resinWavelengthNm: null,
    resinExposureSeconds: null,
    colors: [
      { name: "Branco Jade", hex: "#FFFFFF" },
      { name: "Verde Bambu", hex: "#00AE42" },
      { name: "Vermelho", hex: "#C12E1F" },
      { name: "Preto", hex: "#000000" },
    ],
    sources: [plaSource],
  },
  {
    id: "bambu-ppa-cf",
    name: "PPA-CF",
    brand: "Bambu Lab",
    family: "PPA-CF",
    process: "filament",
    filamentDiameterMm: 1.75,
    densityGPerCm3: 1.25,
    nozzleTemperatureC: { min: 280, max: 310 },
    bedTemperatureC: { min: 100, max: 120 },
    nozzleDiametersMm: [0.4, 0.6, 0.8],
    enclosureRequired: true,
    abrasive: true,
    multicolorCompatible: false,
    printSpeedMaximumMmPerSecond: 100,
    drying: { required: true, temperatureC: 100, hours: 12 },
    resinWavelengthNm: null,
    resinExposureSeconds: null,
    colors: [{ name: "Preto", hex: "#000000" }],
    sources: [ppaSource],
  },
  ...[
    { id: "creality-hyper-pla", name: "Hyper PLA", family: "PLA", enclosureRequired: null, multicolorCompatible: null, url: "https://store.creality.com/eu/products/hyper-1-75mm-pla-3d-printing-filament-1kg" },
    { id: "creality-hyper-abs", name: "Hyper ABS", family: "ABS", enclosureRequired: true, multicolorCompatible: null, url: "https://store.creality.com/eu/products/hyper-abs-3d-printing-filament" },
    { id: "creality-hyper-petg", name: "Hyper PETG", family: "PETG", enclosureRequired: null, multicolorCompatible: null, url: "https://store.creality.com/eu/products/hyper-petg-filament-1-75mm-1kg" },
    { id: "creality-hp-asa", name: "HP ASA", family: "ASA", enclosureRequired: true, multicolorCompatible: null, url: "https://store.creality.com/eu/products/creality-hp-asa" },
    { id: "creality-hp-tpu", name: "HP-TPU", family: "TPU", enclosureRequired: null, multicolorCompatible: false, url: "https://store.creality.com/de/products/hp-tpu-fdm-3d-drucker-filament-1-75mm-1kg" },
  ].map(({ id, name, family, enclosureRequired, multicolorCompatible, url }) => ({
    id, name, brand: "Creality", family, process: "filament" as const,
    filamentDiameterMm: 1.75, densityGPerCm3: null, nozzleTemperatureC: null,
    bedTemperatureC: null, nozzleDiametersMm: null, enclosureRequired, abrasive: null,
    multicolorCompatible, printSpeedMaximumMmPerSecond: null, drying: null,
    resinWavelengthNm: null, resinExposureSeconds: null, colors: [],
    sources: [{ label: `Creality — ${name}`, url, checkedAt: "2026-11-13" }],
  })),
];

const nozzleDiameters = [
  { diameter: 0.2, included: false, material: null },
  { diameter: 0.4, included: true, material: "Aço inoxidável" },
  { diameter: 0.6, included: false, material: null },
  { diameter: 0.8, included: false, material: null },
];

export const nozzles: NozzleEntry[] = [
  ...nozzleDiameters.map(({ diameter, included, material }) => ({
    id: `bambu-a1-mini-${diameter}`,
    name: `Bico ${diameter.toLocaleString("pt-BR")} mm`,
    brand: "Bambu Lab",
    diameterMm: diameter,
    material,
    maxTemperatureC: null,
    abrasionResistant: null,
    printerCompatibility: { "bambu-a1-mini-ams-lite": "compatible" as const },
    original: included,
    sources: [machineSource],
  })),
  ...[0.2, 0.4, 0.6, 0.8].map((diameter) => ({
    id: `bambu-p2s-${diameter}`,
    name: `Bico ${diameter.toLocaleString("pt-BR")} mm · P2S`,
    brand: "Bambu Lab",
    diameterMm: diameter,
    material: null,
    maxTemperatureC: null,
    abrasionResistant: null,
    printerCompatibility: { "bambu-p2s": "compatible" as const },
    original: diameter === 0.4,
    sources: [bambuP2sSource],
  })),
  ...[0.2, 0.4, 0.6, 0.8].map((diameter) => ({
    id: `creality-k2-plus-${diameter}`,
    name: `Bico ${diameter.toLocaleString("pt-BR")} mm · K2 Plus`,
    brand: "Creality",
    diameterMm: diameter,
    material: null,
    maxTemperatureC: null,
    abrasionResistant: null,
    printerCompatibility: { "creality-k2-plus": "compatible" as const },
    original: diameter === 0.4,
    sources: [crealityK2PlusSource],
  })),
];
