export const MAX_MODEL_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_PUBLIC_MODEL_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_THREE_MF_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;

export type ModelUnit = "mm" | "cm" | "m";
export type ModelSourceUnit = ModelUnit | "um" | "in" | "ft";
export type ModelFormat = "stl" | "obj" | "3mf" | "glb" | "gltf";
export type ModelDimensions = { x: number; y: number; z: number };
export type ThreeMfColorData = { componentPaintColors: string[][]; componentTriangleColors: string[][][]; componentPartColors: string[][]; faceColors: Record<number, string[]>; objectColors: string[]; namedColors: Record<string, string>; palette: string[]; paintPaletteColors: string[] };

export function getModelColorMatchedComponentIds(components: Array<{ id: string; colors: string[] }>, color: string | null) {
  return color ? components.filter((component) => component.colors.includes(color)).map((component) => component.id) : [];
}

export function exceedsThreeMfExpansionLimit(expandedBytes: number, nextEntryBytes: number) {
  return nextEntryBytes > MAX_THREE_MF_UNCOMPRESSED_BYTES - expandedBytes;
}

export function getModelFormat(fileName: string): ModelFormat | null {
  const extension = fileName.toLowerCase().match(/\.([^.]+)$/)?.[1];
  return extension === "stl" || extension === "obj" || extension === "3mf" || extension === "glb" || extension === "gltf"
    ? extension
    : null;
}

export function validateModelFile(file: Pick<File, "name" | "size">): string | null {
  if (!getModelFormat(file.name)) return "Escolha um arquivo STL, OBJ, 3MF, GLB ou GLTF.";
  if (file.size > MAX_MODEL_FILE_BYTES) return "O arquivo precisa ter até 20 MB.";
  if (file.size === 0) return "O arquivo está vazio.";
  return null;
}

export function validateModelFiles(files: Array<Pick<File, "name" | "size">>, maxBytes = MAX_MODEL_FILE_BYTES): string | null {
  const models = files.filter((file) => getModelFormat(file.name));
  if (models.length !== 1) return "Selecione um modelo principal por vez.";
  const companions = new Set(["mtl", "bin", "png", "jpg", "jpeg", "webp"]);
  if (files.some((file) => !getModelFormat(file.name) && !companions.has(file.name.toLowerCase().match(/\.([^.]+)$/)?.[1] ?? ""))) {
    return "Um dos arquivos associados não é compatível.";
  }
  if (files.some((file) => file.size === 0)) return "Um dos arquivos selecionados está vazio.";
  if (files.reduce((total, file) => total + file.size, 0) > maxBytes) return `O conjunto de arquivos precisa ter até ${Math.round(maxBytes / 1024 / 1024)} MB.`;
  return null;
}

export function parseThreeMfUnit(modelXml: string): ModelSourceUnit | null {
  const value = modelXml.match(/<model\b[^>]*\bunit=["']([^"']+)["']/i)?.[1]?.toLowerCase();
  if (!value) return "mm";
  const units: Record<string, ModelSourceUnit> = {
    micron: "um",
    millimeter: "mm",
    centimeter: "cm",
    meter: "m",
    inch: "in",
    foot: "ft",
  };
  return units[value] ?? null;
}

export async function readThreeMfUnit(data: Uint8Array): Promise<ModelSourceUnit | null> {
  return (await readThreeMfPackage(data)).unit;
}

export async function readThreeMfPackage(data: Uint8Array) {
  const { unzipSync } = await import("fflate");
  let expandedBytes = 0;
  const archive = unzipSync(data, { filter: (entry) => {
    if (exceedsThreeMfExpansionLimit(expandedBytes, entry.originalSize)) {
      throw new Error("O pacote 3MF ultrapassa o limite de extração de 100 MB.");
    }
    expandedBytes += entry.originalSize;
    return true;
  } });
  const modelPart = Object.entries(archive).find(([name]) => /^3d\/[^/]+\.model$/i.test(name))?.[1];
  if (!modelPart) throw new Error("O pacote 3MF não contém o modelo principal.");
  const modelXml = new TextDecoder().decode(modelPart);
  const projectSettings = Object.entries(archive).find(([name]) => /^metadata\/project_settings\.config$/i.test(name))?.[1];
  const modelSettings = Object.entries(archive).find(([name]) => /^metadata\/model_settings\.config$/i.test(name))?.[1];
  const colors = parseThreeMfColors(
    modelXml,
    modelSettings ? new TextDecoder().decode(modelSettings) : "",
    projectSettings ? new TextDecoder().decode(projectSettings) : "",
    Object.entries(archive).filter(([name]) => /^3d\/.*\.model$/i.test(name)).map(([path, contents]) => ({ path, xml: new TextDecoder().decode(contents) })),
  );
  return {
    unit: parseThreeMfUnit(modelXml),
    colors,
  };
}

