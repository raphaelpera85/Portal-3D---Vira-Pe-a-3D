import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ModelDetailContent } from "@/components/model-detail-content";
import { ModelRecommendations } from "@/components/model-showcase";
import { SiteHeader } from "@/components/site-header";
import { getModelAssetUrl, getRecommendedModels, getShowcaseModel, modelShowcase } from "@/lib/model-showcase";
import { getSiteUrl } from "@/lib/site-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ModelPageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ perfil?: string }> };
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return modelShowcase.map(({ id }) => ({ id }));
}

export async function generateMetadata({ params }: ModelPageProps): Promise<Metadata> {
  const { id } = await params;
  const model = getShowcaseModel(id);
  return model ? {
    title: `${model.name} | Modelos 3D | ViraPeça 3D`,
    description: `Visualize o modelo 3D ${model.name} e baixe o arquivo 3MF original.`,
    ...(getSiteUrl() ? {
      alternates: { canonical: `/modelos/${encodeURIComponent(model.id)}` },
      openGraph: {
        title: `${model.name} | Modelo 3D ViraPeça 3D`,
        description: `Visualize ${model.name} em 3D e baixe o arquivo 3MF original.`,
        url: `/modelos/${encodeURIComponent(model.id)}`,
        type: "website" as const,
        images: [model.image],
      },
      twitter: {
        card: "summary_large_image" as const,
        title: `${model.name} | Modelo 3D ViraPeça 3D`,
        description: `Visualize ${model.name} em 3D e baixe o arquivo 3MF original.`,
        images: [model.image],
      },
    } : {}),
  } : { title: "Modelo não encontrado | ViraPeça 3D", robots: { index: false, follow: false } };
}

export default async function ModelPage({ params, searchParams }: ModelPageProps) {
  const [{ id }, { perfil }] = await Promise.all([params, searchParams]);
  const model = getShowcaseModel(id);
  if (!model) notFound();
  const previewUrl = getModelAssetUrl(model.filePath);
  const downloadUrl = previewUrl;
  const downloadVariants = (model.downloads ?? []).flatMap(({ label, filePath }) => {
    const url = getModelAssetUrl(filePath);
    return url ? [{ label, filePath, url }] : [];
  });
  const previewVersions = [
    ...(downloadUrl ? [{ label: "Arquivo principal", url: downloadUrl }] : []),
    ...downloadVariants.map(({ label, url }) => ({ label, url })),
  ];
  const siteUrl = getSiteUrl();
  const modelUrl = siteUrl ? new URL(`/modelos/${encodeURIComponent(model.id)}`, siteUrl).toString() : null;
  const structuredData = modelUrl ? {
    "@context": "https://schema.org",
    "@type": "3DModel",
    name: model.name,
    description: `Modelo 3D ${model.name} para visualização e download em 3MF.`,
    category: model.category,
    keywords: model.tags,
    url: modelUrl,
    image: siteUrl ? new URL(model.image, siteUrl).toString() : undefined,
    ...(downloadUrl ? { encoding: { "@type": "MediaObject", name: `${model.name}.3mf`, contentUrl: downloadUrl, encodingFormat: "model/3mf" } } : {}),
  } : null;
  const recommendations = getRecommendedModels(model);
  const supabase = await createSupabaseServerClient();
  const { data: auth } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const [profileResult, makerRoleResult] = await Promise.all([
    supabase ? supabase.from("visible_model_print_profiles")
      .select("id, profile_name, profile_type, slicer, printer_snapshot, material_snapshot, nozzle_snapshot, layer_height_mm, infill_percent, wall_count, supports, orientation, scale_percent, quantity, slicer_metrics, created_at, sharing_scope, review_status, review_note, is_owner")
      .eq("model_slug", model.id).order("created_at", { ascending: false }).limit(100) : Promise.resolve(null),
    supabase && auth.user ? supabase.from("user_roles").select("role").eq("user_id", auth.user.id).eq("role", "maker").maybeSingle() : Promise.resolve(null),
  ]);
  const profiles = (profileResult?.data ?? []).map(({ is_owner, ...profile }) => ({ ...profile, isOwner: is_owner })) as import("@/components/model-print-profile-manager").ModelPrintProfileRecord[];
  const notice = profileResult?.error ? "erro" : ["salvo", "enviado", "copiado", "retirado", "excluido", "erro"].includes(perfil ?? "") ? perfil! : null;

  return <>
    <SiteHeader />
    <main className="model-detail-page">
      <div className="shell model-detail-heading">
        {structuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />}
        <Link href="/modelos" className="model-detail-back">← Voltar à coleção</Link>
        <p className="eyebrow">{model.category} · ARQUIVO 3MF</p>
        <h1>{model.name}</h1>
        <ul className="product-tags" aria-label={`Tags de ${model.name}`}>{model.tags.map((tag) => <li key={tag}><Link href={`/modelos?q=${encodeURIComponent(tag)}#modelos`}>{tag}</Link></li>)}</ul>
      </div>
      <ModelDetailContent key={model.id} modelId={model.id} modelName={model.name} previewUrl={previewUrl} previewVersions={previewVersions} today={new Date().toISOString().slice(0, 10)} profiles={profiles} authenticated={Boolean(auth.user)} canUseOcr={Boolean(makerRoleResult?.data)} ocrConfigured={Boolean(process.env.GOOGLE_CLOUD_VISION_API_KEY)} notice={notice} />
      <ModelRecommendations models={recommendations} />
      <section className="shell model-detail-download" aria-label="Download do modelo">
        <div><p className="eyebrow">ARQUIVOS ORIGINAIS</p><h2>{model.name}</h2><p>Escolha a versão 3MF para abrir no seu fatiador ou programa de modelagem.</p></div>
        <ul className="model-download-options">
          {downloadUrl && <li><a className="button button-primary" href={downloadUrl} download={`${model.name}.3mf`}>Baixar arquivo principal</a></li>}
          {downloadVariants.map(({ label, filePath, url }) => <li key={filePath}><a className="button button-secondary" href={url} download={filePath.split("/").at(-1)}>{label}</a></li>)}
          {!downloadUrl && <li><span className="button button-primary" aria-disabled="true">Download indisponível</span></li>}
        </ul>
      </section>
    </main>
    <footer className="site-footer"><div className="shell footer-inner"><a className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></a><p>Sua ideia vira realidade.</p><span>© 2026 ViraPeça 3D</span></div></footer>
  </>;
}
