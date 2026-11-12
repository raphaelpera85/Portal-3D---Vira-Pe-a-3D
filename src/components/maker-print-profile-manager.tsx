"use client";

import { deleteMakerPrintProfile, saveMakerPrintProfile } from "@/app/painel/maker/actions";
import type { PrintProfileType } from "@/lib/print-profiles";

type Choice = { id: string; name: string };
type PrintProfile = {
  id: string; product_id: string; profile_name: string; profile_type: PrintProfileType;
  sharing_scope: "private" | "community" | "official"; review_status: "draft" | "pending" | "published" | "rejected"; review_note: string | null;
  maker_printer_id: string | null; printer_snapshot: string; material_id: string | null; material_snapshot: string;
  nozzle_id: string | null; nozzle_snapshot: string; layer_height_mm: number | string | null;
  infill_percent: number | string | null; wall_count: number | null; supports: boolean; orientation: string;
  scale_percent: number | string; quantity: number; print_hours: number | string | null;
  material_grams: number | string | null; material_by_color: Array<{ color: string; grams: number }>;
};

const profileTypes: Array<{ value: PrintProfileType; label: string }> = [
  { value: "economic", label: "Econômico" },
  { value: "fast", label: "Rápido" },
  { value: "detailed", label: "Detalhado" },
  { value: "multicolor", label: "Multicolorido" },
  { value: "custom", label: "Personalizado" },
];
const value = (number: number | string | null | undefined) => number == null ? "" : String(number);

