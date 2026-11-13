export type VisualImageCandidate = {
  id: string;
  name: string;
  categorySlug: string;
  image: string;
  tags: string[];
  hash: string;
};
export type RankedVisualCandidate = VisualImageCandidate & { distance: number };
// shortcut: 64-bit dHash only matches similar previews; use Vision for different views of the same object.
const MAX_VISUAL_DISTANCE = 20;

export function differenceHash(pixels: ArrayLike<number>) {
  const bits: string[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = (y * 9 + x) * 4;
      const right = left + 4;
      const leftLuma = 0.299 * pixels[left] + 0.587 * pixels[left + 1] + 0.114 * pixels[left + 2];
      const rightLuma = 0.299 * pixels[right] + 0.587 * pixels[right + 1] + 0.114 * pixels[right + 2];
      bits.push(leftLuma > rightLuma ? "1" : "0");
    }
  }
  return Array.from({ length: 16 }, (_, index) => Number.parseInt(bits.slice(index * 4, index * 4 + 4).join(""), 2).toString(16)).join("");
}

function hammingDistance(left: string, right: string) {
  if (!/^[\da-f]{16}$/i.test(left) || !/^[\da-f]{16}$/i.test(right)) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let index = 0; index < 16; index++) {
    let bits = Number.parseInt(left[index], 16) ^ Number.parseInt(right[index], 16);
    while (bits) {
      distance += bits & 1;
      bits >>= 1;
    }
  }
  return distance;
}

export function rankVisualCandidates<T extends VisualImageCandidate>(hash: string, candidates: T[], category = "", limit = 5): Array<T & Pick<RankedVisualCandidate, "distance">> {
  if (!/^[\da-f]{16}$/i.test(hash)) return [];
  return candidates
    .filter((candidate) => !category || candidate.categorySlug === category)
    .map((candidate) => ({ ...candidate, distance: hammingDistance(hash, candidate.hash) }))
    .filter((candidate) => Number.isFinite(candidate.distance) && candidate.distance <= MAX_VISUAL_DISTANCE)
    .sort((left, right) => left.distance - right.distance || left.name.localeCompare(right.name, "pt-BR"))
    .slice(0, Math.max(0, limit));
}
