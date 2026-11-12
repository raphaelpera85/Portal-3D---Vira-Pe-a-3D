export const MAX_CHARGEBACK_EVIDENCE_FILES = 10;
export const MAX_CHARGEBACK_EVIDENCE_BYTES = 10 * 1024 * 1024;

const evidenceTypes = new Map([["pdf", "application/pdf"], ["jpg", "image/jpeg"], ["jpeg", "image/jpeg"], ["png", "image/png"]]);

export function validateChargebackEvidence(files: { name: string; type: string; size: number }[]) {
  if (!Array.isArray(files)) return "Selecione arquivos válidos.";
  if (files.length < 1) return "Selecione ao menos um comprovante.";
  if (files.length > MAX_CHARGEBACK_EVIDENCE_FILES) return "Envie no máximo 10 arquivos por contestação.";
  if (files.some((file) => {
    if (!file || typeof file.name !== "string" || typeof file.type !== "string" || typeof file.size !== "number") return true;
    const { name, type, size } = file;
    const extension = name.split(".").at(-1)?.toLowerCase();
    return !name || name.length > 255 || /[\u0000-\u001f\u007f]/.test(name)
      || !Number.isSafeInteger(size) || size < 1 || evidenceTypes.get(extension ?? "") !== type;
  })) return "Use arquivos JPG, PNG ou PDF válidos e maiores que zero.";
  if (files.reduce((total, file) => total + file.size, 0) > MAX_CHARGEBACK_EVIDENCE_BYTES) return "O conjunto de comprovantes pode ter até 10 MB.";
  return null;
}

export function isChargebackEvidenceBytes(type: string, bytes: Uint8Array) {
  if (type === "application/pdf") {
    for (let index = 0; index <= Math.min(bytes.length - 5, 1023); index += 1) {
      if (bytes[index] === 37 && bytes[index + 1] === 80 && bytes[index + 2] === 68 && bytes[index + 3] === 70 && bytes[index + 4] === 45) return true;
    }
    return false;
  }
  if (type === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (type === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return false;
}

export function isChargebackEvidencePath(path: string, storeId: string, caseId: string) {
  const [pathStore, pathCase, filename, ...extra] = path.split("/");
  return pathStore === storeId && pathCase === caseId && extra.length === 0
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png)$/i.test(filename ?? "");
}

export function sanitizeChargebackEvidenceFilename(filename: string) {
  const basename = filename.replaceAll("\\", "/").split("/").at(-1) ?? "comprovante";
  return basename.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 120) || "comprovante";
}
