import type { ReactNode } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

type LegalSection = { title: string; content: ReactNode };

export function LegalDocument({ title, intro, updatedAt, sections }: {
  title: string;
  intro: string;
  updatedAt: string;
  sections: LegalSection[];
}) {
  const operator = process.env.SITE_LEGAL_NAME?.trim();
  const registration = process.env.SITE_LEGAL_ID?.trim();
  const contact = process.env.SITE_PRIVACY_EMAIL?.trim();
  const address = process.env.SITE_LEGAL_ADDRESS?.trim();

  return <>
    <SiteHeader />
    <main id="main-content" tabIndex={-1} className="legal-page shell">
      <Link className="viewer-back-link" href="/">← Voltar para o início</Link>
      <header className="legal-heading">
        <p className="eyebrow">VIRAPEÇA 3D · INFORMAÇÕES</p>
        <h1>{title}</h1>
        <p>{intro}</p>
        <span className="legal-updated">Atualizado em {updatedAt}</span>
      </header>
      <aside className="legal-operator" aria-label="Identificação da plataforma">
        <span className="account-kicker">RESPONSÁVEL PELA PLATAFORMA</span>
        {operator && <p><strong>{operator}</strong></p>}
        {registration && <p>CNPJ/CPF: {registration}</p>}
        {address && <p>Endereço: {address}</p>}
        {contact && <p>Privacidade e dados pessoais: <a href={`mailto:${contact}`}>{contact}</a></p>}
        {(!operator || !registration || !contact || !address) && <p className="legal-missing-details">Identificação legal, endereço e contato oficial ainda precisam ser cadastrados antes da operação pública.</p>}
        {process.env.SITE_LEGAL_PAGES_APPROVED !== "true" && <p className="legal-missing-details">Documento em revisão; valide identificação e conteúdo com o responsável legal antes de usar como versão oficial.</p>}
      </aside>
      <div className="legal-layout">
        <nav className="legal-toc" aria-label="Nesta página">
          <span className="account-kicker">NESTA PÁGINA</span>
          <ol>{sections.map((section, index) => <li key={section.title}><a href={`#secao-${index + 1}`}>{section.title}</a></li>)}</ol>
        </nav>
        <div className="legal-sections">
          {sections.map((section, index) => <section id={`secao-${index + 1}`} key={section.title}>
            <span className="legal-section-number">{String(index + 1).padStart(2, "0")}</span>
            <h2>{section.title}</h2>
            <div>{section.content}</div>
          </section>)}
        </div>
      </div>
    </main>
    <footer className="site-footer"><div className="shell legal-footer">
      <Link href="/">ViraPeça 3D</Link><span>Informações do portal</span>
      <nav aria-label="Documentos legais"><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos de uso</Link><Link href="/conta">Minha conta</Link></nav>
    </div></footer>
  </>;
}
