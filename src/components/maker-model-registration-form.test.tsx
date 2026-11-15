import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ router: { refresh: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: vi.fn() }));
vi.mock("@/app/painel/maker/model-actions", () => ({
  discardCreatorModelUpload: vi.fn(),
  finalizeCreatorModelUpload: vi.fn(),
  prepareCreatorModelUpload: vi.fn(),
  submitCreatorModel: vi.fn(),
}));

import { MakerModelRegistrationForm, uploadCreatorModelFile } from "./maker-model-registration-form";

class MockXMLHttpRequest {
  static instances: MockXMLHttpRequest[] = [];
  upload = { onprogress: null as XMLHttpRequestUpload["onprogress"] } as XMLHttpRequestUpload;
  status = 200;
  onload: XMLHttpRequest["onload"] = null;
  onerror: XMLHttpRequest["onerror"] = null;
  onabort: XMLHttpRequest["onabort"] = null;
  body: XMLHttpRequestBodyInit | null = null;
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn((body: XMLHttpRequestBodyInit | null) => {
    this.body = body;
    (this.upload.onprogress as ((event: ProgressEvent) => void) | null)?.({ lengthComputable: true, loaded: 3, total: 3 } as ProgressEvent);
    this.onload?.call(this as unknown as XMLHttpRequest, {} as ProgressEvent);
  });

  constructor() { MockXMLHttpRequest.instances.push(this); }
}

afterEach(() => {
  MockXMLHttpRequest.instances = [];
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("MakerModelRegistrationForm", () => {
  it("offers an accessible 3MF picker with drag-and-drop instructions and size information", () => {
    const markup = renderToStaticMarkup(<MakerModelRegistrationForm availableAssets={[]} />);

    expect(markup).toContain('name="modelFile"');
    expect(markup).toContain("Arraste um 3MF até aqui ou escolha no dispositivo");
    expect(markup).toContain("máximo 50 MiB");
    expect(markup).toContain("O arquivo fica privado enquanto aguarda revisão.");
  });

  it("uploads through the signed Supabase endpoint and reports byte progress", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubGlobal("XMLHttpRequest", MockXMLHttpRequest);
    const file = new File(["3mf"], "modelo.3mf", { type: "application/octet-stream" });
    const progress = vi.fn();

    await uploadCreatorModelFile("user-1/model.3mf", "signed-token", "user-session-token", file, progress);

    const request = MockXMLHttpRequest.instances[0];
    expect(request.open).toHaveBeenCalledWith("PUT", expect.stringContaining("/storage/v1/object/upload/sign/creator-model-uploads/user-1/model.3mf"));
    expect(request.setRequestHeader).toHaveBeenCalledWith("authorization", "Bearer user-session-token");
    expect((request.body as FormData).get("")).toBe(file);
    expect(progress).toHaveBeenCalledWith(3);
  });

  it("does not accept a failed signed upload", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubGlobal("XMLHttpRequest", class extends MockXMLHttpRequest { status = 403; });
    const file = new File(["3mf"], "modelo.3mf", { type: "application/octet-stream" });

    await expect(uploadCreatorModelFile("user-1/model.3mf", "signed-token", "user-session-token", file, () => {}))
      .rejects.toThrow("storage_upload_failed");
  });
});
