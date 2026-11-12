# Plano: orçamento de impressão por modelo 3D

## Classificação e conclusão esperada

Implementar uma solicitação própria de impressão, separada do orçamento de um produto anunciado. O comprador seleciona um conjunto salvo na biblioteca privada, informa material, escala, quantidade, cor, qualidade e prazo; o banco encaminha a solicitação apenas a lojas publicadas com equipamento disponível, compatibilidade técnica publicada e volume suficiente. Cada loja pode enviar uma proposta; o comprador compara e escolhe uma. Cancelamento e escolha de proposta devem fechar a concorrência em uma transação.

Concluir quando a jornada estiver ligada à biblioteca, painel do fabricante, painel do comprador, fila de avisos e autorização de arquivos; os validadores tiverem testes; `npm test`, `npm run typecheck`, `npm run build` e `git diff --check` passarem. Migração ainda precisará de validação em PostgreSQL/Supabase real.

## Evidência atual

- `product_quote_requests` exige produto e loja, e `product_quote_offers.request_id` é único (`supabase/migrations/202611110006_product_quotes.sql`).
- A biblioteca de arquivos usa bucket privado e acesso somente ao comprador (`supabase/migrations/202611110012_private_model_uploads.sql`).
- `/orcamentos` e `/painel/maker` só carregam solicitações ligadas a produtos; equipamentos do fabricante vinculam-se a modelos mestres (`src/app/orcamentos/page.tsx`, `src/app/painel/maker/page.tsx`, `supabase/migrations/202611110010_maker_equipment.sql`).
- O Prompt Master V5, seção 14, pede arquivo 3D, configuração, múltiplas propostas, contratação, pagamento e acompanhamento da produção.

## Abordagem escolhida

Criar tabelas próprias para solicitações personalizadas, lojas compatíveis e propostas concorrentes; usar RPCs transacionais para roteamento, envio de proposta, escolha e cancelamento. Manter o bucket privado e emitir links de download temporários somente após confirmar a loja participante. Alternativa descartada: tornar o bucket público ou reaproveitar tabelas vinculadas a produto, pois ambas ampliam acesso ou distorcem o modelo existente.

## Escopo desta etapa

- Migração `supabase/migrations/202611110021_custom_print_requests.sql` com regras de compatibilidade, RLS, concorrência, arquivos e avisos externos.
- Validação e testes em `src/lib/custom-print-request.ts` e `src/lib/custom-print-request.test.ts`.
- Formulário e ação no visualizador/biblioteca privada; listagem, comparação, proposta, aceite e cancelamento em `/orcamentos` e `/painel/maker`.
- Links temporários para os arquivos do modelo apenas aos fabricantes atribuídos, com checagem no servidor.
- Documentação de arquitetura e implantação.

## Premissas e limites

- Convites sugerem lojas com impressora mestre publicada e disponível, vínculo publicado, dimensões calculadas no visualizador dentro do volume e dados técnicos suficientes. Para filamento, exige-se bico publicado de encaixe e diâmetro corretos. Todo convite é condicional: o fabricante confirma o arquivo, o bico instalado e as condições reais de operação antes da proposta.
- Cores e qualidade são pedidos do comprador; a proposta pode indicar condições ou substituições.
- Aceitar uma proposta habilita checkout Mercado Pago por loja; a produção só pode iniciar após o webhook confirmar o pagamento. Etiquetas e cotação de frete continuam fora desta etapa.
- Catálogo, autenticação e notificações dependem das migrações anteriores aplicadas; nenhuma migração será executada contra produção neste trabalho.

## Checklist de execução

- [x] Testar primeiro a validação de configuração e escala.
- [x] Persistir dimensões físicas verificadas do modelo salvo.
- [x] Criar roteamento, ofertas múltiplas, transições atômicas, acesso temporário a arquivos e avisos.
- [x] Integrar as telas de comprador e fabricante.
- [x] Atualizar documentação e executar verificações locais.
- [x] Conferir alterações e limites de verificação.
- [x] Cobrar a proposta escolhida via Checkout Pro e exigir pagamento confirmado para iniciar produção.
