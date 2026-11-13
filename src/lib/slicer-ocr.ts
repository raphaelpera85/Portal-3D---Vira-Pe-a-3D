const numberPattern = String.raw`(\d[\d.,]*)`;
const massLabels = {
  model: String.raw`(?:model(?:\s+weight)?|modelo(?:\s+(?:3d|peso))?)`,
  support: String.raw`(?:supports?|suportes?)`,
  total: String.raw`(?:filament\s+(?:used|usage|total)|material\s+(?:used|usage|total)|(?:consumo|peso)\s+total|total(?:\s+(?:filament|material|weight|consumption))?)`,
};
const materialPattern = String.raw`(?:(?:Prusament|Anycubic|ELEGOO|Bambu\s+Lab|Creality)\s+)?(?:Water[- ]Wash\s+Resin(?:\s+\d+(?:\.\d+)?)?|Standard\s+Resin(?:\s+V\d+(?:\.\d+)?)?|ABS[- ]?Like\s+Resin(?:\s+V?\d+(?:\.\d+)?)?|Hyper\s+(?:PLA|ABS|PETG)|HP[- ](?:ASA|TPU)|PPA[- ]CF|PA11(?:[- ](?:CF|Carbon[- ]?Fiber))?|PETG(?:[- ](?:CF|Carbon[- ]?Fiber))?|PC\s+Blend|TPU\s*95A|PLA(?:\+|\s*(?:Silk|Matte|Basic))?|PETG|ABS|ASA|TPU|PA(?:-CF)?|NYLON|PC|PVA|HIPS|RESIN|RESINA)`;
const colorPattern = String.raw`(?:preto|branco|vermelho|azul|verde|amarelo|laranja|roxo|rosa|cinza|marrom|black|white|red|blue|green|yellow|orange|purple|pink|gray|grey|brown)`;
const namedColors: Record<string, string> = {
  preto: "black", branco: "white", vermelho: "red", azul: "blue", verde: "green", amarelo: "yellow",
  laranja: "orange", roxo: "purple", rosa: "pink", cinza: "gray", marrom: "brown",
  black: "black", white: "white", red: "red", blue: "blue", green: "green", yellow: "yellow",
  orange: "orange", purple: "purple", pink: "pink", gray: "gray", grey: "grey", brown: "brown",
};

export function slicerColorPresentation(color: unknown) {
  if (typeof color !== "string" || !color.trim()) return null;
  const value = color.trim();
  const normalized = value.toLocaleLowerCase("pt-BR");
  if (/^#?(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) {
    const hex = `#${value.replace(/^#/, "")}`;
    return { label: hex, cssColor: hex };
  }
  return { label: value, cssColor: Object.hasOwn(namedColors, normalized) ? namedColors[normalized] : null };
}

const slicerPatterns: Array<[RegExp, string]> = [
  [/Anycubic\s+Slicer\s+Next/i, "Anycubic Slicer Next"],
  [/OrcaSlicer/i, "OrcaSlicer"],
  [/Bambu\s+Studio/i, "Bambu Studio"],
  [/PrusaSlicer/i, "PrusaSlicer"],
  [/Creality\s+Print/i, "Creality Print"],
  [/Elegoo\s*Slicer/i, "ElegooSlicer"],
  [/Flash\s*Print/i, "FlashPrint"],
  [/idea\s*Maker/i, "ideaMaker"],
  [/UltiMaker\s+Cura/i, "UltiMaker Cura"],
  [/\bCura\b/i, "Cura"],
];

function parseNumber(value: string) {
  const clean = value.replace(/\s/g, "");
  const comma = clean.lastIndexOf(",");
  const dot = clean.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimal = Math.max(comma, dot);
    return Number(`${clean.slice(0, decimal).replace(/[.,]/g, "")}.${clean.slice(decimal + 1)}`);
  }
  return Number(clean.replace(",", "."));
}

function findMeasurement(lines: string[], labels: string, units: string, normalize: (value: number, unit: string) => number, exclude?: RegExp) {
  const expression = new RegExp(`${numberPattern}\\s*(${units})\\b`, "i");
  const bracketedUnit = new RegExp(`\\[\\s*(${units})\\s*\\]\\s*[:=]\\s*${numberPattern}`, "i");
  const currencyPrefix = units.includes("r\\$") ? String.raw`(?:R\$|US\$|BRL|USD|\$)\s*` : "";
  const standalone = new RegExp(`^\\s*[:=\\-–]?\\s*${currencyPrefix}${numberPattern}\\s*(${units})\\b\\s*$`, "i");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (exclude?.test(line)) continue;
    const label = new RegExp(labels, "i").exec(line);
    if (!label) continue;
    const after = line.slice(label.index + label[0].length);
    const match = expression.exec(after) ?? expression.exec(line.slice(0, label.index)) ?? standalone.exec(lines[index + 1] ?? "");
    const bracketedMatch = match ? null : bracketedUnit.exec(after);
    const value = match ? parseNumber(match[1]) : bracketedMatch ? parseNumber(bracketedMatch[2]) : NaN;
    const unit = match?.[2] ?? bracketedMatch?.[1];
    if (unit && Number.isFinite(value) && value >= 0) return normalize(value, unit.toLowerCase());
  }
  return null;
}

