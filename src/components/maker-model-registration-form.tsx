import { modelShowcaseCategories } from "@/lib/model-showcase";
import { submitCreatorModel } from "@/app/painel/maker/model-actions";

export function MakerModelRegistrationForm({ availableAssets }: { availableAssets: string[] }) {
  return <section id="modelos-3d" className="account-card maker-products-card" aria-labelledby="maker-model-registration-title">
    <span className="account-kicker">COLEÇÃO DA COMUNIDADE</span>
    <h2 id="maker-model-registration-title">Cadastrar modelo 3D</h2>
    <p>Escolha um arquivo 3MF que já está versionado no portal. Após a revisão, ele aparece na coleção pública com autoria e tags.</p>
    {availableAssets.length ? <form action={submitCreatorModel} className="auth-form">
      <div className="equipment-form-grid">
        <label>Arquivo do Git<select name="assetPath" required defaultValue=""><option value="" disabled>Escolha um arquivo 3MF</option>{availableAssets.map((assetPath) => <option value={assetPath} key={assetPath}>{assetPath.split("/").at(-1)}</option>)}</select></label>
        <label>Nome do modelo<input name="name" minLength={2} maxLength={120} required /></label>
        <label>Categoria<select name="categorySlug" required defaultValue=""><option value="" disabled>Escolha uma categoria</option>{modelShowcaseCategories.map(({ name, slug }) => <option value={slug} key={slug}>{name}</option>)}</select></label>
        <label>Criador original<input name="creatorName" minLength={2} maxLength={100} required /></label>
        <label>Tags separadas por vírgula<input name="tags" maxLength={400} placeholder="ex.: dragão, articulado, brinquedo" required /></label>
        <label>Link da fonte (opcional)<input name="sourceUrl" type="url" maxLength={2048} placeholder="https://..." /></label>
      </div>
      <label className="creator-model-rights"><input type="checkbox" name="rightsConfirmed" required /> Confirmo que tenho os direitos ou autorização para publicar este arquivo e os dados informados.</label>
      <button className="button button-primary" type="submit">Enviar para revisão</button>
    </form> : <p className="empty-state">Todos os arquivos 3MF atualmente no Git já estão cadastrados. Um novo arquivo precisa ser adicionado à pasta <code>models/</code> e enviado ao Git antes de aparecer aqui.</p>}
  </section>;
}
