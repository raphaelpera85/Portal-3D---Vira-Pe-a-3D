"use client";

import { deleteBuyerAddress, saveBuyerAddress } from "@/app/conta/actions";

type Address = {
  id: string; label: string; recipient_name: string; postal_code: string; street: string; number: string;
  complement: string; district: string; city: string; state_code: string; reference: string; is_default: boolean;
};

function AddressForm({ address, first }: { address?: Address; first?: boolean }) {
  return <form className="auth-form buyer-address-form" action={saveBuyerAddress}>
    {address && <input type="hidden" name="id" value={address.id} />}
    <div className="buyer-address-fields">
      <label>Como identificar<input name="label" minLength={2} maxLength={40} defaultValue={address?.label ?? ""} placeholder="Casa, trabalho…" autoComplete="off" required /></label>
      <label>Nome de quem recebe<input name="recipientName" minLength={2} maxLength={100} defaultValue={address?.recipient_name ?? ""} autoComplete="name" required /></label>
      <label>CEP<input name="postalCode" inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}-?[0-9]{3}" maxLength={9} defaultValue={address?.postal_code ?? ""} placeholder="00000-000" required /></label>
      <label>Rua ou avenida<input name="street" minLength={2} maxLength={120} autoComplete="address-line1" defaultValue={address?.street ?? ""} required /></label>
      <label>Número<input name="number" maxLength={20} autoComplete="address-line2" defaultValue={address?.number ?? ""} placeholder="Use S/N se não houver" required /></label>
      <label>Complemento (opcional)<input name="complement" maxLength={100} defaultValue={address?.complement ?? ""} /></label>
      <label>Bairro<input name="district" minLength={2} maxLength={100} autoComplete="address-level3" defaultValue={address?.district ?? ""} required /></label>
      <label>Cidade<input name="city" minLength={2} maxLength={100} autoComplete="address-level2" defaultValue={address?.city ?? ""} required /></label>
      <label>UF<input name="stateCode" minLength={2} maxLength={2} autoComplete="address-level1" defaultValue={address?.state_code ?? ""} placeholder="SP" required /></label>
      <label>Referência (opcional)<input name="reference" maxLength={200} defaultValue={address?.reference ?? ""} placeholder="Próximo ao…" /></label>
    </div>
    <label className="buyer-address-default"><input type="checkbox" name="isDefault" defaultChecked={address?.is_default ?? first ?? false} /> Usar como endereço principal</label>
    <button className="button button-primary" type="submit">{address ? "Salvar endereço" : "Adicionar endereço"}</button>
  </form>;
}

export function BuyerAddressManager({ addresses, error, result }: { addresses: Address[]; error: boolean; result?: string }) {
  return <section className="account-card buyer-address-section" id="enderecos">
    <span className="account-kicker">DADOS DE ENTREGA</span><h2>Meus endereços</h2>
    <p className="buyer-address-intro">Escolha um endereço no carrinho para enviá-lo às lojas e combinar a entrega. O portal ainda não calcula frete nem processa pagamentos.</p>
    {result === "salvo" && <p className="auth-notice is-success" role="status">Endereço salvo.</p>}
    {result === "excluido" && <p className="auth-notice is-success" role="status">Endereço excluído.</p>}
    {result === "erro" && <p className="auth-notice is-error" role="alert">Não foi possível salvar o endereço. Confira os campos e a migração 017.</p>}
    {error ? <p className="auth-notice is-error" role="alert">O cadastro de endereços estará disponível após aplicar a migração 017.</p> : <>
      {addresses.length > 0 && <ul className="buyer-address-list">{addresses.map((address) => <li key={address.id}>
        <div className="buyer-address-summary"><div><span className="account-kicker">{address.label}{address.is_default ? " · PRINCIPAL" : ""}</span><strong>{address.recipient_name}</strong><span>{address.street}, {address.number}{address.complement ? ` · ${address.complement}` : ""}</span><span>{address.district} · {address.city}/{address.state_code} · CEP {address.postal_code.replace(/(\d{5})(\d{3})/, "$1-$2")}</span></div>
          {address.reference && <small>Referência: {address.reference}</small>}
        </div>
        <details className="equipment-edit-form"><summary>Editar endereço</summary><AddressForm address={address} /></details>
        <form action={deleteBuyerAddress} onSubmit={(event) => { if (!window.confirm(`Excluir o endereço “${address.label}”? Se ele for o principal, outro endereço será promovido.`)) event.preventDefault(); }}><input type="hidden" name="addressId" value={address.id} /><button className="price-history-delete" type="submit">Excluir endereço</button></form>
      </li>)}</ul>}
      <details className="equipment-edit-form" open={addresses.length === 0}><summary>Adicionar endereço</summary><AddressForm first={addresses.length === 0} /></details>
    </>}
  </section>;
}
