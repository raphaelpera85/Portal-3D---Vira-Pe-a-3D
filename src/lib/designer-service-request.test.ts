import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateDesignerServiceRequest } from "./designer-service-request";

const migration = readFileSync(new URL("../../supabase/migrations/20261114040000_designer_service_requests.sql", import.meta.url), "utf8");

describe("designer service request validation", () => {
  it("normalizes a modeling brief without accepting an identity from the browser", () => {
    expect(validateDesignerServiceRequest({
      title: "  Modelagem de suporte para luminária ",
      brief: "Preciso transformar este conceito em um modelo paramétrico que possa ser fabricado em impressão 3D.",
      dueDate: "2026-12-01",
      referenceUrl: "https://portfolio.example/referencia",
      designerId: "spoofed-designer",
      buyerId: "spoofed-buyer",
    }, "2026-11-13")).toEqual({
      title: "Modelagem de suporte para luminária",
      brief: "Preciso transformar este conceito em um modelo paramétrico que possa ser fabricado em impressão 3D.",
      dueDate: "2026-12-01",
      referenceUrl: "https://portfolio.example/referencia",
    });
  });

  it.each([
    { title: "x", brief: "Brief suficientemente longo para ser inválido por causa do título." },
    { title: "Modelo", brief: "Curto demais." },
    { title: "Modelo", brief: "Descrição válida com detalhes suficientes para iniciar a solicitação.", dueDate: "2026-11-12" },
    { title: "Modelo", brief: "Descrição válida com detalhes suficientes para iniciar a solicitação.", referenceUrl: "http://example.com" },
    { title: "Modelo", brief: "Descrição válida com detalhes suficientes para iniciar a solicitação.", referenceUrl: "https://user:pass@example.com" },
  ])("rejects incomplete or unsafe request details %#", (values) => {
    expect(validateDesignerServiceRequest(values, "2026-11-13")).toBeNull();
  });

  it("keeps briefs private and limits quotes to the selected designer", () => {
    expect(migration).toContain("alter table public.designer_service_requests enable row level security");
    expect(migration).toContain("q.buyer_id <> actor_id");
    expect(migration).toContain("d.user_id = actor_id");
    expect(migration).toContain("d.status = 'published'");
    expect(migration).toContain("grant execute on function public.create_designer_service_request");
    expect(migration).toContain("public.submit_designer_service_quote(uuid, bigint, smallint, text) to authenticated");
    expect(migration).toContain("America/Sao_Paulo");
  });
});
