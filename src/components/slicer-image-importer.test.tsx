import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SlicerImageImporter } from "./slicer-image-importer";

describe("SlicerImageImporter", () => {
  it("shows the image picker to an approved maker when Vision is not configured", () => {
    const markup = renderToStaticMarkup(<SlicerImageImporter enabled configured={false} onApply={() => false} />);
    expect(markup).toContain('type="file"');
    expect(markup).toContain("Escolher imagens");
    expect(markup).toContain('class="price-ocr-file-picker"');
    expect(markup).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(markup).toContain("multiple=");
    expect(markup).toContain("Google Cloud Vision");
    expect(markup).toContain("ainda não está conectada");
  });

  it("keeps the picker unavailable to accounts without OCR authorization", () => {
    const markup = renderToStaticMarkup(<SlicerImageImporter enabled={false} configured onApply={() => false} />);
    expect(markup).not.toContain('type="file"');
  });

  it("keeps image reading behind explicit Google Vision consent", () => {
    const markup = renderToStaticMarkup(<SlicerImageImporter enabled configured onApply={() => false} />);
    expect(markup).toContain('type="file"');
    expect(markup).toContain("Autorizo o envio dessas imagens ao Google Cloud Vision");
    expect(markup).toContain("Ler dados das imagens");
  });
});