function ProfileForm({ storeId, products, printers, materials, nozzles, profile }: {
  storeId: string; products: Choice[]; printers: Choice[]; materials: Choice[]; nozzles: Choice[]; profile?: PrintProfile;
}) {
  const selectedMaterialId = profile?.material_id && materials.some(({ id }) => id === profile.material_id) ? profile.material_id : "";
  const selectedNozzleId = profile?.nozzle_id && nozzles.some(({ id }) => id === profile.nozzle_id) ? profile.nozzle_id : "";
  return <form className="auth-form print-profile-form" action={saveMakerPrintProfile}>
    <input type="hidden" name="storeId" value={storeId} />
    {profile && <input type="hidden" name="profileId" value={profile.id} />}
    {profile?.sharing_scope === "community" ? <input type="hidden" name="sharingScope" value="community" /> : <label>Visibilidade<select name="sharingScope" defaultValue="private"><option value="private">Privado, só para minha loja</option><option value="community">Enviar para revisão da comunidade</option></select><small>Perfis enviados ficam públicos somente após aprovação administrativa.</small></label>}
    <div className="print-profile-fields">
      <label>Produto<select name="productId" defaultValue={profile?.product_id ?? ""} required><option value="" disabled>Selecione um produto da loja</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
      <label>Nome do perfil<input name="name" minLength={2} maxLength={100} defaultValue={profile?.profile_name ?? ""} placeholder="Ex.: PLA detalhado" required /></label>
      <label>Tipo<select name="profileType" defaultValue={profile?.profile_type ?? "custom"}>{profileTypes.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
      <label>Impressora cadastrada<select name="printerId" defaultValue={profile?.maker_printer_id ?? ""}><option value="">Informar modelo manualmente</option>{printers.map((printer) => <option value={printer.id} key={printer.id}>{printer.name}</option>)}</select></label>
      <label>Impressora / modelo<input name="printerName" maxLength={120} minLength={2} defaultValue={profile?.printer_snapshot ?? ""} placeholder="Ex.: Bambu Lab A1 mini" /></label>
      <label>Material do catálogo<select name="materialId" defaultValue={selectedMaterialId}><option value="">Informar material manualmente</option>{materials.map((material) => <option value={material.id} key={material.id}>{material.name}</option>)}</select></label>
      <label>Material<input name="materialName" maxLength={120} minLength={2} defaultValue={profile?.material_snapshot ?? ""} placeholder="Ex.: PLA, PETG ou resina 405 nm" /></label>
      <label>Bico do catálogo<select name="nozzleId" defaultValue={selectedNozzleId}><option value="">Informar bico manualmente</option>{nozzles.map((nozzle) => <option value={nozzle.id} key={nozzle.id}>{nozzle.name}</option>)}</select></label>
      <label>Bico<input name="nozzleName" maxLength={120} minLength={2} defaultValue={profile?.nozzle_snapshot ?? ""} placeholder="Ex.: 0,4 mm aço temperado" /></label>
      <label>Altura de camada (mm)<input name="layerHeightMm" type="number" min="0.01" max="5" step="0.001" defaultValue={value(profile?.layer_height_mm)} /></label>
      <label>Preenchimento (%)<input name="infillPercent" type="number" min="0" max="100" step="0.01" defaultValue={value(profile?.infill_percent)} /></label>
      <label>Paredes<input name="wallCount" type="number" min="0" max="100" step="1" defaultValue={value(profile?.wall_count)} /></label>
      <label>Orientação<input name="orientation" maxLength={80} defaultValue={profile?.orientation ?? ""} placeholder="Ex.: deitado, face plana na mesa" /></label>
      <label>Escala (%)<input name="scalePercent" type="number" min="10" max="300" step="0.01" defaultValue={value(profile?.scale_percent ?? 100)} required /></label>
      <label>Quantidade de produtos no lote<input name="quantity" type="number" min="1" max="1000000" step="1" defaultValue={value(profile?.quantity ?? 1)} required /></label>
      <label>Tempo total (horas)<input name="printHours" type="number" min="0" max="100000" step="0.001" defaultValue={value(profile?.print_hours)} /></label>
      <label>Material total (g)<input name="materialGrams" type="number" min="0" max="1000000" step="0.001" defaultValue={value(profile?.material_grams)} /></label>
    </div>
    <label className="profile-supports"><input name="supports" type="checkbox" defaultChecked={profile?.supports ?? false} /> Usa suportes</label>
    <label>Consumo por cor (opcional)<textarea name="materialByColor" rows={3} maxLength={400} defaultValue={(profile?.material_by_color ?? []).map(({ color, grams }) => `${color}; ${grams}`).join("\n")} placeholder="#336699; 20&#10;#FFAA00; 4" /><small>Uma cor por linha no formato hexadecimal; gramas. A soma não pode exceder o material total.</small></label>
    <button className="button button-primary" type="submit">{profile ? "Salvar perfil" : "Cadastrar perfil"}</button>
  </form>;
}

export function MakerPrintProfileManager({ storeId, products, printers, materials, nozzles, profiles, error }: {
  storeId: string; products: Choice[]; printers: Choice[]; materials: Choice[]; nozzles: Choice[]; profiles: PrintProfile[]; error: boolean;
}) {
  return <section className="account-card maker-products-card print-profile-section" id="perfis">
    <span className="account-kicker">CONFIGURAÇÕES DE FABRICAÇÃO</span><h2>Perfis de impressão</h2>
    <p>Registre presets por produto. Mantenha-os privados ou envie à equipe para revisão antes de compartilhar com a comunidade.</p>
    {error ? <p className="auth-notice is-error" role="alert">Os perfis de impressão ficarão disponíveis após aplicar a migração 016.</p> : <>
      {!products.length && <p className="quote-small-note">Cadastre um produto antes de vincular um perfil de impressão.</p>}
      <details className="equipment-edit-form" open={profiles.length === 0 && products.length > 0}>
        <summary>Adicionar perfil a um produto</summary>
        {products.length > 0 && <ProfileForm storeId={storeId} products={products} printers={printers} materials={materials} nozzles={nozzles} />}
      </details>
      {profiles.length === 0 ? <p>Nenhum perfil cadastrado nesta loja.</p> : <div className="print-profile-list">{profiles.map((profile) => <article className="print-profile-card" key={profile.id}>
        <div className="print-profile-heading"><div><span className="account-kicker">{profileTypes.find(({ value: kind }) => kind === profile.profile_type)?.label ?? "Personalizado"} · {profile.sharing_scope === "official" ? "OFICIAL" : profile.sharing_scope === "community" ? profile.review_status === "published" ? "COMUNITÁRIO · PUBLICADO" : profile.review_status === "rejected" ? "RECUSADO" : "EM ANÁLISE" : "PRIVADO"}</span><h3>{products.find(({ id }) => id === profile.product_id)?.name ?? "Produto arquivado"}</h3><p>{profile.profile_name}</p></div></div>
        {profile.review_note && <p className="quote-small-note">Retorno da revisão: {profile.review_note}</p>}
        <dl className="print-profile-facts">
          <div><dt>Impressora</dt><dd>{profile.printer_snapshot}</dd></div><div><dt>Material</dt><dd>{profile.material_snapshot}</dd></div><div><dt>Bico</dt><dd>{profile.nozzle_snapshot}</dd></div>
          <div><dt>Lote</dt><dd>{profile.quantity} produto(s) · {profile.print_hours == null ? "tempo não informado" : `${value(profile.print_hours)} h`}</dd></div>
          <div><dt>Consumo total</dt><dd>{profile.material_grams == null ? "Não informado" : `${value(profile.material_grams)} g`}</dd></div>
          <div><dt>Configuração</dt><dd>{profile.layer_height_mm == null ? "Camada não informada" : `${value(profile.layer_height_mm)} mm`}{profile.infill_percent == null ? "" : ` · ${value(profile.infill_percent)}% preenchimento`}{profile.wall_count == null ? "" : ` · ${profile.wall_count} paredes`}{profile.supports ? " · suportes" : ""}</dd></div>
        </dl>
        {profile.material_by_color?.length > 0 && <ul className="print-profile-colors">{profile.material_by_color.map(({ color, grams }) => <li key={color}><i style={{ backgroundColor: color }} />{color} · {value(grams)} g</li>)}</ul>}
        {(profile.sharing_scope === "private" || profile.review_status === "pending" || profile.review_status === "rejected") && <details className="equipment-edit-form"><summary>{profile.sharing_scope === "private" ? "Editar perfil" : "Editar e reenviar à revisão"}</summary><ProfileForm storeId={storeId} products={products} printers={printers} materials={materials} nozzles={nozzles} profile={profile} /></details>}
        {(profile.sharing_scope === "private" || profile.review_status === "pending" || profile.review_status === "rejected") && <form action={deleteMakerPrintProfile} onSubmit={(event) => { if (!window.confirm(`Excluir o perfil “${profile.profile_name}”?`)) event.preventDefault(); }}><input type="hidden" name="profileId" value={profile.id} /><button className="price-history-delete" type="submit">{profile.sharing_scope === "private" ? "Excluir perfil" : "Retirar submissão"}</button></form>}
      </article>)}</div>}
    </>}
  </section>;
}
