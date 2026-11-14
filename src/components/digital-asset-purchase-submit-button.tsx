"use client";

import { useFormStatus } from "react-dom";

export function DigitalAssetPurchaseSubmitButton() {
  const { pending } = useFormStatus();
  return <button className="button button-primary" type="submit" disabled={pending}>
    {pending ? "Enviando solicitação…" : "Continuar para o pagamento"}
  </button>;
}
