import { reportDigitalAsset } from "@/app/produtos/actions";

export function DigitalAssetReportForm({ productId, slug, authorized }: { productId: string; slug: string; authorized: boolean }) {
  return <details className="digital-report-form"><summary>Denunciar possível violação de direitos</summary>
    {authorized ? <form action={reportDigitalAsset} className="auth-form">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="slug" value={slug} />
      <label>Motivo<select name="reason" required defaultValue="copyright"><option value="copyright">Direitos autorais</option><option value="trademark">Marca registrada</option><option value="other">Outro direito</option></select></label>
      <label>Explique a denúncia<textarea name="details" minLength={20} maxLength={2000} rows={4} required /></label>
      <button className="button button-secondary" type="submit">Enviar para análise</button>
    </form> : <p><a href="/conta">Entre na conta</a> para enviar uma denúncia. A equipe de moderação receberá os detalhes.</p>}
  </details>;
}
