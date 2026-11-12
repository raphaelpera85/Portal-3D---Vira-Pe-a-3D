# Status do Prompt Master V5.0

Revisão em 12 de novembro de 2026. Esta página compara os requisitos de produto do Prompt Master V5.0 enviado pelo proprietário com o estado atual do repositório e da produção. “Implementado” significa que o fluxo existe no código; integrações externas ainda dependem de credenciais e testes operacionais.

## Estado por fase

| Fase | Estado | Evidência e pendências principais |
| --- | --- | --- |
| 1. Fundação técnica e visual | Implementada, com configuração operacional pendente | Next.js App Router, TypeScript, tema claro/escuro, Supabase Auth/RLS, migrations e publicação Vercel existem. Ainda é preciso completar usuários de operação e conferir a configuração de produção. |
| 2. Visualizador | Implementada | Upload local de STL, OBJ, 3MF, GLB e GLTF; rotação, zoom, dimensões, escala, exportação GLB e layout responsivo. |
| 3. Modelos avançados | Parcial | 3MF, materiais/cores, componentes e biblioteca privada estão no visualizador. A coleção `/modelos` contém 94 modelos únicos em sete categorias, com prévias, tags, busca por texto, busca por imagem e páginas individuais de visualização/download. Os 94 originais ficam em `models/` no repositório público e são carregados diretamente pelo visualizador; a busca por imagem depende do Google Cloud Vision. Quando o 3MF contém `slice_info.config` compatível, o visualizador mostra gramas e metros por filamento, total, tempo previsto por placa e uso de suportes. A calculadora aceita entrada manual e OCR, mas o catálogo de modelos ainda não mantém dados de consumo editáveis por modelo nem cobre todos os campos de peso, purga, torre, trocas, material e perfil. |
| 4. Catálogos técnicos | Parcial | Existem catálogos de impressoras, materiais, resinas e bicos, sugestões de modelos ausentes, compatibilidade e registro de equipamentos/manutenções. A cobertura de marcas e especificações precisa crescer com fontes oficiais revisadas. |
| 5. Marketplace | Parcial | Contas, lojas moderadas, anúncios, busca, favoritos, carrinho multivendedor, cupons percentuais e fixos, pedidos e gestão de pedidos existem. Cupons são rateados por loja e descontados antes da comissão. Pedidos físicos aceitos podem consultar tarifas Melhor Envio, emitir etiqueta após confirmação do vendedor e acompanhar rastreio via webhook. Faltam credenciais e validação sandbox/produção. |
| 6. Calculadora | Parcial | Cálculo manual por lote, componentes, custos de impressora, margem sobre venda, markup sobre custo, comparação de canais, histórico privado e exportação PDF/CSV estão implementados. Arquivos 3MF com dados de fatiamento podem preencher peso/tempo por placa; perfis de impressão da própria loja também podem aplicar consumo e tempo escalados para o tamanho do lote, incluindo consumo por cor e preservação dos preços já informados. O fluxo de consignação aceita comissão percentual e taxa fixa por venda; a migração e a integração foram publicadas em produção. |
| 7. OCR e precificação avançada | Parcial | OCR aceita até três imagens por envio, consolida leituras e deixa valores conflitantes sem preenchimento; o fabricante revisa antes de aplicar. Agora separa peso de purga e torre de limpeza sem somá-los automaticamente. A leitura depende do Google Cloud Vision; extração de campos, perfis, moedas e configurações ainda precisa de cobertura e validação com capturas reais por fatiador. |
| 8. Pagamentos e logística | Parcial | Fluxos Mercado Pago, webhooks, idempotência, cancelamento e reembolso existem. O Melhor Envio oferece cotação e emissão de etiquetas com confirmação explícita do custo pelo vendedor; webhooks assinados atualizam status e rastreio. Falta validar OAuth, compra e webhooks com conta sandbox; esta versão aceita uma embalagem por pedido. |
| 9. Orçamentos | Parcial | Solicitações, propostas, escolha do fabricante, início/conclusão da impressão, cotação manual para impressões personalizadas, pagamento, rastreio, entrega e histórico existem. Pedidos do carrinho aceitos podem receber cotação Melhor Envio, etiqueta e rastreio automático; cotação de etiqueta para impressões personalizadas segue pendente. |
| 10. Expansão | Parcial | Arquivos digitais, suporte, notificações, perfis e relatórios têm módulos no produto. E-mail/anexos/SLA do suporte, recomendações e relatórios avançados ainda não estão completos. |

## Dependências de produção observadas

- Na inspeção atual do ambiente Production da Vercel, não aparecem `GOOGLE_CLOUD_VISION_API_KEY`, variáveis `RESEND_*` nem variáveis `WHATSAPP_*`; busca por imagem, OCR e notificações externas ficam indisponíveis até configurar e validar as credenciais.
- A galeria usa prévias leves versionadas em `public/modelos`. Os 94 arquivos 3MF únicos (1,19 GB) ficam na pasta `models/` do repositório público, fora de `public`, e o navegador os busca diretamente em `raw.githubusercontent.com`; isso evita incluí-los nos arquivos estáticos gerados pelo Next.js, mas torna cada original publicamente baixável e aumenta o tamanho dos clones do repositório. As prévias usam imagens extraídas dos 3MF; a página pública abre o arquivo original no visualizador.
- A publicação comercial permanece mediada por conta de fabricante, loja aprovada e anúncio revisado. Ter direitos sobre os arquivos não substitui esse fluxo de aprovação.

## Próximas entregas

1. Configurar Google Vision, Resend e WhatsApp na Vercel e validar busca por imagem, OCR e notificações externas sem expor segredos no Git.
2. Configurar e testar o OAuth, compra de etiquetas e webhook Melhor Envio em sandbox; depois validar o fluxo de produção com vendedores reconectados.
3. Ampliar consumo editável por modelo/perfil, campos de OCR para todos os slicers e histórico de origem dos dados; validar com imagens e fatiamentos reais.
4. Expandir a curadoria oficial dos catálogos e estados de produção, depois testar compra e pós-venda ponta a ponta com contas sandbox.

Os detalhes de instalação, banco, segurança, operação e integrações continuam nos documentos vinculados pelo [README](../README.md).
