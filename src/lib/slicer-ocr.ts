const numberPattern = String.raw`(\d[\d.,]*)`;
const massLabels = {
  model: String.raw`(?:model(?:\s+weight)?|modelo(?:\s+(?:3d|peso))?)`,
  support: String.raw`(?:supports?|suportes?)`,
  total: String.raw`(?:filament\s+(?:used|usage|total)|material\s+(?:used|usage|total)|(?:consumo|peso)\s+total|total(?:\s+(?:filament|material|weight|consumption))?)`,
};
const materialPattern = String.raw`(?:PLA(?:\+|\s*Silk|\s*Matte)?|PETG(?:-CF)?|ABS|ASA|TPU|PA(?:-CF)?|NYLON|PC|PVA|HIPS|RESIN|RESINA)`;
const colorPattern = String.raw`(?:preto|branco|vermelho|azul|verde|amarelo|laranja|roxo|rosa|cinza|marrom|black|white|red|blue|green|yellow|orange|purple|pink|gray|grey|brown)`;

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

function findMeasurement(lines: string[], labels: string, units: string, normalize: (value: number, unit: string) => number) {
  for (const line of lines) {
    const label = new RegExp(labels, "i").exec(line);
    if (!label) continue;
    const after = line.slice(label.index + label[0].length);
    const expression = new RegExp(`${numberPattern}\\s*(${units})\\b`, "i");
    const match = expression.exec(after) ?? expression.exec(line.slice(0, label.index));
    if (!match) continue;
    const value = parseNumber(match[1]);
    if (Number.isFinite(value) && value >= 0) return normalize(value, match[2].toLowerCase());
  }
  return null;
}

function findCount(lines: string[], labels: string) {
  for (const line of lines) {
    const label = new RegExp(labels, "i").exec(line);
    if (!label) continue;
    const match = new RegExp(`${numberPattern}`, "i").exec(line.slice(label.index + label[0].length));
    if (match) {
      const value = parseNumber(match[1]);
      if (Number.isInteger(value) && value >= 0) return value;
    }
  }
  return null;
}

function findPrintHours(lines: string[]) {
  const labels = /(?:print(?:ing)?\s*time|tempo\s+(?:total\s+de\s+)?impress[aã]o|tempo\s+estimado|dura[cç][aã]o|^time)\s*[:=\-]?/i;
  for (const line of lines) {
    const label = labels.exec(line);
    if (!label) continue;
    const tail = line.slice(label.index + label[0].length);
    const clock = /\b(\d{1,3}):(\d{1,2})\b/.exec(tail);
    if (clock) return Number(clock[1]) + Number(clock[2]) / 60;
    const compound = /(?:(\d+(?:[.,]\d+)?)\s*d(?:ays?)?\s*)?(?:(\d+(?:[.,]\d+)?)\s*h(?:ours?)?(?:\s*(\d+(?:[.,]\d+)?)\s*m?(?:in(?:utes?)?)?)?|(?:(\d+(?:[.,]\d+)?)\s*m(?:in(?:utes?)?)?))/i.exec(tail);
    if (!compound) continue;
    const days = compound[1] ? parseNumber(compound[1]) : 0;
    const hours = compound[2] ? parseNumber(compound[2]) : 0;
    const minutes = compound[3] ? parseNumber(compound[3]) : compound[4] ? parseNumber(compound[4]) : 0;
    return days * 24 + hours + minutes / 60;
  }
  return null;
}

