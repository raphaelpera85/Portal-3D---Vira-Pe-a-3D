import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ModelViewer } from "@/components/model-viewer";
import { getSiteUrl } from "@/lib/site-url";
import { getUserWithRole } from "@/lib/auth-role.server";
import type { SavedModelUpload } from "@/components/model-upload-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Visualizador 3D — ViraPeça 3D",
  description: "Visualize arquivos STL, OBJ, 3MF e GLB no navegador, confira dimensões e explore cores e componentes.",
  ...(getSiteUrl() ? { alternates: { canonical: "/visualizador" } } : {}),
};

export default async function ViewerPage({ searchParams }: { searchParams: Promise<{ orcamento?: string }> }) {
  const buyer = await getUserWithRole("buyer");
  const [{ orcamento }, uploads, materialResult] = await Promise.all([
    searchParams,
    buyer.supabase && buyer.user && buyer.authorized
      ? buyer.supabase.from("buyer_model_uploads").select("id, bundle_id, model_name, total_bytes, files, dimensions_mm, created_at").eq("buyer_id", buyer.user.id).order("created_at", { ascending: false })
      : Promise.resolve(null),
    buyer.supabase ? buyer.supabase.from("material_catalog").select("id, manufacturer, product, family").eq("catalog_status", "published").order("manufacturer").order("product") : Promise.resolve({ data: null, error: null }),
  ]);
  const savedModels = (uploads?.data ?? []) as SavedModelUpload[];
  const materials = (materialResult.data ?? []).map((item) => ({ id: item.id, label: `${item.manufacturer} ${item.product} · ${item.family}` }));
  return (
    <>
      <SiteHeader />
      <main className="viewer-page">
        <div className="viewer-page-intro shell">
          <a href="/" className="viewer-back-link">← Voltar à vitrine</a>
          <p>DO ARQUIVO À PEÇA</p>
        </div>
        {orcamento === "sem-fabricantes" && <p className="auth-notice shell" role="status">Nenhuma loja publicada foi confirmada como compatível com esse material e volume. Confira os dados técnicos ou escolha outro material.</p>}
        {orcamento === "erro" && <p className="auth-notice is-error shell" role="alert">Não foi possível enviar a solicitação. Confira os campos, o catálogo e se a migração de orçamentos personalizados está aplicada.</p>}
        <ModelViewer buyerId={buyer.user && buyer.authorized ? buyer.user.id : null} savedModels={savedModels} materials={materials} today={new Date().toISOString().slice(0, 10)} libraryError={Boolean(uploads?.error)} />
        <div className="viewer-page-foot shell"><strong>Compatibilidade nesta etapa</strong><span>STL e OBJ para malhas · 3MF, GLB e GLTF para cenas com materiais quando presentes. STL/OBJ pedem confirmação de unidade. Os arquivos ficam no dispositivo até você salvar o conjunto na biblioteca privada.</span></div>
      </main>
    </>
  );
}
