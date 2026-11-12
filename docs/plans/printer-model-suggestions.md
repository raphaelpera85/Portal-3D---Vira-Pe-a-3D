# Sugestões de impressoras para o catálogo mestre

## Objetivo

Permitir que fabricantes peçam a inclusão de modelos ausentes no catálogo. A equipe administrativa revisa a solicitação; a aprovação cria um rascunho no catálogo para enriquecimento técnico e publicação verificada.

## Escopo

- Formulário autenticado no painel maker com fabricante, modelo, variante, tecnologia, fonte opcional e observações.
- Validação no servidor e RLS para autoria; makers podem ler apenas suas sugestões.
- Fila administrativa com aprovação ou recusa auditada.
- Aprovação não publica dados nem declara compatibilidade: cria ou associa somente um registro `draft`.

## Checklist

- [x] Validar primeiro o formulário com testes.
- [x] Implementar submissão, fila privada e decisão administrativa transacional.
- [x] Ligar o fluxo aos painéis do fabricante e da administração.
- [x] Documentar a revisão antes de publicação.
- [x] Aplicar a migration ao projeto Supabase configurado e confirmar a tabela no banco.
- [ ] Validar submissão, aprovação e recusa ponta a ponta com contas de teste.

## Verificação

- Testes unitários para normalização, URL HTTPS e campos inválidos.
- `npm test`, `npm run typecheck`, `npm run build` e inspeção de diff.
- A migration já está aplicada; o fluxo de curadoria precisa de teste ponta a ponta antes de habilitar em produção.
