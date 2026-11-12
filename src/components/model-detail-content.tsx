"use client";

import { useState } from "react";
import { ModelPrintProfileManager, type ModelPrintProfileRecord } from "@/components/model-print-profile-manager";
import { ModelViewer } from "@/components/model-viewer";
import type { ThreeMfSlicePlate } from "@/lib/model-file";

export function ModelDetailContent({ modelId, modelName, previewUrl, today, profiles, authenticated, notice }: {
  modelId: string; modelName: string; previewUrl: string | null; today: string;
  profiles: ModelPrintProfileRecord[]; authenticated: boolean; notice: string | null;
}) {
  const [slicePlates, setSlicePlates] = useState<ThreeMfSlicePlate[]>([]);
  return <>
    {previewUrl ? <ModelViewer buyerId={null} today={today} previewUrl={previewUrl} modelName={modelName} readOnly onSlicePlatesChange={setSlicePlates} /> : <p className="shell model-detail-error" role="alert">A conexão com o catálogo de arquivos 3D ainda não está configurada.</p>}
    <ModelPrintProfileManager modelSlug={modelId} profiles={profiles} plates={slicePlates} authenticated={authenticated} notice={notice} />
  </>;
}
