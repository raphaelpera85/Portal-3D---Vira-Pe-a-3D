"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const ModelViewer = dynamic(() => import("@/components/model-viewer").then((module) => module.ModelViewer), {
  ssr: false,
  loading: () => <p className="auth-notice" role="status">Preparando visualizador 3D…</p>,
});

export function CreatorModelReviewPreview({ assetUrl, modelName, id }: { assetUrl: string; modelName: string; id: string }) {
  const [open, setOpen] = useState(false);
  const previewId = `creator-model-preview-${id}`;

  return <div className="admin-creator-model-preview">
    <button className="button button-secondary" type="button" aria-expanded={open} aria-controls={previewId} onClick={() => setOpen((current) => !current)}>
      {open ? "Fechar prévia 3D" : "Inspecionar em 3D"}
    </button>
    {open && <div id={previewId} className="admin-creator-model-preview-canvas">
      <ModelViewer buyerId={null} today={new Date().toISOString().slice(0, 10)} previewUrl={assetUrl} modelName={modelName} previewLabel="PRÉVIA PRIVADA · REVISÃO" readOnly />
    </div>}
  </div>;
}
