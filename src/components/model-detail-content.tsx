"use client";

import { useState } from "react";
import { ModelPrintProfileManager, type ModelPrintProfileRecord } from "@/components/model-print-profile-manager";
import { ModelViewer } from "@/components/model-viewer";
import type { ThreeMfSlicePlate } from "@/lib/model-file";

export function ModelDetailContent({ modelId, modelName, previewUrl, previewVersions, today, profiles, authenticated, canUseOcr, ocrConfigured, notice }: {
  modelId: string; modelName: string; previewUrl: string | null; previewVersions: { label: string; url: string }[]; today: string;
  profiles: ModelPrintProfileRecord[]; authenticated: boolean; canUseOcr: boolean; ocrConfigured: boolean; notice: string | null;
}) {
  const [slicePlates, setSlicePlates] = useState<ThreeMfSlicePlate[]>([]);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState(previewUrl ?? previewVersions[0]?.url ?? null);
  return <>
    {previewVersions.length > 1 && <div className="shell model-detail-preview-version"><label htmlFor="model-preview-version">Pré-visualizar versão<select id="model-preview-version" value={selectedPreviewUrl ?? ""} onChange={(event) => setSelectedPreviewUrl(event.target.value)}>{previewVersions.map(({ label, url }) => <option key={url} value={url}>{label}</option>)}</select></label></div>}
    {selectedPreviewUrl ? <ModelViewer buyerId={null} today={today} previewUrl={selectedPreviewUrl} modelName={modelName} readOnly onSlicePlatesChange={setSlicePlates} /> : <p className="shell model-detail-error" role="alert">A conexão com o catálogo de arquivos 3D ainda não está configurada.</p>}
    <ModelPrintProfileManager modelSlug={modelId} profiles={profiles} plates={slicePlates} authenticated={authenticated} canUseOcr={canUseOcr} ocrConfigured={ocrConfigured} notice={notice} />
  </>;
}
