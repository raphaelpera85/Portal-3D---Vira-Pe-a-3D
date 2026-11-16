import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ModelDetailContent } from "@/components/model-detail-content";
import { ModelRecommendations } from "@/components/model-showcase";
import { SiteHeader } from "@/components/site-header";
import { getModelAssetUrl, getRecommendedModels, getShowcaseFileLabel, getShowcaseModel, getShowcaseModelIds, modelShowcase } from "@/lib/model-showcase";
import { getSiteUrl } from "@/lib/site-url";
import { loadPublishedCreatorModel } from "@/lib/creator-models.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPaginationRedirectPage, maxPageNumber, parsePageNumber } from "@/lib/pagination";

type ModelPageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ perfil?: string; perfilPagina?: string }> };
export const dynamic = "force-dynamic";
const profilePageSize = 24;

export function generateStaticParams() {
  return modelShowcase.map(({ id }) => ({ id }));
}

export async function generateMetadata({ params }: ModelPageProps): Promise<Metadata> {
  const { id } = await params;
  const model = getShowcaseModel(id) ?? await loadPublishedCreatorModel(id);
  const format = model ? getShowcaseFileLabel(model.filePath) : "3D";
  return model ? {
    title: `${model.name} | Modelos 3D | ViraPeça 3D`,
    description: `Visualize o modelo 3D ${model.name} e baixe o arquivo ${format} original.`,
    ...(getSiteUrl() ? {
      alternates: { canonical: `/modelos/${encodeURIComponent(model.id)}` },
      openGraph: {
        title: `${model.name} | Modelo 3D ViraPeça 3D`,
        description: `Visualize ${model.name} em 3D e baixe o arquivo ${format} original.`,
        url: `/modelos/${encodeURIComponent(model.id)}`,
        type: "website" as const,
        images: [model.image],
      },
      twitter: {
        card: "summary_large_image" as const,
        title: `${model.name} | Modelo 3D ViraPeça 3D`,
        description: `Visualize ${model.name} em 3D e baixe o arquivo ${format} original.`,
        images: [model.image],
      },
    } : {}),
  } : { title: "Modelo não encontrado | ViraPeça 3D", robots: { index: false, follow: false } };
}

