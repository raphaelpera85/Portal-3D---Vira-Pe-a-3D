import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { applyCartCoupon, checkoutCart, removeCartCoupon, removeCartItem, setCartItemQuantity } from "./actions";
import { getUserWithRole } from "@/lib/auth-role.server";
import { formatBrl } from "@/lib/money";
import { groupCartItemsByStore, type CartRow } from "@/lib/cart";
import { allocateCouponDiscountCents, normalizeCouponCode } from "@/lib/coupon";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Carrinho | ViraPeça 3D", robots: { index: false, follow: false } };

const notices: Record<string, string> = {
  adicionado: "Produto adicionado ao carrinho.", atualizado: "Carrinho atualizado.",
  indisponivel: "O carrinho não pôde ser fechado. Um produto pode ter mudado de preço ou disponibilidade; confira os itens e tente novamente.",
  "endereco-invalido": "Escolha um endereço de entrega salvo na sua conta antes de enviar os pedidos.",
  "cupom-aplicado": "Cupom aplicado. O desconto será dividido entre as lojas do pedido.",
  "cupom-removido": "Cupom removido.", "cupom-invalido": "Cupom inválido, inativo ou indisponível para este carrinho.",
  erro: "Não foi possível atualizar o carrinho. Confira os dados e tente novamente.",
};

