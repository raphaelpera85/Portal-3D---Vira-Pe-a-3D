import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { TechnicalCatalog } from "@/components/technical-catalog";
import { loadTechnicalCatalog } from "@/lib/technical-catalog.server";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Catálogos técnicos | ViraPeça 3D",
  description: "Consulte especificações de impressoras, materiais, bicos e uma verificação explicável de compatibilidade.",
  ...(getSiteUrl() ? { alternates: { canonical: "/catalogos" } } : {}),
};

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const catalog = await loadTechnicalCatalog();
  return (
    <>
      <SiteHeader />
      <main className="technical-page">
        <div className="technical-page-back shell"><Link className="viewer-back-link" href="/">← Voltar para o início</Link><span>ESPECIFICAÇÕES COM FONTE</span></div>
        <TechnicalCatalog printers={catalog.printers} materials={catalog.materials} nozzles={catalog.nozzles} notice={catalog.error ?? (catalog.source === "local" ? "Ainda não há registros publicados no catálogo técnico; exibimos referências locais com fonte identificada." : null)} />
      </main>
      <footer className="site-footer"><div className="shell footer-inner"><Link className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></Link><p>Dados técnicos abertos, com origem identificada.</p><span>© 2026 ViraPeça 3D</span></div></footer>
    </>
  );
}
