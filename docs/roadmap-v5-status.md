# Status do Prompt Master V5.0

Revisão em 12 de novembro de 2026. Esta página compara os requisitos de produto do Prompt Master V5.0 enviado pelo proprietário com o estado atual do repositório e da produção. “Implementado” significa que o fluxo existe no código; integrações externas ainda dependem de credenciais e testes operacionais.

## Estado por fase

| Fase | Estado | Evidência e pendências principais |
| --- | --- | --- |
| 1. Fundação técnica e visual | Implementada, com configuração operacional pendente | Next.js App Router, TypeScript, tema claro/escuro, Supabase Auth/RLS, migrations e publicação Vercel existem. Ainda é preciso completar usuários de operação e conferir a configuração de produção. |
| 2. Visualizador | Implementada | Upload local de STL, OBJ, 3MF, GLB e GLTF; rotação, zoom, dimensões, escala, exportação GLB e layout responsivo. |
| 3. Modelos avançados | Parcial | 3MF, materiais/cores, componentes e biblioteca privada estão no visualizador. A coleção `/modelos` contém 94 modelos únicos em sete categorias, com prévias, tags, busca por texto, busca por imagem e páginas individuais de visualização/download. Os 94 originais agora ficam em `models/` no repositório público e são carregados diretamente pelo visualizador; a busca por imagem depende do Google Cloud Vision. Consumo por filamento ainda não é calculado a partir do fatiamento. |
| 4. Catálogos técnicos | Parcial | Existem catálogos de impressoras, materiais, resinas e bicos, sugestões de modelos ausentes, compatibilidade e registro de equipamentos/manutenções. A cobertura de marcas e especificações precisa crescer com fontes oficiais revisadas. |
| 5. Marketplace | Parcial | Contas, lojas moderadas, anúncios, busca, favoritos, carrinho multivendedor, pedidos e gestão de pedidos existem. Cupons e cotação/etiqueta/rastreamento automáticos de frete seguem pendentes. |
| 6. Calculadora | Parcial | Cálculo manual por lote, componentes, custos de impressora, margem sobre venda, markup sobre custo, comparação de canais, histórico privado e exportação PDF/CSV estão implementados. O fluxo de consignação aceita comissão percentual e taxa fixa por venda; a migração e a integração foram publicadas em produção. |
| 7. OCR e precificação avançada | Parcial | OCR de imagens de fatiadores e entrada manual existem; a leitura depende do Google Cloud Vision e requer revisão humana. Ainda falta fechar consolidação de múltiplas imagens e todos os campos previstos no Prompt Master. |
| 8. Pagamentos e logística | Parcial | Fluxos Mercado Pago, webhooks, idempotência, cancelamento e reembolso existem. Frete de produtos físicos automatizado e repasses do marketplace ainda precisam de integração e validação operacional. |
| 9. Orçamentos | Parcial | Solicitações, propostas, escolha do fabricante, início/conclusão da impressão, cotação de frete, pagamento, rastreio, entrega e histórico de eventos existem para impressões personalizadas e pedidos do carrinho. As cotações de frete ainda são manuais; a automação de transportadoras e os estados completos de produção de produtos sob encomenda seguem pendentes. |
| 10. Expansão | Parcial | Arquivos digitais, suporte, notificações, perfis e relatórios têm módulos no produto. E-mail/anexos/SLA do suporte, recomendações e relatórios avançados ainda não estão completos. |

## Dependências de produção observadas

- No Vercel, `GOOGLE_CLOUD_VISION_API_KEY` não está cadastrado; busca por imagem e OCR ficam indisponíveis até configurar a credencial.
- Também não aparecem variáveis de Resend ou WhatsApp no ambiente de produção; notificações por esses canais precisam ser configuradas e validadas antes de serem consideradas operacionais.
- A galeria usa prévias leves versionadas em `public/modelos`. Os 94 arquivos 3MF únicos (1,19 GB) ficam na pasta `models/` do repositório público, fora de `public`, e o navegador os busca diretamente em `raw.githubusercontent.com`; isso evita incluí-los nos arquivos estáticos gerados pelo Next.js, mas torna cada original publicamente baixável e aumenta o tamanho dos clones do repositório. As prévias usam imagens extraídas dos 3MF; a página pública abre o arquivo original no visualizador.
- A publicação comercial permanece mediada por conta de fabricante, loja aprovada e anúncio revisado. Ter direitos sobre os arquivos não substitui esse fluxo de aprovação.

## Próximas entregas

1. Configurar Google Vision, Resend e WhatsApp na Vercel e validar busca por imagem, OCR e notificações externas sem expor segredos no Git.
2. Implementar cupons e automatizar cotações, etiquetas e rastreamento de fretes físicos, preservando pedidos por loja, comissão e histórico financeiro.
3. Fechar as lacunas de calculadora, OCR e estados de produção descritas nas fases 6, 7 e 9; cobrir cada fluxo com testes de regras e autorização.
4. Completar cadastros de fabricantes e testar compra, notificações, logística e pós-venda ponta a ponta em ambiente de homologação.

Os detalhes de instalação, banco, segurança, operação e integrações continuam nos documentos vinculados pelo [README](../README.md).
