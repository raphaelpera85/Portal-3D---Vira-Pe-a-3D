import { respondToProductPurchaseRequest } from "@/app/orcamentos/actions";

export function MakerPurchaseDecisionForm({ requestId }: { requestId: string }) {
  return <div className="quote-actions purchase-decision-actions">
    <form action={respondToProductPurchaseRequest}><input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="response" value="accept" /><button className="button button-primary" type="submit">Confirmar disponibilidade</button></form>
    <form action={respondToProductPurchaseRequest}><input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="response" value="decline" /><button className="button button-secondary" type="submit">Recusar pedido</button></form>
  </div>;
}
