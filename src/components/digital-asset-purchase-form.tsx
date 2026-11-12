import Link from "next/link";
import { requestDigitalAssetPurchase } from "@/app/produtos/actions";

export function DigitalAssetPurchaseForm({ productId, slug, authorized, personalPriceBrl, commercialPriceBrl }: {
  productId: string; slug: string; authorized: boolean; personalPriceBrl: number; commercialPriceBrl: number | null;
}) {
  return <section className="digital-license-card" aria-label="Licenças do arquivo digital">
    <span className="account-kicker">ESCOLHA SUA LICENÇA</span>
    <p>O arquivo original fica privado. O download aparece em seus pedidos depois da confirmação do pagamento.</p>
    {authorized ? <form action={requestDigitalAssetPurchase} className="digital-license-options">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="slug" value={slug} />
      <label><input type="radio" name="licenseType" value="personal" defaultChecked /> <span><strong>Uso pessoal</strong><small>Projetos próprios, sem produção para venda.</small></span><b>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(personalPriceBrl)}</b></label>
      {commercialPriceBrl != null && <label><input type="radio" name="licenseType" value="commercial" /> <span><strong>Uso comercial</strong><small>Produção de peças para comercialização, conforme a licença.</small></span><b>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(commercialPriceBrl)}</b></label>}
      <button className="button button-primary" type="submit">Continuar para o pagamento</button>
    </form> : <p><Link href="/conta">Entre como comprador</Link> para adquirir este arquivo digital.</p>}
  </section>;
}