export function parseThreeMfColors(modelXml: string, modelSettingsXml: string, projectSettingsText: string, modelParts: Array<{ path: string; xml: string }> = []): ThreeMfColorData {
  let palette: string[] = [];
  try {
    const settings = JSON.parse(projectSettingsText) as { filament_colour?: unknown };
    const colors = Array.isArray(settings.filament_colour) ? settings.filament_colour : typeof settings.filament_colour === "string" ? JSON.parse(settings.filament_colour) : [];
    palette = colors.filter((color: unknown): color is string => typeof color === "string" && /^#?[\da-f]{6}$/i.test(color)).map((color: string) => color.replace(/^#/, "").toLowerCase());
  } catch { /* Non-Bambu 3MF files have no slicer palette. */ }

  const filamentColor = (extruder: string | undefined) => palette[Number(extruder) - 1];
  const objects = new Map<string, { name: string; color: string }>();
  const namedColors: Record<string, string> = {};
  const faceColors: Record<number, string[]> = {};
  const partColors = new Map<string, string[]>();
  const paintColors = new Map<string, { triangles: string[]; counts: Map<string, number> }>();
  const decodePaintStates = (value: string) => {
    if (!/^[\da-f]+$/i.test(value) || value.length > 2048) return [];
    const nibbles = [...value].flatMap((digit, index) => index % 2 === 0 && index + 1 < value.length
      ? [parseInt(value[index + 1], 16), parseInt(digit, 16)]
      : index % 2 === 1 ? [] : [parseInt(digit, 16)]);
    const states: number[] = [];
    let cursor = 0;
    let nodes = 0;
    const readTree = (depth: number): boolean => {
      if (depth > 64 || ++nodes > 4096 || cursor >= nibbles.length) return false;
      const code = nibbles[cursor++];
      const splits = code & 3;
      if (splits) {
        for (let child = 0; child <= splits; child++) if (!readTree(depth + 1)) return false;
        return true;
      }
      let state = code >> 2;
      if (state === 3) {
        let continuation = 0;
        let next = nibbles[cursor++];
        while (next === 15 && continuation < 128 && cursor < nibbles.length) {
          continuation += 15;
          next = nibbles[cursor++];
        }
        if (next === undefined) return false;
        state += continuation + next;
      }
      if (state > 0) states.push(state);
      return true;
    };
    return readTree(0) ? states : [];
  };
  for (const match of modelSettingsXml.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/gi)) {
    const id = match[1].match(/\bid=["']([^"']+)["']/i)?.[1];
    const body = match[2];
    const metadata = [...body.matchAll(/<metadata\b([^>]*)\/?\s*>/gi)].map((entry) => entry[1]);
    const valueFor = (entries: string[], key: string) => entries.find((entry) => entry.match(/\bkey=["']([^"']+)["']/i)?.[1] === key)?.match(/\bvalue=["']([^"']*)["']/i)?.[1];
    const color = filamentColor(valueFor(metadata, "extruder"));
    const name = valueFor(metadata, "name");
    if (id && color) objects.set(id, { name: name ?? "", color });
    if (name && color) namedColors[name] = color;
    const colorsForParts: string[] = [];
    for (const part of body.matchAll(/<part\b[^>]*>([\s\S]*?)<\/part>/gi)) {
      const partMetadata = [...part[1].matchAll(/<metadata\b([^>]*)\/?\s*>/gi)].map((entry) => entry[1]);
      const partName = valueFor(partMetadata, "name");
      const partColor = filamentColor(valueFor(partMetadata, "extruder")) ?? color;
      colorsForParts.push(partColor ?? "");
      if (partName && partColor) namedColors[partName] = partColor;
      const faceCount = part[1].match(/<(?:mesh_stat|metadata)\b[^>]*\bface_count=["'](\d+)["']/i)?.[1];
      if (faceCount && partColor) (faceColors[Number(faceCount)] ??= []).push(partColor);
    }
    if (id && colorsForParts.length) partColors.set(id, colorsForParts);
  }
  const objectColors = [...modelXml.matchAll(/<item\b[^>]*\bobjectid=["']([^"']+)["'][^>]*\/?\s*>/gi)]
    .map((item) => objects.get(item[1])?.color ?? "");
  const componentPartColors = [...modelXml.matchAll(/<item\b[^>]*\bobjectid=["']([^"']+)["'][^>]*\/?\s*>/gi)]
    .map((item) => partColors.get(item[1]) ?? []);
  for (const { path, xml } of modelParts) {
    for (const object of xml.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/gi)) {
      const id = object[1].match(/\bid=["']([^"']+)["']/i)?.[1];
      const counts = new Map<string, number>();
      const triangles: string[] = [];
      for (const triangle of object[2].matchAll(/<triangle\b([^>]*)\/?\s*>/gi)) {
        const code = triangle[1].match(/\bpaint_color=["']([^"']+)["']/i)?.[1];
        const states = code ? decodePaintStates(code) : [];
        const colors = [...new Set(states.map((state) => palette[state - 1]).filter((value): value is string => Boolean(value)))];
        // shortcut: mixed selector states within one triangle are listed but not rendered; interpolate them when vertex paint data is available.
        const color = colors.length === 1 ? colors[0] : "";
        triangles.push(color);
        for (const value of colors) counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      if (id && counts.size) paintColors.set(`${path.toLowerCase()}#${id}`, { triangles, counts });
    }
  }
  const rootObjects = new Map([...modelXml.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/gi)]
    .map((object) => [object[1].match(/\bid=["']([^"']+)["']/i)?.[1] ?? "", object[2]]));
  const componentPaintColors = [...modelXml.matchAll(/<item\b[^>]*\bobjectid=["']([^"']+)["'][^>]*\/?\s*>/gi)].map((item) => {
    const body = rootObjects.get(item[1]) ?? "";
    return [...body.matchAll(/<component\b([^>]*)\/?\s*>/gi)].map((component) => {
      const path = component[1].match(/(?:p:)?path=["']([^"']+)["']/i)?.[1]?.replace(/^\//, "").toLowerCase() ?? "3d/3dmodel.model";
      const id = component[1].match(/\bobjectid=["']([^"']+)["']/i)?.[1];
      const counts = path && id ? paintColors.get(`${path}#${id}`)?.counts : undefined;
      return counts?.size === 1 ? [...counts.keys()][0] : "";
    });
  });
  const componentTriangleColors = [...modelXml.matchAll(/<item\b[^>]*\bobjectid=["']([^"']+)[^>]*\/?\s*>/gi)].map((item) => {
    const body = rootObjects.get(item[1]) ?? "";
    return [...body.matchAll(/<component\b([^>]*)\/?\s*>/gi)].map((component) => {
      const path = component[1].match(/(?:p:)?path=["']([^"']+)["']/i)?.[1]?.replace(/^\//, "").toLowerCase() ?? "3d/3dmodel.model";
      const id = component[1].match(/\bobjectid=["']([^"']+)["']/i)?.[1];
      return path && id ? paintColors.get(`${path}#${id}`)?.triangles ?? [] : [];
    });
  });
  const paintPaletteColors = [...new Set([...paintColors.values()].flatMap(({ counts }) => [...counts.keys()]))];
  return { componentPaintColors, componentTriangleColors, componentPartColors, faceColors, objectColors, namedColors, palette: [...new Set(palette)], paintPaletteColors };
}

export function modelUnitToMeters(unit: ModelSourceUnit) {
  const metersPerUnit: Record<ModelSourceUnit, number> = { um: 0.000001, mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048 };
  return metersPerUnit[unit];
}

export function formatModelDimensions(
  dimensions: ModelDimensions,
  sourceUnit: ModelSourceUnit,
  displayUnit: ModelUnit,
  scale: number,
): ModelDimensions {
  const factor = (modelUnitToMeters(sourceUnit) / modelUnitToMeters(displayUnit)) * scale;
  const round = (value: number) => Math.round(value * factor * 100) / 100;
  return { x: round(dimensions.x), y: round(dimensions.y), z: round(dimensions.z) };
}
