import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const models = JSON.parse(await readFile(path.join(root, "src/lib/model-showcase-data.json"), "utf8"));
const index = [];

for (const model of models) {
  const imagePath = path.join(root, "public", model.image.replace(/^\//, ""));
  const { data } = await sharp(imagePath).resize(9, 8, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const bits = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) bits.push(data[y * 9 + x] > data[y * 9 + x + 1] ? "1" : "0");
  }
  const hash = Array.from({ length: 16 }, (_, position) => Number.parseInt(bits.slice(position * 4, position * 4 + 4).join(""), 2).toString(16)).join("");
  index.push({ id: model.id, name: model.name, categorySlug: model.categorySlug, image: model.image, tags: model.tags, hash });
}

if (index.length !== models.length || index.some(({ hash }) => !/^[\da-f]{16}$/.test(hash))) throw new Error("Índice visual incompleto.");
const serialized = `[\n${index.map((model) => `  ${JSON.stringify(model)}`).join(",\n")}\n]\n`;
await writeFile(path.join(root, "src/lib/model-showcase-visual-index.json"), serialized);
process.stdout.write(`Índice visual gerado para ${index.length} modelos.\n`);
