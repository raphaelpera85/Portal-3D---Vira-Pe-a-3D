# Arquitetura atual

## Direção

Next.js App Router com TypeScript, páginas renderizadas no servidor e componentes client apenas para interações que precisam de estado local ou WebGL. Supabase fornece Auth e PostgreSQL com RLS. Integrações externas rodam no servidor; OAuth do Mercado Pago vincula contas de vendedores com PKCE e tokens criptografados. O Checkout Pro Orders processa pedidos de carrinho, compras diretas e propostas de impressão aceitos por loja; para carrinhos, o vendedor informa manualmente o frete, o comprador aceita a cotação e acompanha o rastreio.

```mermaid
flowchart LR
  Browser[Comprador, maker ou admin] --> Next[Next.js App Router]
  Next --> Marketplace[Vitrine, produtos, carrinho e pedidos]
  Next --> Dashboards[Painel maker e moderação]
  Next --> SSR[Cliente Supabase por requisição]
  Browser --> Viewer[Visualizador Three.js local]
  Viewer --> LocalFiles[Arquivos processados no navegador]
  Next --> Ocr[API OCR protegida]
  Ocr --> Vision[Google Cloud Vision]
  SSR --> Auth[Supabase Auth]
  SSR --> DB[(PostgreSQL com RLS)]
  DB --> Queue[Fila de notificações]
  Cron[Vercel Cron] --> Worker[Route Handler protegido]
  Worker --> Queue
  Worker --> Providers[Resend e WhatsApp Cloud API]
  SSR --> PaymentAction[Ação de pagamento server-side]
  PaymentAction --> MercadoPago[Mercado Pago Orders API]
  MercadoPago --> PaymentWebhook[Webhook assinado]
  PaymentWebhook --> DB
```

## Fluxos implementados

