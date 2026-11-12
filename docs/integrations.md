# Integrações

## Supabase

Preencha `.env.local` com a URL base do projeto, a publishable key, `SUPABASE_SECRET_KEY` e `NEXT_PUBLIC_SITE_URL`. Use a secret key `sb_secret_…` no servidor; `SUPABASE_SERVICE_ROLE_KEY` continua aceito para projetos com a chave legada. Na Vercel, cadastre as mesmas variáveis de runtime em **Project Settings → Environment Variables**; `.env.local` não é enviado ao Git. Com URL e publishable key, `/conta` habilita cadastro com confirmação por e-mail, login e saída via Supabase Auth; `/auth/callback` troca o código de confirmação por uma sessão. Cadastre `${NEXT_PUBLIC_SITE_URL}/auth/callback` nas URLs de redirecionamento do Supabase. Sem as credenciais, a homepage segue pública e a tela de conta informa que o recurso não está conectado.

Aplique as migrações com a Supabase CLI somente depois de confirmar o projeto de destino. Nenhuma migração foi executada contra um banco externo.

Para migrações, `SUPABASE_DB_URL` é uma conexão Postgres separada da chave da Data API. Copie a string **Direct connection** de **Connect** no Dashboard, substitua `[YOUR-PASSWORD]` pela senha do banco e codifique caracteres reservados conforme RFC 3986. Essa variável é somente para a Supabase CLI; não a configure na Vercel. A senha do banco pode ser redefinida em **Project Settings → Database**. Não envie a senha por chat nem a coloque em arquivos versionados.

## Notificações para lojas

Uma solicitação de orçamento ou compra cria aviso persistente no painel do fabricante e itens na fila `store_notification_deliveries`. O carrinho agrupa produtos fixos em uma ordem por loja e envia um aviso por canal cadastrado para cada ordem. O painel acompanha solicitações e pedidos via Supabase Realtime, lista os itens e permite confirmar ou recusar disponibilidade. Os contatos são mantidos em tabela privada separada de `stores`; cada canal recebe uma cópia do destino e do tipo de solicitação, produtos e quantidades no momento do pedido. O painel informa o estado, e o fabricante pode reenviar entregas que chegaram ao limite de tentativas.

Itens de pronta entrega validam a quantidade contra o estoque contado no anúncio ao entrar no carrinho, na solicitação direta e na criação do pedido. Para pedidos de carrinho aceitos e solicitações diretas de compra aceitas, o início do checkout reserva o estoque de forma transacional; o webhook confirmado mantém a baixa após pagamento ou devolve as unidades quando a tentativa termina sem pagamento.

A rota `GET /api/notifications/dispatch` consome a fila em lotes e exige `Authorization: Bearer <CRON_SECRET>`. `vercel.json` agenda a chamada a cada cinco minutos em deployments de produção. O worker exige `SUPABASE_SECRET_KEY` (ou a chave legada `SUPABASE_SERVICE_ROLE_KEY`), `NEXT_PUBLIC_SITE_URL` e as configurações do canal. A chave secreta é usada somente no servidor para acessar a fila; nunca deve receber o prefixo `NEXT_PUBLIC_`.

### E-mail

