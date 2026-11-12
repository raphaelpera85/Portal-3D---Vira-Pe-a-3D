import { describe, expect, it } from "vitest";
import { validateHomepageBanner } from "./homepage-banners";

const banner = {
  eyebrow: "FEITO PERTO",
  title: "Sua ideia vira realidade",
  description: "Descubra fabricantes independentes em todo o Brasil.",
  imageUrl: "https://cdn.example.com/banner.webp",
  imageAlt: "Peça impressa em 3D sobre uma mesa",
  actionLabel: "Explorar peças",
  actionHref: "/#produtos",
  sortOrder: "1",
  isActive: "on",
};

describe("validateHomepageBanner", () => {
  it("normalizes valid campaign content", () => {
    expect(validateHomepageBanner(banner)).toEqual({
      eyebrow: "FEITO PERTO",
      title: "Sua ideia vira realidade",
      description: "Descubra fabricantes independentes em todo o Brasil.",
      imageUrl: "https://cdn.example.com/banner.webp",
      imageAlt: "Peça impressa em 3D sobre uma mesa",
      actionLabel: "Explorar peças",
      actionHref: "/#produtos",
      sortOrder: 1,
      isActive: true,
    });
  });

  it("rejects external links, insecure media and invalid ordering", () => {
    expect(validateHomepageBanner({ ...banner, actionHref: "https://example.com" })).toBeNull();
    expect(validateHomepageBanner({ ...banner, actionHref: "//example.com" })).toBeNull();
    expect(validateHomepageBanner({ ...banner, imageUrl: "http://example.com/image.jpg" })).toBeNull();
    expect(validateHomepageBanner({ ...banner, sortOrder: "-1" })).toBeNull();
  });

  it("allows a text-only banner without inventing media", () => {
    const result = validateHomepageBanner({ ...banner, imageUrl: "", imageAlt: "", isActive: "" });
    expect(result?.imageUrl).toBeNull();
    expect(result?.imageAlt).toBeNull();
    expect(result?.isActive).toBe(false);
  });
});