export default async function ModelPage({ params, searchParams }: ModelPageProps) {
  const [{ id }, { perfil, perfilPagina }] = await Promise.all([params, searchParams]);
  const model = getShowcaseModel(id) ?? await loadPublishedCreatorModel(id);
  if (!model) notFound();
  if (model.id !== id) redirect(`/modelos/${encodeURIComponent(model.id)}`);
  const previewFilePath = model.previewFilePath ?? model.filePath;
  const previewUrl = model.previewFilePath ? getModelAssetUrl(model.previewFilePath) : model.assetUrl ?? getModelAssetUrl(model.filePath);
  const downloadUrl = model.downloadUrl ?? getModelAssetUrl(model.filePath) ?? model.assetUrl ?? previewUrl;
  const downloadVariants = (model.downloads ?? []).flatMap(({ label, filePath }) => {
    const url = getModelAssetUrl(filePath);
    return url ? [{ label, filePath, url }] : [];
  });
  const previewVersions = [
    ...(previewUrl ? [{ label: model.previewFilePath ? "Prévia otimizada" : "Arquivo principal", url: previewUrl, filePath: previewFilePath }] : []),
    ...downloadVariants.map(({ label, filePath, url }) => ({ label, filePath, url })),
  ];
  const siteUrl = getSiteUrl();
  const modelUrl = siteUrl ? new URL(`/modelos/${encodeURIComponent(model.id)}`, siteUrl).toString() : null;
  const structuredData = modelUrl ? {
    "@context": "https://schema.org",
    "@type": "3DModel",
    name: model.name,
    description: `Modelo 3D ${model.name} para visualização e download em ${getShowcaseFileLabel(model.filePath)}.`,
    category: model.category,
    keywords: model.tags,
    url: modelUrl,
    image: siteUrl ? new URL(model.image, siteUrl).toString() : undefined,
    ...(downloadUrl ? { encoding: { "@type": "MediaObject", name: model.filePath.split("/").at(-1), contentUrl: downloadUrl, encodingFormat: model.filePath.toLowerCase().endsWith(".zip") ? "application/zip" : "model/3mf" } } : {}),
  } : null;
  const recommendations = getRecommendedModels(model);
  const supabase = await createSupabaseServerClient();
  const { data: auth } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const requestedProfilePage = parsePageNumber(perfilPagina) ?? 1;
  const profileModelIds = getShowcaseModelIds(model.id).length ? getShowcaseModelIds(model.id) : [model.id];
  const [profileResult, makerRoleResult] = await Promise.all([
    supabase ? supabase.from("visible_model_print_profiles")
      .select("id, profile_name, profile_type, slicer, printer_snapshot, material_snapshot, nozzle_snapshot, layer_height_mm, infill_percent, wall_count, supports, orientation, scale_percent, quantity, slicer_metrics, created_at, sharing_scope, review_status, review_note, is_owner", { count: "exact" })
      .in("model_slug", profileModelIds).order("created_at", { ascending: false }).order("id", { ascending: false })
      .range((requestedProfilePage - 1) * profilePageSize, requestedProfilePage * profilePageSize - 1) : Promise.resolve(null),
    supabase && auth.user ? supabase.from("user_roles").select("role").eq("user_id", auth.user.id).eq("role", "maker").maybeSingle() : Promise.resolve(null),
  ]);
  const profilePages = Math.max(1, Math.min(maxPageNumber, Math.ceil((profileResult?.count ?? 0) / profilePageSize)));
  const resultNotices = ["salvo", "enviado", "copiado", "retirado", "excluido", "erro"];
  const profilePageHref = (page: number) => {
    const query = new URLSearchParams();
    if (resultNotices.includes(perfil ?? "")) query.set("perfil", perfil!);
    if (page > 1) query.set("perfilPagina", String(page));
    return `/modelos/${encodeURIComponent(model.id)}${query.size ? `?${query.toString()}` : ""}`;
  };
  const profileRedirectPage = getPaginationRedirectPage(requestedProfilePage, profilePages);
  if (profileResult && !profileResult.error && profileRedirectPage !== null) redirect(profilePageHref(profileRedirectPage));
  const profiles = (profileResult?.data ?? []).map(({ is_owner, ...profile }) => ({ ...profile, isOwner: is_owner })) as import("@/components/model-print-profile-manager").ModelPrintProfileRecord[];
  const notice = profileResult?.error ? "erro" : resultNotices.includes(perfil ?? "") ? perfil! : null;

  return <>
    <SiteHeader />
    <main id="main-content" tabIndex={-1} className="model-detail-page">
      <div className="shell model-detail-heading">
        {structuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />}
        <Link href="/modelos" className="model-detail-back">← Voltar à coleção</Link>
        <p className="eyebrow">{model.category} · ARQUIVO {getShowcaseFileLabel(model.filePath)}</p>
        <h1>{model.name}</h1>
        {model.creatorName && <p className="model-detail-creator">Criado por <strong>{model.creatorName}</strong>{model.sourceUrl && <> · <a href={model.sourceUrl} target="_blank" rel="noreferrer">Fonte original ↗</a></>}</p>}
        <ul className="product-tags" aria-label={`Tags de ${model.name}`}>{model.tags.map((tag) => <li key={tag}><Link href={`/modelos?q=${encodeURIComponent(tag)}#modelos`}>{tag}</Link></li>)}</ul>
      </div>
      <ModelDetailContent key={model.id} modelId={model.id} modelName={model.name} modelFilePath={model.filePath} previewUrl={previewUrl} previewVersions={previewVersions} today={new Date().toISOString().slice(0, 10)} profiles={profiles} profilesPage={requestedProfilePage} profilesPages={profilePages} profilesCount={profileResult?.count ?? 0} authenticated={Boolean(auth.user)} canUseOcr={Boolean(makerRoleResult?.data)} ocrConfigured={Boolean(process.env.GOOGLE_CLOUD_VISION_API_KEY)} notice={notice}>
        <section className="shell model-detail-download" aria-label="Download do modelo">
          <div><p className="eyebrow">ARQUIVOS ORIGINAIS</p><h2>{model.name}</h2><p>Baixe o arquivo para abrir no seu fatiador ou programa de modelagem.</p></div>
          <ul className="model-download-options">
            {downloadUrl && <li><a className="button button-primary" href={downloadUrl} download={model.filePath.split("/").at(-1)}>Baixar arquivo principal</a></li>}
            {downloadVariants.map(({ label, filePath, url }) => <li key={filePath}><a className="button button-secondary" href={url} download={filePath.split("/").at(-1)}>{label}</a></li>)}
            {!downloadUrl && <li><span className="button button-primary" aria-disabled="true">Download indisponível</span></li>}
          </ul>
        </section>
      </ModelDetailContent>
      <ModelRecommendations models={recommendations} />
    </main>
    <footer className="site-footer"><div className="shell footer-inner"><a className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></a><p>Sua ideia vira realidade.</p><span>© 2026 ViraPeça 3D</span></div></footer>
  </>;
}
