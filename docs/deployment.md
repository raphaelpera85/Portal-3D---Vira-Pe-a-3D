# Publicação

O projeto usa Next.js e está pronto para importação na Vercel a partir do repositório GitHub. O fluxo padrão da plataforma detecta Next.js e executa a instalação e o build.

`.env.local` é somente para desenvolvimento local e está ignorado pelo Git por conter segredos. Na publicação, cadastre os valores usados pelo portal em **Vercel → Project Settings → Environment Variables**, escolhendo os ambientes Preview e Production conforme o uso; salve e faça um novo deployment para aplicar alterações. O Git recebe apenas `.env.example`, com os nomes das variáveis e sem valores. A Vercel armazena esses valores fora do código-fonte.

| Variável | Origem e uso | Vercel |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL base do projeto, sem `/rest/v1/` | Sim |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key da Data API | Sim |
| `SUPABASE_SECRET_KEY` | `sb_secret_…`, operações privilegiadas no servidor | Sim, como segredo |
| `SUPABASE_SERVICE_ROLE_KEY` | Compatibilidade para chave legada | Sim, se esse projeto ainda a usa |
| `SUPABASE_DB_URL` | Conexão Postgres com senha, exclusiva da Supabase CLI | Não |

Nunca coloque chaves secretas ou a senha do banco em variáveis `NEXT_PUBLIC_*`, em commits ou em migrações. Se uma credencial for exposta, revogue-a no provedor e atualize os ambientes.

Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` e `NEXT_PUBLIC_SITE_URL` por ambiente antes de ativar o backend. Use a origem HTTPS pública em `NEXT_PUBLIC_SITE_URL`. Para verificar a propriedade de prefixo no Google Search Console, preencha `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` com o token fornecido pelo Google; veja [docs/google-search-console.md](google-search-console.md). Não coloque chaves secretas em variáveis `NEXT_PUBLIC_*`.

Antes de habilitar recursos com persistência, confira `supabase migration list --db-url <SUPABASE_DB_URL>` e faça uma simulação com `supabase db push --dry-run --db-url <SUPABASE_DB_URL>`. Depois, aplique todas as migrações versionadas em `supabase/migrations/` em ordem com `supabase db push --db-url <SUPABASE_DB_URL>`; esse comando também mantém o histórico no banco. Não aplique arquivos SQL manualmente fora desse fluxo. `SUPABASE_DB_URL` é somente para a CLI, precisa apontar para o mesmo projeto indicado por `NEXT_PUBLIC_SUPABASE_URL` e permanece fora do Git e da Vercel. As migrações atuais incluem arquivos privados, solicitações, marketplace, pagamentos, notificações, contestações e o bucket privado temporário de evidências. Pagamentos só podem ser habilitados após conectar cada loja, configurar comissão e webhook, e validar o fluxo com contas de teste. Não configure comunicação como confirmação de pagamento.

Para notificações, configure na Vercel `SUPABASE_SECRET_KEY` (ou a chave legada `SUPABASE_SERVICE_ROLE_KEY`), `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` e as cinco variáveis `WHATSAPP_*` indicadas em [docs/integrations.md](integrations.md). Cadastre e aprove um template WhatsApp de utilidade com três parâmetros de corpo (`produto`, `quantidade`, `link do painel`) e `pt_BR` ou ajuste o idioma. A aplicação despacha a fila em `after()` após registrar solicitações ou pedidos, sem bloquear a resposta. O cron diário ao meio-dia UTC é uma varredura de recuperação para itens pendentes; no plano Hobby, ele não substitui o envio iniciado por evento.

Para pagamentos, configure as variáveis `MP_*` descritas em [docs/integrations.md](integrations.md), aplique todas as migrações existentes e cadastre o webhook `/api/payments/mercado-pago/webhook` no Mercado Pago com os eventos de orders e contestações. Não habilite vendas reais antes de validar o split, Pix/cartão, cancelamentos, reembolsos, webhook, estoque reservado e download pós-pagamento com contas de teste. Pedidos do carrinho e impressões personalizadas incluem no checkout o frete manual aceito pelo comprador; cotações externas e etiquetas não estão integradas.

Para OCR, configure `GOOGLE_CLOUD_VISION_API_KEY` somente se habilitar a Cloud Vision API no Google Cloud Console e restringir a chave à API Vision. Essa chave é diferente do token `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` do Search Console.

Para vincular vendedores ao Mercado Pago, crie uma aplicação configurada como marketplace Split 1:1 e Checkout Pro. Cadastre como Redirect URL exatamente `https://SEU-DOMINIO/api/payments/mercado-pago/callback` (com o domínio de `NEXT_PUBLIC_SITE_URL`) e cadastre `/api/payments/mercado-pago/webhook` para o evento de orders. Configure `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_TOKEN_ENCRYPTION_KEY`, `MP_WEBHOOK_SECRET` e `MP_MARKETPLACE_FEE_PERCENT` como segredos server-only. Gere a chave de criptografia com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`; mantenha-a estável e faça backup seguro, pois tokens salvos deixam de ser recuperáveis se ela for perdida. A aplicação usa OAuth com PKCE e renova tokens no servidor. O split 1:1 exige contas de vendedor Mercado Pago verificadas no nível KYC 6 e autorização OAuth de cada vendedor. Valide a integração, política de frete e reembolso com contas sandbox antes de ativar cobranças reais.

O projeto `virapeca3d` está conectado ao GitHub e recebe deploys de preview por branch; `main` é o branch de produção ao qual `virapeca3d.vercel.app` está associado. A captura de novembro de 2026 mostra o domínio configurado, mas sem deployment de produção porque o build anterior de `main` falhou no cron `*/5 * * * *`. `vercel.json` agora usa o cron diário `0 12 * * *`, compatível com Hobby. Depois de validar e aplicar as migrações e configurar as variáveis necessárias, um push a `main` gera o novo deployment de produção. A promoção de produção exige autorização expressa.
