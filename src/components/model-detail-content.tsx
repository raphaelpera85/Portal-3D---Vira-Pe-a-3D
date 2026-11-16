"use client";

import { useState, type ReactNode } from "react";
import { ModelPrintProfileManager, type ModelPrintProfileRecord } from "@/components/model-print-profile-manager";
import { ModelViewer } from "@/components/model-viewer";
import type { ThreeMfSlicePlate } from "@/lib/model-file";

export function ModelDetailContent({ modelId, modelName, modelFilePath, previewUrl, previewVersions, today, profiles, profilesPage, profilesPages, profilesCount, authenticated, canUseOcr, ocrConfigured, notice, children }: {
  modelId: string; modelName: string; modelFilePath: string; previewUrl: string | null; previewVersions: { label: string; url: string; filePath: string }[]; today: string;
  profiles: ModelPrintProfileRecord[]; profilesPage: number; profilesPages: number; profilesCount: number;
  authenticated: boolean; canUseOcr: boolean; ocrConfigured: boolean; notice: string | null;
  children?: ReactNode;
}) {
  const [slicePlates, setSlicePlates] = useState<ThreeMfSlicePlate[]>([]);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState(previewUrl ?? previewVersions[0]?.url ?? null);
  const selectedPreviewFilePath = previewVersions.find(({ url }) => url === selectedPreviewUrl)?.filePath ?? modelFilePath;
  return <>
    {previewVersions.length > 1 && <div className="shell model-detail-preview-version"><label htmlFor="model-preview-version">Pré-visualizar versão<select id="model-preview-version" value={selectedPreviewUrl ?? ""} onChange={(event) => setSelectedPreviewUrl(event.target.value)}>{previewVersions.map(({ label, url }) => <option key={url} value={url}>{label}</option>)}</select></label></div>}
    {selectedPreviewUrl ? <ModelViewer buyerId={null} today={today} previewUrl={selectedPreviewUrl} modelName={modelName} previewFileName={selectedPreviewFilePath.split("/").at(-1)} readOnly onSlicePlatesChange={setSlicePlates} /> : <p className="shell model-detail-error" role="alert">A conexão com o catálogo de arquivos 3D ainda não está configurada.</p>}
    {children}
    <ModelPrintProfileManager modelSlug={modelId} profiles={profiles} profilesPage={profilesPage} profilesPages={profilesPages} profilesCount={profilesCount} plates={slicePlates} authenticated={authenticated} canUseOcr={canUseOcr} ocrConfigured={ocrConfigured} notice={notice} />
  </>;
}
