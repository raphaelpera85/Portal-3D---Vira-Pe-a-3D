type ProductCategoryNode = { id: string; parent_id: string | null; active: boolean };

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
