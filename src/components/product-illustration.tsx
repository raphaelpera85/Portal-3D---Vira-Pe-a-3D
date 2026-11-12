import type { Product } from "@/lib/products";

export function ProductIllustration({ product }: { product: Product }) {
  if (product.visual === "dragon") {
    return <svg viewBox="0 0 240 190" role="img" aria-label="Ilustração geométrica de um dragão articulado"><path className="art-shadow" d="M43 154h151l-20 13H60z" /><path className="dragon-body" d="m72 119 16-27 25-13 22 6 20-20 23 4 8 17-12 15 10 12-8 19-23 4-18-13-21 12-22-4-13 10-16-5z" /><path className="dragon-wing" d="m106 92-22-40 38 17 10-30 16 36-13 18z" /><path className="dragon-body" d="m62 112-24-12 13 25-18 5 24 7"/><path className="dragon-body" d="m177 91 21-10 5 14-17 10"/><circle cx="171" cy="94" r="2.5" className="art-eye"/><path className="art-line" d="m96 104 9 8m16-22 9 8m8 25 9 7m-42-4 8 7m42-34 8 6"/></svg>;
  }

  if (product.visual === "organizer") {
    return <svg viewBox="0 0 240 190" role="img" aria-label="Ilustração geométrica de um organizador modular"><path className="art-shadow" d="M37 150h166l-19 14H56z"/><path className="organizer-side" d="M52 103 118 66l68 37-67 38z"/><path className="organizer-front" d="M52 103v40l67 38v-40z"/><path className="organizer-dark" d="M119 141v40l67-38v-40z"/><path className="organizer-top" d="m68 94 50-28 52 29-51 29z"/><path className="organizer-front" d="M78 91v29l39 22V112z"/><path className="organizer-dark" d="M117 112v30l40-23V91z"/><path className="organizer-top" d="m78 91 39-23 40 23-40 21z"/><path className="art-line" d="M66 115v22m18-8v22m59-18v18"/></svg>;
  }

  if (product.visual === "keychain") {
    return <svg viewBox="0 0 240 190" role="img" aria-label="Ilustração geométrica de um chaveiro personalizado"><path className="art-shadow" d="M44 150h152l-18 14H60z"/><ellipse cx="122" cy="77" rx="38" ry="45" className="keychain-ring"/><ellipse cx="122" cy="77" rx="22" ry="29" className="keychain-hole"/><path className="keychain-body" d="m92 103 61 6 11 35-70-8z"/><path className="keychain-side" d="m164 109 10 35-70-8-10-35z"/><path className="keychain-top" d="m92 103 72 6-63 17z"/><text x="124" y="128" textAnchor="middle" className="keychain-letter">R</text></svg>;
  }

  return <svg viewBox="0 0 240 190" role="img" aria-label="Ilustração geométrica de um vaso decorativo"><path className="art-shadow" d="M47 153h147l-18 13H65z"/><path className="vase-back" d="M91 59h58l-5 21 15 68-40 18-39-18 16-68z"/><path className="vase-front" d="M91 59h58l-5 21 15 68-40 18-39-18 16-68z"/><path className="vase-side" d="m120 80 29-21-5 21 15 68-39 18z"/><path className="vase-mouth" d="M91 59 120 42l29 17-29 17z"/><path className="vase-ridge" d="m94 88 26 14 27-15m-58 29 31 17 32-17m-57 35 25 13 27-13"/></svg>;
}
