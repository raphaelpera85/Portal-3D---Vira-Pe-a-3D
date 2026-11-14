"use client";

import { useState } from "react";
import type { CatalogOptionKind } from "@/lib/catalog-options";

type Option = { id: string; label: string };

export function CatalogOptionSelect({
  kind, name, label, selectedValue, options: initialOptions,
}: { kind: CatalogOptionKind; name: string; label: string; selectedValue: string; options: Option[] }) {
  const [options, setOptions] = useState(initialOptions);
  const [selected, setSelected] = useState(selectedValue);
  const [query, setQuery] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);

  async function load(reset: boolean) {
    if (loading) return;
    const nextPage = reset ? 0 : page + 1;
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ kind, q: query, offset: String(nextPage * 50) });
      const response = await fetch(`/api/admin/catalog-options?${params.toString()}`, { cache: "no-store" });
      const data = await response.json() as { options?: Option[]; total?: number };
      if (!response.ok || !data.options || typeof data.total !== "number") throw new Error("catalog_search_failed");
      setOptions((previous) => {
        const next = reset ? [] : [...previous];
        for (const option of data.options!) if (!next.some((item) => item.id === option.id)) next.push(option);
        const selectedOption = previous.find((option) => option.id === selected);
        if (selectedOption && !next.some((option) => option.id === selectedOption.id)) next.unshift(selectedOption);
        return next;
      });
      setPage(nextPage);
      setHasMore(nextPage * 50 + data.options.length < data.total);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return <div className="catalog-option-picker">
    <label>{label}<select name={name} value={selected} onChange={(event) => setSelected(event.currentTarget.value)} required>
      <option value="" disabled>Selecione</option>
      {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select></label>
    <div className="catalog-option-search"><label>Buscar {label.toLocaleLowerCase("pt-BR")}<input type="search" value={query} maxLength={160} disabled={loading} onChange={(event) => { setQuery(event.currentTarget.value); setPage(0); setHasMore(false); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void load(true); } }} /></label><button className="button button-secondary" type="button" onClick={() => void load(true)} disabled={loading}>{loading ? "Buscando…" : "Buscar"}</button></div>
    {hasMore && <button className="button button-secondary" type="button" onClick={() => void load(false)} disabled={loading}>{loading ? "Carregando…" : "Carregar mais opções"}</button>}
    {error && <small className="auth-notice is-error" role="alert">Não foi possível buscar opções. Atualize a lista e tente novamente.</small>}
  </div>;
}