function findCost(lines: string[]) {
  const labels = String.raw`(?:estimated\s+cost|material\s+cost|filament\s+cost|custo\s+(?:estimado|do\s+material)|\bcost\b)`;
  const expression = /(?:(?:R\$|US\$|BRL|USD|\$)\s*)?(\d[\d.,]*)(?:\s*(?:BRL|R\$|USD|\$))?/i;
  const standalone = new RegExp(`^\\s*[:=\\-–]?\\s*(?:(?:R\\$|US\\$|BRL|USD|\\$)\\s*)?${numberPattern}(?:\\s*(?:BRL|R\\$|USD|\\$))?\\s*$`, "i");
  for (let index = 0; index < lines.length; index++) {
    const label = new RegExp(labels, "i").exec(lines[index]);
    if (!label) continue;
    const sameLine = lines[index].slice(label.index + label[0].length);
    const match = expression.exec(sameLine) ?? expression.exec(lines[index].slice(0, label.index)) ?? standalone.exec(lines[index + 1] ?? "");
    if (!match) continue;
    const value = parseNumber(match[1]);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return null;
}

function findCount(lines: string[], labels: string) {
  const standalone = new RegExp(`^\\s*[:=\\-–]?\\s*${numberPattern}\\s*$`, "i");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const label = new RegExp(labels, "i").exec(line);
    if (!label) continue;
    const match = new RegExp(`${numberPattern}`, "i").exec(line.slice(label.index + label[0].length)) ?? standalone.exec(lines[index + 1] ?? "");
    if (match) {
      const value = parseNumber(match[1]);
      if (Number.isInteger(value) && value >= 0) return value;
    }
  }
  return null;
}

function findPrintHours(lines: string[]) {
  const labels = /(?:print(?:ing)?\s*time|tempo\s+(?:total\s+de\s+)?impress[aã]o|tempo\s+estimado|dura[cç][aã]o|^time)\s*[:=\-]?/i;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const label = labels.exec(line);
    if (!label) continue;
    const tail = line.slice(label.index + label[0].length).trim() ? line.slice(label.index + label[0].length) : lines[index + 1] ?? "";
    const clock = /\b(\d{1,3}):(\d{1,2})\b/.exec(tail);
    if (clock) return Number(clock[1]) + Number(clock[2]) / 60;
    const compound = /(?:(\d+(?:[.,]\d+)?)\s*d(?:ays?)?\s*)?(?:(\d+(?:[.,]\d+)?)\s*h(?:ours?)?(?:\s*(\d+(?:[.,]\d+)?)\s*m?(?:in(?:utes?)?)?)?|(?:(\d+(?:[.,]\d+)?)\s*m(?:in(?:utes?)?)?))/i.exec(tail);
    const seconds = /(?<![\d.,])(\d+(?:[.,]\d+)?)\s*s(?:ec(?:ond)?s?)?\b/i.exec(tail);
    if (!compound) {
      if (seconds) return parseNumber(seconds[1]) / 3600;
      continue;
    }
    const days = compound[1] ? parseNumber(compound[1]) : 0;
    const hours = compound[2] ? parseNumber(compound[2]) : 0;
    const minutes = compound[3] ? parseNumber(compound[3]) : compound[4] ? parseNumber(compound[4]) : 0;
    return days * 24 + hours + minutes / 60 + (seconds ? parseNumber(seconds[1]) / 3600 : 0);
  }
  return null;
}

function findCostCurrency(lines: string[]): "BRL" | "USD" | null {
  const labels = /(?:estimated\s+cost|material\s+cost|filament\s+cost|custo\s+(?:estimado|do\s+material)|\bcost\b)/i;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const label = labels.exec(line);
    if (!label) continue;
    const sameLine = line.slice(label.index + label[0].length).replace(/^\s*[:=\-]?\s*/, "");
    const value = sameLine || lines[index + 1] || "";
    if (/(?:R\$|BRL)\s*\d[\d.,]*|\d[\d.,]*\s*BRL\b|\d[\d.,]*\s*R\$/i.test(value)) return "BRL";
    if (/(?:USD\s*|US\$\s*)\d[\d.,]*|\d[\d.,]*\s*USD\b/i.test(value)) return "USD";
  }
  return null;
}

