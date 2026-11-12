"use client";

import { useState } from "react";
import { requestCustomPrint } from "@/app/orcamentos/actions";
import type { SavedModelUpload } from "@/components/model-upload-manager";

type MaterialOption = { id: string; label: string };

export function CustomPrintRequestForm({ models, materials, today }: { models: SavedModelUpload[]; materials: MaterialOption[]; today: string }) {
  const measuredModels = models.filter((model) => model.dimensions_mm && [model.dimensions_mm.x, model.dimensions_mm.y, model.dimensions_mm.z].every((value) => Number.isFinite(value) && value > 0));
  const firstModel = measuredModels[0];
  const [modelId, setModelId] = useState(firstModel?.id ?? "");
  const selectedModel = measuredModels.find((model) => model.id === modelId) ?? firstModel;
  if (!models.length || !materials.length) return <p className="model-library-note">Salve um modelo e aguarde materiais publicados para pedir uma impressão.</p>;
  if (!measuredModels.length) return <p className="model-library-note">Abra o modelo no visualizador com as unidades confirmadas e salve-o novamente para calcular as dimensões antes de pedir uma impressão.</p>;

  return <form action={requestCustomPrint} className="custom-print-request">
    <h3>Solicitar impressão personalizada</h3>
    <p>A sugestão de lojas usa o modelo do catálogo, material, equipamento disponível e dimensões salvas pelo visualizador. O fabricante confere o arquivo e os dados técnicos antes de enviar uma proposta.</p>
    <label>Modelo salvo<select name="uploadId" value={selectedModel?.id ?? ""} onChange={(event) => setModelId(event.target.value)}>{measuredModels.map((model) => <option key={model.id} value={model.id}>{model.model_name}</option>)}</select></label>
    <label>Material<select name="materialId" required>{materials.map((material) => <option key={material.id} value={material.id}>{material.label}</option>)}</select></label>
    <fieldset className="custom-print-dimensions"><legend>Dimensões verificadas do modelo original (mm)</legend>
      {(["x", "y", "z"] as const).map((axis) => <label key={axis}>{axis.toUpperCase()}<input name={`dimensions${axis.toUpperCase()}`} type="number" value={selectedModel?.dimensions_mm?.[axis] ?? ""} readOnly required /></label>)}
    </fieldset>
    <label>Escala (%)<input name="scalePercent" type="number" min="1" max="1000" step="0.01" defaultValue="100" required /></label>
    <label>Quantidade<input name="quantity" type="number" min="1" max="1000" step="1" defaultValue="1" required /></label>
    <label>Cor ou referência desejada<input name="color" maxLength={80} placeholder="Ex.: azul-marinho" /></label>
    <label>Qualidade<select name="quality" defaultValue="standard"><option value="standard">Padrão</option><option value="fine">Detalhada</option><option value="fast">Rápida</option><option value="custom">A combinar</option></select></label>
    <label>Prazo desejado<input name="dueDate" type="date" min={today} /></label>
    <label>Observações<textarea name="notes" maxLength={1000} rows={3} placeholder="Acabamento, uso da peça ou outros requisitos" /></label>
    <button className="button button-primary" type="submit">Enviar para fabricantes compatíveis</button>
  </form>;
}
