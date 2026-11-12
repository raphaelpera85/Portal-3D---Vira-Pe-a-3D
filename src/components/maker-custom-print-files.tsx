"use client";

import { useActionState } from "react";
import { createCustomPrintFileLinks, type CustomPrintFileLinksState } from "@/app/painel/maker/actions";

const initialState: CustomPrintFileLinksState = { message: "", links: [] };

export function MakerCustomPrintFiles({ targetId }: { targetId: string }) {
  const [state, action, pending] = useActionState(createCustomPrintFileLinks, initialState);
  return <div className="custom-print-files">
    <form action={action}><input type="hidden" name="targetId" value={targetId} /><button className="button button-secondary" type="submit" disabled={pending}>{pending ? "Preparando arquivos…" : "Acessar arquivos do modelo"}</button></form>
    {state.message && <p role="status">{state.message}</p>}
    {state.links.map((file) => <a key={file.name} href={file.url} target="_blank" rel="noreferrer" download>{file.name}</a>)}
  </div>;
}
