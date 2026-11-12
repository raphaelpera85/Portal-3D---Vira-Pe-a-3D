"use client";

import { useState } from "react";

type Profile = {
  id: string; name: string; type: string; scope: "community" | "official";
  printer: string; material: string; nozzle: string; layerHeight: number | string | null;
  infill: number | string | null; walls: number | null; supports: boolean; orientation: string;
  scale: number | string; quantity: number; hours: number | string | null; grams: number | string | null;
  colors: Array<{ color: string; grams: number }>;
};

const typeNames: Record<string, string> = { economic: "Econômico", fast: "Rápido", detailed: "Detalhado", multicolor: "Multicolorido", custom: "Personalizado" };

export function ProductPrintProfiles({ profiles, error }: { profiles: Profile[]; error: boolean }) {
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? "");
  const selected = profiles.find(({ id }) => id === selectedId);
  if (error) return <p className="profile-public-note" role="status">Perfis de fabricação temporariamente indisponíveis.</p>;
  if (!selected) return null;

  return <section className="product-print-profiles" aria-labelledby="product-print-profiles-title">
    <div><span className="account-kicker">CONFIGURAÇÕES COMPARTILHADAS</span><h2 id="product-print-profiles-title">Perfis de impressão</h2><p>Parâmetros e consumo declarados para o lote indicado pelo fabricante.</p></div>
    <label className="profile-public-select">Escolha um perfil<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {typeNames[profile.type] ?? "Personalizado"} · {profile.scope === "official" ? "Oficial" : "Comunidade"}</option>)}</select></label>
    <article className="print-profile-card" aria-live="polite">
      <div className="print-profile-heading"><div><span className="account-kicker">{selected.scope === "official" ? "PERFIL OFICIAL" : "PERFIL DA COMUNIDADE"} · {typeNames[selected.type] ?? "Personalizado"}</span><h3>{selected.name}</h3></div></div>
      <dl className="print-profile-facts">
        <div><dt>Impressora</dt><dd>{selected.printer}</dd></div><div><dt>Material</dt><dd>{selected.material}</dd></div><div><dt>Bico</dt><dd>{selected.nozzle}</dd></div>
        <div><dt>Escala e lote</dt><dd>{selected.scale}% · {selected.quantity} produto(s)</dd></div>
        <div><dt>Tempo informado</dt><dd>{selected.hours == null ? "Não informado" : `${selected.hours} h`}</dd></div>
        <div><dt>Material informado</dt><dd>{selected.grams == null ? "Não informado" : `${selected.grams} g`}</dd></div>
        <div><dt>Camada</dt><dd>{selected.layerHeight == null ? "Não informada" : `${selected.layerHeight} mm`}</dd></div>
        <div><dt>Preenchimento e paredes</dt><dd>{selected.infill == null ? "Preenchimento não informado" : `${selected.infill}%`}{selected.walls == null ? "" : ` · ${selected.walls} paredes`}</dd></div>
        <div><dt>Suportes e orientação</dt><dd>{selected.supports ? "Com suportes" : "Sem suportes"}{selected.orientation ? ` · ${selected.orientation}` : ""}</dd></div>
      </dl>
      {selected.colors.length > 0 && <ul className="print-profile-colors" aria-label="Consumo por cor">{selected.colors.map(({ color, grams }) => <li key={color}><i style={{ backgroundColor: color }} />{color} · {grams} g</li>)}</ul>}
    </article>
  </section>;
}
