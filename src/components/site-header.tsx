"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Box, Menu, Moon, ShoppingCart, Sun, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SiteHeader() {
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [canUseCreatorTools, setCanUseCreatorTools] = useState(false);
  const firstMenuLinkRef = useRef<HTMLAnchorElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("virapeca-theme");
    const isDark = saved === "dark";
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    setDark(isDark);
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    let requestId = 0;
    const syncCreatorRole = async (userId: string | null) => {
      const currentRequestId = ++requestId;
      if (!userId) {
        setCanUseCreatorTools(false);
        return;
      }
      const { data, error } = await supabase.from("user_roles").select("role")
        .eq("user_id", userId).in("role", ["maker", "designer"]);
      if (currentRequestId === requestId) setCanUseCreatorTools(!error && Boolean(data?.length));
    };

    void supabase.auth.getUser().then(({ data }) => syncCreatorRole(data.user?.id ?? null)).catch(() => syncCreatorRole(null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncCreatorRole(session?.user.id ?? null);
    });
    return () => {
      requestId++;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (menuOpen) firstMenuLinkRef.current?.focus();
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    window.localStorage.setItem("virapeca-theme", next ? "dark" : "light");
  }

  function closeMenu() {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  }

  return (
    <header className="site-header" id="top">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="ViraPeça3D, início">
          <span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span>
          <span>vira<span className="brand-strong">peça</span><small>3D</small></span>
        </Link>
        <nav id="primary-navigation" className={`main-nav${menuOpen ? " is-open" : ""}`} aria-label="Navegação principal">
          <Link ref={firstMenuLinkRef} href="/#produtos" onClick={closeMenu}>Explorar</Link>
          <Link href="/modelos" onClick={closeMenu}>Modelos 3D</Link>
          <Link href="/visualizador" onClick={closeMenu}>Visualizador 3D</Link>
          {canUseCreatorTools && <Link href="/catalogos" onClick={closeMenu}>Catálogos</Link>}
          <Link href="/lojas" onClick={closeMenu}>Lojas</Link>
          <Link href="/designers" onClick={closeMenu}>Designers</Link>
          <Link href="/favoritos" onClick={closeMenu}>Favoritos</Link>
          {canUseCreatorTools && <Link href="/calculadora" onClick={closeMenu}>Calculadora</Link>}
          <Link href="/#como-funciona" onClick={closeMenu}>Como funciona</Link>
          <Link href="/#fabricantes" onClick={closeMenu}>Para makers</Link>
        </nav>
        <div className="header-actions">
          <button className="icon-button theme-button" onClick={toggleTheme} aria-label={`Ativar tema ${dark ? "claro" : "escuro"}`} title={`Tema ${dark ? "claro" : "escuro"}`}>
            {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
          <Link className="header-login" href="/conta">Minha conta</Link>
          <Link className="header-cart" href="/carrinho" aria-label="Abrir carrinho"><ShoppingCart size={16} aria-hidden="true" /> Carrinho</Link>
          <Link className="header-maker" href="/#fabricantes"><Box size={16} aria-hidden="true" /> Quero vender</Link>
          <button ref={menuButtonRef} className="icon-button menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} aria-controls="primary-navigation">
            {menuOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
