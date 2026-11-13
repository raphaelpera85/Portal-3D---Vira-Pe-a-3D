type ProductCategoryNode = { id: string; parent_id: string | null; active: boolean };
type NamedProductCategoryNode = { id: string; parent_id: string | null; name: string };

export function getAssignableCategoryParentIds(categoryId: string | null, categories: ProductCategoryNode[]): string[] {
  const excluded = new Set<string>();
  if (categoryId) {
    const children = new Map<string, string[]>();
    for (const category of categories) {
      if (category.parent_id) children.set(category.parent_id, [...(children.get(category.parent_id) ?? []), category.id]);
    }
    const pending = [categoryId];
    while (pending.length) {
      const current = pending.pop()!;
      if (excluded.has(current)) continue;
      excluded.add(current);
      pending.push(...(children.get(current) ?? []));
    }
  }
  return categories.filter(({ id, active }) => active && !excluded.has(id)).map(({ id }) => id);
}

export function getProductCategoryLabels(categories: NamedProductCategoryNode[]): Map<string, string> {
  const byId = new Map(categories.map((category) => [category.id, category]));
  return new Map(categories.map((category) => {
    const path = [category.name];
    const seen = new Set([category.id]);
    let parentId = category.parent_id;
    while (parentId && !seen.has(parentId)) {
      const parent = byId.get(parentId);
      if (!parent) break;
      seen.add(parentId);
      path.unshift(parent.name);
      parentId = parent.parent_id;
    }
    return [category.id, path.join(" / ")];
  }));
}

export function getProductCategoryTreeIds(categoryId: string, categories: ProductCategoryNode[]): string[] {
  const children = new Map<string, string[]>();
  for (const category of categories) {
    if (category.active && category.parent_id) children.set(category.parent_id, [...(children.get(category.parent_id) ?? []), category.id]);
  }
  const included = new Set<string>();
  const pending = [categoryId];
  while (pending.length) {
    const current = pending.pop()!;
    if (included.has(current)) continue;
    included.add(current);
    pending.push(...(children.get(current) ?? []));
  }
  return categories.filter(({ id, active }) => active && included.has(id)).map(({ id }) => id);
}
