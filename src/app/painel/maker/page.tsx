import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { MakerProductForm } from "@/components/maker-product-form";
import { MakerQuoteOfferForm } from "@/components/maker-quote-offer-form";
import { MakerCustomPrintOfferForm } from "@/components/maker-custom-print-offer-form";
import { MakerCustomPrintFiles } from "@/components/maker-custom-print-files";
import { MakerPurchaseDecisionForm } from "@/components/maker-purchase-decision-form";
import { MakerOrderDecisionForm } from "@/components/maker-order-decision-form";
import { StoreNotificationContactsForm } from "@/components/store-notification-contacts-form";
import { MakerNotificationUpdates } from "@/components/maker-notification-updates";
import { MakerEquipmentManager } from "@/components/maker-equipment-manager";
import { MakerConsignmentManager } from "@/components/maker-consignment-manager";
import { MakerPrintProfileManager } from "@/components/maker-print-profile-manager";
import { MakerProductInventoryForm } from "@/components/maker-product-inventory-form";
import { MakerDigitalAssetManager } from "@/components/maker-digital-asset-manager";
import { advanceCustomPrintProduction, deleteProductDraft, markCustomPrintTargetRead, markQuoteRequestNotificationRead, markSellerOrderNotificationRead, markSellerPurchaseOrderShipped, retryCustomPrintNotificationDelivery, retryStoreNotificationDelivery, saveMakerStoreProfile, submitSellerOrderShippingQuote } from "./actions";
import { getUserWithRole } from "@/lib/auth-role.server";
import { formatBrl, formatBrlTotal } from "@/lib/money";
import { getCustomPrintEventLabel } from "@/lib/custom-print-events";
import { readPrintProfileColors } from "@/lib/print-profile-colors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { disconnectMercadoPago, startMercadoPagoConnect } from "./payment-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Painel do fabricante | ViraPeça 3D", robots: { index: false, follow: false } };

type CustomPrintRequestRow = { id: string; model_name: string; dimensions_x_mm: number; dimensions_y_mm: number; dimensions_z_mm: number; scale_percent: number; material_snapshot: string; quantity: number; color: string; quality: string; due_date: string | null; notes: string; status: string; production_started_at: string | null; production_completed_at: string | null; payments?: { status: string; total_cents: number; marketplace_fee_cents: number; created_at: string }[] };
type CustomPrintTargetRow = {
  id: string; status: string; compatibility: string; maker_read_at: string | null;
  request: CustomPrintRequestRow | CustomPrintRequestRow[] | null;
  offer: { id: string; total_brl: number; lead_days: number; terms: string; status: string } | { id: string; total_brl: number; lead_days: number; terms: string; status: string }[] | null;
  deliveries: { id: string; channel: string; status: string; last_error: string | null }[] | null;
  events: { id: string; event_type: string; event_data: Record<string, unknown>; actor_user_id: string | null; created_at: string }[] | null;
};