- Homepage pública com busca, categorias, paginação, páginas de produto e metadados para indexação.
- Diretório público `/lojas` e páginas individuais de fabricantes aprovados, com marca visual, localização aproximada, descrição, anúncios, prazos por produto, políticas comerciais e avaliações moderadas.
- Supabase Auth com cadastro, confirmação, login e saída; compradores podem solicitar acesso maker e admins aprovam perfis, lojas e anúncios.
- Compradores autenticados enviam pedidos de orçamento e solicitações individuais de compra. O fabricante pode propor preço para orçamento e confirmar ou recusar disponibilidade para compra.
- Compradores autenticados também enviam pedidos personalizados para modelos salvos. Lojas com equipamento disponível, compatibilidade técnica publicada e volume suficiente recebem o pedido, podem enviar propostas concorrentes e o comprador escolhe uma. Após a escolha, o comprador seleciona um endereço salvo; somente a loja vencedora pode lê-lo, cotar manualmente o frete e incluí-lo no checkout. Depois do pagamento confirmado, a loja inicia e conclui a produção, registra o rastreio e o comprador confirma a entrega. O banco bloqueia o início até confirmar o pagamento. Os arquivos ficam em bucket privado e são acessados por link assinado curto somente durante a participação.
- Compradores autenticados salvam e removem produtos publicados em `/favoritos`; favoritos são privados por comprador e não incluem dados de demonstração.
- Produtos de preço fixo também podem ser reunidos em carrinho persistente. O fechamento valida preços e disponibilidade no banco e cria um pedido separado por loja; após a loja confirmar disponibilidade e cotar manualmente o frete, o comprador aceita e paga produtos mais frete pelo Mercado Pago. A comissão incide no subtotal dos produtos. A loja informa o rastreio e o comprador confirma o recebimento. Solicitações diretas de compra aceitas também podem iniciar checkout e reservar estoque contado.
- Produtos físicos de preço fixo podem anunciar até quatro grupos de personalização, como cor e tamanho; o carrinho mantém uma linha por combinação e leva a escolha ao pedido e aos avisos do fabricante. As opções compartilham o preço e o estoque total do produto.
- Fabricantes definem pronta entrega ou produção sob encomenda, acompanham estoque contado e prazo de preparação; o banco rejeita quantidades maiores que o estoque publicado.
- Fabricantes podem solicitar reembolsos totais ou parciais no extrato; o banco reserva o saldo por cobrança e o Mercado Pago recebe uma chave de idempotência que permite repetir uma tentativa pendente sem emitir outro estorno.
- Compradores podem cancelar orders ainda não pagas em `/orcamentos`; o portal confere a order no Mercado Pago e libera estoque reservado somente após confirmação.
- Fabricantes registram data ou horímetro previsto de manutenção por componente; o painel destaca agendas vencidas e próximas usando apenas os dados informados pela própria loja.
- Compradores salvam endereços privados, definem um endereço principal e podem editá-los/removê-los; a exclusão do principal promove outro endereço automaticamente.
- No checkout, compradores escolhem um endereço salvo; cada pedido por loja recebe um snapshot de entrega visível ao comprador e ao fabricante responsável para combinar o envio.
- Painel maker lista solicitações e pedidos, contatos de notificação, anúncios, equipamentos próprios com manutenção, lotes de consignação agrupados por estabelecimento e perfis privados/comunitários de impressão.
- Revisão administrativa aprova perfis submetidos como comunitários ou oficiais; páginas públicas leem somente perfis publicados ligados a produtos e lojas publicados.
- Administradores gerenciam destaques da homepage em `/admin/banners`; os seis primeiros ativos pela ordem configurada aparecem na vitrine. Destinos são limitados a caminhos internos e imagens exigem HTTPS e texto alternativo.
- Administradores criam e editam categorias do marketplace em `/admin/categorias`; categorias com anúncios publicados não podem ser desativadas.
- Fabricantes editam descrição, logo, banner, cidade/UF e políticas comerciais pelo painel; somente lojas aprovadas são listadas e indexáveis, e as páginas de produto e a homepage levam às vitrines.
- Compradores podem avaliar lojas e produtos após pedidos do carrinho concluídos, compras diretas pagas e arquivos digitais pagos; impressões personalizadas podem receber avaliação da loja depois de pagas e concluídas. Avaliações ficam pendentes até aprovação em `/admin/avaliacoes`; páginas públicas exibem apenas as aprovadas e não identificam o comprador.
- Administradores cadastram e revisam modelos mestres de impressoras em `/admin/catalogos/impressoras`, com referências HTTPS e data de conferência obrigatórias para publicar.
- Fabricantes podem sugerir modelos ausentes do catálogo; a curadoria administrativa aprova ou recusa e aprovação cria apenas um rascunho revisável.
- Administradores cadastram materiais, resinas, bicos e relações de compatibilidade em `/admin/catalogos/materiais` e `/admin/catalogos/bicos`; cada vínculo publicado requer fonte HTTPS e data de conferência.
- E-mail e WhatsApp usam fila persistente com tentativas; WhatsApp depende de consentimento do maker e template aprovado.
- `/catalogos` consulta os registros publicados no banco quando disponíveis e usa dados locais de referência quando não há conexão.
- `/visualizador` lê arquivos STL, OBJ, 3MF, GLB e GLTF localmente no navegador; compradores podem salvar conjuntos validados no Supabase Storage privado e reabri-los depois. `/calculadora` estima custos e preços por canal; makers salvam snapshots privados e, se Cloud Vision estiver configurado, leem capturas de tela com consentimento.
- O histórico de custos pode ser associado a um anúncio e ao equipamento principal da própria loja sem alterar o snapshot recalculado; os vínculos são validados no servidor e na política RLS.
- `/admin` reúne indicadores brutos do marketplace, contagens das filas pendentes (fabricantes, lojas, anúncios, perfis, designers, denúncias, avaliações e sugestões de impressora) e atalhos para as ferramentas administrativas existentes. As filas usam a sessão autenticada e as políticas RLS; a RPC financeira é acessada pelo servidor após verificar papel admin e só pode ser executada com `service_role`.
- Compradores, fabricantes e designers abrem tickets privados em `/suporte`, acompanham mensagens e respondem; administradores gerenciam status e respondem em `/admin/atendimento`, com contagem de pendências no painel administrativo.

## Limites atuais

