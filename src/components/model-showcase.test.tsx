import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ModelShowcase } from "./model-showcase";

describe("ModelShowcase", () => {
  it("links a submitted catalog query to MakerWorld without importing files", () => {
    const markup = renderToStaticMarkup(<ModelShowcase models={[]} query="cat holder" category="" page={1} pages={1} />);

    expect(markup).toContain("https://makerworld.com/en/search/models?keyword=cat%20holder");
    expect(markup).toContain('target="_blank" rel="noopener noreferrer nofollow"');
    expect(markup).toContain("O portal não baixa arquivos do MakerWorld.");
    expect(markup).toContain("Baixe somente um modelo que você tenha permissão para usar");
  });

  it("does not show an external search link for an empty query", () => {
    const markup = renderToStaticMarkup(<ModelShowcase models={[]} query="" category="" page={1} pages={1} />);

    expect(markup).not.toContain("makerworld.com/en/search/models");
  });
});
