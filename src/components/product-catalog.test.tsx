import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/favorite-button", () => ({ FavoriteButton: () => null }));

import { ProductCatalog } from "./product-catalog";

describe("ProductCatalog visual image search", () => {
  it("keeps local image comparison enabled without Google Vision", () => {
    vi.stubEnv("GOOGLE_CLOUD_VISION_API_KEY", "");
    try {
      const markup = renderToStaticMarkup(<ProductCatalog
        products={[]}
        categories={[]}
        source="local"
        unavailable={false}
        notice={null}
        query=""
        category=""
        page={1}
        pages={1}
        sort="newest"
      />);

      expect(markup).toContain("Comparar com prévias");
      expect(markup).toContain("Comparação visual local com as prévias do catálogo");
      expect(markup).not.toContain("Configure Google Cloud Vision para ativar a busca por imagem.");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("links buyers to the model catalog while no products are published", () => {
    const markup = renderToStaticMarkup(<ProductCatalog
      products={[]}
      categories={[]}
      source="database"
      unavailable={false}
      notice={null}
      query=""
      category=""
      page={1}
      pages={0}
      sort="newest"
    />);

    expect(markup).toContain('href="/modelos">Explore os modelos 3D</a>');
    expect(markup).toContain('href="/conta">cadastre-se para vender</a>');
  });
});
