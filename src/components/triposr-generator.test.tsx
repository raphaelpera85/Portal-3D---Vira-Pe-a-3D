import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({ default: () => () => null }));

import { TriposrGenerator } from "./triposr-generator";

describe("TriposrGenerator", () => {
  it("uses a localized image picker and displays its selected-file state", () => {
    const markup = renderToStaticMarkup(<TriposrGenerator spaceId="owner/space" />);

    expect(markup).toContain('for="triposr-image-input"');
    expect(markup).toContain("Escolher imagem");
    expect(markup).toContain("Nenhuma imagem selecionada");
    expect(markup).toContain('accept="image/png,image/jpeg,image/webp"');
  });
});