export default async function CartPage({ searchParams }: { searchParams: Promise<{ resultado?: string; cupom?: string }> }) {
  const [{ resultado, cupom: rawCouponCode }, actor] = await Promise.all([searchParams, getUserWithRole("buyer")]);
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");
  const couponCode = normalizeCouponCode(rawCouponCode);
  const cartResult = await actor.supabase.from("buyer_carts").select("id").eq("buyer_id", actor.user.id).maybeSingle();
  const cart = cartResult.data;
  const [itemsResult, addressesResult] = await Promise.all([
    cart ? actor.supabase.from("buyer_cart_items").select("id, product_id, store_id, store_name, product_name, price_brl, quantity").eq("cart_id", cart.id).order("created_at") : Promise.resolve({ data: [], error: null }),
    actor.supabase.from("buyer_addresses").select("id, label, recipient_name, postal_code, street, number, complement, district, city, state_code, reference, is_default").eq("buyer_id", actor.user.id).order("is_default", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  const { data: cartItems, error: itemsError } = itemsResult;
  const addresses = addressesResult.data ?? [];
  const couponResult = couponCode && cartItems?.length
    ? await actor.supabase.rpc("preview_marketplace_coupon", { p_code: couponCode })
    : null;
  const couponQuote = !couponResult?.error && Array.isArray(couponResult?.data) ? couponResult.data[0] : null;
  const error = cartResult.error ?? itemsError;
  const rows: CartRow[] = (cartItems ?? []).map((item) => ({
    store_id: item.store_id, store_name: item.store_name, product_id: item.product_id,
    product_name: item.product_name, quantity: item.quantity, price_brl: item.price_brl,
  }));
  const grouped = groupCartItemsByStore(rows);
  const totalCents = grouped.reduce((total, group) => total + Math.round(group.totalBrl * 100), 0);
  const discountCents = Number(couponQuote?.discount_cents ?? 0);
  const storeDiscounts = couponQuote ? allocateCouponDiscountCents(grouped.map((group) => ({
    key: group.storeId, subtotalCents: Math.round(group.totalBrl * 100),
  })), discountCents) : {};
  const netTotalCents = totalCents - discountCents;
  const itemIds = new Map((cartItems ?? []).map((item, index) => [`${item.store_id}:${item.product_id}`, item.id]));

  return <>
    <SiteHeader />
    <main className="account-page shell quote-page">
      <Link className="viewer-back-link" href="/#produtos">← Continuar explorando</Link>
      <div className="account-heading"><p className="eyebrow">ÁREA DO COMPRADOR</p><h1>Seu carrinho</h1><p>Itens de cada loja serão enviados em pedidos separados.</p></div>
      {resultado && notices[resultado] && <p className={`auth-notice ${["erro", "indisponivel", "cupom-invalido"].includes(resultado) ? "is-error" : "is-success"}`} role="status">{notices[resultado]}</p>}
      {error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar o carrinho. Confira as migrações do marketplace.</p> : grouped.length === 0 ? <section className="account-card"><h2>Seu carrinho está vazio</h2><p>Encontre produtos publicados com preço fixo para começar.</p><Link className="button button-primary" href="/#produtos">Explorar produtos</Link></section> : <>
        <div className="quote-list" aria-label="Produtos do carrinho">
          {grouped.map((group) => <section className="account-card" key={group.storeId}>
            <span className="account-kicker">PEDIDO DA LOJA</span><h2>{group.storeName}</h2>
            <ul className="cart-items-list">{group.items.map((item) => {
              const itemId = itemIds.get(`${group.storeId}:${item.productId}`)!;
              return <li key={item.productId}>
                <div><strong>{item.productName}</strong><span>{formatBrl(item.priceBrl)} cada · subtotal {formatBrl(item.totalBrl)}</span></div>
                <div className="cart-item-actions">
                  <form action={setCartItemQuantity}><input type="hidden" name="itemId" value={itemId} />{couponCode && <input type="hidden" name="couponCode" value={couponCode} />}<label><span className="sr-only">Quantidade de {item.productName}</span><input aria-label={`Quantidade de ${item.productName}`} name="quantity" type="number" min="1" max="100" defaultValue={item.quantity} /></label><button className="button button-secondary" type="submit">Atualizar</button></form>
                  <form action={removeCartItem}><input type="hidden" name="itemId" value={itemId} />{couponCode && <input type="hidden" name="couponCode" value={couponCode} />}<button className="button button-secondary" type="submit">Remover</button></form>
                </div>
              </li>;
            })}</ul>
            <p className="cart-store-total">Subtotal desta loja: <strong>{formatBrl(group.totalBrl)}</strong></p>
            {couponQuote && <p className="cart-store-total">Desconto do cupom: <strong>−{formatBrl(Number(storeDiscounts[group.storeId] ?? 0) / 100)}</strong></p>}
            {couponQuote && <p className="cart-store-total">Produtos após desconto: <strong>{formatBrl((Math.round(group.totalBrl * 100) - Number(storeDiscounts[group.storeId] ?? 0)) / 100)}</strong></p>}
          </section>)}
        </div>
        <section className="account-card cart-checkout"><div><span className="account-kicker">TOTAL ESTIMADO</span><strong>{formatBrl(netTotalCents / 100)}</strong>{couponQuote && <p>Subtotal: {formatBrl(totalCents / 100)} · cupom {couponQuote.coupon_code}: −{formatBrl(discountCents / 100)}</p>}<p>O endereço selecionado será compartilhado com cada loja, inclusive em pedidos com retirada local. Se a loja aceitar o pedido, enviará uma proposta disponível de entrega ou retirada local por vez; você pagará pelo portal após aceitá-la.</p>
          <form action={applyCartCoupon} className="cart-coupon-form"><label htmlFor="cart-coupon-code">Cupom de desconto</label><div><input id="cart-coupon-code" name="code" maxLength={40} defaultValue={couponCode ?? ""} autoCapitalize="characters" aria-describedby="cart-coupon-note" /><button className="button button-secondary" type="submit">Aplicar</button></div><small id="cart-coupon-note">O desconto é pago pelos vendedores, rateado por valor dos produtos e não reduz o frete.</small></form>
          {couponQuote && <form action={removeCartCoupon}><button className="button button-secondary" type="submit">Remover cupom</button></form>}
        </div>
          {addressesResult.error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar endereços. Confira a migração 017.</p> : addresses.length === 0 ? <div><p>Cadastre um endereço para enviar os pedidos.</p><Link className="button button-secondary" href="/conta#enderecos">Cadastrar endereço</Link></div> : <form action={checkoutCart} className="cart-checkout-form">
            <fieldset className="cart-address-options"><legend>Endereço de entrega</legend>{addresses.map((address, index) => <label className="cart-address-option" key={address.id}><input type="radio" name="addressId" value={address.id} defaultChecked={address.is_default || index === 0} required /><span><strong>{address.label}{address.is_default ? " · Principal" : ""}</strong><span>{address.recipient_name} · {address.street}, {address.number}{address.complement ? `, ${address.complement}` : ""}</span><span>{address.district} · {address.city}/{address.state_code} · CEP {address.postal_code.replace(/(\d{5})(\d{3})/, "$1-$2")}</span></span></label>)}</fieldset>
            {couponQuote && <input type="hidden" name="couponCode" value={couponCode ?? ""} />}
            <button className="button button-primary" type="submit">Enviar pedidos às lojas</button>
          </form>}
        </section>
      </>}
    </main>
    <footer className="site-footer"><div className="shell footer-inner"><Link className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></Link><p>Pedidos separados por loja.</p><span>© 2026 ViraPeça 3D</span></div></footer>
  </>;
}
