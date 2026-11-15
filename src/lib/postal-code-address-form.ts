import type { BrazilianPostalAddress } from "./brazilian-postal-code";

type AddressInput = { value: string; dataset: { manual?: string } };
type AddressFieldNames = Record<keyof BrazilianPostalAddress, string>;

export function applyPostalCodeAddress(
  form: Pick<HTMLFormElement, "elements">,
  address: BrazilianPostalAddress,
  names: AddressFieldNames,
) {
  for (const key of Object.keys(names) as (keyof BrazilianPostalAddress)[]) {
    const input = form.elements.namedItem(names[key]) as AddressInput | null;
    if (input && input.dataset.manual !== "true" && address[key]) input.value = address[key];
  }
}
