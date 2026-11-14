"use client";

import { useEffect } from "react";

function getVisibleMain() {
  const loading = document.querySelector<HTMLElement>("main.app-loading");
  if (loading?.getClientRects().length) return null;
  const main = document.querySelector<HTMLElement>("main:not(.app-loading)");
  return main?.getClientRects().length ? main : null;
}

export function SkipLink() {
  useEffect(() => {
    let observer: MutationObserver | undefined;
    let timeout: number | undefined;
    const stopWaiting = () => {
      observer?.disconnect();
      observer = undefined;
      if (timeout !== undefined) window.clearTimeout(timeout);
      timeout = undefined;
    };
    const focusMain = () => {
      if (window.location.hash !== "#main-content") {
        stopWaiting();
        return;
      }
      const main = getVisibleMain();
      if (main) {
        stopWaiting();
        main.focus();
        return;
      }
      if (observer) return;
      observer = new MutationObserver(focusMain);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "style"] });
      timeout = window.setTimeout(stopWaiting, 10_000);
    };
    window.addEventListener("hashchange", focusMain);
    focusMain();
    return () => {
      window.removeEventListener("hashchange", focusMain);
      stopWaiting();
    };
  }, []);

  return <a className="skip-link" href="#main-content">Pular para o conteúdo principal</a>;
}
