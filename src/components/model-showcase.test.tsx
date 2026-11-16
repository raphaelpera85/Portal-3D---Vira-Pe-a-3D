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

  it("combines text and image search in one compact catalog field", () => {
    const markup = renderToStaticMarkup(<ModelShowcase models={[]} query="" category="" page={1} pages={1} />);

    expect(markup).toContain('for="model-gallery-search">Buscar modelos por nome, tag ou imagem</label>');
    expect(markup).toContain('type="file" accept="image/png,image/jpeg,image/webp"');
    expect(markup).toContain('title="Buscar modelos por imagem"');
    expect(markup).not.toContain("Comparar com prévias");
    expect(markup).not.toContain("Comparação visual local com as prévias do catálogo");
  });
});
