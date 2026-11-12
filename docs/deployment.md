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

Antes de habilitar pedidos, favoritos, uploads privados, equipamentos, custos, OCR, consignações, perfis, endereços, banners, catálogos administráveis, impressão personalizada, sugestões técnicas, frete, lembretes de manutenção, perfis de designers, arquivos digitais e pagamentos, aplique todas as migrações em ordem até `202611110032_digital_asset_previews.sql`. O pedido personalizado depende das tabelas e do bucket privado criados nas migrações anteriores. Pagamentos só podem ser habilitados após conectar cada loja, configurar comissão e webhook, e validar o fluxo com contas de teste. Não configure comunicação como confirmação de pagamento.

Para notificações, configure na Vercel `SUPABASE_SECRET_KEY` (ou a chave legada `SUPABASE_SERVICE_ROLE_KEY`), `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` e as cinco variáveis `WHATSAPP_*` indicadas em [docs/integrations.md](integrations.md). Cadastre e aprove um template WhatsApp de utilidade com três parâmetros de corpo (`produto`, `quantidade`, `link do painel`) e `pt_BR` ou ajuste o idioma. O cron `vercel.json` roda em produção a cada cinco minutos; faça um deployment de preview para validar a interface, pois Vercel Cron não agenda previews.

Para pagamentos, configure as cinco variáveis `MP_*` descritas em [docs/integrations.md](integrations.md), aplique todas as migrações até `202611110032_digital_asset_previews.sql` e cadastre o webhook `/api/payments/mercado-pago/webhook` no Mercado Pago com evento de orders. Não habilite vendas reais antes de validar o split, Pix/cartão, webhook, estoque reservado e download pós-pagamento com contas de teste. Pedidos do carrinho incluem no checkout o frete manual aceito pelo comprador; cotações externas e etiquetas não estão integradas.

Para OCR, configure `GOOGLE_CLOUD_VISION_API_KEY` somente se habilitar a Cloud Vision API no Google Cloud Console e restringir a chave à API Vision. Essa chave é diferente do token `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` do Search Console.

Para vincular vendedores ao Mercado Pago, crie uma aplicação configurada como marketplace Split 1:1 e Checkout Pro. Cadastre como Redirect URL exatamente `https://SEU-DOMINIO/api/payments/mercado-pago/callback` (com o domínio de `NEXT_PUBLIC_SITE_URL`) e cadastre `/api/payments/mercado-pago/webhook` para o evento de orders. Configure `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_TOKEN_ENCRYPTION_KEY`, `MP_WEBHOOK_SECRET` e `MP_MARKETPLACE_FEE_PERCENT` como segredos server-only. Gere a chave de criptografia com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`; mantenha-a estável e faça backup seguro, pois tokens salvos deixam de ser recuperáveis se ela for perdida. A aplicação usa OAuth com PKCE e renova tokens no servidor. O split 1:1 exige contas de vendedor Mercado Pago verificadas no nível KYC 6 e autorização OAuth de cada vendedor. Valide a integração, política de frete e reembolso com contas sandbox antes de ativar cobranças reais.

Não foi criado projeto na Vercel nem realizado deploy. A publicação em produção requer autorização expressa.
