import gitModelAssets from "./git-model-assets.json";
import { modelShowcase } from "./model-showcase";

const catalogAssets = new Set(modelShowcase.flatMap((model) => [model.filePath, ...(model.downloads ?? []).map(({ filePath }) => filePath)]));

export function getUnregisteredGitModelAssets(registeredAssets: string[] = [], assets = gitModelAssets as string[]) {
  const registered = new Set([...catalogAssets, ...registeredAssets]);
  return assets.filter((assetPath) => !registered.has(assetPath));
}
