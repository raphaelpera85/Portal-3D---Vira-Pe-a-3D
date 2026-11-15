import { modelShowcaseCategories } from "./model-showcase";

export type CreatorModelSubmissionInput = {
  name: string;
  categorySlug: string;
  assetPath: string;
  tags: string[];
  creatorName: string;
  sourceUrl: string | null;
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

export function validateCreatorModelSubmission(values: Record<string, unknown>, availableAssets: string[]): CreatorModelSubmissionInput | null {
  const name = text(values.name);
  const categorySlug = text(values.categorySlug);
  const assetPath = text(values.assetPath);
  const tags = text(values.tags).split(",").map((tag) => tag.trim()).filter(Boolean);
  const creatorName = text(values.creatorName);
  const rawSourceUrl = text(values.sourceUrl);
  let sourceUrl: string | null = null;
  try {
    if (rawSourceUrl) {
      const url = new URL(rawSourceUrl);
      if (url.protocol !== "https:" || rawSourceUrl.length > 2048) return null;
      sourceUrl = url.toString();
    }
  } catch {
    return null;
  }
  const normalizedTags = tags.map((tag) => tag.toLocaleLowerCase("pt-BR"));
  if (name.length < 2 || name.length > 120 || !modelShowcaseCategories.some((item) => item.slug === categorySlug)
    || !availableAssets.includes(assetPath) || creatorName.length < 2 || creatorName.length > 100
    || values.rightsConfirmed !== "on" || tags.length < 1 || tags.length > 12
    || tags.some((tag) => tag.length > 32 || /[\u0000-\u001f\u007f]/.test(tag))
    || new Set(normalizedTags).size !== normalizedTags.length) return null;
  return { name, categorySlug, assetPath, tags, creatorName, sourceUrl };
}
