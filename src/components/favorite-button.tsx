"use client";

import { useActionState } from "react";
import { Heart } from "lucide-react";
import { setProductFavorite, type FavoriteActionState } from "@/app/favoritos/actions";

const initialState: FavoriteActionState = { message: "", success: false, favorite: false };

export function FavoriteButton({ productId, slug, initialFavorite = false }: { productId: string; slug: string; initialFavorite?: boolean }) {
  const [state, action, pending] = useActionState(setProductFavorite, initialState);
  const favorite = state.success ? state.favorite : initialFavorite;
  const label = favorite ? "Remover dos favoritos" : "Salvar nos favoritos";

  return <form className="favorite-form" action={action}>
    <input type="hidden" name="productId" value={productId} />
    <input type="hidden" name="slug" value={slug} />
    <input type="hidden" name="favorite" value={String(!favorite)} />
    <button className={`favorite-button${favorite ? " is-active" : ""}`} type="submit" aria-label={label} aria-pressed={favorite} disabled={pending} title={label}>
      <Heart size={18} aria-hidden="true" fill={favorite ? "currentColor" : "none"} />
    </button>
    {state.message && <span className="favorite-feedback" role={state.success ? "status" : "alert"}>{state.message}</span>}
  </form>;
}
