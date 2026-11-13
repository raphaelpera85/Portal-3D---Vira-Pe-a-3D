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
  supportedMaterials: {},
  sources: [crealityK2PlusSource],
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
