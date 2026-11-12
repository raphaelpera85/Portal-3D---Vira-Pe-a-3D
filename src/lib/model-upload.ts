import { validateModelFiles } from "./model-file";

export type ModelUploadFile = { name: string; storage_name: string; size: number };

export function prepareModelUploadFiles(files: Array<Pick<File, "name" | "size" | "type">>): { error: string | null; files: ModelUploadFile[] | null } {
  const validation = validateModelFiles(files);
  if (validation) return { error: validation, files: null };

  const manifest = files.map(({ name, size }) => {
    const safeName = name.replace(/[\\/\u0000-\u001f\u007f]/g, "_");
    const extension = safeName.match(/\.([^.]+)$/)?.[1] ?? "";
    const baseName = extension ? safeName.slice(0, -(extension.length + 1)) : safeName;
    const safeBase = baseName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_. -]/g, "_").replace(/^\.+/, "").slice(0, 120) || "arquivo";
    const safeExtension = extension.replace(/[^A-Za-z0-9]/g, "");
    return { name: safeName, storage_name: `${safeBase}.${safeExtension}`, size };
  });
  if (manifest.some((file) => !file.name || file.name.length > 200 || !file.storage_name || file.storage_name.length > 200)) {
    return { error: "Os nomes dos arquivos precisam ter até 200 caracteres.", files: null };
  }
  if (new Set(manifest.map((file) => file.storage_name.toLocaleLowerCase("en-US"))).size !== manifest.length) {
    return { error: "O conjunto contém arquivos com o mesmo nome. Renomeie-os antes de salvar.", files: null };
  }
  return { error: null, files: manifest };
}
