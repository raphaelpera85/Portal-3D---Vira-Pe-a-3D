import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getUserWithRole } from "@/lib/auth-role.server";
import { createCouponAction, setCouponActiveAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cupons | ViraPeça 3D", robots: { index: false, follow: false } };

const notices: Record<string, string> = {
  salvo: "Cupom criado e disponível no carrinho.", duplicado: "Esse código já está cadastrado.",
  atualizado: "Status do cupom atualizado.", erro: "Não foi possível salvar. Confira o código e o valor.",
};

function CouponForm() {
  return <form action={createCouponAction} className="printer-model-form">
    <label>Código<input name="code" maxLength={40} autoCapitalize="characters" pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,39}" required /></label>
    <label>Desconto<select name="type" defaultValue="percent"><option value="percent">Percentual</option><option value="fixed">Valor fixo em reais</option></select></label>
    <label>Valor<input name="value" type="number" min="0.01" max="9999999.99" step="0.01" inputMode="decimal" required /><small>Percentuais aceitam até 99,99%. O desconto é rateado entre as lojas pelo valor dos produtos.</small></label>
    <button className="button button-primary" type="submit">Criar cupom</button>
  </form>;
}

export default async function CouponAdminPage({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const [{ resultado }, actor] = await Promise.all([searchParams, getUserWithRole("admin")]);
  if (!actor.supabase || !actor.authorized) redirect("/conta");
  const coupons = await actor.supabase.from("marketplace_coupons").select("id, code, discount_percent_bps, discount_fixed_cents, active, created_at").order("created_at", { ascending: false }).limit(250);
  return <><SiteHeader /><main className="admin-dashboard shell">
    <Link className="viewer-back-link" href="/admin">← Painel administrativo</Link>
    <div className="account-heading maker-dashboard-heading"><p className="eyebrow">GESTÃO DO MARKETPLACE</p><h1>Cupons</h1><p>Cupons são pagos pelos vendedores. A comissão da plataforma é calculada após o desconto.</p></div>
    {resultado && notices[resultado] && <p className={`auth-notice ${resultado === "erro" || resultado === "duplicado" ? "is-error" : "is-success"}`} role="status">{notices[resultado]}</p>}
    <section className="account-card admin-banner-create"><div className="admin-section-title"><span className="account-kicker">NOVA PROMOÇÃO</span><h2>Cadastrar cupom</h2></div><CouponForm /></section>
    <section className="admin-review-section"><div className="admin-section-title"><span className="account-kicker">CÓDIGOS CADASTRADOS</span><h2>Gerenciar disponibilidade</h2></div>
      {coupons.error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar os cupons. Confira a migração do marketplace.</p> : !coupons.data?.length ? <p className="admin-empty">Nenhum cupom cadastrado.</p> : coupons.data.map((coupon) => {
        const value = coupon.discount_percent_bps == null
          ? `R$ ${(Number(coupon.discount_fixed_cents) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
          : `${(Number(coupon.discount_percent_bps) / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
        return <article className="account-card admin-banner-record" key={coupon.id}><div className="admin-banner-record-heading"><div><span className="account-kicker">{coupon.active ? "ATIVO" : "INATIVO"}</span><h3>{coupon.code} · {value}</h3><p>Criado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(coupon.created_at))}</p></div><form action={setCouponActiveAction}><input type="hidden" name="couponId" value={coupon.id} /><input type="hidden" name="active" value={String(!coupon.active)} /><button className="button button-secondary" type="submit">{coupon.active ? "Desativar" : "Ativar"}</button></form></div></article>;
      })}
    </section>
  </main><footer className="site-footer"><div className="shell footer-inner"><Link className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></Link><p>Cupons do marketplace.</p><span>© 2026 ViraPeça 3D</span></div></footer></>;
}
