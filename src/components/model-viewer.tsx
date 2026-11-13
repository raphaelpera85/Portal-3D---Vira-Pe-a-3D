"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine, Box, Download, Expand, Eye, EyeOff, Grid2X2, RotateCcw, Upload, X,
} from "lucide-react";
import type * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ModelUploadManager, type SavedModelUpload } from "@/components/model-upload-manager";
import { createMeterExportCopy } from "@/lib/model-export";
import {
  formatModelDimensions, MAX_MODEL_FILE_BYTES, MAX_PUBLIC_MODEL_FILE_BYTES, type ModelDimensions, type ModelUnit,
  type ModelFormat, type ModelSourceUnit, type ThreeMfColorData, type ThreeMfSlicePlate, getModelColorMatchedComponentIds, getModelFormat, readThreeMfPackage, validateModelFiles,
} from "@/lib/model-file";

type ViewName = "frente" | "tras" | "topo" | "base" | "esquerda" | "direita";
const views: { name: ViewName; label: string; direction: [number, number, number] }[] = [
  { name: "frente", label: "Frente", direction: [0, -1, 0.35] },
  { name: "tras", label: "Trás", direction: [0, 1, 0.35] },
  { name: "topo", label: "Topo", direction: [0, 0, 1] },
  { name: "base", label: "Base", direction: [0, 0, -1] },
  { name: "esquerda", label: "Esquerda", direction: [-1, 0, 0.35] },
  { name: "direita", label: "Direita", direction: [1, 0, 0.35] },
];
type ViewerComponent = { id: string; name: string; visible: boolean; colors: string[] };

