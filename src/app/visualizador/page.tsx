import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ModelViewer } from "@/components/model-viewer";
import { getSiteUrl } from "@/lib/site-url";
import { getUserWithRole } from "@/lib/auth-role.server";
import { loadTechnicalCatalog } from "@/lib/technical-catalog.server";
import { getBuildVolumeModes } from "@/lib/technical-catalog-data";
import { modelShowcase } from "@/lib/model-showcase";
import type { SavedModelUpload } from "@/components/model-upload-manager";
import type { CatalogMaterial, CatalogNozzle, CatalogPrinter } from "@/lib/compatibility";

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
  const catalogModels = modelShowcase.map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const materials = catalog.materials.map((item): CatalogMaterial & { label: string } => ({
    id: item.id, label: `${item.brand} ${item.name} · ${item.family}`, name: item.name, family: item.family, process: item.process,
    filamentDiameterMm: item.filamentDiameterMm, nozzleTemperatureC: item.nozzleTemperatureC, bedTemperatureC: item.bedTemperatureC,
    nozzleDiametersMm: item.nozzleDiametersMm, enclosureRequired: item.enclosureRequired, abrasive: item.abrasive,
    multicolorCompatible: item.multicolorCompatible, resinWavelengthNm: item.resinWavelengthNm, resinExposureSeconds: item.resinExposureSeconds,
  }));
  const printers = catalog.printers.map((printer) => {
    const properties = printer.technicalProperties ?? {};
    const volumeModes = getBuildVolumeModes(properties);
    const cylindrical = properties.buildVolumeShape === "cylindrical";
    return {
      id: printer.id, name: printer.name, technology: printer.technology,
      buildVolumeMm: volumeModes.length || cylindrical ? null : printer.buildVolumeMm,
      filamentDiameterMm: printer.filamentDiameterMm, maxNozzleTemperatureC: printer.maxNozzleTemperatureC,
      maxBedTemperatureC: printer.maxBedTemperatureC, heatedBed: printer.heatedBed, enclosure: printer.enclosure,
      multicolorSlots: printer.multicolorSlots, multicolorSupported: printer.multicolorSupported, supportedMaterials: printer.supportedMaterials, volumeModes, cylindrical,
    };
  });
  const nozzles = catalog.nozzles.map((nozzle): CatalogNozzle & { brand: string } => ({
    id: nozzle.id, name: nozzle.name, brand: nozzle.brand, diameterMm: nozzle.diameterMm, material: nozzle.material,
    maxTemperatureC: nozzle.maxTemperatureC, abrasionResistant: nozzle.abrasionResistant, printerCompatibility: nozzle.printerCompatibility,
  }));
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
        <ModelViewer buyerId={buyer.user && buyer.authorized ? buyer.user.id : null} savedModels={savedModels} catalogModels={catalogModels} materials={materials} nozzles={nozzles} printers={printers} today={new Date().toISOString().slice(0, 10)} libraryError={Boolean(uploads?.error)} />
        <div className="viewer-page-foot shell"><strong>Compatibilidade nesta etapa</strong><span>STL e OBJ para malhas · 3MF, GLB e GLTF para cenas com materiais quando presentes. STL/OBJ pedem confirmação de unidade. Os arquivos ficam no dispositivo até você salvar o conjunto na biblioteca privada.</span></div>
      </main>
    </>
  );
}
