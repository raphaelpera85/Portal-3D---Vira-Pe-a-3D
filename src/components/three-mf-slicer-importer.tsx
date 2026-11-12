"use client";

import { useState } from "react";
import { FileArchive, LoaderCircle } from "lucide-react";
import { MAX_PUBLIC_MODEL_FILE_BYTES, readThreeMfPackage, type ThreeMfSlicePlate } from "@/lib/model-file";

export function ThreeMfSlicerImporter({ onApply }: {
  onApply: (plate: ThreeMfSlicePlate, plateNumber: number) => boolean | null;
}) {
  const [plates, setPlates] = useState<ThreeMfSlicePlate[]>([]);
  const [plateIndex, setPlateIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const plate = plates[plateIndex];

  async function importFile(file?: File) {
    setPlates([]);
    setPlateIndex(0);
    setError("");
    setStatus("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".3mf") || file.size < 1 || file.size > MAX_PUBLIC_MODEL_FILE_BYTES) {
      setError(`Selecione um arquivo 3MF válido de até ${Math.round(MAX_PUBLIC_MODEL_FILE_BYTES / 1024 / 1024)} MiB.`);
      return;
    }
    setLoading(true);
    try {
      const result = await readThreeMfPackage(new Uint8Array(await file.arrayBuffer()));
      if (!result.slicePlates.length) throw new Error("Este arquivo 3MF não contém consumo ou tempo salvo pelo fatiador.");
      setPlates(result.slicePlates);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível ler os dados do arquivo 3MF.");
    } finally {
      setLoading(false);
    }
  }

  function apply() {
    if (!plate) return;
    const applied = onApply(plate, plate.index ?? plateIndex + 1);
    if (applied !== null) setStatus(applied ? "Dados da placa preenchidos. Revise os valores antes de calcular." : "Esta placa não informa peso nem tempo; preencha esses valores manualmente.");
  }

  return <section className="price-card slicer-ocr-card" aria-labelledby="three-mf-import-title">
    <div className="price-card-heading"><span className="price-step"><FileArchive size={15} aria-hidden="true" /></span><div><h2 id="three-mf-import-title">Importar dados do 3MF</h2><p>Leia o peso e o tempo gravados pelo fatiador sem enviar o arquivo para um serviço externo.</p></div></div>
    <label className="price-ocr-file">Arquivo 3MF<input type="file" accept=".3mf,application/vnd.ms-3mfdocument" onChange={(event) => { void importFile(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /><small>Até {Math.round(MAX_PUBLIC_MODEL_FILE_BYTES / 1024 / 1024)} MiB · leitura local no navegador.</small></label>
    {loading && <p className="price-ocr-note"><LoaderCircle size={13} className="spin" aria-hidden="true" /> Lendo metadados da placa…</p>}
    {error && <p className="auth-notice is-error" role="alert">{error}</p>}
    {status && <p className="auth-notice is-success" role="status">{status}</p>}
    {plate && <div className="price-ocr-result" aria-live="polite">
      {plates.length > 1 && <label className="price-field"><span>Placa do fatiador</span><select value={plateIndex} onChange={(event) => { setPlateIndex(Number(event.target.value)); setStatus(""); }}>
        {plates.map((item, index) => <option key={`${item.index ?? index}-${index}`} value={index}>Placa {item.index ?? index + 1}</option>)}
      </select></label>}
      <dl>
        <div><dt>Consumo registrado</dt><dd>{plate.weightGrams == null ? "Somente por filamento" : `${plate.weightGrams.toLocaleString("pt-BR")} g`}</dd></div>
        <div><dt>Tempo previsto</dt><dd>{plate.printTimeSeconds == null ? "Não informado" : `${(plate.printTimeSeconds / 3600).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} h`}</dd></div>
        <div><dt>Suportes</dt><dd>{plate.supportUsed == null ? "Não informado" : plate.supportUsed ? "Incluídos" : "Não usados"}</dd></div>
      </dl>
      {plate.filaments.length > 0 && <div className="price-ocr-filaments"><strong>Consumo por filamento</strong><ul>{plate.filaments.map((filament, index) => <li key={`${filament.color ?? "sem-cor"}-${index}`}><span>{filament.color && <i className="three-mf-filament-color" style={{ backgroundColor: `#${filament.color}` }} aria-hidden="true" />}{filament.type || `Filamento ${index + 1}`}{filament.color ? ` · #${filament.color}` : ""}</span><b>{filament.weightGrams == null ? "—" : `${filament.weightGrams.toLocaleString("pt-BR")} g`}</b></li>)}</ul></div>}
      {plate.weightGrams == null && <p className="price-ocr-note">Se o total não estiver disponível, o cálculo soma as massas por filamento apenas quando todas estiverem registradas.</p>}
      <button className="button button-primary" type="button" onClick={apply}>Revisar e preencher peso/tempo</button>
    </div>}
  </section>;
}
