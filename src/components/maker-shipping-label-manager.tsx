import { formatBrl } from "@/lib/money";
import { addSellerOrderShippingLabelToCart, buySellerOrderShippingLabel, generateSellerOrderShippingLabel, printSellerOrderShippingLabel } from "@/app/painel/maker/actions";

type Label = {
  id: string; status: string; shipping_cost_cents: number | null; provider_status: string | null;
  tracking_code: string | null; tracking_url: string | null; print_url: string | null;
};

export function MakerShippingLabelManager({ orderId, label, result, enabled }: { orderId: string; label: Label | null; result?: string; enabled: boolean }) {
  return <section className="maker-shipping-label-manager">
    <span className="account-kicker">ETIQUETA E RASTREIO · MELHOR ENVIO</span>
    {result === "etiqueta-dados-erro" && <p className="auth-notice is-error" role="alert">Confira NF-e, CPF, telefone e as medidas/peso da embalagem.</p>}
    {result === "etiqueta-pedido-erro" && <p className="auth-notice is-error" role="alert">A etiqueta exige pagamento confirmado, cotação Melhor Envio aceita e dados completos do remetente.</p>}
    {result === "etiqueta-configurar" && <p className="auth-notice is-error" role="alert">Configure Melhor Envio e as migrações antes de emitir etiquetas.</p>}
    {result === "etiqueta-erro" && <p className="auth-notice is-error" role="alert">Não foi possível preparar a etiqueta. Verifique a conta Melhor Envio; se ela estiver no carrinho, não tente criar outra.</p>}
    {result === "etiqueta-no-carrinho" && <p className="auth-notice is-success" role="status">Frete adicionado ao carrinho do Melhor Envio. A carteira ainda não foi debitada.</p>}
    {result === "etiqueta-compra-incerta" && <p className="auth-notice is-error" role="alert">O resultado do pagamento do frete não foi confirmado. Confira a conta Melhor Envio antes de qualquer nova tentativa; o portal bloqueou a repetição para evitar cobrança duplicada.</p>}
    {result === "etiqueta-paga" && <p className="auth-notice is-success" role="status">Etiqueta paga pela carteira do vendedor. Agora solicite a geração.</p>}
    {result === "etiqueta-gerando" && <p className="auth-notice" role="status">Geração solicitada. O Melhor Envio notificará o portal quando a etiqueta estiver pronta.</p>}
    {result === "etiqueta-impressa" && <p className="auth-notice is-success" role="status">Link privado de impressão criado.</p>}
    {result === "etiqueta-geracao-erro" && <p className="auth-notice is-error" role="alert">Não foi possível solicitar a geração. Nenhum novo pagamento foi feito; atualize o estado e tente novamente.</p>}
    {result === "etiqueta-impressao-erro" && <p className="auth-notice is-error" role="alert">O Melhor Envio ainda não liberou o link privado de impressão. Aguarde a notificação da etiqueta pronta e tente novamente.</p>}
    {result === "etiqueta-ja-criada" && <p className="auth-notice is-error" role="alert">Já existe um envio para este pedido. Confira o estado abaixo antes de tentar novamente.</p>}
    {result?.startsWith("etiqueta-") && result.endsWith("-erro") && !["etiqueta-dados-erro", "etiqueta-pedido-erro", "etiqueta-configurar", "etiqueta-erro", "etiqueta-geracao-erro", "etiqueta-impressao-erro"].includes(result) && <p className="auth-notice is-error" role="alert">Não foi possível concluir esta etapa. Atualize o painel e confira o estado da etiqueta.</p>}
    {!label && !enabled && <p className="quote-small-note">Reconecte a conta Melhor Envio para autorizar as permissões de carrinho, compra, geração, impressão e rastreio.</p>}
    {label ? <div className="order-delivery-address">
      <strong>{label.status === "carted" ? "Aguardando confirmação de compra" : label.status === "checkout_uncertain" ? "Pagamento precisa de conferência" : label.status === "paid" ? "Frete pago · aguardando geração" : label.status === "generating" ? "Etiqueta em geração" : label.status === "generated" ? "Etiqueta pronta" : label.status === "posted" ? "Encomenda postada" : label.status === "delivered" ? "Encomenda entregue" : label.status === "cancelled" ? "Etiqueta cancelada" : "Etiqueta em análise"}</strong>
      {label.shipping_cost_cents !== null && <span>Custo debitado do vendedor: {formatBrl(label.shipping_cost_cents / 100)}</span>}
      {label.provider_status && <small>Status Melhor Envio: {label.provider_status}</small>}
      {label.tracking_code && <span>Código: {label.tracking_code}</span>}
      {label.tracking_url && <a href={label.tracking_url} target="_blank" rel="noreferrer">Acompanhar entrega ↗</a>}
      {label.print_url && <a href={label.print_url} target="_blank" rel="noreferrer">Abrir etiqueta para impressão ↗</a>}
      {label.status === "carted" && <form action={buySellerOrderShippingLabel} className="maker-shipping-quote-form"><input type="hidden" name="orderId" value={orderId} /><label className="quote-consent"><input type="checkbox" name="confirmPurchase" value="yes" required /> Confirmo a compra da etiqueta por {formatBrl((label.shipping_cost_cents ?? 0) / 100)} debitada da minha carteira Melhor Envio.</label><button className="button button-primary" type="submit">Confirmar e pagar etiqueta</button></form>}
      {label.status === "paid" && <form action={generateSellerOrderShippingLabel}><input type="hidden" name="orderId" value={orderId} /><button className="button button-secondary" type="submit">Solicitar geração da etiqueta</button></form>}
      {label.status === "generated" && !label.print_url && <form action={printSellerOrderShippingLabel}><input type="hidden" name="orderId" value={orderId} /><button className="button button-secondary" type="submit">Gerar link privado de impressão</button></form>}
    </div> : enabled ? <form action={addSellerOrderShippingLabelToCart} className="maker-shipping-quote-form">
      <p>Informações enviadas ao Melhor Envio para criar a etiqueta. A NF-e e o CPF são usados nesta solicitação e não ficam salvos no portal. O custo só será debitado quando você confirmar a compra na próxima etapa.</p>
      <label>Chave de acesso da NF-e<input name="invoiceKey" inputMode="numeric" minLength={44} maxLength={54} pattern="[0-9.\- /]{44,54}" required /></label>
      <label>CPF do destinatário<input name="recipientDocument" inputMode="numeric" minLength={11} maxLength={14} pattern="[0-9.\-]{11,14}" required /></label>
      <label>Telefone do destinatário<input name="recipientPhone" type="tel" inputMode="tel" minLength={10} maxLength={16} placeholder="DDD + número" required /></label>
      <div className="equipment-form-grid"><label>Largura embalada (cm)<input name="packageWidthCm" type="number" min="1" max="1000" step="0.1" required /></label><label>Altura embalada (cm)<input name="packageHeightCm" type="number" min="1" max="1000" step="0.1" required /></label><label>Comprimento embalado (cm)<input name="packageLengthCm" type="number" min="1" max="1000" step="0.1" required /></label><label>Peso embalado (kg)<input name="packageWeightKg" type="number" min="0.01" max="30000" step="0.01" required /></label></div>
      <input type="hidden" name="orderId" value={orderId} />
      <button className="button button-primary" type="submit">Adicionar etiqueta ao carrinho do Melhor Envio</button>
    </form> : null}
  </section>;
}
