"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CircleHelp, Cpu, FlaskConical, Printer, ShieldCheck } from "lucide-react";
import { evaluateCompatibility } from "@/lib/compatibility";
import type { MaterialEntry, NozzleEntry, PrinterEntry } from "@/lib/technical-catalog";

const statusText = {
  compatible: "Compatível",
  conditional: "Compatível com condições",
  incompatible: "Incompatível",
  unverified: "Não verificado",
};
const processForPrinter = (printer: PrinterEntry) => printer.technology === "FDM" ? "filament" : "resin";

const powerText = (watts: number | null) => watts == null ? "Não medida" : `${watts} W`;
const numericRange = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const range = value as Record<string, unknown>;
  return typeof range.min === "number" && Number.isFinite(range.min) && typeof range.max === "number" && Number.isFinite(range.max)
    ? { min: range.min, max: range.max } : null;
};
const rangeLabel = (value: unknown, unit: string) => {
  const range = numericRange(value);
  return range ? `${range.min.toLocaleString("pt-BR")}–${range.max.toLocaleString("pt-BR")} ${unit}` : null;
};

type TechnicalCatalogProps = { printers: PrinterEntry[]; materials: MaterialEntry[]; nozzles: NozzleEntry[]; notice: string | null };

export function TechnicalCatalog(props: TechnicalCatalogProps) {
  if (!props.printers.length || !props.materials.length) {
    return <section className="technical-catalog shell"><div className="technical-panel"><h1>Catálogo técnico indisponível</h1><p>{props.notice ?? "Ainda não há impressoras, materiais e bicos publicados no catálogo."}</p></div></section>;
  }
  return <CatalogContent {...props} />;
}

