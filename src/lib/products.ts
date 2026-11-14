export type ProductVisual = "vase" | "dragon" | "organizer" | "keychain";
export type ProductVariant = { id: string; options: Record<string, string>; priceBrl: number; stockQuantity: number | null };
export type ProductPhysicalSpecifications = {
  material?: string;
  color?: string;
  weightG?: number;
  dimensionsCm?: { length: number; width: number; height: number };
};
export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  maker: string;
  color: string;
  visual: ProductVisual | null;
  priceBrl: number | null;
  priceMode: "fixed" | "from" | "quote";
  fulfillmentMode: "ready_to_ship" | "made_to_order" | "digital" | "quote";
  stockQuantity: number | null;
  preparationDays: number | null;
  physicalSpecifications?: ProductPhysicalSpecifications;
  modelPreview?: { name: string; url: string };
  variantOptions?: Record<string, string[]>;
  variants?: ProductVariant[];
  priceLabel: string;
  media: string[];
  videoUrl: string | null;
  storeId: string | null;
  storeSlug: string | null;
  demo: boolean;
  listingType?: "physical" | "digital" | "print_service";
  digitalAsset?: { personalPriceBrl: number; commercialPriceBrl: number | null; previewUrl?: string | null } | null;
};

export const products: Product[] = [
  {
    id: "demo-vaso-aresta", slug: "vaso-aresta", description: "Vaso geométrico de demonstração para a vitrine ViraPeça 3D.",
    name: "Vaso Aresta",
    category: "Decoração",
    tags: ["casa", "vaso", "design", "geometria"],
    maker: "Design de bancada",
    color: "blue",
    visual: "vase",
    priceBrl: null, priceMode: "quote", fulfillmentMode: "quote", stockQuantity: null, preparationDays: null, priceLabel: "Demonstração", media: [], videoUrl: null, storeId: null, storeSlug: null, demo: true,
  },
  {
    id: "demo-dragao-articulado", slug: "dragao-articulado", description: "Miniatura articulada de demonstração para a vitrine ViraPeça 3D.",
    name: "Dragão articulado",
    category: "Miniaturas",
    tags: ["RPG", "fantasia", "miniatura", "articulado"],
    maker: "Peça de exemplo",
    color: "green",
    visual: "dragon",
    priceBrl: null, priceMode: "quote", fulfillmentMode: "quote", stockQuantity: null, preparationDays: null, priceLabel: "Demonstração", media: [], videoUrl: null, storeId: null, storeSlug: null, demo: true,
  },
  {
    id: "demo-organizador-modular", slug: "organizador-modular", description: "Organizador modular de demonstração para a vitrine ViraPeça 3D.",
    name: "Organizador modular",
    category: "Organização",
    tags: ["mesa", "casa", "organizador", "modular"],
    maker: "Ideia demonstrativa",
    color: "sand",
    visual: "organizer",
    priceBrl: null, priceMode: "quote", fulfillmentMode: "quote", stockQuantity: null, preparationDays: null, priceLabel: "Demonstração", media: [], videoUrl: null, storeId: null, storeSlug: null, demo: true,
  },
  {
    id: "demo-chaveiro-monograma", slug: "chaveiro-monograma", description: "Chaveiro personalizado de demonstração para a vitrine ViraPeça 3D.",
    name: "Chaveiro Monograma",
    category: "Personalizados",
    tags: ["presente", "chaveiro", "nome", "personalizado"],
    maker: "Projeto de vitrine",
    color: "pink",
    visual: "keychain",
    priceBrl: null, priceMode: "quote", fulfillmentMode: "quote", stockQuantity: null, preparationDays: null, priceLabel: "Demonstração", media: [], videoUrl: null, storeId: null, storeSlug: null, demo: true,
  },
];