function parseOne(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const grams = (value: number, unit: string) => unit === "kg" ? value * 1000 : value;
  const length = findMeasurement(lines, String.raw`(?:(?:filament\s+)?(?:length|comprimento)(?:\s+(?:of\s+)?filament)?|filament\s+used)`, String.raw`(?:m|meters?|metros?|mm)`, (value, unit) => unit === "mm" ? value / 1000 : value);
  const cost = findCost(lines);
  const materials = [...new Set(lines.flatMap((line) => {
    const match = new RegExp(`(?<![a-z0-9])${materialPattern}(?![a-z0-9])`, "i").exec(line);
    return match ? [match[0].toUpperCase()] : [];
  }))];
  const filamentReadings = lines.flatMap((line) => {
    const row = /\b(?:filament|filamento)\s+#?(\d+)\s*[:=\-]?\s*(.*)$/i.exec(line);
    if (!row) return [];
    const mass = new RegExp(`${numberPattern}\\s*(kg|g|gr|grams?|gramas?)\\b`, "i").exec(row[2]);
    const lengthMatch = new RegExp(`${numberPattern}\\s*(mm|meters?|metros?|m)\\b`, "i").exec(row[2]);
    if (!mass && !lengthMatch) return [];
    const massAmount = mass ? parseNumber(mass[1]) : null;
    const gramsValue = massAmount === null ? null : mass![2].toLowerCase() === "kg" ? massAmount * 1000 : massAmount;
    const lengthAmount = lengthMatch ? parseNumber(lengthMatch[1]) : null;
    const lengthMeters = lengthAmount === null ? null : lengthMatch![2].toLowerCase() === "mm" ? lengthAmount / 1000 : lengthAmount;
    const material = new RegExp(`(?<![a-z0-9])${materialPattern}(?![a-z0-9])`, "i").exec(row[2])?.[0]?.toUpperCase() ?? null;
    const labeledColor = new RegExp(`(?:color|colour|cor)\\s*[:=]\\s*(#[0-9a-f]{3,8}|${colorPattern})`, "i").exec(row[2])?.[1];
    const namedColor = new RegExp(`\\b(${colorPattern})\\b`, "i").exec(row[2])?.[1];
    return (gramsValue === null || Number.isFinite(gramsValue)) && (lengthMeters === null || Number.isFinite(lengthMeters))
      ? [{ index: Number(row[1]), grams: gramsValue, lengthMeters, material, color: (labeledColor ?? namedColor ?? null)?.toLowerCase() ?? null }]
      : [];
  });
  const slicer = slicerPatterns.find(([pattern]) => pattern.test(text))?.[1] ?? null;
  return {
    slicer,
    modelGrams: findMeasurement(lines, massLabels.model, String.raw`(?:g|gr|grams?|gramas?|kg)`, grams),
    supportGrams: findMeasurement(lines, massLabels.support, String.raw`(?:g|gr|grams?|gramas?|kg)`, grams),
    totalGrams: findMeasurement(lines, massLabels.total, String.raw`(?:g|gr|grams?|gramas?|kg)`, grams),
    purgeGrams: findMeasurement(lines, String.raw`(?:purge|flush|purga|filamento\s+descartado)`, String.raw`(?:g|gr|grams?|gramas?|kg)`, grams, /(?:wipe|prime|purge|cleaning)\s*tower|torre\s+(?:de\s+)?(?:purga|limpeza)/i),
    wipeTowerGrams: findMeasurement(lines, String.raw`(?:(?:wipe|prime|purge|cleaning)\s*tower|torre\s+(?:de\s+)?(?:purga|limpeza))`, String.raw`(?:g|gr|grams?|gramas?|kg)`, grams),
    lengthMeters: length,
    printHours: findPrintHours(lines),
    filamentChanges: findCount(lines, String.raw`(?:filament\s+changes?|color\s+changes?|trocas?(?:\s+de\s+(?:filamento|cor))?|mudan[cç]as\s+de\s+(?:filamento|cor)|swaps?)\s*[:=\-]?`),
    estimatedCost: cost,
    estimatedCostCurrency: findCostCurrency(lines),
    materials,
    filamentReadings,
  };
}

