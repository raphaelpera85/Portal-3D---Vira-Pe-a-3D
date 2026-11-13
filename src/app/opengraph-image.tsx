import { ImageResponse } from "next/og";

export const alt = "ViraPeça 3D — Sua ideia vira realidade";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "68px 78px", background: "linear-gradient(120deg, #ffffff 0%, #f1f6ff 58%, #dbeafe 100%)",
      color: "#0f172a", fontFamily: "Arial, sans-serif",
    }}>
      <div style={{ width: 680, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 37, fontWeight: 700, letterSpacing: "-1.5px" }}>
          <span>vira<span style={{ color: "#2563eb" }}>peça</span></span>
          <span style={{ color: "#2563eb", fontSize: 19, letterSpacing: 0 }}>3D</span>
        </div>
        <div style={{ marginTop: 76, color: "#2563eb", fontSize: 17, fontWeight: 700, letterSpacing: 3 }}>
          MARKETPLACE DE IMPRESSÃO 3D
        </div>
        <div style={{ marginTop: 20, fontSize: 62, lineHeight: 1.12, fontWeight: 700, letterSpacing: "-2px" }}>
          Sua ideia vira realidade.
        </div>
        <div style={{ marginTop: 22, color: "#475569", fontSize: 24, lineHeight: 1.45 }}>
          Produtos autorais, impressão sob encomenda e modelos 3D em um só lugar.
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 30 }}>
          {["Produtos autorais", "Modelos 3D", "Fabricantes do Brasil"].map((label) => (
            <span key={label} style={{ padding: "11px 16px", border: "1px solid #bfdbfe", borderRadius: 999, color: "#1e40af", background: "#ffffffaa", fontSize: 15 }}>
              {label}
            </span>
          ))}
        </div>
      </div>
      <div style={{ width: 310, height: 390, borderRadius: 34, background: "linear-gradient(150deg, #0f172a, #172554)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 280, height: 280, borderRadius: 999, background: "#2563eb", opacity: 0.28, top: -110, right: -90 }} />
        <div style={{ position: "absolute", width: 210, height: 210, borderRadius: 999, background: "#38bdf8", opacity: 0.16, bottom: -75, left: -75 }} />
        <div style={{ width: 190, height: 190, borderRadius: 30, background: "linear-gradient(145deg, #60a5fa, #2563eb 62%, #1d4ed8)", boxShadow: "0 18px 0 #1e40af, 0 36px 0 #172554", transform: "rotate(-8deg)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 73, fontWeight: 700, letterSpacing: "-5px" }}>
          VP
        </div>
        <div style={{ position: "absolute", right: 24, bottom: 25, padding: "10px 16px", borderRadius: 999, background: "#ffffff", color: "#1d4ed8", fontSize: 17, fontWeight: 700 }}>
          SUA IDEIA VIRA REALIDADE
        </div>
      </div>
    </div>,
    size,
  );
}
