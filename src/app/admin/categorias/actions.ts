"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth-role.server";
import { getAssignableCategoryParentIds } from "@/lib/product-category-hierarchy";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const finish = (result: string): never => redirect(`/admin/categorias?resultado=${result}`);

export async function saveProductCategoryAction(formData: FormData): Promise<void> {
  const rawId = formData.get("categoryId");
  const id = typeof rawId === "string" && rawId ? rawId : null;
  const name = formData.get("name");
  const slug = formData.get("slug");
  const rawOrder = formData.get("sortOrder");
  const rawParent = formData.get("parentId");
  const parentId = typeof rawParent === "string" && rawParent ? rawParent : null;
  const sortOrder = typeof rawOrder === "string" && /^\d{1,5}$/.test(rawOrder) ? Number(rawOrder) : NaN;

  if (typeof name !== "string" || typeof slug !== "string") return finish("erro");
  if ((id && !uuidPattern.test(id)) || (parentId && !uuidPattern.test(parentId)) || (parentId && id && parentId === id) || name.trim().length < 2 || name.trim().length > 80 || slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 32767) finish("erro");

  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");

  const values = { name: name.trim(), slug, sort_order: sortOrder };
  let result;
  if (id) {
    const { data: existing, error: existingError } = await actor.supabase.from("product_categories")
      .select("id, parent_id").eq("id", id).maybeSingle();
    if (existingError) finish("erro");
    if (!existing) return finish("erro");
    if (parentId && parentId !== existing.parent_id) {
      const categories: { id: string; parent_id: string | null; active: boolean }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data: page, error: categoriesError } = await actor.supabase.from("product_categories")
          .select("id, parent_id, active").order("id").range(from, from + 999);
        if (categoriesError) finish("erro");
        categories.push(...(page ?? []));
        if ((page ?? []).length < 1000) break;
      }
      if (!getAssignableCategoryParentIds(id, categories).includes(parentId)) finish("erro");
    }
    result = await actor.supabase.from("product_categories").update({ ...values, parent_id: parentId })
      .eq("id", id).select("id").maybeSingle();
  } else {
    if (parentId) {
      const { data: parent } = await actor.supabase.from("product_categories").select("id").eq("id", parentId).eq("active", true).maybeSingle();
      if (!parent) finish("erro");
    }
    result = await actor.supabase.from("product_categories").insert({ ...values, parent_id: parentId })
      .select("id").single();
  }
  if (result.error || !result.data) finish("erro");

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/categorias");
  revalidatePath("/painel/maker");
  finish("salvo");
}

export async function setProductCategoryActiveAction(formData: FormData): Promise<void> {
  const id = formData.get("categoryId");
  const activeValue = formData.get("active");
  if (typeof id !== "string" || !uuidPattern.test(id) || (activeValue !== "true" && activeValue !== "false")) finish("erro");

  const actor = await getUserWithRole("admin");
  if (!actor.supabase || !actor.user || !actor.authorized) redirect("/conta");

  const active = activeValue === "true";
  if (!active) {
    const { count, error } = await actor.supabase.from("marketplace_products").select("id", { count: "exact", head: true }).eq("category_id", id).eq("catalog_status", "published");
    if (error) finish("erro");
    if (count) finish("tem-anuncios");
  }

  const { data, error } = await actor.supabase.from("product_categories").update({ active }).eq("id", id).select("id").maybeSingle();
  if (error || !data) finish("erro");

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/categorias");
  revalidatePath("/painel/maker");
  finish(active ? "ativada" : "desativada");
}