export function parseSlicerOcrTexts(texts: string[]) {
  const parsed = texts.slice(0, 3).map(parseOne);
  const conflicts: string[] = [];
  const unique = <T extends number>(key: keyof ReturnType<typeof parseOne>, label: string) => {
    const values = parsed.map((item) => item[key]).filter((value): value is T => typeof value === "number");
    if (values.some((value) => Math.abs(value - values[0]) > 0.001)) {
      conflicts.push(label);
      return null;
    }
    return values[0] ?? null;
  };
  const totalGrams = unique<number>("totalGrams", "consumo total");
  const modelGrams = unique<number>("modelGrams", "peso do modelo");
  const supportGrams = unique<number>("supportGrams", "peso dos suportes");
  const purgeGrams = unique<number>("purgeGrams", "purga");
  const wipeTowerGrams = unique<number>("wipeTowerGrams", "torre de limpeza");
  const costCurrencies = [...new Set(parsed.map((item) => item.estimatedCostCurrency).filter((value): value is "BRL" | "USD" => value !== null))];
  if (costCurrencies.length > 1) conflicts.push("moeda do custo");
  const canDeriveMass = totalGrams === null && !conflicts.includes("consumo total") && modelGrams !== null && supportGrams !== null;
  const filaments = new Map<number, { index: number; grams: number | null; lengthMeters: number | null; material: string | null; color: string | null }>();
  const conflictingFilaments = new Set<number>();
  const conflictingFilamentLengths = new Set<number>();
  for (const reading of parsed.flatMap((item) => item.filamentReadings)) {
    const previous = filaments.get(reading.index);
    if (previous && ((previous.grams !== null && reading.grams !== null && Math.abs(previous.grams - reading.grams) > 0.001)
      || (previous.material && reading.material && previous.material !== reading.material)
      || (previous.color && reading.color && previous.color !== reading.color))) {
      conflictingFilaments.add(reading.index);
      filaments.delete(reading.index);
    } else if (!conflictingFilaments.has(reading.index)) {
      let lengthMeters = reading.lengthMeters ?? previous?.lengthMeters ?? null;
      if (previous?.lengthMeters !== null && previous?.lengthMeters !== undefined && reading.lengthMeters !== null
        && Math.abs(previous.lengthMeters - reading.lengthMeters) > 0.001) {
        conflictingFilamentLengths.add(reading.index);
        lengthMeters = null;
      }
      if (conflictingFilamentLengths.has(reading.index)) lengthMeters = null;
      filaments.set(reading.index, {
        ...reading, grams: reading.grams ?? previous?.grams ?? null, lengthMeters,
        material: reading.material ?? previous?.material ?? null, color: reading.color ?? previous?.color ?? null,
      });
    }
  }
  for (const index of conflictingFilaments) conflicts.push(`filamento ${index}`);
  for (const index of conflictingFilamentLengths) conflicts.push(`comprimento do filamento ${index}`);
  const slicers = [...new Set(parsed.map((item) => item.slicer).filter((value): value is string => value !== null))];
  const fullText = texts.slice(0, 3).map((text) => text.slice(0, 6000)).join("\n\n--- imagem ---\n\n").slice(0, 12_000);
  return {
    slicer: slicers.length === 1 ? slicers[0] : slicers.length ? "Diferentes" : "Não identificado",
    modelGrams,
    supportGrams,
    totalGrams,
    purgeGrams,
    wipeTowerGrams,
    filamentGrams: totalGrams ?? (canDeriveMass ? modelGrams! + supportGrams! : null),
    derivedMass: canDeriveMass,
    lengthMeters: unique<number>("lengthMeters", "comprimento do filamento"),
    printHours: unique<number>("printHours", "tempo de impressão"),
    filamentChanges: unique<number>("filamentChanges", "trocas de filamento"),
    estimatedCost: unique<number>("estimatedCost", "custo informado"),
    estimatedCostCurrency: costCurrencies.length === 1 ? costCurrencies[0] : null,
    materials: [...new Set(parsed.flatMap((item) => item.materials))],
    filaments: [...filaments.values()].sort((left, right) => left.index - right.index),
    conflicts: [...new Set(conflicts)],
    text: fullText,
  };
}

export function hasReviewableSlicerOcrData(extraction: ReturnType<typeof parseSlicerOcrTexts>) {
  return [extraction.modelGrams, extraction.supportGrams, extraction.totalGrams, extraction.purgeGrams,
    extraction.wipeTowerGrams, extraction.lengthMeters, extraction.printHours, extraction.filamentChanges,
    extraction.estimatedCost].some((value) => value !== null)
    || extraction.materials.length > 0 || extraction.filaments.length > 0 || extraction.conflicts.length > 0;
}

export function confirmSlicerOcrCostCurrency(
  extraction: ReturnType<typeof parseSlicerOcrTexts>,
  choice: unknown,
) {
  if (extraction.estimatedCost === null || extraction.estimatedCostCurrency !== null) return extraction;
  if (choice !== "BRL" && choice !== "USD" && choice !== "ignore") return null;
  const currency: "BRL" | "USD" | null = choice === "BRL" ? "BRL" : choice === "USD" ? "USD" : null;
  return {
    ...extraction,
    estimatedCost: currency === null ? null : extraction.estimatedCost,
    estimatedCostCurrency: currency,
    conflicts: extraction.conflicts.filter((conflict) => conflict !== "moeda do custo"),
  };
}
