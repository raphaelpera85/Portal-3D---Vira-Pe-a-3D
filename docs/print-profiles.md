# Perfis de impressão

O painel do fabricante permite salvar perfis privados vinculados aos produtos da própria loja. Um perfil registra tipo (econômico, rápido, detalhado, multicolorido ou personalizado), impressora própria ou descrição manual, material e bico do catálogo ou descrição manual, altura de camada, preenchimento, paredes, suportes, orientação, escala, quantidade por lote, tempo total e massa total. O consumo por cor é opcional e aceita até 12 linhas no formato `#RRGGBB; gramas; metros`. Gramas e metros podem ser preenchidos separadamente; linhas antigas `#RRGGBB; gramas` continuam válidas.

O tempo e o material são valores do lote informado; o portal não multiplica automaticamente esses valores pela quantidade. A soma das gramas por cor não pode superar a massa total informada. O comprimento por cor é preservado no perfil publicado e na calculadora; ele não é convertido em massa.

Perfis privados aparecem somente no painel da loja. O fabricante pode enviar um perfil à comunidade; enquanto aguarda revisão, pode editá-lo e reenviá-lo ou retirar a submissão. Na área administrativa `/admin/fabricantes`, a equipe pode aprovar como comunitário, aprovar como oficial ou recusar com uma nota. Somente perfis publicados ligados a produtos e lojas publicados aparecem na página pública do produto.

Perfis aprovados ficam somente para leitura pelo fabricante. Um perfil recusado pode ser corrigido e enviado novamente. A seleção na página do produto apresenta o lote e os valores informados sem tratá-los como previsão universal ou consumo geométrico.

Os detalhes públicos de cada modelo também aceitam perfis particulares do autor e submissões comunitárias. A equipe pode aprovar uma submissão como comunitária ou oficial, ou recusá-la com nota; perfis publicados podem ser copiados para a conta de outro usuário. A view `visible_model_print_profiles` expõe apenas perfis próprios ou compartilhados publicados, oculta o identificador do autor e limita a nota de revisão ao autor e à equipe. A migration `20261113150000_model_print_profile_sharing.sql` implementa esse fluxo e está versionada no Git, mas ainda não foi aplicada ao Supabase.

Perfis por modelo podem importar métricas de uma placa 3MF ou receber valores manuais. O campo opcional de consumo por cor aceita até 32 linhas no formato `#RRGGBB; material; gramas; metros; filamento`; o último campo preserva o número original do slot, inclusive quando os slots não são consecutivos. Linhas antigas sem esse campo continuam válidas e recebem numeração sequencial. Se o 3MF tiver IDs ausentes, inválidos ou duplicados, a importação usa a ordem das linhas para evitar slots ambíguos.

As migrations devem continuar versionadas em `supabase/migrations/` e aplicadas em ordem. Publicar alterações de código pelo Git/Vercel não aplica automaticamente o schema Supabase.
