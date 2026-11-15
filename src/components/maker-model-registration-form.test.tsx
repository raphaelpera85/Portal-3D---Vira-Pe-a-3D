import { describe, expect, it, vi } from "vitest";
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

import { MakerModelRegistrationForm } from "./maker-model-registration-form";

describe("MakerModelRegistrationForm", () => {
  it("offers an accessible 3MF picker with drag-and-drop instructions and size information", () => {
    const markup = renderToStaticMarkup(<MakerModelRegistrationForm availableAssets={[]} />);

    expect(markup).toContain('name="modelFile"');
    expect(markup).toContain("Arraste um 3MF até aqui ou escolha no dispositivo");
    expect(markup).toContain("máximo 50 MiB");
    expect(markup).toContain("O arquivo fica privado enquanto aguarda revisão.");
  });
});