function CatalogContent({ printers, materials, nozzles, notice }: TechnicalCatalogProps) {
  const [printerId, setPrinterId] = useState(printers[0].id);
  const [materialId, setMaterialId] = useState(materials.find((item) => item.process === processForPrinter(printers[0]))?.id ?? materials[0].id);
  const [nozzleId, setNozzleId] = useState(nozzles.find((item) => item.original)?.id ?? nozzles[0].id);
  const [dimensions, setDimensions] = useState({ x: "", y: "", z: "" });
  const [useMulticolor, setUseMulticolor] = useState(false);
  const printer = printers.find((item) => item.id === printerId) ?? printers[0];
  const printerProperties = printer.technicalProperties ?? {};
  const chamberTemperature = typeof printerProperties.activeChamberMaximumTemperatureC === "number"
    && Number.isFinite(printerProperties.activeChamberMaximumTemperatureC) ? printerProperties.activeChamberMaximumTemperatureC : null;
  const supportedMaterials = Array.isArray(printerProperties.manufacturerSupportedMaterials)
    ? printerProperties.manufacturerSupportedMaterials.filter((value): value is string => typeof value === "string") : [];
  const materialNozzleConditions = printerProperties.materialNozzleConditions && typeof printerProperties.materialNozzleConditions === "object" && !Array.isArray(printerProperties.materialNozzleConditions)
    ? Object.entries(printerProperties.materialNozzleConditions).filter((entry): entry is [string, string] => typeof entry[1] === "string") : [];
  const specificationNotes = Array.isArray(printerProperties.manufacturerSpecificationNotes)
    ? printerProperties.manufacturerSpecificationNotes.filter((value): value is string => typeof value === "string") : [];
  const multicolorSystem = printer.multicolorSystem ?? (typeof printer.technicalProperties?.multicolorUpgradeDescription === "string" ? printer.technicalProperties.multicolorUpgradeDescription : null);
  const material = materials.find((item) => item.id === materialId) ?? materials[0];
  const resinProperties = material.technicalProperties ?? {};
  const washingMethods = Array.isArray(resinProperties.washingMethods) ? resinProperties.washingMethods.filter((value): value is string => typeof value === "string") : [];
  const washingDurationMin = typeof resinProperties.washingDurationMinutes === "object" && resinProperties.washingDurationMinutes !== null
    && "min" in resinProperties.washingDurationMinutes && typeof resinProperties.washingDurationMinutes.min === "number"
    ? resinProperties.washingDurationMinutes.min : null;
  const washingMethodLabels: Record<string, string> = { water: "água", ethanol: "etanol", IPA: "álcool isopropílico (IPA)" };
  const postCureMinutes = typeof resinProperties.postCureMinutes === "number" ? resinProperties.postCureMinutes : null;
  const resinExposureByPrinter = Array.isArray(resinProperties.exposureByPrinter) ? resinProperties.exposureByPrinter.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    return typeof item.printer === "string" && typeof item.layerHeightMm === "number" && Number.isFinite(item.layerHeightMm)
      && typeof item.normalExposureSeconds === "number" && Number.isFinite(item.normalExposureSeconds)
      && typeof item.bottomExposureSeconds === "number" && Number.isFinite(item.bottomExposureSeconds)
      ? [{ printer: item.printer, layerHeightMm: item.layerHeightMm, normalExposureSeconds: item.normalExposureSeconds, bottomExposureSeconds: item.bottomExposureSeconds }]
      : [];
  }) : [];
  const printerNozzles = nozzles.filter((item) => {
    const fit = item.printerCompatibility?.[printer.id];
    return fit === "compatible" || fit === "conditional";
  });
  const nozzle = printerNozzles.find((item) => item.id === nozzleId) ?? printerNozzles[0];
  const checkDimensions = Object.values(dimensions).some((value) => value !== "");
  const compatibility = useMemo(() => evaluateCompatibility(printer, material, nozzle, {
    ...(checkDimensions && {
      partDimensionsMm: {
        x: dimensions.x === "" ? Number.NaN : Number(dimensions.x),
        y: dimensions.y === "" ? Number.NaN : Number(dimensions.y),
        z: dimensions.z === "" ? Number.NaN : Number(dimensions.z),
      },
    }),
    useMulticolor,
  }), [printer, material, nozzle, dimensions, checkDimensions, useMulticolor]);

  return (
    <section className="technical-catalog shell" aria-label="Catálogos técnicos e verificação de compatibilidade">
      {notice && <p className="catalog-source-note" role="status">{notice}</p>}
      <header className="technical-intro">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> BASE TÉCNICA VIRAPEÇA</p>
          <h1>Dados para escolher<br /><em>com segurança.</em></h1>
          <p>Compare equipamentos, materiais e bicos com referências do fabricante. A ferramenta não completa o que a documentação não informa.</p>
        </div>
        <div className="technical-intro-mark" aria-hidden="true"><Printer size={29} /><span>CATÁLOGO<br />01 / 03</span></div>
      </header>

      <div className="technical-layout">
        <div className="technical-records">
          <section className="technical-panel">
            <div className="technical-panel-heading"><span className="technical-panel-icon"><Printer size={17} /></span><div><p>01 / IMPRESSORA</p><h2>Modelo e especificações</h2></div></div>
            <label className="technical-select">Fabricante, modelo e variante
              <select value={printerId} onChange={(event) => {
                const nextPrinter = printers.find((item) => item.id === event.target.value);
                setPrinterId(event.target.value);
                if (nextPrinter && materials.find((item) => item.id === materialId)?.process !== processForPrinter(nextPrinter)) {
                  setMaterialId(materials.find((item) => item.process === processForPrinter(nextPrinter))?.id ?? materialId);
                }
              }}>
                {printers.map((item) => <option key={item.id} value={item.id}>{item.brand} · {item.model} · {item.variant}</option>)}
              </select>
            </label>
            <dl className="technical-facts">
              <div><dt>Tecnologia</dt><dd>{printer.technology}</dd></div>
              <div><dt>Volume útil</dt><dd>{printer.buildVolumeDescription ?? (printer.buildVolumeMm ? `${printer.buildVolumeMm.x} × ${printer.buildVolumeMm.y} × ${printer.buildVolumeMm.z} mm` : "Não informado")}</dd></div>
              <div><dt>Filamento</dt><dd>{printer.filamentDiameterMm ? `${printer.filamentDiameterMm} mm` : "Não informado"}</dd></div>
              <div><dt>Hotend máximo</dt><dd>{printer.maxNozzleTemperatureC ? `${printer.maxNozzleTemperatureC} °C` : "Não informado"}</dd></div>
              <div><dt>Mesa máxima</dt><dd>{printer.maxBedTemperatureC ? `${printer.maxBedTemperatureC} °C` : "Não informado"}</dd></div>
              {chamberTemperature !== null && <div><dt>Câmara ativa máxima</dt><dd>{chamberTemperature} °C</dd></div>}
              <div><dt>Velocidade máxima</dt><dd>{printer.maximumSpeedDescription ?? (printer.maximumSpeedMmPerSecond ? `${printer.maximumSpeedMmPerSecond} mm/s` : "Não informado")}</dd></div>
              <div><dt>Potência máxima</dt><dd>{powerText(printer.maximumPowerWatts)}</dd></div>
              <div><dt>Potência média medida</dt><dd>{powerText(printer.measuredAveragePowerWatts)}</dd></div>
              <div><dt>Multicolorido</dt><dd>{multicolorSystem ? `${multicolorSystem}${printer.multicolorSlots == null ? "" : ` · até ${printer.multicolorSlots} filamentos`}` : "Não informado"}</dd></div>
            </dl>
            {typeof printerProperties.compatibilityNotes === "string" && <p className="catalog-source-note">Condições do fabricante: {printerProperties.compatibilityNotes}</p>}
            {supportedMaterials.length > 0 && <p className="catalog-source-note">Filamentos citados pelo fabricante: {supportedMaterials.join(" · ")}</p>}
            {materialNozzleConditions.map(([name, conditions]) => <p className="catalog-source-note" key={name}>{name}: {conditions}</p>)}
            {specificationNotes.map((note) => <p className="catalog-source-note" key={note}>{note}</p>)}
            <SourceLinks sources={printer.sources} />
          </section>

          <section className="technical-panel">
            <div className="technical-panel-heading"><span className="technical-panel-icon is-green"><FlaskConical size={17} /></span><div><p>02 / MATERIAL</p><h2>Produto e condições de impressão</h2></div></div>
            <label className="technical-select">Marca e material
              <select value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
                {materials.map((item) => <option key={item.id} value={item.id}>{item.brand} · {item.name}</option>)}
              </select>
            </label>
            <div className="material-summary">
              <strong>{material.name}</strong><span>{material.family} · densidade {material.densityGPerCm3 == null ? rangeLabel(resinProperties.densityGPerCm3, "g/cm³") ?? "não informada" : `${material.densityGPerCm3.toLocaleString("pt-BR")} g/cm³`}</span>
            </div>
            {material.process === "filament" ? <dl className="technical-facts material-facts">
              <div><dt>Diâmetro do filamento</dt><dd>{material.filamentDiameterMm == null ? "Não informado" : `${material.filamentDiameterMm} mm`}</dd></div>
              <div><dt>Temperatura do bico</dt><dd>{material.nozzleTemperatureC ? `${material.nozzleTemperatureC.min}–${material.nozzleTemperatureC.max} °C` : "Não informada"}</dd></div>
              <div><dt>Temperatura da mesa</dt><dd>{material.bedTemperatureC ? `${material.bedTemperatureC.min}–${material.bedTemperatureC.max} °C` : "Não informada"}</dd></div>
              <div><dt>Câmara fechada</dt><dd>{material.enclosureRequired == null ? "Não informado" : material.enclosureRequired ? "Requerida" : "Não requerida"}</dd></div>
              <div><dt>Secagem</dt><dd>{material.drying ? `${material.drying.required ? "Requerida" : "Opcional"}${material.drying.temperatureC == null ? "" : ` · ${material.drying.temperatureC} °C`}${material.drying.hours == null ? "" : ` por ${material.drying.hours} h`}` : "Não informada"}</dd></div>
              <div><dt>Velocidade indicada</dt><dd>{material.printSpeedMaximumMmPerSecond ? `Até ${material.printSpeedMaximumMmPerSecond} mm/s` : "Não informada"}</dd></div>
              <div><dt>Sistema multicolorido</dt><dd>{material.multicolorCompatible == null ? "Não verificado" : material.multicolorCompatible ? "Compatível" : "Não recomendado"}</dd></div>
            </dl> : <dl className="technical-facts material-facts">
              <div><dt>Comprimento de onda</dt><dd>{rangeLabel(resinProperties.wavelengthNm, "nm") ?? (material.resinWavelengthNm == null ? "Não informado" : `${material.resinWavelengthNm} nm`)}</dd></div>
              <div><dt>Viscosidade{typeof resinProperties.viscosityMpas === "object" && resinProperties.viscosityMpas && "temperatureC" in resinProperties.viscosityMpas ? ` a ${String(resinProperties.viscosityMpas.temperatureC)} °C` : ""}</dt><dd>{rangeLabel(resinProperties.viscosityMpas, "mPa·s") ?? "Não informada"}</dd></div>
              <div><dt>Exposição normal</dt><dd>{rangeLabel(resinProperties.normalExposureSeconds, "s") ?? (material.resinExposureSeconds == null ? "Não informada" : `${material.resinExposureSeconds} s`)}</dd></div>
              <div><dt>Exposição das primeiras camadas</dt><dd>{rangeLabel(resinProperties.firstLayerExposureSeconds, "s") ?? "Não informada"}</dd></div>
              <div><dt>Compatibilidade</dt><dd>Consulte a verificação ao lado para o modelo selecionado</dd></div>
            </dl>}
            {material.process === "resin" && (washingMethods.length > 0 || postCureMinutes !== null || typeof resinProperties.safetyNotes === "string" || typeof resinProperties.wasteDisposal === "string") && <div className="resin-handling-note">
              {washingMethods.length > 0 && <p>Lavagem: {washingMethods.map((method) => washingMethodLabels[method] ?? method).join(", ")}{washingDurationMin !== null ? ` · mínimo de ${washingDurationMin} min` : ""}.</p>}
              {postCureMinutes !== null && <p>Pós-cura: {postCureMinutes} min{typeof resinProperties.postCureWavelengthNm === "number" ? ` · ${resinProperties.postCureWavelengthNm} nm` : ""}.</p>}
              {typeof resinProperties.safetyNotes === "string" && <p>{resinProperties.safetyNotes}</p>}
              {typeof resinProperties.wasteDisposal === "string" && <p>Descarte: {resinProperties.wasteDisposal}</p>}
            </div>}
            {resinExposureByPrinter.length > 0 && <div className="resin-exposure-table-wrap"><p>Configuração do fabricante por impressora</p><table className="resin-exposure-table"><thead><tr><th>Impressora</th><th>Camada</th><th>Normal</th><th>Base</th></tr></thead><tbody>{resinExposureByPrinter.map((item) => <tr key={item.printer}><th scope="row">{item.printer}</th><td>{item.layerHeightMm} mm</td><td>{item.normalExposureSeconds} s</td><td>{item.bottomExposureSeconds} s</td></tr>)}</tbody></table></div>}
            {material.colors.length > 0 && <div className="material-swatches"><span>Cores de referência</span>{material.colors.map((color) => <span className={`material-swatch${color.hex ? "" : " is-clear"}`} key={color.name} title={color.name} style={color.hex ? { "--swatch": color.hex } as React.CSSProperties : undefined} aria-label={color.name} />)}</div>}
            <SourceLinks sources={material.sources} />
          </section>

          {material.process === "filament" ? <section className="technical-panel">
            <div className="technical-panel-heading"><span className="technical-panel-icon is-sand"><Cpu size={17} /></span><div><p>03 / BICO</p><h2>Diâmetros cadastrados</h2></div></div>
            {printerNozzles.length > 0 ? <><label className="technical-select">Bico instalado na configuração analisada
              <select value={nozzle?.id ?? ""} onChange={(event) => setNozzleId(event.target.value)}>
                {printerNozzles.map((item) => <option key={item.id} value={item.id}>{item.name}{item.original ? " · original" : ""}</option>)}
              </select>
            </label>
            <div className="nozzle-facts"><span>Material do bico</span><strong>{nozzle?.material ?? "Não informado para esta variante"}</strong></div>
            {nozzle?.printerCompatibilityConditions?.[printer.id] && <p className="catalog-source-note">Condições do fabricante: {nozzle.printerCompatibilityConditions[printer.id]}</p>}
            <div className="nozzle-options" aria-label="Diâmetros listados pelo fabricante">
              {printerNozzles.map((item) => <button type="button" key={item.id} className={item.id === nozzle?.id ? "is-selected" : ""} onClick={() => setNozzleId(item.id)}>{item.diameterMm.toLocaleString("pt-BR")} <small>mm</small></button>)}
            </div>
            <SourceLinks sources={nozzle?.sources ?? []} /></> : <p className="admin-empty">Nenhum bico publicado para seleção. O encaixe e os requisitos do bico permanecem não verificados.</p>}
          </section> : <section className="technical-panel technical-empty-panel">
            <div className="technical-panel-heading"><span className="technical-panel-icon is-purple"><FlaskConical size={17} /></span><div><p>03 / RESINA</p><h2>Processo de cura</h2></div></div>
            <p>Resinas não usam bicos de extrusão. Compare a compatibilidade do produto com a impressora e consulte as fontes antes de definir lavagem, cura e exposição.</p>
          </section>}
        </div>

        <aside className="compatibility-panel" aria-live="polite">
          <div className="compatibility-panel-heading"><ShieldCheck size={18} /><span>VERIFICAÇÃO EXPLICÁVEL</span></div>
          <h2>Compatibilidade</h2>
          <p className={`compatibility-status status-${compatibility.status}`}>{statusText[compatibility.status]}</p>
          <p className="compatibility-model">{printer.name}<br />{material.brand} {material.name}{material.process === "filament" && nozzle ? ` · ${nozzle.name}` : ""}</p>
          {material.process === "filament" && <label className="multicolor-toggle"><input type="checkbox" checked={useMulticolor} onChange={(event) => setUseMulticolor(event.target.checked)} /><span>Quero usar o sistema multicolorido</span></label>}
          <div className="part-dimensions">
            <span>Dimensões da peça <small>(opcional, mm)</small></span>
            <div>{(["x", "y", "z"] as const).map((axis) => <label key={axis}><span>{axis.toUpperCase()}</span><input aria-label={`Dimensão ${axis.toUpperCase()} em milímetros`} type="number" min="0" step="any" value={dimensions[axis]} onChange={(event) => setDimensions((current) => ({ ...current, [axis]: event.target.value }))} /></label>)}</div>
          </div>
          <ul className="compatibility-checks">
            {compatibility.checks.map((check) => <li key={check.key}><span className={`compatibility-check-mark check-${check.status}`} aria-hidden="true">{check.status === "compatible" ? "✓" : check.status === "incompatible" ? "×" : check.status === "conditional" ? "!" : "?"}</span><div><strong>{check.label} · {statusText[check.status]}</strong><p>{check.detail}</p></div></li>)}
          </ul>
          <p className="compatibility-disclaimer"><CircleHelp size={14} /> Referência de triagem: confira perfil, fabricante, condições de uso e estado real do equipamento antes de fabricar.</p>
          <div className="catalog-source-note">{material.sources[0]?.checkedAt ? `Ficha conferida em ${new Date(`${material.sources[0].checkedAt}T00:00:00`).toLocaleDateString("pt-BR")}.` : "Data de conferência não informada."} Dados ausentes permanecem sinalizados como não verificados.</div>
          <div className="catalog-next-step"><a href="/visualizador">Abrir visualizador 3D <ArrowUpRight size={14} /></a><a href="/calculadora">Calcular custo da peça <ArrowUpRight size={14} /></a></div>
        </aside>
      </div>
    </section>
  );
}

function SourceLinks({ sources }: { sources: { label: string; url: string }[] }) {
  return <div className="technical-sources">{sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} <ArrowUpRight size={12} aria-hidden="true" /></a>)}</div>;
}
