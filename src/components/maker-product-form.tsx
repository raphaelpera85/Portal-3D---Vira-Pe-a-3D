"use client";

import { useActionState, useState } from "react";
import { createProductDraft, type MakerProductState } from "@/app/painel/maker/actions";
import { MakerProductVariantPricing } from "@/components/maker-product-variant-pricing";

const initialState: MakerProductState = { message: "", success: false };
type Category = { id: string; name: string };

export function MakerProductForm({ storeId, categories }: { storeId: string; categories: Category[] }) {
  const [mode, setMode] = useState("quote");
  const [fulfillmentMode, setFulfillmentMode] = useState("made_to_order");
  const [listingType, setListingType] = useState<"physical" | "digital">("physical");
  const [variantOptionsText, setVariantOptionsText] = useState("");
  const [basePriceBrl, setBasePriceBrl] = useState("");
  const [state, action, pending] = useActionState(createProductDraft, initialState);
  return (
    <section className="account-card maker-listing-card">
      <span className="account-kicker">ANÚNCIO NOVO · RASCUNHO</span><h2>Cadastrar produto</h2>
      <p>O anúncio será revisado antes de aparecer publicamente. Não envie arquivos privados pela URL da imagem.</p>
      <form className="auth-form" action={action}>
        <input type="hidden" name="storeId" value={storeId} />
        <label>Nome do produto<input name="name" minLength={3} maxLength={100} required /></label>
        <label>Descrição<textarea name="description" maxLength={2000} rows={4} /></label>
        <label>Tipo de anúncio<select name="listingType" value={listingType} onChange={(event) => { const next = event.target.value === "digital" ? "digital" : "physical"; setListingType(next); if (next === "digital") { setMode("fixed"); setFulfillmentMode("digital"); } else if (fulfillmentMode === "digital") setFulfillmentMode("made_to_order"); }}><option value="physical">Produto físico</option><option value="digital">Arquivo digital 3D</option></select></label>
        <label>Categoria<select name="categoryId" required defaultValue=""><option value="" disabled>Selecione</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
        {listingType === "physical" && <label>Tipo de preço<select name="priceMode" value={mode} onChange={(event) => { const next = event.target.value; setMode(next); if (next === "quote") setFulfillmentMode("quote"); else if (fulfillmentMode === "quote") setFulfillmentMode("made_to_order"); }}><option value="quote">Sob orçamento</option><option value="fixed">Preço fixo</option><option value="from">A partir de</option></select></label>}
        {listingType === "digital" && <input type="hidden" name="priceMode" value="fixed" />}
        <label>{listingType === "digital" ? "Preço da licença pessoal (R$)" : `Preço em reais ${mode === "quote" ? "(não usado no orçamento)" : "(R$)"}`}<input name={listingType === "physical" && variantOptionsText.trim() && mode === "fixed" ? "variantBasePrice" : "priceBrl"} type="number" min="0.01" max="999999999" step="0.01" value={basePriceBrl} onChange={(event) => setBasePriceBrl(event.target.value)} disabled={listingType === "physical" && mode === "quote"} required={listingType === "digital" || mode !== "quote"} /></label>
        {listingType === "digital" ? <input type="hidden" name="fulfillmentMode" value="digital" /> : mode === "quote" ? <input type="hidden" name="fulfillmentMode" value="quote" /> : <>
          <label>Forma de atendimento<select name="fulfillmentMode" value={fulfillmentMode} onChange={(event) => setFulfillmentMode(event.target.value)}><option value="made_to_order">Produzido sob encomenda</option><option value="ready_to_ship">Pronta entrega</option></select></label>
          {fulfillmentMode === "ready_to_ship" && !variantOptionsText.trim() && <label>Unidades em estoque<input name="stockQuantity" type="number" min="0" max="1000000" step="1" defaultValue="1" required /><small>Informe 0 para pausar novas solicitações. O estoque não é reservado sem pagamento.</small></label>}
          {mode === "fixed" && <><label>Variações disponíveis (opcional)<textarea name="variantOptions" maxLength={500} rows={3} value={variantOptionsText} onChange={(event) => setVariantOptionsText(event.target.value)} placeholder={"Cor: Preto, Branco, Vermelho\nTamanho: P, M, G"} /><small>Uma opção por linha. Para cada combinação, defina abaixo preço e estoque próprios.</small></label>
            {variantOptionsText.trim() && <MakerProductVariantPricing optionsText={variantOptionsText} basePrice={basePriceBrl} fulfillmentMode={fulfillmentMode === "ready_to_ship" ? "ready_to_ship" : "made_to_order"} />}
          </>}
          <label>Prazo de preparação (dias)<input name="preparationDays" type="number" min="0" max="365" step="1" placeholder="Opcional" /></label>
        </>}
        {listingType === "physical" && <fieldset className="shipping-package-fields"><legend>Embalagem do produto</legend><small>Opcional. Informe as medidas externas da embalagem e o peso com a peça protegida.</small><div>
          <label>Peso (g)<input name="packageWeightG" type="number" min="1" max="100000" step="1" placeholder="Ex.: 420" /></label>
          <label>Comprimento (cm)<input name="packageLengthCm" type="number" min="0.1" max="500" step="0.01" /></label>
          <label>Largura (cm)<input name="packageWidthCm" type="number" min="0.1" max="500" step="0.01" /></label>
          <label>Altura (cm)<input name="packageHeightCm" type="number" min="0.1" max="500" step="0.01" /></label>
        </div></fieldset>}
        <label>Imagem pública HTTPS (opcional)<input name="imageUrl" type="url" maxLength={1000} placeholder="https://" /></label>
        <label>Vídeo público MP4 ou WebM (opcional)<input name="videoUrl" type="url" maxLength={1000} placeholder="https://.../demonstracao.mp4" /><small>Link direto para o arquivo, em HTTPS. O portal aceita MP4 e WebM.</small></label>
        <label>Tags separadas por vírgula (opcional)<input name="tags" maxLength={260} placeholder="miniatura, RPG, articulado" /></label>
        <button className="button button-primary" type="submit" disabled={pending || categories.length === 0 || state.success}>{pending ? "Salvando…" : "Salvar rascunho"}</button>
        <p className={`auth-notice${state.message ? state.success ? " is-success" : " is-error" : ""}`} aria-live="polite">{state.message || (categories.length === 0 ? "Não há categorias ativas para anúncios." : "")}</p>
      </form>
      {state.productId && listingType === "digital" && <p className="account-next-step">Agora adicione o arquivo privado na lista de anúncios: <a href="#produtos">ir para seus anúncios</a>.</p>}
    </section>
  );
}
