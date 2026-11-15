import type { SlicerFilamentRow } from "./google-vision-ocr";

type FilamentColor = { index: number; color: string | null };

export function mergeSlicerFilamentColors<T extends FilamentColor>(filaments: T[], samples: Array<{ index: number; color: string }>) {
  const colors = new Map<number, string>();
  for (const sample of samples) if (!colors.has(sample.index)) colors.set(sample.index, sample.color);
  return filaments.map((filament) => ({ ...filament, color: filament.color ?? colors.get(filament.index) ?? null }));
}

export function sampleSlicerFilamentColors(image: { width: number; height: number; data: Uint8ClampedArray }, rows: SlicerFilamentRow[]) {
  const colors: Array<{ index: number; color: string }> = [];
  if (image.width < 1 || image.height < 1 || image.data.length < image.width * image.height * 4) return colors;

  for (const row of rows) {
    // shortcut: reads only the Anycubic color chip left of each OCR row; add slicer-specific geometry when another UI is validated.
    const rowHeight = row.height * image.height;
    if (!Number.isFinite(rowHeight) || rowHeight < 2 || row.x < 0 || row.x > 1 || row.y < 0 || row.y > 1) continue;
    const centerX = Math.round(row.x * image.width - rowHeight * 0.9);
    const centerY = Math.round(row.y * image.height);
    const radius = Math.max(1, Math.round(rowHeight * 0.12));
    const sums = [0, 0, 0];
    let samples = 0;
    for (let y = centerY - radius; y <= centerY + radius; y++) {
      for (let x = centerX - radius; x <= centerX + radius; x++) {
        if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
        const offset = (y * image.width + x) * 4;
        for (let channel = 0; channel < 3; channel++) sums[channel] += image.data[offset + channel];
        samples++;
      }
    }
    if (!samples) continue;
    const rgb = sums.map((sum) => Math.round(sum / samples));
    const saturation = (Math.max(...rgb) - Math.min(...rgb)) / Math.max(1, Math.max(...rgb));
    if (saturation < 0.12 && Math.max(...rgb) < 235) continue;
    colors.push({ index: row.index, color: `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}` });
  }
  return colors;
}
