# Perfis de impressão

O painel do fabricante permite salvar perfis privados vinculados aos produtos da própria loja. Um perfil registra tipo (econômico, rápido, detalhado, multicolorido ou personalizado), impressora própria ou descrição manual, material e bico do catálogo ou descrição manual, altura de camada, preenchimento, paredes, suportes, orientação, escala, quantidade por lote, tempo total e massa total. O consumo por cor é opcional e aceita até 12 linhas no formato `#RRGGBB; gramas`.

O tempo e o material são valores do lote informado; o portal não multiplica automaticamente esses valores pela quantidade. A soma do consumo por cor não pode superar a massa total informada.

Perfis privados aparecem somente no painel da loja. O fabricante pode enviar um perfil à comunidade; enquanto aguarda revisão, pode editá-lo e reenviá-lo ou retirar a submissão. Na área administrativa `/admin/fabricantes`, a equipe pode aprovar como comunitário, aprovar como oficial ou recusar com uma nota. Somente perfis publicados ligados a produtos e lojas publicados aparecem na página pública do produto.

Perfis aprovados ficam somente para leitura pelo fabricante. Um perfil recusado pode ser corrigido e enviado novamente. A seleção na página do produto apresenta o lote e os valores informados sem tratá-los como previsão universal ou consumo geométrico.

O recurso e as migrações 001–016 estão aplicados ao projeto Supabase configurado para o portal. Mudanças futuras devem continuar versionadas em `supabase/migrations/` e validadas antes do deploy.