export function ModelViewer({ buyerId, savedModels = [], materials = [], today, libraryError = false, previewUrl, modelName, readOnly = false, onSlicePlatesChange }: { buyerId: string | null; savedModels?: SavedModelUpload[]; materials?: { id: string; label: string }[]; today: string; libraryError?: boolean; previewUrl?: string | null; modelName?: string; readOnly?: boolean; onSlicePlatesChange?: (plates: ThreeMfSlicePlate[]) => void }) {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const threeRef = useRef<typeof import("three") | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const componentObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const originalEmissivesRef = useRef<Map<string, Array<{ material: THREE.Material & { emissive?: THREE.Color; emissiveIntensity?: number }; color: THREE.Color; intensity: number }>>>(new Map());
  const resourceUrlsRef = useRef<string[]>([]);
  const sceneReadyRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  if (!sceneReadyRef.current) {
    let resolve!: () => void;
    const promise = new Promise<void>((complete) => { resolve = complete; });
    sceneReadyRef.current = { promise, resolve };
  }
  const frameRef = useRef<THREE.Group | null>(null);
  const modelOriginPositionRef = useRef<THREE.Vector3 | null>(null);
  const [fileName, setFileName] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [rawDimensions, setRawDimensions] = useState<ModelDimensions | null>(null);
  const [fileKind, setFileKind] = useState<ModelFormat | null>(null);
  const [sourceUnit, setSourceUnit] = useState<ModelSourceUnit | null>(null);
  const [components, setComponents] = useState<ViewerComponent[]>([]);
  const [modelColors, setModelColors] = useState<string[]>([]);
  const [slicePlates, setSlicePlates] = useState<ThreeMfSlicePlate[]>([]);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [unit, setUnit] = useState<ModelUnit | "">("");
  const [scale, setScale] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [webglError, setWebglError] = useState(false);

  function restoreColorHighlight() {
    originalEmissivesRef.current.forEach((entries) => entries.forEach(({ material, color, intensity }) => {
      material.emissive?.copy(color);
      if (material.emissiveIntensity !== undefined) material.emissiveIntensity = intensity;
    }));
  }

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    const canvasHost = host;
    let stopped = false;

    async function start() {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        if (stopped) return;
        const scene = new THREE.Scene();
        scene.background = null;
        const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100000);
        camera.up.set(0, 0, 1);
        camera.position.set(4, -6, 4);
        const createdRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        createdRenderer.setClearColor(0x000000, 0);
        createdRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        createdRenderer.outputColorSpace = THREE.SRGBColorSpace;
        createdRenderer.setSize(canvasHost.clientWidth, canvasHost.clientHeight);
        canvasHost.appendChild(createdRenderer.domElement);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x8190a3, 2.2));
        const key = new THREE.DirectionalLight(0xffffff, 3.2);
        key.position.set(-4, -5, 8);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0x8ab7ff, 1.3);
        fill.position.set(5, 4, 3);
        scene.add(fill);

        const grid = new THREE.GridHelper(200, 40, 0x9caec5, 0xd9e1ec);
        grid.rotation.x = Math.PI / 2;
        grid.position.z = -0.005;
        grid.name = "build-grid";
        grid.visible = false;
        scene.add(grid);
        const axes = new THREE.AxesHelper(1);
        axes.name = "build-axes";
        axes.visible = false;
        scene.add(axes);
        const controls = new OrbitControls(camera, createdRenderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.screenSpacePanning = true;
        sceneRef.current = scene;
        threeRef.current = THREE;
        cameraRef.current = camera;
        rendererRef.current = createdRenderer;
        controlsRef.current = controls;
        frameRef.current = new THREE.Group();
        frameRef.current.name = "model-frame";
        scene.add(frameRef.current);
        sceneReadyRef.current?.resolve();

        const resize = new ResizeObserver(() => {
          if (!canvasHost.clientWidth || !canvasHost.clientHeight) return;
          camera.aspect = canvasHost.clientWidth / canvasHost.clientHeight;
          camera.updateProjectionMatrix();
          createdRenderer.setSize(canvasHost.clientWidth, canvasHost.clientHeight);
        });
        resize.observe(canvasHost);
        createdRenderer.setAnimationLoop(() => {
          controls.update();
          createdRenderer.render(scene, camera);
        });

        return () => {
          resize.disconnect();
          controls.dispose();
          createdRenderer.setAnimationLoop(null);
          createdRenderer.dispose();
          createdRenderer.domElement.remove();
        };
      } catch {
        if (!stopped) setWebglError(true);
        sceneReadyRef.current?.resolve();
      }
    }

    let cleanup: (() => void) | undefined;
    void start().then((value) => { cleanup = value; if (stopped) cleanup?.(); });
    return () => {
      stopped = true;
      sceneReadyRef.current?.resolve();
      cleanup?.();
      if (!cleanup && rendererRef.current) {
        rendererRef.current.setAnimationLoop(null);
        rendererRef.current.dispose();
        rendererRef.current.domElement.remove();
        controlsRef.current?.dispose();
      }
      if (modelRef.current) disposeObject(modelRef.current);
      resourceUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      resourceUrlsRef.current = [];
      rendererRef.current = null;
      sceneRef.current = null;
      threeRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      modelRef.current = null;
      modelOriginPositionRef.current = null;
      componentObjectsRef.current.clear();
      frameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const grid = sceneRef.current?.getObjectByName("build-grid");
    const axes = sceneRef.current?.getObjectByName("build-axes");
    if (grid) grid.visible = showGrid && Boolean(rawDimensions);
    if (axes) axes.visible = showAxes && Boolean(rawDimensions);
  }, [showGrid, showAxes, rawDimensions]);

  useEffect(() => {
    restoreColorHighlight();
    const matchedIds = new Set(getModelColorMatchedComponentIds(components, selectedColor));
    matchedIds.forEach((id) => originalEmissivesRef.current.get(id)?.forEach(({ material }) => {
      material.emissive?.set(`#${selectedColor}`);
      if (material.emissiveIntensity !== undefined) material.emissiveIntensity = 0.65;
    }));
  }, [components, selectedColor]);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;
    model.scale.setScalar(scale / 100);
    if (modelOriginPositionRef.current) model.position.copy(modelOriginPositionRef.current).multiplyScalar(scale / 100);
  }, [scale]);

  async function loadFiles(files: File[], publicPreview = false, maxFileBytes = MAX_MODEL_FILE_BYTES): Promise<boolean> {
    if (files.length === 0) return false;
    if (exporting) {
      setMessage("Aguarde a exportação terminar antes de trocar o modelo.");
      return false;
    }
    const validation = validateModelFiles(files, maxFileBytes);
    if (validation) {
      setMessage(validation);
      return false;
    }
    const file = files.find((item) => getModelFormat(item.name))!;
    const kind = getModelFormat(file.name);
    if (!kind) return false;
    setBusy(true);
    setMessage("Preparando a visualização…");
    setModelColors([]);
    setSlicePlates([]);
    onSlicePlatesChange?.([]);
    resourceUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    const fileUrls = new Map<string, string>();
    resourceUrlsRef.current = files.map((item) => {
      const url = URL.createObjectURL(item);
      const basename = item.name.toLowerCase().split(/[\\/]/).pop()!;
      fileUrls.set(basename, url);
      return url;
    });
    try {
      await sceneReadyRef.current?.promise;
      const [THREE, buffer] = await Promise.all([import("three"), file.arrayBuffer()]);
      const packageData = kind === "3mf" ? await readThreeMfPackage(new Uint8Array(buffer)) : null;
      if (packageData) {
        const colors = packageData.colors;
        setModelColors([...new Set([
          ...colors.objectColors,
          ...colors.componentPaintColors.flat(),
          ...colors.componentPartColors.flat(),
          ...Object.values(colors.namedColors),
          ...colors.paintPaletteColors,
        ])].filter(Boolean).slice(0, 12));
      }
      if (!rendererRef.current) throw new Error("Este dispositivo não conseguiu iniciar a visualização WebGL.");
      const threeMfColors = packageData?.colors ?? null;
      const threeMfSlicePlates = packageData?.slicePlates ?? [];
      const manager = new THREE.LoadingManager();
      manager.setURLModifier((resource) => {
        let filename = resource.split(/[?#]/)[0].split(/[\\/]/).pop()!;
        try { filename = decodeURIComponent(filename); } catch {}
        const localFile = fileUrls.get(filename.toLowerCase());
        if (localFile) return localFile;
        if (publicPreview && kind !== "3mf" && !resource.startsWith("data:")) throw new Error("A prévia precisa incluir todos os recursos dentro do GLB.");
        return resource;
      });
      let object: THREE.Object3D;
      let modelUnit: ModelSourceUnit | null = null;
      if (kind === "stl") {
        const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
        const geometry = new STLLoader().parse(buffer);
        geometry.computeVertexNormals();
        object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x3476df, roughness: 0.42, metalness: 0.04 }));
      } else if (kind === "obj") {
        const [{ OBJLoader }, materialFile] = await Promise.all([
          import("three/examples/jsm/loaders/OBJLoader.js"),
          Promise.resolve(files.find((item) => item.name.toLowerCase().endsWith(".mtl"))),
        ]);
        const loader = new OBJLoader(manager);
        if (materialFile) {
          const { MTLLoader } = await import("three/examples/jsm/loaders/MTLLoader.js");
          const materials = new MTLLoader(manager).parse(await materialFile.text(), "");
          materials.preload();
          loader.setMaterials(materials);
        }
        object = loader.parse(new TextDecoder().decode(buffer));
      } else if (kind === "3mf") {
        if (!packageData) throw new Error("O pacote 3MF não pôde ser interpretado.");
        const { ThreeMFLoader } = await import("three/examples/jsm/loaders/3MFLoader.js");
        modelUnit = packageData.unit;
        object = new ThreeMFLoader(manager).parse(buffer);
        applyThreeMfColors(object, packageData.colors, THREE);
        object.rotation.x = -Math.PI / 2;
      } else {
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
          new GLTFLoader(manager).parse(kind === "gltf" ? new TextDecoder().decode(buffer) : buffer, "", resolve, reject);
        });
        object = gltf.scene;
        object.rotation.x = Math.PI / 2;
        modelUnit = "m";
      }
      const THREEAgain = await import("three");
      const wrapper = new THREEAgain.Group();
      wrapper.add(object);
      const bounds = new THREEAgain.Box3().setFromObject(wrapper);
      if (bounds.isEmpty()) throw new Error("O arquivo não contém uma geometria visível.");
      const center = bounds.getCenter(new THREEAgain.Vector3());
      wrapper.position.set(-center.x, -center.y, -bounds.min.z);

      if (modelRef.current) {
        restoreColorHighlight();
        frameRef.current?.remove(modelRef.current);
        disposeObject(modelRef.current);
      }
      frameRef.current?.add(wrapper);
      modelRef.current = wrapper;
      modelOriginPositionRef.current = wrapper.position.clone();
      wrapper.scale.setScalar(1);
      const parts: ViewerComponent[] = [];
      componentObjectsRef.current.clear();
      originalEmissivesRef.current.clear();
      wrapper.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const id = child.uuid;
        const name = child.name.trim() || `Componente ${parts.length + 1}`;
        const mesh = child as THREE.Mesh;
        componentObjectsRef.current.set(id, child);
        const originalEmissives: Array<{ material: THREE.Material & { emissive?: THREE.Color; emissiveIntensity?: number }; color: THREE.Color; intensity: number }> = [];
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((entry) => {
          const material = entry as THREE.Material & { emissive?: THREE.Color; emissiveIntensity?: number };
          if (material.emissive?.isColor) originalEmissives.push({ material, color: material.emissive.clone(), intensity: material.emissiveIntensity ?? 1 });
        });
        originalEmissivesRef.current.set(id, originalEmissives);
        parts.push({ id, name, visible: true, colors: extractModelColors(mesh, kind, THREE) });
      });
      setComponents(parts);
      setSelectedColor(null);
      const fileColors = extractModelColors(wrapper, kind, THREE);
      const paintedColors = threeMfColors?.componentPaintColors.flat().filter(Boolean) ?? [];
      setModelColors([...new Set([
        ...fileColors,
        ...paintedColors,
        ...(threeMfColors?.componentPartColors.flat() ?? []),
        ...Object.values(threeMfColors?.namedColors ?? {}),
        ...(threeMfColors?.paintPaletteColors ?? []),
      ])].filter(Boolean).slice(0, 12));
      setSlicePlates(threeMfSlicePlates);
      onSlicePlatesChange?.(threeMfSlicePlates);
      const size = bounds.getSize(new THREEAgain.Vector3());
      const grid = sceneRef.current?.getObjectByName("build-grid");
      const axes = sceneRef.current?.getObjectByName("build-axes");
      const referenceSize = Math.max(size.x, size.y, size.z, 0.01);
      if (grid) {
        grid.scale.setScalar(referenceSize * 0.05);
        grid.visible = showGrid;
      }
      if (axes) {
        axes.scale.setScalar(referenceSize * 0.2);
        axes.visible = showAxes;
      }
      setRawDimensions({ x: size.x, y: size.y, z: size.z });
      setFileName(files.length > 1 ? `${file.name} + ${files.length - 1} arquivos` : file.name);
      setSelectedFiles(files);
      setFileKind(kind);
      setSourceUnit(modelUnit);
      setUnit(modelUnit ? "mm" : "");
      setScale(100);
      fitView();
      setMessage(modelUnit
        ? `${kind.toUpperCase()} carregado. Unidade identificada: ${modelUnit}.`
        : `${kind.toUpperCase()} carregado. Confirme a unidade para exibir as dimensões.`);
      return true;
    } catch (error) {
      resourceUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      resourceUrlsRef.current = [];
      setMessage(error instanceof Error ? `Não foi possível abrir o modelo: ${error.message}` : "Não foi possível abrir este modelo.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!readOnly || !previewUrl) return;
    const controller = new AbortController();
    void fetch(previewUrl, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Prévia indisponível");
      const blob = await response.blob();
      const isPublic3mf = modelName !== undefined;
      const maxFileBytes = isPublic3mf ? MAX_PUBLIC_MODEL_FILE_BYTES : MAX_MODEL_FILE_BYTES;
      if (blob.size > maxFileBytes) throw new Error("Arquivo acima do limite");
      const filename = isPublic3mf ? `${modelName}.3mf` : "preview.glb";
      const type = isPublic3mf ? "application/vnd.ms-package.3dmanufacturing-3dmodel+xml" : "model/gltf-binary";
      await loadFiles([new File([blob], filename, { type })], true, maxFileBytes);
    }).catch(() => {
      if (!controller.signal.aborted) setMessage("Prévia 3D indisponível. Atualize a página para tentar novamente.");
    });
    return () => controller.abort();
  }, [previewUrl, readOnly, modelName]);

  function fitView() {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const model = modelRef.current;
    const THREE = threeRef.current;
    if (!camera || !controls || !model || !THREE) return;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 0.01);
    const distance = radius / (2 * Math.tan((camera.fov * Math.PI) / 360)) * 1.45;
    const direction = new THREE.Vector3(1, -1.35, 0.95).normalize();
    controls.target.copy(center);
    camera.position.copy(center).add(direction.multiplyScalar(distance));
    camera.up.set(0, 0, 1);
    camera.near = Math.max(distance / 1000, 0.001);
    camera.far = distance * 100;
    camera.updateProjectionMatrix();
    controls.update();
  }

  function selectView(view: ViewName) {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const model = modelRef.current;
    const THREE = threeRef.current;
    if (!THREE) return;
    if (!camera || !controls || !model) return;
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const distance = Math.max(size.x, size.y, size.z, 0.01) * 2.2;
    const selected = views.find((item) => item.name === view)!;
    const direction = new THREE.Vector3(...selected.direction).normalize();
    controls.target.copy(center);
    camera.up.set(0, 0, 1);
    if (view === "topo" || view === "base") camera.up.set(0, 1, 0);
    camera.position.copy(center).add(direction.multiplyScalar(distance));
    camera.updateProjectionMatrix();
    controls.update();
  }

  function toggleComponent(component: ViewerComponent) {
    const visible = !component.visible;
    const object = componentObjectsRef.current.get(component.id);
    if (object) object.visible = visible;
    setComponents((current) => current.map((item) => item.id === component.id ? { ...item, visible } : item));
  }

  function capturePreview() {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.domElement.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${fileName.replace(/\.[^.]+$/, "") || "modelo-virapeca"}-previa.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function updateScale(value: number) {
    setScale(value);
    const model = modelRef.current;
    if (!model) return;
    model.scale.setScalar(value / 100);
    if (modelOriginPositionRef.current) model.position.copy(modelOriginPositionRef.current).multiplyScalar(value / 100);
  }

  async function downloadScaledModel() {
    const model = modelRef.current;
    if (!model || !unit || exporting) return;
    const exportUnit = sourceUnit ?? unit as ModelSourceUnit;
    let exportCopy: ReturnType<typeof createMeterExportCopy> | null = null;
    setExporting(true);
    setMessage("Preparando o modelo redimensionado…");
    try {
      const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
      exportCopy = createMeterExportCopy(model, exportUnit);
      const output = await new GLTFExporter().parseAsync(exportCopy.object, { binary: true, onlyVisible: true });
      if (!(output instanceof ArrayBuffer)) throw new Error("O formato GLB não foi gerado.");
      const url = URL.createObjectURL(new Blob([output], { type: "model/gltf-binary" }));
      const sourceName = selectedFiles.find((file) => getModelFormat(file.name))?.name ?? "modelo";
      const stem = sourceName.replace(/\.[^.]+$/, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim() || "modelo";
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${stem}-escala-${scale}pct.glb`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`Nova cópia GLB exportada na escala de ${scale}%. O arquivo original não foi alterado.`);
    } catch {
      setMessage("Não foi possível exportar o modelo. O arquivo original permanece intacto.");
    } finally {
      exportCopy?.dispose();
      setExporting(false);
    }
  }

  const dimensions = rawDimensions && unit
    ? formatModelDimensions(rawDimensions, sourceUnit ?? unit, unit, scale / 100)
    : null;
  const dimensionsMm = rawDimensions && unit
    ? formatModelDimensions(rawDimensions, sourceUnit ?? unit, "mm", 1)
    : null;

  return (
    <section className="viewer-shell shell" aria-label="Visualizador de modelos 3D">
      <div className="viewer-topline"><span><Box size={16} aria-hidden="true" /> VISUALIZADOR VIRAPEÇA 3D</span><span>{readOnly ? `${modelName ? "MODELO PÚBLICO · 3MF" : "PRÉVIA PÚBLICA · GLB"}` : "PRÉVIA LOCAL · ENVIO OPCIONAL"}</span></div>
      <div className={`viewer-layout${readOnly ? " viewer-readonly" : ""}`}>
        <div className="viewer-stage-wrap">
          <div className="viewer-stage-toolbar">
            {!readOnly && <label className="viewer-upload-button">
              <Upload size={16} aria-hidden="true" /> Abrir modelo
              <input type="file" multiple accept=".stl,.obj,.3mf,.glb,.gltf,.mtl,.bin,.png,.jpg,.jpeg,.webp,model/stl,model/obj,model/3mf,model/gltf-binary,model/gltf+json" onChange={(event) => { void loadFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
            </label>}
            <span className="viewer-file-label" title={fileName}>{fileName || "Nenhum modelo selecionado"}</span>
            <div className="viewer-stage-actions">
              <button type="button" className={`viewer-icon-button${showGrid ? " is-active" : ""}`} aria-pressed={showGrid} aria-label="Alternar grade" title="Alternar grade" onClick={() => setShowGrid(!showGrid)}><Grid2X2 size={16} /></button>
              <button type="button" className={`viewer-icon-button${showAxes ? " is-active" : ""}`} aria-pressed={showAxes} aria-label="Alternar eixos" title="Alternar eixos" onClick={() => setShowAxes(!showAxes)}>XYZ</button>
              <button type="button" className="viewer-icon-button" aria-label="Enquadrar modelo" title="Enquadrar modelo" disabled={!rawDimensions} onClick={fitView}><RotateCcw size={16} /></button>
              {!readOnly && <button type="button" className="viewer-icon-button" aria-label="Salvar imagem da prévia" title="Salvar imagem da prévia" disabled={!rawDimensions} onClick={capturePreview}><ArrowDownToLine size={16} /></button>}
              {!readOnly && <button type="button" className="viewer-icon-button" aria-label={exporting ? "Gerando cópia GLB" : "Baixar cópia redimensionada em GLB"} title="Baixar cópia redimensionada em GLB" aria-busy={exporting} disabled={!rawDimensions || !unit || busy || exporting} onClick={() => void downloadScaledModel()}><Download size={16} /></button>}
              <button type="button" className="viewer-icon-button" aria-label="Tela cheia" title="Tela cheia" onClick={() => { void canvasHostRef.current?.requestFullscreen?.(); }}><Expand size={16} /></button>
            </div>
          </div>
          <div
            ref={canvasHostRef}
            className={`viewer-stage${rawDimensions ? " has-model" : ""}`}
            onDragOver={(event) => { if (!readOnly) event.preventDefault(); }}
            onDrop={(event) => { if (!readOnly) { event.preventDefault(); void loadFiles(Array.from(event.dataTransfer.files)); } }}
          >
            <div className="viewer-canvas-label">X <i /> Y <i /> Z</div>
            {!rawDimensions && !busy && <div className="viewer-empty"><div className="viewer-empty-icon"><Box size={30} /></div><h2>{readOnly ? modelName ? `Visualize ${modelName} em 3D` : "Prévia 3D do produto" : "Veja seu modelo ganhar forma."}</h2><p>{readOnly ? modelName ? "Carregando o arquivo 3MF original." : "Carregando a cópia de prévia enviada pelo fabricante." : "Abra ou arraste um arquivo STL, OBJ, 3MF ou GLB para explorar a peça em 3D."}</p>{!readOnly && <span>Até 20 MB no conjunto · processamento no seu dispositivo</span>}</div>}
            {busy && <div className="viewer-loading" role="status"><span className="viewer-spinner" />Preparando modelo 3D…</div>}
            {webglError && <div className="viewer-loading" role="alert">Este dispositivo não conseguiu iniciar a visualização 3D (WebGL).</div>}
            {message && <div className={`viewer-message${message.startsWith("Não foi") || message.includes("Escolha") || message.includes("20 MB") || message.includes("50 MB") || message.includes("vazio") || message.includes("Selecione") || message.includes("compatível") ? " is-error" : ""}`} role="status"><span>{message}</span><button type="button" onClick={() => setMessage("")} aria-label="Dispensar mensagem"><X size={14} /></button></div>}
          </div>
          <div className="viewer-toolbar">
            {views.map((view) => <button key={view.name} type="button" className="viewer-view-button" disabled={!rawDimensions} onClick={() => selectView(view.name)}>{view.label}</button>)}
            <span className="viewer-hint">Arraste para girar · scroll para zoom · botão direito para mover</span>
          </div>
          {readOnly && modelColors.length > 0 && <section className="viewer-readonly-colors" aria-label="Cores do modelo">
            <div className="inspector-section-head"><h2>Cores do arquivo</h2><span className="component-count">{modelColors.length}</span></div>
            <ul>{modelColors.map((color) => <li key={color}><i style={{ backgroundColor: `#${color}` }} aria-hidden="true" /><span>#{color.toUpperCase()}</span></li>)}</ul>
          </section>}
          {slicePlates.length > 0 && <section className="slice-info-panel" aria-label="Resultados registrados pelo fatiador">
            <h2>Consumo registrado pelo fatiador</h2>
            <p>Dados gravados no arquivo 3MF; placas separadas representam opções distintas.</p>
            {slicePlates.map((plate, plateIndex) => <div className="slice-info-plate" key={`${plate.index ?? plateIndex}-${plateIndex}`}>
              <strong>Placa {plate.index ?? plateIndex + 1}</strong>
              <div className="slice-info-summary">
                {plate.weightGrams !== null && <span>Total: {formatSliceNumber(plate.weightGrams)} g</span>}
                {plate.printTimeSeconds !== null && <span>Tempo previsto: {formatSliceTime(plate.printTimeSeconds)}</span>}
                {plate.supportUsed !== null && <span>{plate.supportUsed ? "Inclui suportes" : "Sem suportes"}</span>}
              </div>
              {plate.filaments.length > 0 && <ul>{plate.filaments.map((filament, filamentIndex) => <li key={`${filament.color ?? filament.type ?? "filamento"}-${filamentIndex}`}>
                <span className="slice-info-filament-name">{filament.color && <i style={{ backgroundColor: `#${filament.color}` }} aria-hidden="true" />}{filament.type || `Filamento ${filamentIndex + 1}`}</span>
                <span>{filament.weightGrams !== null ? `${formatSliceNumber(filament.weightGrams)} g` : ""}{filament.lengthMeters !== null ? `${filament.weightGrams !== null ? " · " : ""}${formatSliceNumber(filament.lengthMeters)} m` : ""}</span>
              </li>)}</ul>}
            </div>)}
          </section>}
        </div>
        {!readOnly && <aside className="viewer-inspector">
          <div className="inspector-heading"><div><p className="eyebrow">PAINEL DO MODELO</p><h1>Inspecione<br /><em>cada detalhe.</em></h1></div><span className="inspector-mark"><Box size={19} /></span></div>
          <p className="inspector-description">Gire, aproxime e confira as medidas antes de transformar o arquivo em uma peça.</p>
          <div className="inspector-divider" />
          <div className="inspector-section-head"><h2>Dimensões</h2><label className="unit-select"><span className="sr-only">Unidade das dimensões</span><select value={unit} onChange={(event) => setUnit(event.target.value as ModelUnit | "")} disabled={!rawDimensions}><option value="">Unidade</option><option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option></select></label></div>
          <div className="dimension-grid">
            {(["x", "y", "z"] as const).map((axis) => <div key={axis} className="dimension-cell"><span>{axis.toUpperCase()}</span><strong>{dimensions ? dimensions[axis].toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—"}</strong><small>{unit || "unid."}</small></div>)}
          </div>
          {!unit && rawDimensions && <p className="unit-note">Confirme a unidade do arquivo para liberar as medidas.</p>}
          <div className="inspector-divider" />
          <div className="inspector-section-head"><h2>Escala proporcional</h2><strong className="scale-value">{scale}%</strong></div>
          <input className="scale-slider" aria-label="Escala proporcional do modelo" type="range" min="10" max="300" step="5" value={scale} onChange={(event) => updateScale(Number(event.target.value))} disabled={!rawDimensions} />
          <div className="scale-limits"><span>10%</span><span>300%</span></div>
          <p className="scale-note">A escala altera a prévia. Baixe uma nova cópia GLB para aplicar a escala; o original permanece intacto.{!unit && rawDimensions ? " Confirme a unidade para exportar corretamente." : ""}</p>
          {modelColors.length > 0 && <>
            <div className="inspector-divider" />
            <div className="inspector-section-head"><h2>Cores do arquivo</h2><span className="component-count">{modelColors.length}</span></div>
            <div className="model-color-list" aria-label="Cores definidas no arquivo">
              {modelColors.map((color) => <button key={color} type="button" className={`model-color-swatch${selectedColor === color ? " is-selected" : ""}`} style={{ backgroundColor: `#${color}` }} title={`Destacar componentes da cor #${color}`} aria-label={`Destacar componentes da cor #${color}`} aria-pressed={selectedColor === color} onClick={() => setSelectedColor(selectedColor === color ? null : color)} />)}
            </div>
            <p className="scale-note">{selectedColor ? getModelColorMatchedComponentIds(components, selectedColor).length > 0 ? `Componentes que usam #${selectedColor} estão destacados. Selecione novamente para limpar.` : `#${selectedColor} aparece nos dados do arquivo, sem associação a uma parte visível.` : "Selecione uma cor para destacar as partes correspondentes no modelo."}</p>
          </>}
          {components.length > 0 && <>
            <div className="inspector-divider" />
            <div className="inspector-section-head"><h2>Componentes</h2><span className="component-count">{components.length}</span></div>
            <ul className="viewer-component-list">
              {components.map((component, index) => <li key={component.id}>
                <span className="component-index">{String(index + 1).padStart(2, "0")}</span>
                <span className={`component-name${selectedColor && component.colors.includes(selectedColor) ? " is-color-match" : ""}`} title={component.name}>{component.name}</span>
                <button type="button" className="component-visibility" aria-label={`${component.visible ? "Ocultar" : "Exibir"} ${component.name}`} aria-pressed={component.visible} onClick={() => toggleComponent(component)}>{component.visible ? <Eye size={15} /> : <EyeOff size={15} />}</button>
              </li>)}
            </ul>
          </>}
          <div className="inspector-divider" />
          <div className="file-summary"><span className="file-summary-icon"><Box size={17} /></span><div><strong>{fileName || "Seu arquivo 3D"}</strong><small>{fileKind ? `${fileKind.toUpperCase()} · conjunto de até ${Math.round(MAX_MODEL_FILE_BYTES / 1024 / 1024)} MB` : "STL, OBJ, 3MF, GLB ou GLTF · máximo 20 MB"}</small></div></div>
          <label className="viewer-upload-secondary"><Upload size={15} /> {rawDimensions ? "Trocar arquivo" : "Escolher arquivo"}<input type="file" multiple accept=".stl,.obj,.3mf,.glb,.gltf,.mtl,.bin,.png,.jpg,.jpeg,.webp,model/stl,model/obj,model/3mf,model/gltf-binary,model/gltf+json" onChange={(event) => { void loadFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} /></label>
          <ModelUploadManager buyerId={buyerId} files={selectedFiles} savedModels={savedModels} materials={materials} dimensionsMm={dimensionsMm} today={today} onLoad={loadFiles} libraryError={libraryError} />
          <p className="privacy-note">Os arquivos ficam no dispositivo até você salvar o conjunto na biblioteca privada. Para OBJ/GLTF com recursos externos, selecione também os arquivos MTL, BIN e texturas associados.</p>
        </aside>}
      </div>
    </section>
  );
}

function formatSliceNumber(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function formatSliceTime(seconds: number) {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}

function extractModelColors(root: THREE.Object3D, format: ModelFormat, THREE: typeof import("three")) {
  const colors = new Set<string>();
  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material) continue;
      const materialWithColor = material as THREE.Material & { color?: THREE.Color; map?: THREE.Texture | null };
      if (material.vertexColors) {
        const attribute = mesh.geometry.getAttribute("color");
        if (attribute) {
          const stride = Math.max(1, Math.ceil(attribute.count / 5000));
          for (let index = 0; index < attribute.count; index += stride) {
            colors.add(new THREE.Color(attribute.getX(index), attribute.getY(index), attribute.getZ(index)).getHexString());
            if (colors.size >= 12) break;
          }
        }
      } else if (format !== "stl" && materialWithColor.color?.isColor && (!materialWithColor.map || materialWithColor.color.getHex() !== 0xffffff)) {
        colors.add(materialWithColor.color.getHexString());
      }
      if (colors.size >= 12) break;
    }
  });
  return [...colors].slice(0, 12);
}

function applyThreeMfColors(root: THREE.Object3D, colors: ThreeMfColorData, THREE: typeof import("three")) {
  const paint = (object: THREE.Object3D, hex: string, force = false) => object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const colored = materials.map((material) => {
      if (!material) return material;
      const original = material as THREE.Material & { color?: THREE.Color; map?: THREE.Texture | null };
      if (material.vertexColors || original.map || (!force && original.color?.isColor && original.color.getHex() !== 0xffffff)) return material;
      const clone = material.clone() as THREE.Material & { color?: THREE.Color };
      clone.color?.set(`#${hex}`);
      return clone;
    });
    mesh.material = Array.isArray(mesh.material) ? colored : colored[0];
  });
  root.children.forEach((item, index) => {
    colors.componentPartColors[index]?.forEach((hex, partIndex) => {
      if (hex && item.children[partIndex]) paint(item.children[partIndex], hex, true);
    });
    item.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const faceCount = mesh.geometry.getAttribute("position")?.count / 3;
      const hex = colors.namedColors[child.name]
        ?? colors.faceColors[faceCount]?.[0]
        ?? colors.namedColors[item.name]
        ?? colors.objectColors[index];
      if (hex) paint(child, hex);
    });
    colors.componentTriangleColors[index]?.forEach((triangleColors, componentIndex) => {
      const component = item.children[componentIndex];
      if (!component || !triangleColors.some(Boolean)) return;
      applyTrianglePaint(component, triangleColors, THREE);
    });
    colors.componentPaintColors[index]?.forEach((hex, componentIndex) => {
      if (hex && !colors.componentTriangleColors[index]?.[componentIndex]?.some(Boolean) && item.children[componentIndex]) {
        paint(item.children[componentIndex], hex, true);
      }
    });
  });
}

