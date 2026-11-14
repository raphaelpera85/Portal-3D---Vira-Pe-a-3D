import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ModelViewer } from "@/components/model-viewer";
import { getSiteUrl } from "@/lib/site-url";
import { getUserWithRole } from "@/lib/auth-role.server";
import { loadTechnicalCatalog } from "@/lib/technical-catalog.server";
import type { SavedModelUpload } from "@/components/model-upload-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Visualizador 3D — ViraPeça 3D",
  description: "Visualize arquivos STL, OBJ, 3MF e GLB no navegador, confira dimensões e explore cores e componentes.",
  ...(getSiteUrl() ? { alternates: { canonical: "/visualizador" } } : {}),
};

export default async function ViewerPage({ searchParams }: { searchParams: Promise<{ orcamento?: string }> }) {
  const buyer = await getUserWithRole("buyer");
  const [{ orcamento }, uploads, catalog] = await Promise.all([
    searchParams,
    buyer.supabase && buyer.user && buyer.authorized
      ? buyer.supabase.from("buyer_model_uploads").select("id, bundle_id, model_name, total_bytes, files, dimensions_mm, created_at").eq("buyer_id", buyer.user.id).order("created_at", { ascending: false })
      : Promise.resolve(null),
    loadTechnicalCatalog(),
  ]);
  const savedModels = (uploads?.data ?? []) as SavedModelUpload[];
  const materials = catalog.materials.map((item) => ({ id: item.id, label: `${item.brand} ${item.name} · ${item.family}` }));
  const printers = catalog.printers.map((printer) => {
    const properties = printer.technicalProperties ?? {};
    const volumeModes = [
      ["singleNozzleBuildVolumeMm", "Um bico"], ["dualNozzleBuildVolumeMm", "Dois bicos"],
      ["combinedNozzleBuildVolumeMm", "Volume combinado"], ["singleExtrusionVolumeMm", "Extrusão simples"],
      ["dualExtrusionVolumeMm", "Extrusão dupla"],
    ].flatMap(([key, label]) => {
      const value = properties[key];
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const dimensions = value as Record<string, unknown>;
      if (![dimensions.x, dimensions.y, dimensions.z].every((axis) => typeof axis === "number" && Number.isFinite(axis) && axis > 0)) return [];
      return [{ id: key, label, dimensionsMm: { x: dimensions.x as number, y: dimensions.y as number, z: dimensions.z as number } }];
    });
    const cylindrical = properties.buildVolumeShape === "cylindrical";
    return { id: printer.id, name: printer.name, buildVolumeMm: volumeModes.length || cylindrical ? null : printer.buildVolumeMm, volumeModes, cylindrical };
  });
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
        <ModelViewer buyerId={buyer.user && buyer.authorized ? buyer.user.id : null} savedModels={savedModels} materials={materials} printers={printers} today={new Date().toISOString().slice(0, 10)} libraryError={Boolean(uploads?.error)} />
        <div className="viewer-page-foot shell"><strong>Compatibilidade nesta etapa</strong><span>STL e OBJ para malhas · 3MF, GLB e GLTF para cenas com materiais quando presentes. STL/OBJ pedem confirmação de unidade. Os arquivos ficam no dispositivo até você salvar o conjunto na biblioteca privada.</span></div>
      </main>
    </>
  );
}
