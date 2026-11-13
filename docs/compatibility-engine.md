# Motor de compatibilidade

`src/lib/compatibility.ts` retorna uma lista de verificações explicáveis com quatro resultados: compatível, compatível com condições, incompatível e não verificado.

O motor compara processo (filamento ou resina), família de material informada pela impressora, diâmetro do filamento, encaixe cadastrado do bico, limites de temperatura, exigência de câmara, abrasividade, uso de alimentador multicolorido e dimensões opcionais da peça. A calculadora permite escolher um bico do catálogo para incluir encaixe, limite térmico e resistência à abrasão na checagem do material e da impressora; sem bico selecionado, esses critérios não são avaliados. Para orientar a peça no volume, os três eixos são ordenados antes da comparação. Campos ausentes permanecem não verificados; valores “não recomendados” pelo fabricante são condições, não uma afirmação de impossibilidade.

Incompatibilidade prevalece no resultado geral; dados críticos ausentes produzem “não verificado”; depois vêm condições e compatibilidade. A classificação serve como triagem. Não substitui perfil validado, medição do equipamento ou avaliação de segurança.

As referências iniciais ficam em `src/lib/technical-catalog.ts`, com fonte e data de conferência em cada registro. `/catalogos` consulta registros publicados no Supabase; quando ainda não há nenhum, apresenta essas referências locais até a primeira curadoria. Equipamentos particulares não são armazenados por essa página. Testes do motor e dos registros estão em `src/lib/compatibility.test.ts` e `src/lib/technical-catalog.test.ts`.
