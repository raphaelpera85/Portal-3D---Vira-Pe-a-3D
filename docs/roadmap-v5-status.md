# Status do Prompt Master V5.0

Revisão em 12 de novembro de 2026. Esta página compara os requisitos de produto do Prompt Master V5.0 enviado pelo proprietário com o estado atual do repositório e da produção. “Implementado” significa que o fluxo existe no código; integrações externas ainda dependem de credenciais e testes operacionais.

## Estado por fase

| Fase | Estado | Evidência e pendências principais |
| --- | --- | --- |
| 1. Fundação técnica e visual | Implementada, com configuração operacional pendente | Next.js App Router, TypeScript, tema claro/escuro, Supabase Auth/RLS, migrations e publicação Vercel existem. Ainda é preciso completar usuários de operação e conferir a configuração de produção. |
| 2. Visualizador | Implementada | Upload local de STL, OBJ, 3MF, GLB e GLTF; rotação, zoom, dimensões, escala, exportação GLB e layout responsivo. |
| 3. Modelos avançados | Parcial | 3MF, materiais/cores, componentes e biblioteca privada estão no visualizador. A coleção `/modelos` possui 76 prévias com categorias e tags; os arquivos 3MF originais não estão hospedados, e a busca por imagem depende do Google Cloud Vision. Consumo por filamento ainda não é calculado a partir do fatiamento. |
| 4. Catálogos técnicos | Parcial | Existem catálogos de impressoras, materiais, resinas e bicos, sugestões de modelos ausentes, compatibilidade e registro de equipamentos/manutenções. A cobertura de marcas e especificações precisa crescer com fontes oficiais revisadas. |
| 5. Marketplace | Parcial | Contas, lojas moderadas, anúncios, busca, favoritos, carrinho multivendedor, pedidos e gestão de pedidos existem. Cupons e cotação/etiqueta/rastreamento automáticos de frete seguem pendentes. |
| 6. Calculadora | Parcial | Cálculo manual por lote, componentes, custos de impressora, margem sobre venda, markup sobre custo, comparação de canais, histórico privado e exportação PDF/CSV estão implementados. O controle de consignação comercial e relatórios por estabelecimento ainda não estão ligados à calculadora. |
| 7. OCR e precificação avançada | Parcial | OCR de imagens de fatiadores e entrada manual existem; a leitura depende do Google Cloud Vision e requer revisão humana. Ainda falta fechar consolidação de múltiplas imagens e todos os campos previstos no Prompt Master. |
| 8. Pagamentos e logística | Parcial | Fluxos Mercado Pago, webhooks, idempotência, cancelamento e reembolso existem. Frete de produtos físicos automatizado e repasses do marketplace ainda precisam de integração e validação operacional. |
| 9. Orçamentos | Parcial | Solicitações de impressão, propostas e decisões do fabricante existem. Acompanhamento completo da produção e entrega ainda precisa ser verificado contra os estados previstos no Prompt Master. |
| 10. Expansão | Parcial | Arquivos digitais, suporte, notificações, perfis e relatórios têm módulos no produto. E-mail/anexos/SLA do suporte, recomendações e relatórios avançados ainda não estão completos. |

## Dependências de produção observadas

- No Vercel, `GOOGLE_CLOUD_VISION_API_KEY` não está cadastrado; busca por imagem e OCR ficam indisponíveis até configurar a credencial.
- Também não aparecem variáveis de Resend ou WhatsApp no ambiente de produção; notificações por esses canais precisam ser configuradas e validadas antes de serem consideradas operacionais.
- A galeria usa prévias leves versionadas no site. Os arquivos originais da coleção somam aproximadamente 940 MiB nas três categorias solicitadas; não devem ser incluídos no bundle do Vercel. Para visualização 3D pública, é necessário armazenamento de objetos com política de acesso, limite de tamanho e geração/armazenamento de prévias GLB.
- A publicação comercial permanece mediada por conta de fabricante, loja aprovada e anúncio revisado. Ter direitos sobre os arquivos não substitui esse fluxo de aprovação.

## Próximas entregas

1. Completar a configuração operacional das integrações de imagem, e-mail e WhatsApp nos ambientes de produção e validar cada canal sem expor segredos no Git.
2. Definir o armazenamento dos modelos originais e prévias GLB, incluindo limite de arquivo e controles de publicação, antes de publicar arquivos 3D para download ou visualização.
3. Implementar frete de produtos físicos e cupons com provedor/regra aprovados, preservando pedidos por loja, cálculo de comissão e histórico financeiro.
4. Fechar as lacunas de calculadora, OCR e estados de produção descritas nas fases 6, 7 e 9; cobrir cada fluxo com testes de regras e autorização.
5. Manter o onboarding administrativo e do fabricante seguro, completar cadastros reais e testar compra/notificações ponta a ponta em ambiente de homologação.

Os detalhes de instalação, banco, segurança, operação e integrações continuam nos documentos vinculados pelo [README](../README.md).