function applyTrianglePaint(object: THREE.Object3D, triangleColors: string[], THREE: typeof import("three")) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const source = mesh.geometry;
    const triangleCount = (source.index?.count ?? source.getAttribute("position")?.count ?? 0) / 3;
    if (triangleCount !== triangleColors.length) return;
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    const positions = geometry.getAttribute("position");
    const previousColors = geometry.getAttribute("color");
    const values = new Float32Array(positions.count * 3);
    const color = new THREE.Color();
    for (let triangleIndex = 0; triangleIndex < triangleColors.length; triangleIndex++) {
      const hex = triangleColors[triangleIndex];
      if (hex) color.set(`#${hex}`);
      for (let vertex = 0; vertex < 3; vertex++) {
        const index = triangleIndex * 3 + vertex;
        values[index * 3] = hex ? color.r : previousColors?.getX(index) ?? 1;
        values[index * 3 + 1] = hex ? color.g : previousColors?.getY(index) ?? 1;
        values[index * 3 + 2] = hex ? color.b : previousColors?.getZ(index) ?? 1;
      }
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(values, 3));
    if (geometry !== source) source.dispose();
    mesh.geometry = geometry;
    const withVertexColors = (material: THREE.Material) => {
      const clone = material.clone() as THREE.Material & { vertexColors?: boolean };
      clone.vertexColors = true;
      return clone;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(withVertexColors) : withVertexColors(mesh.material);
  });
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials?.forEach((material) => {
      if (!material) return;
      Object.values(material).forEach((value) => {
        if (value && typeof value === "object" && "isTexture" in value) (value as THREE.Texture).dispose();
      });
      material.dispose();
    });
  });
}