- As 56 migrações versionadas foram aplicadas ao projeto Supabase `drblsfcahfniwusfblfw`; testes de ponta a ponta com contas sandbox ainda faltam. Pagamentos reais dependem de credenciais Mercado Pago, comissão configurada, webhook ativo e validação sandbox.
- Preços e estoque por SKU, cotação automática de frete, compra de etiquetas, atualização automática de rastreio e cupons ainda estão pendentes. Pedidos do carrinho e impressões personalizadas usam cotação manual da loja. O atendimento atual funciona como caixa de entrada interna; alertas por e-mail/WhatsApp, anexos e SLA ainda não estão integrados. Endereços são snapshots privados por pedido e não são enviados a um serviço de logística.
- Lembretes de manutenção dependem de o fabricante registrar datas/horímetros; o portal não infere intervalos nem apresenta recomendações do fabricante do equipamento.
- Banners aceitam mídia HTTPS externa com carregamento tardio e texto alternativo; upload gerenciado e otimização de imagem ainda não estão conectados.
- O visualizador não preserva atribuições reais de filamento por cor nem importa resultados de fatiamento. O OCR da calculadora depende de Cloud Vision configurado e reconhecimento de rótulos comuns; imagens e texto OCR não entram no histórico.
- Catálogos técnicos não recebem atualização automatizada e suas telas administrativas exibem até 250 registros por categoria/relação. A lista de impressoras do maker usa modelos publicados no banco; sem registros publicados, o maker pode cadastrar equipamento próprio.
- Designers podem solicitar e editar um portfólio em `/conta`; a aprovação concede acesso de maker e cria uma loja pendente, que a equipe publica em `/admin/fabricantes`. Só perfis aprovados aparecem em `/designers` e no sitemap. Anúncios digitais usam arquivos STL/3MF privados, cópia GLB de prévia interativa, licenças pessoais/comerciais, compra via checkout, links temporários de download e histórico; denúncias vão para `/admin/denuncias-digitais`. O arquivo original não é usado como prévia: o GLB fica privado no Storage e a página pública recebe um link assinado temporário para visualizá-lo. Fabricantes têm extrato das 500 cobranças mais recentes com totais pagos e comissão; ainda faltam conciliação financeira, relatórios administrativos detalhados e dados de liquidação/repasse do provedor. O painel administrativo apresenta totais brutos, sem afirmar receita líquida ou repasse. Solicitações de impressão personalizada mostram histórico de convites, propostas, decisões, cancelamento, etapas de produção e entrega para comprador e fabricante autorizado; frete é cotado manualmente pela loja vencedora e o rastreio é informado no painel. Checkout Pro de pedidos aceitos do carrinho e compras diretas reserva estoque contado; a impressão personalizada só avança para produção depois do pagamento confirmado. O controle de consignação mantém estoque estimado por estabelecimento, sem conciliação com pedidos ou pagamentos.
- A `proxy.ts` atualiza cookies e claims da sessão. Cada página e Server Action privada também verifica o papel do usuário; RLS permanece a fronteira de dados no banco. Reembolsos pendentes são conciliados diariamente. Fabricantes acompanham contestações no extrato e podem enviar evidências ao Mercado Pago enquanto o caso permanece aberto; o portal ainda não administra decisões de disputa.

## Próximas integrações

1. Validar os fluxos do portal contra o esquema Supabase aplicado e executar compras de teste ponta a ponta.
2. Importar no banco as referências técnicas locais depois de rever as fontes.
3. Ligar históricos de manutenção a materiais/produtos; a calculadora identifica filamentos e resinas pelo catálogo e avalia as condições técnicas do material para o modelo de impressora vinculado. O preço de compra continua informado pelo fabricante, e a manutenção usa a média dos custos registrados por hora acumulada.
4. Implementar preço e estoque específicos por combinação de variações, preservando reservas e cancelamentos de pagamento.
5. Integrar um provedor de frete para cotações e etiquetas depois de definir fornecedor e credenciais.
6. Validar pagamentos sandbox antes de qualquer cobrança real e completar conciliação financeira, relatórios administrativos e auditoria.
