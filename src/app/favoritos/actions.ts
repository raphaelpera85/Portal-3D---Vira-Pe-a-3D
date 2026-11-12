"use server";

import { revalidatePath } from "next/cache";
import { getUserWithRole } from "@/lib/auth-role.server";
import { validateFavoriteChange } from "@/lib/favorites";

export type FavoriteActionState = { message: string; success: boolean; favorite: boolean };

export async function setProductFavorite(_previous: FavoriteActionState, formData: FormData): Promise<FavoriteActionState> {
  const change = validateFavoriteChange(Object.fromEntries(formData.entries()));
  const slug = formData.get("slug");
  if (!change || typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { message: "Não foi possível atualizar os favoritos.", success: false, favorite: false };
  }

  const actor = await getUserWithRole("buyer");
  if (!actor.supabase || !actor.user) return { message: "Entre na conta para salvar favoritos.", success: false, favorite: false };
  if (!actor.authorized) return { message: "Esta conta não tem acesso aos favoritos de comprador.", success: false, favorite: false };

  const { error } = await actor.supabase.rpc("set_product_favorite", { p_product_id: change.productId, p_favorite: change.favorite });
  if (error) return { message: "Não foi possível atualizar os favoritos. Confira se a migração está aplicada.", success: false, favorite: false };

  revalidatePath("/");
  revalidatePath("/favoritos");
  revalidatePath(`/produtos/${slug}`);
  return { message: change.favorite ? "Produto salvo nos favoritos." : "Produto removido dos favoritos.", success: true, favorite: change.favorite };
}