function parseOne(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const grams = (value: number, unit: string) => unit === "kg" ? value * 1000 : value;
  const length = findMeasurement(lines, String.raw`(?:filament\s+)?(?:length|comprimento)(?:\s+(?:of\s+)?filament)?`, String.raw`(?:m|meters?|metros?|mm)`, (value, unit) => unit === "mm" ? value / 1000 : value);
  const cost = findMeasurement(lines, String.raw`(?:estimated\s+cost|material\s+cost|filament\s+cost|custo\s+(?:estimado|do\s+material)|\bcost\b)`, String.raw`(?:brl|r\$|usd|\$)?`, (value) => value);
  const materialLines = lines.filter((line) => /\b(?:PLA|PETG|ABS|ASA|TPU|NYLON|PA(?:-CF)?|PC|PVA|HIPS|RESIN|RESINA)\b/i.test(line));
  const materials = [...new Set(materialLines.map((line) => line.match(new RegExp(`\\b${materialPattern}\\b`, "i"))?.[0]?.toUpperCase()).filter((value): value is string => Boolean(value)))];
  const filamentReadings = lines.flatMap((line) => {
    const row = /\b(?:filament|filamento)\s+#?(\d+)\s*[:=\-]?\s*(.*)$/i.exec(line);
    if (!row) return [];
    const mass = new RegExp(`${numberPattern}\\s*(kg|g|gr|grams?|gramas?)\\b`, "i").exec(row[2]);
    if (!mass) return [];
    const amount = parseNumber(mass[1]);
    const gramsValue = mass[2].toLowerCase() === "kg" ? amount * 1000 : amount;
    const material = new RegExp(`\\b${materialPattern}\\b`, "i").exec(row[2])?.[0]?.toUpperCase() ?? null;
    const labeledColor = new RegExp(`(?:color|colour|cor)\\s*[:=]\\s*(#[0-9a-f]{3,8}|${colorPattern})`, "i").exec(row[2])?.[1];
    const namedColor = new RegExp(`\\b(${colorPattern})\\b`, "i").exec(row[2])?.[1];
    return Number.isFinite(gramsValue) ? [{ index: Number(row[1]), grams: gramsValue, material, color: (labeledColor ?? namedColor ?? null)?.toLowerCase() ?? null }] : [];
  });
  const slicer = /Anycubic\s+Slicer\s+Next|OrcaSlicer|Bambu\s+Studio|PrusaSlicer|Cura/i.exec(text)?.[0] ?? null;
  return {
    slicer,
    modelGrams: findMeasurement(lines, massLabels.model, String.raw`(?:g|gr|grams?|gramas?|kg)`, grams),
    supportGrams: findMeasurement(lines, massLabels.support, String.raw`(?:g|gr|grams?|gramas?|kg)`, grams),
    totalGrams: findMeasurement(lines, massLabels.total, String.raw`(?:g|gr|grams?|gramas?|kg)`, grams),
    lengthMeters: length,
    printHours: findPrintHours(lines),
    filamentChanges: findCount(lines, String.raw`(?:filament\s+changes?|color\s+changes?|trocas?(?:\s+de\s+(?:filamento|cor))?|mudan[cç]as\s+de\s+(?:filamento|cor)|swaps?)\s*[:=\-]?`),
    estimatedCost: cost,
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
  const canDeriveMass = totalGrams === null && !conflicts.includes("consumo total") && modelGrams !== null && supportGrams !== null;
  const filaments = new Map<number, { index: number; grams: number; material: string | null; color: string | null }>();
  const conflictingFilaments = new Set<number>();
  for (const reading of parsed.flatMap((item) => item.filamentReadings)) {
    const previous = filaments.get(reading.index);
    if (previous && (Math.abs(previous.grams - reading.grams) > 0.001
      || (previous.material && reading.material && previous.material !== reading.material)
      || (previous.color && reading.color && previous.color !== reading.color))) {
      conflictingFilaments.add(reading.index);
      filaments.delete(reading.index);
    } else if (!conflictingFilaments.has(reading.index)) {
      filaments.set(reading.index, { ...reading, material: reading.material ?? previous?.material ?? null, color: reading.color ?? previous?.color ?? null });
    }
  }
  for (const index of conflictingFilaments) conflicts.push(`filamento ${index}`);
  const slicers = [...new Set(parsed.map((item) => item.slicer).filter((value): value is string => value !== null))];
  const fullText = texts.slice(0, 3).map((text) => text.slice(0, 6000)).join("\n\n--- imagem ---\n\n").slice(0, 12_000);
  return {
    slicer: slicers.length === 1 ? slicers[0] : slicers.length ? "Diferentes" : "Não identificado",
    modelGrams,
    supportGrams,
    totalGrams,
    filamentGrams: totalGrams ?? (canDeriveMass ? modelGrams! + supportGrams! : null),
    derivedMass: canDeriveMass,
    lengthMeters: unique<number>("lengthMeters", "comprimento do filamento"),
    printHours: unique<number>("printHours", "tempo de impressão"),
    filamentChanges: unique<number>("filamentChanges", "trocas de filamento"),
    estimatedCost: unique<number>("estimatedCost", "custo informado"),
    materials: [...new Set(parsed.flatMap((item) => item.materials))],
    filaments: [...filaments.values()].sort((left, right) => left.index - right.index),
    conflicts: [...new Set(conflicts)],
    text: fullText,
  };
}
