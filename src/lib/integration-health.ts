import { resolveSiteUrl } from "./site-url";

type Environment = Record<string, string | undefined>;

export type IntegrationHealthItem = {
  id: string;
  title: string;
  description: string;
  status: "configured" | "missing";
  missingVariables: string[];
  setupHref: string;
};

function present(env: Environment, key: string) {
  return Boolean(env[key]?.trim());
}

function hasHttpUrl(value: string | undefined, requireHttps = false) {
  return Boolean(value?.trim()) && resolveSiteUrl(value, requireHttps) !== null;
}

function hasEmail(value: string | undefined) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value?.trim() ?? "");
}

export function getIntegrationHealth(env: Environment): IntegrationHealthItem[] {
  const legacySupabaseKey = !present(env, "SUPABASE_SECRET_KEY") && present(env, "SUPABASE_SERVICE_ROLE_KEY");
  const validFee = env.MP_MARKETPLACE_FEE_PERCENT?.trim() !== undefined
    && env.MP_MARKETPLACE_FEE_PERCENT.trim() !== ""
    && Number.isFinite(Number(env.MP_MARKETPLACE_FEE_PERCENT))
    && Number(env.MP_MARKETPLACE_FEE_PERCENT) >= 0
    && Number(env.MP_MARKETPLACE_FEE_PERCENT) < 100;
  const checks: Array<Omit<IntegrationHealthItem, "status" | "missingVariables"> & { missing: string[] }> = [
    {
      id: "supabase", title: "Supabase", description: "Data API, autenticação e operações seguras no servidor.", setupHref: "https://github.com/raphaelpera85/Portal-3D---Vira-Pe-a-3D/blob/main/docs/integrations.md",
      missing: [
        ...(!hasHttpUrl(env.NEXT_PUBLIC_SUPABASE_URL) ? ["NEXT_PUBLIC_SUPABASE_URL"] : []),
        ...(!present(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ? ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] : []),
        ...(!present(env, "SUPABASE_SECRET_KEY") && !legacySupabaseKey ? ["SUPABASE_SECRET_KEY"] : []),
      ],
    },
    {
      id: "siteUrl", title: "Origem pública", description: "Links de retorno, notificações e URLs canônicas do portal.", setupHref: "https://github.com/raphaelpera85/Portal-3D---Vira-Pe-a-3D/blob/main/docs/deployment.md",
      missing: hasHttpUrl(env.NEXT_PUBLIC_SITE_URL, env.NODE_ENV === "production") ? [] : ["NEXT_PUBLIC_SITE_URL"],
    },
    {
      id: "googleVision", title: "Google Cloud Vision", description: "OCR de imagens de fatiadores e busca de modelos por imagem.", setupHref: "https://github.com/raphaelpera85/Portal-3D---Vira-Pe-a-3D/blob/main/docs/integrations.md",
      missing: present(env, "GOOGLE_CLOUD_VISION_API_KEY") ? [] : ["GOOGLE_CLOUD_VISION_API_KEY"],
    },
    {
      id: "googleSearchConsole", title: "Google Search Console", description: "Verificação da propriedade do portal e envio do sitemap.", setupHref: "https://github.com/raphaelpera85/Portal-3D---Vira-Pe-a-3D/blob/main/docs/google-search-console.md",
      missing: present(env, "NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION") ? [] : ["NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION"],
    },
    {
      id: "email", title: "E-mail · Resend", description: "Avisos de novos pedidos e solicitações às lojas.", setupHref: "https://github.com/raphaelpera85/Portal-3D---Vira-Pe-a-3D/blob/main/docs/integrations.md",
      missing: [
        ...(!present(env, "RESEND_API_KEY") ? ["RESEND_API_KEY"] : []),
        ...(hasEmail(env.RESEND_FROM_EMAIL) ? [] : ["RESEND_FROM_EMAIL"]),
      ],
    },
    {
      id: "whatsapp", title: "WhatsApp Business", description: "Avisos de pedidos por template aprovado na Meta.", setupHref: "https://github.com/raphaelpera85/Portal-3D---Vira-Pe-a-3D/blob/main/docs/integrations.md",
      missing: [
        ...(!present(env, "WHATSAPP_ACCESS_TOKEN") ? ["WHATSAPP_ACCESS_TOKEN"] : []),
        ...( /^\d+$/.test(env.WHATSAPP_PHONE_NUMBER_ID ?? "") ? [] : ["WHATSAPP_PHONE_NUMBER_ID"]),
        ...( /^v\d+\.\d+$/.test(env.WHATSAPP_GRAPH_API_VERSION ?? "") ? [] : ["WHATSAPP_GRAPH_API_VERSION"]),
        ...( /^[a-z0-9_]+$/.test(env.WHATSAPP_TEMPLATE_NAME ?? "") ? [] : ["WHATSAPP_TEMPLATE_NAME"]),
        ...( /^[a-z0-9_]+$/.test(env.WHATSAPP_DESIGNER_TEMPLATE_NAME ?? "") ? [] : ["WHATSAPP_DESIGNER_TEMPLATE_NAME"]),
        ...(env.WHATSAPP_TEMPLATE_LANGUAGE === undefined || /^[a-z]{2}_[A-Z]{2}$/.test(env.WHATSAPP_TEMPLATE_LANGUAGE) ? [] : ["WHATSAPP_TEMPLATE_LANGUAGE"]),
      ],
    },
    {
      id: "cron", title: "Rotina de recuperação", description: "Reprocessa notificações pendentes e tarefas agendadas.", setupHref: "https://github.com/raphaelpera85/Portal-3D---Vira-Pe-a-3D/blob/main/docs/deployment.md",
      missing: present(env, "CRON_SECRET") ? [] : ["CRON_SECRET"],
    },
    {
      id: "mercadoPago", title: "Mercado Pago", description: "Checkout Pro, OAuth das lojas, webhook e comissão do marketplace.", setupHref: "https://github.com/raphaelpera85/Portal-3D---Vira-Pe-a-3D/blob/main/docs/integrations.md",
      missing: ["MP_CLIENT_ID", "MP_CLIENT_SECRET", "MP_WEBHOOK_SECRET"].filter((key) => !present(env, key))
        .concat(present(env, "MP_TOKEN_ENCRYPTION_KEY") && /^[a-f0-9]{64}$/i.test(env.MP_TOKEN_ENCRYPTION_KEY!.trim()) ? [] : ["MP_TOKEN_ENCRYPTION_KEY"])
        .concat(validFee ? [] : ["MP_MARKETPLACE_FEE_PERCENT"]),
    },
    {
      id: "melhorEnvio", title: "Melhor Envio", description: "OAuth das lojas e cotação automática de frete.", setupHref: "https://docs.melhorenvio.com.br/reference/fluxo-de-autoriza%C3%A7%C3%A3o",
      missing: ["ME_CLIENT_ID", "ME_CLIENT_SECRET"].filter((key) => !present(env, key))
        .concat(present(env, "ME_TOKEN_ENCRYPTION_KEY") && /^[a-f0-9]{64}$/i.test(env.ME_TOKEN_ENCRYPTION_KEY!.trim()) ? [] : ["ME_TOKEN_ENCRYPTION_KEY"]),
    },
  ];

  return checks.map(({ missing, ...check }) => ({ ...check, status: missing.length ? "missing" : "configured", missingVariables: missing }));
}
