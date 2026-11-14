import Link from "next/link";
import { requestDigitalAssetPurchase } from "@/app/produtos/actions";
import { DigitalAssetPurchaseSubmitButton } from "@/components/digital-asset-purchase-submit-button";

export function DigitalAssetPurchaseForm({ productId, slug, authorized, personalPriceBrl, commercialPriceBrl }: {
  productId: string; slug: string; authorized: boolean; personalPriceBrl: number; commercialPriceBrl: number | null;
}) {
  const licenses = [
    { value: "personal", name: "Uso pessoal", description: "Projetos próprios, sem produção para venda.", price: personalPriceBrl },
    ...(commercialPriceBrl == null ? [] : [{ value: "commercial", name: "Uso comercial", description: "Produção de peças para comercialização, conforme a licença.", price: commercialPriceBrl }]),
  ];
  return <section className="digital-license-card" aria-label="Licenças do arquivo digital">
    <span className="account-kicker">ESCOLHA SUA LICENÇA</span>
    <p>O arquivo original fica privado. O download aparece em seus pedidos depois da confirmação do pagamento.</p>
    {authorized ? <form action={requestDigitalAssetPurchase} className="digital-license-options">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="slug" value={slug} />
      {licenses.map((license, index) => <label key={license.value}><input type="radio" name="licenseType" value={license.value} defaultChecked={index === 0} /> <span><strong>{license.name}</strong><small>{license.description}</small></span><b>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(license.price)}</b></label>)}
      <DigitalAssetPurchaseSubmitButton />
    </form> : <>
      <div className="digital-license-options" aria-label="Preços das licenças">
        {licenses.map((license) => <div className="digital-license-option" key={license.value}><span><strong>{license.name}</strong><small>{license.description}</small></span><b>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(license.price)}</b></div>)}
      </div>
      <p><Link href="/conta">Entre como comprador</Link> para adquirir este arquivo digital.</p>
    </>}
  </section>;
}
