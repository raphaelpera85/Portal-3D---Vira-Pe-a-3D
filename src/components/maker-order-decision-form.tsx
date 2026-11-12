import { respondToSellerPurchaseOrder } from "@/app/orcamentos/actions";

export function MakerOrderDecisionForm({ orderId }: { orderId: string }) {
  return <div className="quote-actions">
    <form action={respondToSellerPurchaseOrder}><input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="response" value="accept" /><button className="button button-primary" type="submit">Confirmar disponibilidade</button></form>
    <form action={respondToSellerPurchaseOrder}><input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="response" value="decline" /><button className="button button-secondary" type="submit">Recusar pedido</button></form>
  </div>;
}
