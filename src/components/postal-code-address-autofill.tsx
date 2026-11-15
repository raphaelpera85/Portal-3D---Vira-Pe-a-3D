"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { lookupBrazilianPostalCode } from "@/lib/brazilian-postal-code";
import { applyPostalCodeAddress } from "@/lib/postal-code-address-form";

type FieldNames = { street: string; district: string; city: string; stateCode: string };

export function PostalCodeAddressAutofill({
  name = "postalCode",
  defaultValue = "",
  label = "CEP",
  names,
}: {
  name?: string;
  defaultValue?: string;
  label?: string;
  names: FieldNames;
}) {
  const lastLookup = useRef("");
  const lookupRequest = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const markManualValue = (event: Event) => {
      const input = event.target;
      if (input instanceof HTMLInputElement && Object.values(names).includes(input.name)) input.dataset.manual = "true";
    };
    form.addEventListener("input", markManualValue);
    return () => form.removeEventListener("input", markManualValue);
  }, [names]);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const digits = input.value.replace(/\D/g, "");
    if (digits.length !== 8) {
      lastLookup.current = "";
      lookupRequest.current++;
      setStatus("");
      return;
    }
    if (lastLookup.current === digits) return;

    lastLookup.current = digits;
    const requestId = ++lookupRequest.current;
    setStatus("Buscando endereço…");
    try {
      const address = await lookupBrazilianPostalCode(digits);
      if (requestId !== lookupRequest.current || !input.isConnected || digits !== input.value.replace(/\D/g, "")) return;
      if (!address) {
        setStatus("CEP não encontrado. Preencha o endereço manualmente.");
        return;
      }
      if (!input.form) return;
      applyPostalCodeAddress(input.form, address, names);
      setStatus("Endereço preenchido pelo CEP. Confira os dados e informe o número.");
    } catch {
      if (requestId === lookupRequest.current) setStatus("Não foi possível consultar o CEP. Preencha o endereço manualmente.");
    }
  }

  return <label>{label}<input ref={inputRef} name={name} inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}-?[0-9]{3}" maxLength={9} defaultValue={defaultValue} placeholder="00000-000" onChange={handleChange} required />{status && <small role="status" aria-live="polite">{status}</small>}</label>;
}