export default async function MakerDashboard({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const { resultado } = await searchParams;
  const actor = await getUserWithRole("maker");
  if (!actor.supabase || !actor.user) redirect("/conta");
  if (!actor.authorized) redirect("/conta");
  const [storeResult, categoryResult, storeProfileResult] = await Promise.all([
    actor.supabase.from("stores").select("id, name, slug, status, description, city, state_code, logo_url, banner_url").eq("owner_user_id", actor.user.id).maybeSingle(),
    actor.supabase.from("product_categories").select("id, name").eq("active", true).order("sort_order").order("name"),
    actor.supabase.from("stores").select("commercial_policies").eq("owner_user_id", actor.user.id).maybeSingle(),
  ]);
  if (storeResult.error) return <main className="account-page shell"><p className="auth-notice is-error">Não foi possível carregar a loja. Confira as migrações do marketplace.</p></main>;
  const store = storeResult.data;
  const paymentAdmin = store ? createSupabaseAdminClient() : null;
  const paymentConnection = paymentAdmin && store
    ? await paymentAdmin.from("store_payment_connections").select("provider_user_id, connected_at").eq("store_id", store.id).maybeSingle()
    : { data: null, error: null };
  const [productResult, quoteResult, customPrintResult, contactResult, orderResult, equipmentResult, printerModelsResult, consignmentResult, printProfileResult, materialsResult, nozzlesResult, printerSuggestionsResult] = store ? await Promise.all([
    actor.supabase.from("marketplace_products").select("id, name, slug, listing_type, catalog_status, price_mode, price_brl, fulfillment_mode, stock_quantity, preparation_days, updated_at, digital_asset:digital_assets(file_name, has_preview, personal_price_brl, commercial_price_brl)").eq("store_id", store.id).order("created_at", { ascending: false }),
    actor.supabase.from("product_quote_requests").select("id, request_type, unit_price_brl, product_name, quantity, customization, due_date, status, created_at, maker_read_at, offer:product_quote_offers(id, total_brl, lead_days, terms, status), deliveries:store_notification_deliveries(id, channel, status, last_error), payments:seller_order_payments(status, total_cents, marketplace_fee_cents, created_at)").eq("store_id", store.id).order("created_at", { ascending: false }),
    actor.supabase.from("custom_print_request_targets").select("id, status, compatibility, maker_read_at, request:custom_print_requests!inner(id, model_name, dimensions_x_mm, dimensions_y_mm, dimensions_z_mm, scale_percent, material_snapshot, quantity, color, quality, due_date, notes, status, production_started_at, production_completed_at, payments:seller_order_payments(status, total_cents, marketplace_fee_cents, created_at)), offer:custom_print_offers(id, total_brl, lead_days, terms, status), deliveries:store_notification_deliveries(id, channel, status, last_error), events:custom_print_request_events(id, event_type, event_data, actor_user_id, created_at)").eq("store_id", store.id).order("created_at", { ascending: false }),
    actor.supabase.from("store_notification_contacts").select("email, whatsapp, whatsapp_opt_in").eq("store_id", store.id).maybeSingle(),
    actor.supabase.from("seller_purchase_orders").select("id, store_name, status, created_at, maker_read_at, delivery_recipient_name, delivery_postal_code, delivery_street, delivery_number, delivery_complement, delivery_district, delivery_city, delivery_state_code, delivery_reference, shipping_quote_status, shipping_carrier, shipping_service, shipping_cost_cents, shipping_delivery_days, shipment_status, shipping_tracking_code, shipping_tracking_url, shipping_expected_date, items:seller_purchase_order_items(product_name, unit_price_brl, quantity), deliveries:store_notification_deliveries(id, channel, status, last_error), payments:seller_order_payments(status, total_cents, marketplace_fee_cents), events:seller_purchase_order_events(id, event_type, description, created_at)").eq("store_id", store.id).order("created_at", { ascending: false }),
    actor.supabase.from("maker_printers").select("id, catalog_model_id, manufacturer_snapshot, model_snapshot, variant_snapshot, custom_manufacturer, custom_model, nickname, purchased_at, purchase_price_brl, residual_value_brl, useful_life_hours, accumulated_hours, installed_nozzle, modifications, measured_average_power_w, power_measurement_conditions, energy_tariff_per_kwh, operational_status, maintenance:printer_maintenance_events(id, performed_at, maintenance_type, component, cost_brl, hours_at_event, notes, next_due_at, next_due_hours)").eq("store_id", store.id).order("created_at", { ascending: false }).order("performed_at", { ascending: false, referencedTable: "printer_maintenance_events" }),
    actor.supabase.from("printer_models").select("id, manufacturer, model, variant").eq("catalog_status", "published").order("manufacturer").order("model"),
    actor.supabase.from("maker_consignment_items").select("id, establishment, product_name, unit_cost_brl, sale_price_brl, commission_percent, created_at, movements:maker_consignment_movements(id, movement_type, quantity, notes, created_at)").eq("store_id", store.id).order("created_at", { ascending: false }).order("created_at", { ascending: false, referencedTable: "maker_consignment_movements" }),
    actor.supabase.from("maker_print_profiles").select("id, product_id, profile_name, profile_type, sharing_scope, review_status, review_note, maker_printer_id, printer_snapshot, material_id, material_snapshot, nozzle_id, nozzle_snapshot, layer_height_mm, infill_percent, wall_count, supports, orientation, scale_percent, quantity, print_hours, material_grams, material_by_color").eq("store_id", store.id).order("created_at", { ascending: false }),
    actor.supabase.from("material_catalog").select("id, manufacturer, product, family").eq("catalog_status", "published").order("manufacturer").order("product"),
    actor.supabase.from("nozzle_catalog").select("id, manufacturer, model, diameter_mm, interface").eq("catalog_status", "published").order("manufacturer").order("model"),
    actor.supabase.from("printer_model_suggestions").select("id, manufacturer, model, variant, technology, source_url, notes, status, review_note, printer_model_id, created_at").eq("suggested_by", actor.user.id).order("created_at", { ascending: false }).limit(50),
  ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: null, error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  const products = productResult.data ?? [];
  const unreadQuotes = quoteResult.data?.filter((request) => !request.maker_read_at) ?? [];
  const customPrintTargets = (customPrintResult.data ?? []) as unknown as CustomPrintTargetRow[];
  const unreadCustomPrints = customPrintTargets.filter((target) => !target.maker_read_at);
  const unreadOrders = orderResult.data?.filter((order) => !order.maker_read_at) ?? [];

  return (
    <>
      <SiteHeader />
      {store && <MakerNotificationUpdates storeId={store.id} />}
      <main className="maker-dashboard shell">
        <Link className="viewer-back-link" href="/conta">← Voltar à conta</Link>
        <div className="account-heading maker-dashboard-heading"><p className="eyebrow">ÁREA DO FABRICANTE</p><h1>{store?.name ?? "Sua loja"}</h1><p>Cadastre rascunhos e acompanhe a análise de publicação.</p></div>
        {store && <p className="maker-finance-link"><Link className="button button-secondary" href="/painel/maker/financeiro">Abrir financeiro e pagamentos →</Link></p>}
        {!store ? <section className="account-card"><h2>Loja não encontrada</h2><p>Solicite a aprovação da sua conta ou fale com a equipe.</p></section> : (
          <>
            <section className="store-status-card"><span className={`store-status-dot status-${store.status}`} /> <div><strong>Status da loja: {store.status === "published" ? "Publicada" : store.status === "pending" ? "Aguardando aprovação" : "Suspensa"}</strong><p>{store.city ? `${store.city}${store.state_code ? ` · ${store.state_code}` : ""} · ` : ""}{store.description}</p></div></section>
            {(resultado === "loja-perfil-salvo" || resultado === "loja-perfil-erro") && <p className={`auth-notice ${resultado === "loja-perfil-erro" ? "is-error" : "is-success"}`} role="status">{resultado === "loja-perfil-salvo" ? "Perfil público da loja atualizado." : "Não foi possível salvar o perfil. Confira os campos e se a migração 035 foi aplicada."}</p>}
            {store.status !== "suspended" && <section className="account-card maker-products-card store-profile-editor"><span className="account-kicker">SUA VITRINE</span><h2>Perfil público da loja</h2>{store.status === "published" ? <p><Link href={`/lojas/${store.slug}`}>Ver página pública da loja ↗</Link></p> : <p>A página pública ficará disponível quando a loja for aprovada.</p>}
              <form action={saveMakerStoreProfile} className="auth-form"><label>Descrição<textarea name="description" defaultValue={store.description} maxLength={1000} rows={4} required /></label><div className="equipment-form-grid"><label>URL segura do logotipo<input name="logoUrl" type="url" defaultValue={store.logo_url ?? ""} placeholder="https://..." maxLength={2048} /></label><label>URL segura do banner<input name="bannerUrl" type="url" defaultValue={store.banner_url ?? ""} placeholder="https://..." maxLength={2048} /></label><label>Cidade<input name="city" defaultValue={store.city ?? ""} maxLength={80} /></label><label>UF<input name="stateCode" defaultValue={store.state_code ?? ""} maxLength={2} pattern="[A-Za-z]{2}" /></label></div><label>Políticas comerciais<textarea name="commercialPolicies" defaultValue={storeProfileResult.data?.commercial_policies ?? ""} maxLength={2000} rows={5} placeholder="Prazo para troca, cancelamento, personalização e atendimento..." /></label><button className="button button-primary" type="submit">Salvar perfil da loja</button>{storeProfileResult.error && <small className="quote-small-note">A edição do perfil requer a migração 035 do banco.</small>}</form>
            </section>}
            <section className="account-card maker-products-card"><span className="account-kicker">CENTRAL DE AVISOS {unreadQuotes.length + unreadCustomPrints.length + unreadOrders.length > 0 ? `· ${unreadQuotes.length + unreadCustomPrints.length + unreadOrders.length} NOVO(S)` : ""}</span><h2>Notificações</h2>
                {quoteResult.error || customPrintResult.error || orderResult.error ? <p>As notificações ficarão disponíveis após aplicar as migrações do marketplace.</p> : unreadQuotes.length === 0 && unreadCustomPrints.length === 0 && unreadOrders.length === 0 ? <p>Você não tem novas solicitações.</p> : <>
                  {unreadQuotes.length > 0 && <ul className="maker-notification-list">{unreadQuotes.map((request) => <li key={request.id}><div><strong>{request.product_name}</strong><span>{request.request_type === "purchase" ? "Solicitação de compra" : "Pedido de orçamento"} · quantidade {request.quantity}</span></div><div className="maker-notification-actions"><Link className="viewer-back-link" href={`#request-${request.id}`}>Ver pedido</Link><form action={markQuoteRequestNotificationRead}><input type="hidden" name="requestId" value={request.id} /><button className="button button-secondary" type="submit">Marcar como lida</button></form></div></li>)}</ul>}
                  {unreadCustomPrints.map((target) => <div className="maker-notification-actions" key={target.id}><span>Impressão personalizada · {Array.isArray(target.request) ? target.request[0]?.model_name : target.request?.model_name}</span><Link className="viewer-back-link" href={`#custom-${target.id}`}>Ver pedido</Link><form action={markCustomPrintTargetRead}><input type="hidden" name="targetId" value={target.id} /><button className="button button-secondary" type="submit">Marcar como lida</button></form></div>)}
                  {unreadOrders.map((order) => <div className="maker-notification-actions" key={order.id}><span>Solicitação de compra · carrinho · {order.store_name}</span><Link className="viewer-back-link" href={`#order-${order.id}`}>Ver pedido</Link><form action={markSellerOrderNotificationRead}><input type="hidden" name="orderId" value={order.id} /><button className="button button-secondary" type="submit">Marcar como lida</button></form></div>)}
                </>}
            </section>
            {contactResult.error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar seus contatos. Confira a migração de avisos.</p> : <StoreNotificationContactsForm email={contactResult.data?.email ?? actor.user.email ?? ""} whatsapp={contactResult.data?.whatsapp ?? null} whatsappOptIn={contactResult.data?.whatsapp_opt_in ?? false} />}
            <section className="account-card maker-products-card" id="pagamentos"><span className="account-kicker">RECEBIMENTOS</span><h2>Conta Mercado Pago</h2>
              {resultado === "mercado-pago-conectado" && <p className="auth-notice is-success" role="status">Conta Mercado Pago vinculada para pagamentos de pedidos aceitos.</p>}
              {resultado === "mercado-pago-configurar" && <p className="auth-notice is-error" role="alert">A vinculação depende das credenciais e da migração 023 configuradas pelo administrador.</p>}
              {resultado === "mercado-pago-erro" && <p className="auth-notice is-error" role="alert">Não foi possível vincular a conta. Tente novamente ou confira as configurações do Mercado Pago.</p>}
              {resultado === "mercado-pago-desconectado" && <p className="auth-notice is-success" role="status">Os tokens foram removidos do ViraPeça. Para revogar a autorização, remova o ViraPeça também nas configurações de aplicativos autorizados do Mercado Pago.</p>}
              {resultado === "mercado-pago-ja-desconectado" && <p className="auth-notice" role="status">Esta loja já estava desconectada.</p>}
              {resultado === "mercado-pago-pagamentos-pendentes" && <p className="auth-notice is-error" role="alert">Conclua ou cancele os pagamentos pendentes antes de desconectar a conta.</p>}
              {resultado === "mercado-pago-reembolsos-pendentes" && <p className="auth-notice is-error" role="alert">Aguarde a confirmação dos reembolsos antes de desconectar a conta.</p>}
              {resultado === "mercado-pago-desconectar-erro" && <p className="auth-notice is-error" role="alert">Não foi possível desconectar a conta. Atualize o painel e tente novamente.</p>}
              {paymentConnection.error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar a conexão. Confira a migração 023 e as credenciais do servidor.</p> : paymentConnection.data
                ? <p>Conta vinculada desde {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(paymentConnection.data.connected_at))}.</p>
                : <p>Vincule a conta que receberá os pagamentos da sua loja. O ViraPeça usa essa autorização somente no servidor.</p>}
              <form action={startMercadoPagoConnect}><button className="button button-secondary" type="submit">{paymentConnection.data ? "Reconectar Mercado Pago" : "Conectar Mercado Pago"}</button></form>
              {paymentConnection.data && <form action={disconnectMercadoPago} className="auth-form"><input type="hidden" name="storeId" value={store.id} /><label><input type="checkbox" name="confirmDisconnect" value="yes" required /> Confirmo que quero remover do ViraPeça os tokens desta conta.</label><button className="button button-secondary" type="submit">Desconectar Mercado Pago</button><p className="quote-small-note">A desconexão bloqueia novos pagamentos. A autorização concedida ao ViraPeça deve ser revogada também nas configurações da sua conta Mercado Pago. Para administrar reembolsos futuros, será necessário conectar a conta novamente.</p></form>}
            </section>
            {resultado === "equipamento-salvo" && <p className="auth-notice is-success" role="status">Equipamento salvo.</p>}
            {resultado === "manutencao-salva" && <p className="auth-notice is-success" role="status">Registro de manutenção salvo.</p>}
            {(resultado === "equipamento-erro" || resultado === "manutencao-erro") && <p className="auth-notice is-error" role="alert">Não foi possível salvar os dados. Confira os campos e as migrações técnicas.</p>}
            {resultado === "modelo-indisponivel" && <p className="auth-notice is-error" role="alert">O modelo selecionado deixou de estar disponível no catálogo. Atualize o cadastro usando a opção de equipamento próprio ou selecione outro modelo.</p>}
            {equipmentResult.error ? <p className="auth-notice is-error" role="alert">O cadastro de equipamentos ficará disponível após aplicar a migração de impressoras do fabricante.</p> : <MakerEquipmentManager storeId={store.id} models={printerModelsResult.data ?? []} printers={(equipmentResult.data ?? []).map((printer) => ({ ...printer, maintenance: printer.maintenance ?? [] }))} />}
            {resultado === "modelo-sugerido" && <p className="auth-notice is-success" role="status">Sugestão enviada para revisão. A aprovação cria um rascunho, que será conferido antes de aparecer no catálogo.</p>}
            {resultado === "modelo-sugestao-duplicada" && <p className="auth-notice" role="status">Já existe uma sugestão pendente para esse modelo.</p>}
            {resultado === "modelo-sugestao-limite" && <p className="auth-notice" role="status">Você já tem cinco sugestões aguardando revisão. Envie outra após a análise da equipe.</p>}
            {resultado === "modelo-sugestao-erro" && <p className="auth-notice is-error" role="alert">Não foi possível enviar a sugestão. Confira os campos e se a migração 022 foi aplicada.</p>}
            <section className="account-card maker-products-card"><span className="account-kicker">CATÁLOGO TÉCNICO</span><h2>Minhas sugestões de impressoras</h2>
              {printerSuggestionsResult.error ? <p className="auth-notice is-error" role="alert">Acompanhe as sugestões após aplicar a migração 022.</p> : !printerSuggestionsResult.data?.length ? <p>Você ainda não enviou sugestões.</p> : <ul className="maker-product-list">{printerSuggestionsResult.data.map((suggestion) => <li key={suggestion.id}><div><strong>{suggestion.manufacturer} {suggestion.model} · {suggestion.variant}</strong><span>{suggestion.technology} · {suggestion.status === "pending" ? "Aguardando revisão" : suggestion.status === "approved" ? "Aprovada" : "Recusada"}</span>{suggestion.review_note && <span>Retorno: {suggestion.review_note}</span>}{suggestion.source_url && <a href={suggestion.source_url} target="_blank" rel="noreferrer">Fonte informada</a>}</div></li>)}</ul>}
            </section>
            {resultado === "perfil-salvo" && <p className="auth-notice is-success" role="status">Perfil de impressão salvo.</p>}
            {resultado === "perfil-excluido" && <p className="auth-notice is-success" role="status">Perfil de impressão excluído.</p>}
            {resultado === "perfil-erro" && <p className="auth-notice is-error" role="alert">Não foi possível salvar o perfil. Confira os dados, o catálogo e a migração 016.</p>}
            {resultado === "estoque-salvo" && <p className="auth-notice is-success" role="status">Disponibilidade do produto atualizada.</p>}
            {resultado === "estoque-erro" && <p className="auth-notice is-error" role="alert">Não foi possível atualizar o estoque. Confira a quantidade e a migração 018.</p>}
            <MakerPrintProfileManager
              storeId={store.id}
              products={products.map(({ id, name }) => ({ id, name }))}
              printers={(equipmentResult.data ?? []).map((printer) => ({ id: printer.id, name: printer.nickname }))}
              materials={(materialsResult.data ?? []).map((material) => ({ id: material.id, name: `${material.manufacturer} ${material.product} · ${material.family}` }))}
              nozzles={(nozzlesResult.data ?? []).map((nozzle) => ({ id: nozzle.id, name: `${nozzle.manufacturer} ${nozzle.model} · ${Number(nozzle.diameter_mm).toLocaleString("pt-BR")} mm${nozzle.interface ? ` · ${nozzle.interface}` : ""}` }))}
              profiles={(printProfileResult.data ?? []).map((profile) => ({ ...profile, material_by_color: readPrintProfileColors(profile.material_by_color) }))}
              error={Boolean(printProfileResult.error)}
            />
            {resultado === "consignacao-salva" && <p className="auth-notice is-success" role="status">Lote em consignação registrado.</p>}
            {resultado === "consignacao-movimento-salvo" && <p className="auth-notice is-success" role="status">Movimentação registrada; estoque e estimativas atualizados.</p>}
            {(resultado === "consignacao-erro" || resultado === "consignacao-movimento-erro") && <p className="auth-notice is-error" role="alert">Não foi possível salvar a consignação. Confira os dados, o estoque disponível e a migração 015.</p>}
            <MakerConsignmentManager
              items={(consignmentResult.data ?? []).map((item) => ({ ...item, movements: item.movements ?? [] }))}
              products={products.filter((product) => product.catalog_status === "published").map(({ id, name }) => ({ id, name }))}
              error={Boolean(consignmentResult.error)}
            />
            {productResult.error && <p className="auth-notice is-error" role="alert">Não foi possível carregar os anúncios.</p>}
            <section className="account-card maker-products-card" id="produtos"><span className="account-kicker">SEUS ANÚNCIOS</span><h2>Produtos cadastrados</h2>
              {products.length === 0 ? <p>Ainda não há anúncios nesta loja.</p> : <ul className="maker-product-list">{products.map((product) => {
                const asset = Array.isArray(product.digital_asset) ? product.digital_asset[0] : product.digital_asset;
                return <li key={product.id}><div><strong>{product.name}</strong><span>{product.listing_type === "digital" ? "Arquivo digital" : product.price_mode === "quote" ? "Sob orçamento" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(product.price_brl))} · {product.catalog_status === "published" ? "Publicado" : product.catalog_status === "archived" ? "Arquivado" : "Rascunho em revisão"}</span></div>
                  {product.listing_type === "digital" ? <MakerDigitalAssetManager productId={product.id} storeId={store.id} personalPriceBrl={Number(product.price_brl)} status={product.catalog_status} asset={asset ?? null} /> : <MakerProductInventoryForm product={product} />}
                  {product.catalog_status === "draft" && <form action={deleteProductDraft}><input type="hidden" name="productId" value={product.id} /><button className="button button-secondary" type="submit">Excluir rascunho</button></form>}</li>;
              })}</ul>}
            </section>
            {resultado === "compra-aceita" && <p className="auth-notice is-success" role="status">Disponibilidade confirmada. Nenhum pagamento foi processado.</p>}
            {resultado === "compra-recusada" && <p className="auth-notice" role="status">Pedido recusado.</p>}
            {resultado === "pedido-aceito" && <p className="auth-notice is-success" role="status">Disponibilidade confirmada. Nenhum pagamento foi processado.</p>}
            {resultado === "pedido-recusado" && <p className="auth-notice" role="status">Pedido recusado.</p>}
            {resultado === "erro" && <p className="auth-notice is-error" role="alert">Não foi possível concluir a ação.</p>}
            <section className="account-card maker-products-card"><span className="account-kicker">SOLICITAÇÕES DE CLIENTES</span><h2>Pedidos e orçamentos</h2>
              {quoteResult.error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar os pedidos. Confira a migração de orçamentos.</p> : !quoteResult.data?.length ? <p>As solicitações de compra e de orçamento aparecerão aqui.</p> : <div className="quote-list">
                {quoteResult.data.map((request) => {
                  const offer = Array.isArray(request.offer) ? request.offer[0] : request.offer;
                  const payment = [...(request.payments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
                  return <article className="quote-maker-card" key={request.id}>
                    <div className="quote-card-heading" id={`request-${request.id}`}><div><span className="account-kicker">{request.request_type === "purchase" ? "SOLICITAÇÃO DE COMPRA" : "ORÇAMENTO"}</span><h3>{request.product_name}</h3><span className="quote-meta">Quantidade: {request.quantity}{request.due_date ? ` · Prazo desejado: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${request.due_date}T00:00:00Z`))}` : ""}</span></div><span className={`quote-status status-${request.status}`}>{!request.maker_read_at ? "Nova solicitação" : request.status === "pending" ? (request.request_type === "purchase" ? "Aguardando resposta" : "Aguardando proposta") : request.status === "offered" ? "Proposta enviada" : request.status === "accepted" ? (request.request_type === "purchase" ? "Disponibilidade confirmada" : "Proposta aceita") : request.status === "declined" ? (request.request_type === "purchase" ? "Pedido recusado" : "Proposta recusada") : "Cancelada"}</span></div>
                    {request.request_type === "purchase" && request.unit_price_brl != null && <p className="quote-meta">{formatBrl(request.unit_price_brl)} cada · total estimado {formatBrlTotal(request.unit_price_brl, request.quantity)}</p>}
                    {request.customization && <p className="quote-description">{request.customization}</p>}
                    {Array.isArray(request.deliveries) && request.deliveries.length > 0 && <div className="quote-delivery-status" aria-label="Status dos avisos externos">{request.deliveries.map((delivery) => <div key={delivery.id}><span>{delivery.channel === "email" ? "E-mail" : "WhatsApp"}: {delivery.status === "sent" ? "enviado" : delivery.status === "sending" ? "enviando" : delivery.status === "failed" ? "falhou" : "na fila"}</span>{delivery.status === "failed" && <form action={retryStoreNotificationDelivery}><input type="hidden" name="deliveryId" value={delivery.id} /><button className="button button-secondary" type="submit">Tentar novamente</button></form>}</div>)}</div>}
                    {!contactResult.error && !contactResult.data?.whatsapp_opt_in && <p className="quote-small-note">WhatsApp ainda não ativado. Cadastre o número e autorize os avisos para receber por esse canal.</p>}
                    {request.status === "pending" && store.status === "published" && (request.request_type === "purchase" ? <MakerPurchaseDecisionForm requestId={request.id} /> : <MakerQuoteOfferForm requestId={request.id} />)}
                    {offer && request.request_type === "quote" && <div className="quote-offer-summary"><strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(offer.total_brl))}</strong><span>Prazo: {offer.lead_days} dias · {offer.status === "accepted" ? "Aceita" : offer.status === "declined" ? "Encerrada" : "Aguardando comprador"}</span>{offer.terms && <p>{offer.terms}</p>}</div>}
                    {request.status === "accepted" && request.request_type === "purchase" && (payment?.status === "charged_back"
                      ? <p className="auth-notice is-error" role="status">O Mercado Pago registrou uma contestação deste pagamento. Consulte o caso no Mercado Pago e não cobre novamente esta solicitação.</p>
                      : payment?.status === "paid"
                      ? <p className="auth-notice is-success" role="status">Pagamento confirmado pelo Mercado Pago: {formatBrl(payment.total_cents / 100)} · comissão da plataforma {formatBrl(payment.marketplace_fee_cents / 100)}.</p>
                      : payment?.status === "partially_refunded" ? <p className="quote-small-note">O Mercado Pago registrou reembolso parcial desta compra.</p>
                        : payment?.status === "pending" ? <p className="quote-small-note">Pagamento iniciado pelo comprador e aguardando confirmação do Mercado Pago.</p>
                          : payment?.status === "refunded" ? <p className="quote-small-note">O pagamento desta compra foi reembolsado.</p>
                            : <p className="quote-small-note">Disponibilidade confirmada. O comprador pode iniciar o pagamento dos produtos; o frete é combinado à parte.</p>)}
                    {request.status === "accepted" && request.request_type !== "purchase" && <p className="quote-small-note">O comprador aceitou a proposta. Nenhum pagamento foi processado.</p>}
                  </article>;
                })}
              </div>}
            </section>
            <section className="account-card maker-products-card"><span className="account-kicker">PEDIDOS DE IMPRESSÃO 3D</span><h2>Solicitações personalizadas</h2>
              {customPrintResult.error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar pedidos personalizados. Confira a migração 021.</p> : !customPrintResult.data?.length ? <p>Solicitações compatíveis aparecerão aqui quando um comprador enviar um modelo.</p> : <div className="quote-list">
                {customPrintTargets.map((target) => {
                  const request = Array.isArray(target.request) ? target.request[0] : target.request;
                  const offer = Array.isArray(target.offer) ? target.offer[0] : target.offer;
                  if (!request) return null;
                  const payment = [...(request.payments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
                  const dimensions = [request.dimensions_x_mm, request.dimensions_y_mm, request.dimensions_z_mm]
                    .map((value) => (Number(value) * Number(request.scale_percent) / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })).join(" × ");
                  return <article className="quote-maker-card" id={`custom-${target.id}`} key={target.id}>
                    <div className="quote-card-heading"><div><span className="account-kicker">IMPRESSÃO PERSONALIZADA · {request.material_snapshot}</span><h3>{request.model_name}</h3></div><span className={`quote-status status-${target.status}`}>{target.status === "invited" ? "Nova solicitação" : target.status === "offered" ? "Proposta enviada" : target.status === "accepted" ? "Proposta escolhida" : target.status === "declined" ? "Recusada" : "Encerrada"}</span></div>
                    <p className="quote-meta">{request.quantity} peça(s) · escala {Number(request.scale_percent).toLocaleString("pt-BR")}% · dimensões finais {dimensions} mm{request.color ? ` · cor: ${request.color}` : ""}{request.due_date ? ` · prazo: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${request.due_date}T00:00:00Z`))}` : ""}</p>
                    <p className="quote-meta">Qualidade solicitada: {({ standard: "Padrão", fine: "Detalhada", fast: "Rápida", custom: "A combinar" } as Record<string, string>)[request.quality] ?? request.quality}</p>
                    {target.compatibility === "conditional" && <p className="quote-small-note">Convite para avaliação: confira o arquivo e as dimensões no fatiador; confirme também o bico instalado, a preparação e as condições do material antes de enviar sua proposta.</p>}
                    {request.notes && <p className="quote-description">{request.notes}</p>}
                    {Array.isArray(target.deliveries) && target.deliveries.length > 0 && <div className="quote-delivery-status" aria-label="Status dos avisos externos">{target.deliveries.map((delivery) => <div key={delivery.id}><span>{delivery.channel === "email" ? "E-mail" : "WhatsApp"}: {delivery.status === "sent" ? "enviado" : delivery.status === "sending" ? "enviando" : delivery.status === "failed" ? "falhou" : "na fila"}</span>{delivery.status === "failed" && <form action={retryCustomPrintNotificationDelivery}><input type="hidden" name="deliveryId" value={delivery.id} /><button className="button button-secondary" type="submit">Tentar novamente</button></form>}</div>)}</div>}
                    {(["invited", "offered", "accepted"] as string[]).includes(target.status) && request.status !== "completed" && <MakerCustomPrintFiles targetId={target.id} />}
                    {target.status === "invited" && ["pending", "offered"].includes(request.status) && store.status === "published" && <MakerCustomPrintOfferForm targetId={target.id} />}
                    {offer && <div className="quote-offer-summary"><strong>{formatBrl(offer.total_brl)}</strong><span>Prazo: {offer.lead_days} dias · {offer.status === "accepted" ? "Escolhida" : offer.status === "declined" ? "Recusada" : offer.status === "closed" ? "Encerrada" : "Aguardando comprador"}</span>{offer.terms && <p>{offer.terms}</p>}</div>}
                    {target.status === "accepted" && request.status === "accepted" && (payment?.status === "charged_back"
                      ? <p className="auth-notice is-error" role="status">O Mercado Pago registrou uma contestação. Consulte o caso no Mercado Pago; a produção não pode ser iniciada.</p>
                      : payment?.status === "paid"
                      ? <><p className="auth-notice is-success" role="status">Pagamento confirmado pelo Mercado Pago: {formatBrl(payment.total_cents / 100)} · comissão da plataforma {formatBrl(payment.marketplace_fee_cents / 100)}.</p><form action={advanceCustomPrintProduction}><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="nextStatus" value="in_production" /><button className="button button-primary" type="submit">Iniciar produção</button></form></>
                      : payment?.status === "partially_refunded" ? <p className="auth-notice is-error" role="status">O Mercado Pago registrou um reembolso parcial. Confirme o combinado com o comprador antes de produzir.</p>
                        : payment?.status === "refunded" ? <p className="quote-small-note">Pagamento reembolsado; a produção não pode ser iniciada.</p>
                          : payment?.status === "pending" || payment?.status === "creating" ? <p className="quote-small-note">Pagamento iniciado; aguardando confirmação do Mercado Pago antes de iniciar a produção.</p>
                            : <p className="quote-small-note">Proposta escolhida. A produção poderá começar após o pagamento ser confirmado.</p>)}
                    {target.status === "accepted" && request.status === "in_production" && <><p className="quote-small-note">Produção iniciada em {request.production_started_at ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(request.production_started_at)) : "data não informada"}.</p><form action={advanceCustomPrintProduction}><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="nextStatus" value="completed" /><button className="button button-primary" type="submit">Marcar como concluída</button></form></>}
                    {request.status === "completed" && <p className="quote-small-note">Impressão concluída em {request.production_completed_at ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(request.production_completed_at)) : "data não informada"}.</p>}
                    {Array.isArray(target.events) && target.events.length > 0 && <div className="quote-delivery-status"><strong>Histórico da solicitação</strong><ol className="custom-print-timeline">{[...target.events].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((event) => <li key={event.id}><time dateTime={event.created_at}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(event.created_at))}</time><span>{getCustomPrintEventLabel(event.event_type)}{event.event_type === "proposal_sent" ? ` · ${formatBrl(Number(event.event_data.total_brl))} · ${event.event_data.lead_days} dias` : ""}</span><small>{event.actor_user_id === actor.user.id ? "Você" : "Comprador"}</small></li>)}</ol></div>}
                  </article>;
                })}
              </div>}
            </section>
            <section className="account-card maker-products-card"><span className="account-kicker">CARRINHO MULTIVENDEDOR</span><h2>Pedidos de compra</h2>
              {orderResult.error ? <p className="auth-notice is-error" role="alert">Não foi possível carregar os pedidos do carrinho. Confira a migração do carrinho multivendedor.</p> : !orderResult.data?.length ? <p>Pedidos enviados pelo carrinho aparecerão aqui, agrupados por loja.</p> : <div className="quote-list">
                {resultado === "frete-ofertado" && <p className="auth-notice is-success" role="status">Cotação enviada ao comprador.</p>}
                {resultado === "frete-erro" && <p className="auth-notice is-error" role="alert">Não foi possível enviar a cotação. Confira os dados e se o pedido ainda aguarda uma tarifa.</p>}
                {resultado === "pedido-enviado" && <p className="auth-notice is-success" role="status">Rastreio enviado ao comprador.</p>}
                {resultado === "envio-erro" && <p className="auth-notice is-error" role="alert">Não foi possível atualizar o rastreio. Confira os dados e o pagamento confirmado.</p>}
                {orderResult.data.map((order) => <article className="quote-maker-card" key={order.id} id={`order-${order.id}`}>
                  <div className="quote-card-heading"><div><span className="account-kicker">PEDIDO DA LOJA · {order.store_name}</span><h3>{order.items?.length ?? 0} produto(s)</h3><span className="quote-meta">Recebido em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(order.created_at))}</span></div><span className={`quote-status status-${order.status}`}>{!order.maker_read_at ? "Novo pedido" : order.status === "pending" ? "Aguardando resposta" : order.status === "accepted" ? "Disponibilidade confirmada" : "Pedido recusado"}</span></div>
                  <ul className="cart-order-items">{order.items?.map((item, index) => <li key={`${item.product_name}-${index}`}><span>{item.quantity} × {item.product_name}</span><strong>{formatBrlTotal(item.unit_price_brl, item.quantity)}</strong></li>)}</ul>
                  {order.delivery_recipient_name && <div className="order-delivery-address"><span className="account-kicker">ENDEREÇO DE ENTREGA</span><strong>{order.delivery_recipient_name}</strong><span>{order.delivery_street}, {order.delivery_number}{order.delivery_complement ? ` · ${order.delivery_complement}` : ""}</span><span>{order.delivery_district} · {order.delivery_city}/{order.delivery_state_code} · CEP {order.delivery_postal_code?.replace(/(\d{5})(\d{3})/, "$1-$2")}</span>{order.delivery_reference && <small>Referência: {order.delivery_reference}</small>}<small>Use esses dados somente para preparar e combinar a entrega deste pedido.</small></div>}
                  {Array.isArray(order.deliveries) && order.deliveries.length > 0 && <div className="quote-delivery-status" aria-label="Status dos avisos externos">{order.deliveries.map((delivery) => <div key={delivery.id}><span>{delivery.channel === "email" ? "E-mail" : "WhatsApp"}: {delivery.status === "sent" ? "enviado" : delivery.status === "sending" ? "enviando" : delivery.status === "failed" ? "falhou" : "na fila"}</span>{delivery.status === "failed" && <form action={retryStoreNotificationDelivery}><input type="hidden" name="deliveryId" value={delivery.id} /><button className="button button-secondary" type="submit">Tentar novamente</button></form>}</div>)}</div>}
                  {order.status === "pending" && store.status === "published" && <MakerOrderDecisionForm orderId={order.id} />}
                  {order.status === "accepted" && order.shipping_quote_status === "awaiting_quote" && <form action={submitSellerOrderShippingQuote} className="maker-shipping-quote-form"><span className="account-kicker">COTAÇÃO DE FRETE</span><label>Transportadora<select name="carrier" defaultValue="correios" required><option value="correios">Correios</option><option value="melhor_envio">Melhor Envio</option><option value="transportadora">Outra transportadora</option></select></label><label>Serviço<input name="service" minLength={2} maxLength={120} placeholder="PAC, SEDEX…" required /></label><label>Valor do frete (R$)<input name="price" type="number" min="0" max="1000000" step="0.01" inputMode="decimal" required /></label><label>Prazo de transporte (dias)<input name="deliveryDays" type="number" min="1" max="365" step="1" required /></label><input type="hidden" name="orderId" value={order.id} /><button className="button button-primary" type="submit">Enviar cotação ao comprador</button><small>Informe o valor e o prazo do transporte separadamente do prazo de fabricação.</small></form>}
                  {order.status === "accepted" && order.shipping_quote_status === "declined" && <><p className="quote-small-note">O comprador recusou a cotação anterior. Envie uma nova opção.</p><form action={submitSellerOrderShippingQuote} className="maker-shipping-quote-form"><span className="account-kicker">NOVA COTAÇÃO DE FRETE</span><label>Transportadora<select name="carrier" defaultValue="correios" required><option value="correios">Correios</option><option value="melhor_envio">Melhor Envio</option><option value="transportadora">Outra transportadora</option></select></label><label>Serviço<input name="service" minLength={2} maxLength={120} placeholder="PAC, SEDEX…" required /></label><label>Valor do frete (R$)<input name="price" type="number" min="0" max="1000000" step="0.01" inputMode="decimal" required /></label><label>Prazo de transporte (dias)<input name="deliveryDays" type="number" min="1" max="365" step="1" required /></label><input type="hidden" name="orderId" value={order.id} /><button className="button button-primary" type="submit">Enviar nova cotação</button></form></>}
                  {order.status === "accepted" && order.shipping_quote_status === "offered" && <p className="quote-small-note">Cotação enviada: {order.shipping_carrier === "correios" ? "Correios" : order.shipping_carrier === "melhor_envio" ? "Melhor Envio" : "Transportadora"} · {order.shipping_service} · {formatBrl(Number(order.shipping_cost_cents) / 100)} · transporte em {order.shipping_delivery_days} dia(s). Aguardando comprador.</p>}
                  {order.status === "accepted" && order.shipping_quote_status === "accepted" && <p className="quote-small-note">Frete aceito pelo comprador: {order.shipping_service} · {formatBrl(Number(order.shipping_cost_cents) / 100)} · transporte em {order.shipping_delivery_days} dia(s).</p>}
                  {order.status === "accepted" && (order.payments?.some((payment) => payment.status === "charged_back")
                    ? <p className="auth-notice is-error" role="status">O Mercado Pago registrou uma contestação deste pagamento. Consulte o caso no Mercado Pago e não cobre novamente este pedido.</p>
                    : order.payments?.some((payment) => payment.status === "paid")
                    ? <p className="auth-notice is-success" role="status">Pagamento confirmado pelo Mercado Pago: {formatBrl(order.payments.find((payment) => payment.status === "paid")!.total_cents / 100)} · comissão da plataforma {formatBrl(order.payments.find((payment) => payment.status === "paid")!.marketplace_fee_cents / 100)}.</p>
                    : order.payments?.some((payment) => payment.status === "partially_refunded")
                      ? <p className="quote-small-note">O Mercado Pago registrou reembolso parcial deste pedido.</p>
                      : order.payments?.some((payment) => payment.status === "pending")
                      ? <p className="quote-small-note">Pagamento iniciado pelo comprador e aguardando confirmação do Mercado Pago.</p>
                      : order.payments?.some((payment) => payment.status === "refunded")
                        ? <p className="quote-small-note">O pagamento deste pedido foi reembolsado.</p>
                        : <p className="quote-small-note">A disponibilidade foi confirmada. O comprador poderá pagar após aceitar sua cotação de frete.</p>)}
                  {order.status === "accepted" && order.shipping_quote_status === "accepted" && order.payments?.some((payment) => payment.status === "paid") && !order.payments?.some((payment) => payment.status === "charged_back") && order.shipment_status === "awaiting_shipment" && <form action={markSellerPurchaseOrderShipped} className="maker-shipping-quote-form"><span className="account-kicker">RASTREAMENTO DO ENVIO</span><label>Código de rastreio<input name="trackingCode" maxLength={100} required /></label><label>Link seguro de rastreio (opcional)<input name="trackingUrl" type="url" maxLength={2048} placeholder="https://…" /></label><label>Previsão de entrega (opcional)<input name="expectedDate" type="date" /></label><input type="hidden" name="orderId" value={order.id} /><button className="button button-primary" type="submit">Marcar como enviado</button></form>}
                  {order.shipment_status !== "awaiting_shipment" && <div className="order-delivery-address"><span className="account-kicker">ENVIO · {order.shipment_status === "shipped" ? "EM TRÂNSITO" : order.shipment_status === "delivered" ? "ENTREGUE" : "CONCLUÍDO"}</span><strong>{order.shipping_service}</strong><span>Código: {order.shipping_tracking_code}</span>{order.shipping_expected_date && <span>Previsão: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${order.shipping_expected_date}T00:00:00Z`))}</span>}{order.shipping_tracking_url && <a href={order.shipping_tracking_url} target="_blank" rel="noreferrer">Abrir rastreio</a>}</div>}
                  {Array.isArray(order.events) && order.events.length > 0 && <div className="quote-delivery-status" aria-label="Histórico do pedido"><strong>Histórico</strong>{[...order.events].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((event) => <div key={event.id}><span>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))} · {event.description}</span></div>)}</div>}
                </article>)}
              </div>}
            </section>
            {store.status === "published" && !productResult.error && !categoryResult.error && <MakerProductForm storeId={store.id} categories={categoryResult.data ?? []} />}
            {store.status !== "published" && <p className="account-next-step">O cadastro de anúncios será liberado quando a loja for aprovada pela equipe.</p>}
          </>
        )}
      </main>
      <footer className="site-footer"><div className="shell footer-inner"><Link className="brand footer-brand" href="/"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>vira<span className="brand-strong">peça</span><small>3D</small></span></Link><p>Painel da loja ViraPeça 3D.</p><span>© 2026 ViraPeça 3D</span></div></footer>
    </>
  );
}
