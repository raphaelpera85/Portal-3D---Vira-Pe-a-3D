import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { TriposrGenerator } from "@/components/triposr-generator";
import { isHuggingFaceSpaceId } from "@/lib/huggingface-space";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Gerar modelo 3D por imagem | ViraPeça 3D",
  description: "Gere um rascunho 3D a partir de uma imagem usando TripoSR no Hugging Face.",
};

export default function GenerateModelPage() {
  const configuredSpaceId = process.env.TRIPOSR_SPACE_ID?.trim() ?? "";
  const spaceId = isHuggingFaceSpaceId(configuredSpaceId) ? configuredSpaceId : "";

  return <><SiteHeader /><main id="main-content" className="model-gallery-page"><section className="shell ai-model-page"><div className="account-heading"><p className="eyebrow">EXPERIMENTO · IMAGEM PARA 3D</p><h1>Sua imagem vira <em>um começo em 3D.</em></h1><p>O TripoSR cria uma malha GLB para você visualizar e baixar. O resultado é um rascunho: revise e repare a malha antes de imprimir.</p></div><TriposrGenerator spaceId={spaceId} /><p className="ai-model-back"><a href="/modelos">← Voltar ao catálogo de modelos</a></p></section></main><footer className="site-footer"><div className="shell footer-inner"><a className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></a><p>Sua ideia vira realidade.</p><a href="/privacidade">Privacidade</a><span>© 2026 ViraPeça 3D</span></div></footer></>;
}