Configure `RESEND_API_KEY` e `RESEND_FROM_EMAIL` para enviar e-mails transacionais via [API de envio do Resend](https://resend.com/docs/api-reference/emails/send-email). O worker envia chave de idempotência por item da fila e registra apenas o status/código do provedor.

### WhatsApp

Configure `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_API_VERSION`, `WHATSAPP_TEMPLATE_NAME` e `WHATSAPP_TEMPLATE_LANGUAGE`. O envio usa a [WhatsApp Cloud API](https://www.postman.com/meta/whatsapp-business-platform/request/o65u5m5/send-message-template-text) pelo endpoint `/messages` e um template criado e aprovado na conta Meta. O template deve ter três variáveis no corpo, nesta ordem: tipo e nome do produto (`Compra: ...` ou `Orçamento: ...`), quantidade e link do painel. O idioma padrão é `pt_BR`.

O fabricante informa o número no padrão brasileiro e precisa marcar o consentimento para receber avisos por WhatsApp. O e-mail vem preenchido do cadastro de fabricante e pode ser atualizado no painel. Uma solicitação de compra de produto aparece na central e na lista do painel assim que é criada; cada canal externo fica visível como “na fila”, “enviado” ou “falhou”. Se algum canal não tiver credenciais, a entrega fica pendente para uma próxima execução; falhas de envio usam tentativas com intervalo e podem ser reenviadas no painel. O e-mail e o WhatsApp só chegam após configurar os respectivos provedores e manter o cron da Vercel ativo.

## Mercado Pago

Configure `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_TOKEN_ENCRYPTION_KEY`, `MP_WEBHOOK_SECRET` e `MP_MARKETPLACE_FEE_PERCENT` no ambiente do servidor. A comissão é percentual do subtotal, precisa ser definida explicitamente e aceita `0`. Configure na aplicação do Mercado Pago o webhook de orders para `https://<domínio>/api/payments/mercado-pago/webhook`; copie o segredo de assinatura dessa configuração para `MP_WEBHOOK_SECRET`. O checkout usa Checkout Pro Orders API com token OAuth do fabricante, idempotência e expiração em um dia.

Compradores pagam pedidos de carrinho agrupados por loja, solicitações diretas de compra e propostas aceitas de impressão personalizada. Para pedidos de carrinho, o fabricante informa manualmente transportadora, serviço, valor e prazo estimado de transporte; o comprador aceita a cotação antes do checkout. O total inclui o frete aceito, enquanto a comissão incide somente sobre os produtos. Após o pagamento, a loja registra o código/link de rastreio; o comprador confirma o recebimento e conclui o pedido. Cotações ao vivo, compra de etiqueta e atualização automática de rastreio não estão integradas. O total de impressão personalizada segue o valor da proposta de serviço, e a produção só pode iniciar após confirmação do pagamento. O estoque contado é reservado no início do checkout e liberado se o Mercado Pago confirmar falha, cancelamento ou expiração. O retorno do checkout só informa o comprador; o webhook assinado e a consulta server-to-server determinam o estado.

Valide OAuth, Pix, cartão, webhook, split e reserva de estoque com contas de teste antes de habilitar pagamentos reais. O vendedor precisa ter conta Mercado Pago conectada e aprovada para split 1:1. A integração não cobre reembolsos iniciados pelo painel nem disputas ainda.

## OCR de imagens de fatiadores

Para habilitar a leitura de capturas de tela, selecione um projeto no Google Cloud Console, habilite a Cloud Vision API e crie uma chave em **APIs e serviços → Credenciais**. Restrinja a chave à Cloud Vision API e armazene somente no servidor como `GOOGLE_CLOUD_VISION_API_KEY`; não use prefixo `NEXT_PUBLIC_`. A documentação oficial explica a [autenticação e as restrições de chaves](https://docs.cloud.google.com/docs/authentication/api-keys) e o [endpoint `images:annotate`](https://docs.cloud.google.com/vision/docs/request).

O OCR está disponível a fabricantes autenticados. O usuário precisa autorizar cada envio; as imagens são enviadas em memória ao Google Cloud Vision e não são armazenadas pelo ViraPeça. O limite é de 3 imagens por envio, até 2 MiB cada e 4 MiB no total, e 30 imagens por fabricante a cada dia UTC. O importador identifica rótulos comuns em capturas de Anycubic Slicer Next, OrcaSlicer, Bambu Studio, Cura e PrusaSlicer, mostra o texto detectado, marca conflitos entre imagens e só preenche peso total e tempo após confirmação. Valores ausentes ou ambíguos permanecem vazios. Configure cotas e alertas de faturamento no projeto Google Cloud; imagens base64 contam para o limite de corpo JSON de 10 MB da Vision API, e o portal limita ainda mais o envio para caber no limite de função da Vercel.

O template recebe o tipo/nome do produto ou resumo de itens, a quantidade total e o link do painel. O carrinho valida os preços antes do envio e registra o snapshot no pedido. Após o fabricante aceitar, pedidos do carrinho podem ser pagos por loja via Mercado Pago; frete, cupons e variantes ainda não estão integrados. Upload privado já está modelado na migração `202611110012_private_model_uploads.sql`; atualização automatizada de catálogos externos ainda não está implementada.
