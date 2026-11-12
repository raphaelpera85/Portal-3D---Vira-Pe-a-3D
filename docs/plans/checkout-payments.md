# Checkout, pagamentos e frete

## Decisão de integração

O Prompt Master exige split por vendedor, Pix/cartão, comissões, webhooks, idempotência, conciliação, reembolsos e disputas. O Mercado Pago documenta Split 1:1 para marketplace com Checkout Pro ou Checkout Transparente; cada preferência usa o access token OAuth do vendedor e a comissão da plataforma entra em `marketplace_fee`. Split 1:N não é uma opção geral e depende de carteira comercial assessorada.

Este plano começa pelo vínculo OAuth de cada loja, com PKCE. Tokens e refresh tokens são criptografados com AES-256-GCM em uma tabela sem acesso direto por `anon` ou `authenticated`. O Checkout Pro mantém dados de cartão fora do ViraPeça. A cobrança será criada por pedido de uma única loja, pois o split 1:1 tem um vendedor recebedor por cobrança.

## Fases

- [x] Decidir provedor e arquitetura com base na documentação oficial.
- [x] Exibir extrato dos 500 pagamentos mais recentes por loja, com totais pagos e comissão registrada.
- [x] Vincular contas de vendedor com OAuth PKCE e persistência criptografada dos tokens.
- [ ] Implementar desconexão e revogação da autorização do vendedor.
- [x] Implementar refresh token, Checkout Pro para pedidos de carrinho, compras diretas e propostas de impressão aceitos, taxa de marketplace configurável e idempotência.
- [x] Implementar webhook assinado, consulta server-to-server e transição auditável do pagamento.
- [x] Registrar o status de contestação quando a order consultada no webhook retorna `charged_back`, bloquear nova cobrança da mesma origem e exibir o caso nos painéis.
- [x] Permitir ao fabricante pedir reembolso total ou parcial com confirmação, reserva transacional e idempotência no Mercado Pago.
- [ ] Implementar cancelamentos de pagamentos pendentes, reconciliação periódica de reembolsos e gerenciamento dos casos do tópico `chargebacks`.
- [ ] Adicionar testes de integração com contas de teste e validar as migrations no Supabase conectado.
- [x] Implementar cotação manual de frete por loja, aceite do comprador, inclusão no checkout, rastreio manual e confirmação de recebimento.
- [ ] Integrar provedor para cotações automáticas, compra de etiquetas e atualização automática de rastreio.

## Bloqueios de produção

- Credenciais e aplicação Mercado Pago com marketplace Split 1:1 e URL de callback cadastrada.
- Cada vendedor precisa autorizar OAuth e atender ao nível de identificação solicitado pelo provedor.
- Definir a comissão do ViraPeça antes de emitir preferências. Nenhuma taxa é presumida no código.
- Testar Pix/cartão e notificações com contas sandbox; não liberar produção até confirmar conciliação e política de reembolso.
- Escolher provedor de frete e cadastrar credenciais/contrato para cotar e comprar etiquetas.

## Limites verificados

- O extrato do fabricante não informa saldo disponível, tarifa real do provedor nem data/estado de liquidação; esses dados continuam no painel Mercado Pago.

- A documentação do Mercado Pago informa que a comissão do marketplace é aplicada após a taxa do Mercado Pago e que o reembolso pode exigir saldo disponível do vendedor; a plataforma não consegue garantir sozinha o reembolso integral nesse cenário.
- O checkout online atende pedidos do carrinho, solicitações diretas de compra e propostas de impressão aceitos, sempre por loja.
- Para pedidos de carrinho, o checkout inclui o frete manual cotado pela loja e aceito pelo comprador; a comissão é calculada somente sobre os produtos. A cotação não usa tarifas ao vivo e não emite etiqueta.
- Estoque contado de produtos é reservado atomicamente ao iniciar o checkout de carrinho ou compra direta, confirmado como vendido apenas pelo webhook e devolvido se o provedor rejeitar, cancelar ou expirar a order. Serviços de impressão não reservam estoque de produto; a produção só pode começar após o webhook confirmar o pagamento. Orders do Mercado Pago expiram em um dia.
- Cancelamento de pagamentos pendentes, conciliação financeira, gestão e envio de evidências de disputas, frete automatizado e validação com contas sandbox ainda não estão concluídos.
- O webhook atualiza o estado do pagamento após validar a assinatura e consultar a order no Mercado Pago. A página de retorno não confirma pagamento.
- A contestação é registrada somente quando o webhook de orders leva a API da order a retornar `charged_back`; o fluxo não recebe eventos do tópico separado `chargebacks`, envia evidências ou administra prazos e decisões do caso.
