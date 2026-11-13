# ViraPeça 3D

Marketplace brasileiro de produtos e serviços de impressão 3D. A fundação inclui homepage responsiva, preparação do Supabase, visualizador local de modelos STL, OBJ, 3MF, GLB e GLTF, calculadora manual de custos e uma amostra de catálogos técnicos com verificação de compatibilidade.

## Começar

Requer Node.js 22 ou superior.

```bash
npm install
npm run dev
```

Copie `.env.example` para `.env.local` e preencha a URL, a chave publicável e a chave secreta do projeto Supabase. Abra `http://localhost:3000`. Sem as variáveis do Supabase, as ferramentas locais continuam acessíveis e `/conta` explica que o acesso ainda não está conectado.

## Verificações

```bash
npm test
npm run typecheck
npm run build
```

## Estrutura

- `src/app/`: App Router, metadados e estilos globais.
- `src/app/visualizador/`: rota do visualizador de arquivos 3D.
- `src/app/calculadora/`: rota da calculadora manual de impressão.
- `src/app/catalogos/`: rota de catálogos técnicos e triagem de compatibilidade.
- `src/components/`: cabeçalho, vitrine, visualizador e ilustrações vetoriais da homepage.
- `src/lib/model-file.ts`: validação de formato/tamanho e conversão de dimensões.
- `src/lib/supabase/`: clientes browser e server para sessões SSR.
- `supabase/migrations/`: perfis e papéis iniciais com RLS.
- `docs/`: arquitetura, banco, segurança, integrações e publicação.
- [docs/image-extraction.md](docs/image-extraction.md): limites, normalização e revisão dos campos extraídos por OCR.
- `docs/google-search-console.md`: identidade de busca, verificação, sitemap e robots.
- `docs/roadmap-v5-status.md`: estado auditado das fases e próximos passos do Prompt Master V5.0.
- `/admin/integracoes`: presença e validade básica das variáveis de ambiente dos provedores, sem exibir valores secretos.

Sem Supabase configurado, a vitrine apresenta exemplos. Com o backend configurado, a homepage consulta produtos publicados e oferece busca, categorias e paginação; cada item tem uma página de detalhes e administradores podem gerir até seis banners ativos em `/admin/banners`. O painel `/admin` mostra GMV e comissões brutas registradas, pagamentos, reembolsos confirmados, fabricantes, lojas, produtos, usuários e filas de revisão, além de reunir atalhos para os módulos administrativos disponíveis. Totais financeiros não representam liquidação nem receita líquida. Administradores cadastram impressoras, materiais, resinas, bicos e relações de compatibilidade em `/admin/catalogos/impressoras`, `/admin/catalogos/materiais` e `/admin/catalogos/bicos`. Fabricantes podem sugerir modelos ausentes pelo painel; aprovações da equipe criam ou associam rascunhos para revisão técnica, sem publicação automática. Compradores autenticados podem manter endereços privados em `/conta`, escolher endereço no checkout (cujo snapshot é compartilhado com cada loja do pedido), salvar produtos publicados em `/favoritos`, salvar conjuntos de modelos no bucket privado pelo visualizador, solicitar aprovação como fabricante, pedir orçamento, solicitar compra direta ou adicionar produtos de preço fixo ao carrinho em `/carrinho`; o fechamento gera um pedido por loja. Admins aprovam perfis, lojas, anúncios e perfis de impressão comunitários/oficiais; makers aprovados cadastram produtos, equipamentos, manutenções, consignações e perfis privados ou submetidos à revisão em `/painel/maker`. Os fabricantes recebem alertas em tempo real no painel e, com as integrações configuradas, por e-mail e WhatsApp; acompanham pedidos e enviam propostas em `/painel/maker`. Com o Mercado Pago conectado e configurado, compradores podem pagar pedidos do carrinho, compras diretas e propostas de impressão aceitas; a produção personalizada só inicia após confirmação do pagamento. Cada combinação de opções de um produto físico fixo pode ter preço e estoque próprios; carrinho, compra direta, pedidos e reservas de pagamento validam o SKU selecionado. Cotações e etiquetas Melhor Envio e cupons de carrinho estão implementados; o uso de frete depende da conexão de cada vendedor e das credenciais dos provedores, e o desconto do cupom é assumido pelo vendedor antes do cálculo da comissão. O visualizador aceita STL, OBJ, 3MF, GLB e GLTF de até 20 MB por conjunto e mostra prévias no navegador. A calculadora manual roda localmente para qualquer usuário, soma arquivos e componentes com materiais e impressoras próprios e mantém o tempo informado para cada conjunto de execuções; fabricantes podem salvar snapshots privados dos 20 cálculos mais recentes da loja. Consulte [docs/architecture.md](docs/architecture.md), [docs/3d-viewer.md](docs/3d-viewer.md), [docs/print-profiles.md](docs/print-profiles.md), [docs/pricing-engine.md](docs/pricing-engine.md), [docs/compatibility-engine.md](docs/compatibility-engine.md) e [docs/integrations.md](docs/integrations.md) para detalhes e limites.

Em impressões personalizadas, após escolher e pagar uma proposta, o comprador seleciona um endereço salvo. Apenas a loja vencedora recebe o endereço completo e pode cotar o Melhor Envio, salvar as dimensões do pacote e, depois da produção, comprar e emitir a etiqueta com confirmação explícita do custo. O vendedor informa a chave NF-e modelo 55 por envio; a chave é transmitida ao provedor e não fica armazenada no portal. A etiqueta e o rastreio ficam associados ao pedido, e o frete não compõe a comissão da plataforma. A cotação manual continua disponível.

O OCR da calculadora está disponível para fabricantes autenticados quando Cloud Vision estiver configurado; capturas de tela são enviadas somente após consentimento e não são persistidas pelo portal. Consulte [docs/integrations.md](docs/integrations.md) para preparar o projeto no Google Cloud. Os resultados precisam ser conferidos antes de alimentar o cálculo.

## Atendimento

Compradores, fabricantes e designers podem abrir e acompanhar conversas privadas em `/suporte`. A equipe responde e atualiza o status pela caixa de entrada `/admin/atendimento`; uma resposta gera um aviso por e-mail com link para o portal, quando o Resend está configurado. O conteúdo da conversa permanece no portal. Anexos privados estão disponíveis e o prazo de resposta ainda não é monitorado.

## Supabase

Crie um projeto Supabase e preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY` em `.env.local`. A chave secreta é exclusiva do servidor e nunca deve ser compartilhada, versionada ou exposta no browser. Projetos que ainda usam a chave legada podem preencher `SUPABASE_SERVICE_ROLE_KEY`. Para aplicar migrações pela Supabase CLI, informe `SUPABASE_DB_URL` com a conexão direta e senha do banco; essa URL fica somente no `.env.local`, ignorado pelo Git. Na Vercel, cadastre as variáveis de runtime em **Project Settings → Environment Variables**; a plataforma usa as variáveis do projeto, não o arquivo local. O `.env.example` versionado contém nomes sem valores secretos.
