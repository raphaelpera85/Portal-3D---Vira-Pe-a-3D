import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ModelShowcase } from "@/components/model-showcase";
import { filterModelShowcase, modelShowcase, modelShowcaseCategories } from "@/lib/model-showcase";
import { getSiteUrl } from "@/lib/site-url";
import { addPublishedCreatorPreviews, loadPublishedCreatorModels } from "@/lib/creator-models.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Modelos 3D | ViraPeça 3D",
  description: "Explore modelos 3D por categoria e tags ou encontre um modelo usando uma imagem.",
  ...(getSiteUrl() ? { alternates: { canonical: "/modelos" } } : {}),
};

export default async function ModelsPage({ searchParams }: { searchParams: Promise<{ q?: string; categoria?: string; pagina?: string }> }) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const allowedCategories = new Set<string>(modelShowcaseCategories.map(({ slug }) => slug));
  const category = typeof params.categoria === "string" && allowedCategories.has(params.categoria) ? params.categoria : "";
  const creatorModels = await addPublishedCreatorPreviews(await loadPublishedCreatorModels());
  const additionalVisualIndex = creatorModels.flatMap((model) => model.visualHash && model.image !== "/modelos/modelo-sem-imagem.svg"
    ? [{ id: model.id, name: model.name, categorySlug: model.categorySlug, image: model.image, tags: model.tags, hash: model.visualHash }]
    : []);
  const filtered = filterModelShowcase([...modelShowcase, ...creatorModels], query, category);
  const pages = Math.ceil(filtered.length / 24);
  const requestedPage = typeof params.pagina === "string" && /^\d+$/.test(params.pagina) ? Number(params.pagina) : 1;
  const page = pages ? Math.max(1, Math.min(requestedPage, pages)) : 1;
  const visibleModels = filtered.slice((page - 1) * 24, page * 24);

  return <><SiteHeader /><main id="main-content" tabIndex={-1} className="model-gallery-page"><ModelShowcase models={visibleModels} query={query} category={category} page={page} pages={pages} additionalVisualIndex={additionalVisualIndex} /></main><footer className="site-footer"><div className="shell footer-inner"><a className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></a><p>Sua ideia vira realidade.</p><span>© 2026 ViraPeça 3D</span></div></footer></>;
}
