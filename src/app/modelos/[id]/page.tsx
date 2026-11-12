import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ModelViewer } from "@/components/model-viewer";
import { SiteHeader } from "@/components/site-header";
import { getShowcaseModel } from "@/lib/model-showcase";

type ModelPageProps = { params: Promise<{ id: string }> };

function modelAssetUrl(filePath: string, downloadName?: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl || !/^models\/[a-f0-9]{64}\.3mf$/.test(filePath)) return null;
  const path = filePath.split("/").map(encodeURIComponent).join("/");
  const url = `${baseUrl.replace(/\/+$/, "")}/storage/v1/object/public/catalog-models/${path}`;
  return downloadName ? `${url}?download=${encodeURIComponent(downloadName)}` : url;
}

export async function generateMetadata({ params }: ModelPageProps): Promise<Metadata> {
  const { id } = await params;
  const model = getShowcaseModel(id);
  return model ? { title: `${model.name} | Modelos 3D | ViraPeça 3D`, description: `Visualize o modelo 3D ${model.name} e baixe o arquivo 3MF original.` } : { title: "Modelo não encontrado | ViraPeça 3D" };
}

export default async function ModelPage({ params }: ModelPageProps) {
  const { id } = await params;
  const model = getShowcaseModel(id);
  if (!model) notFound();
  const previewUrl = modelAssetUrl(model.filePath);
  const downloadUrl = modelAssetUrl(model.filePath, `${model.name}.3mf`);

  return <>
    <SiteHeader />
    <main className="model-detail-page">
      <div className="shell model-detail-heading">
        <Link href="/modelos" className="model-detail-back">← Voltar à coleção</Link>
        <p className="eyebrow">{model.category} · ARQUIVO 3MF</p>
        <h1>{model.name}</h1>
        <ul className="product-tags" aria-label={`Tags de ${model.name}`}>{model.tags.map((tag) => <li key={tag}><Link href={`/modelos?q=${encodeURIComponent(tag)}#modelos`}>{tag}</Link></li>)}</ul>
      </div>
      {previewUrl ? <ModelViewer buyerId={null} today={new Date().toISOString().slice(0, 10)} previewUrl={previewUrl} modelName={model.name} readOnly /> : <p className="shell model-detail-error" role="alert">A conexão com o catálogo de arquivos 3D ainda não está configurada.</p>}
      <section className="shell model-detail-download" aria-label="Download do modelo">
        <div><p className="eyebrow">ARQUIVO ORIGINAL</p><h2>{model.name}.3mf</h2><p>Baixe o arquivo 3MF para abrir no seu fatiador ou programa de modelagem.</p></div>
        {downloadUrl ? <a className="button button-primary" href={downloadUrl} download={`${model.name}.3mf`}>Baixar arquivo 3MF</a> : <span className="button button-primary" aria-disabled="true">Download indisponível</span>}
      </section>
    </main>
    <footer className="site-footer"><div className="shell footer-inner"><a className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></a><p>Sua ideia vira realidade.</p><span>© 2026 ViraPeça 3D</span></div></footer>
  </>;
}
