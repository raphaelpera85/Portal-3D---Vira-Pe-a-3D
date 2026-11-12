# Calculadora de custos e preços

A rota `/calculadora` calcula um lote por vez no navegador. O cálculo manual funciona sem login; fabricantes com loja e sessão ativa podem salvar snapshots privados no histórico da loja.

## Entradas

- Quantidade de produtos prontos no lote, filamento consumido pela execução principal completa e preço por kg.
- Arquivos ou componentes adicionais com material, impressora, quantidade por produto e custos próprios para o lote.
- Até três capturas de tela do fatiador para extração OCR, disponíveis a fabricantes autenticados com Cloud Vision configurado.
- Tempo de impressão, potência média medida e tarifa por kWh.
- Custo operacional da máquina, depreciação e manutenção por hora.
- Tempo e valor da mão de obra, custos fixos rateados, componentes e reserva para falhas.
- Margem bruta desejada e taxas percentuais e fixas informadas para cada canal.

## Cálculo

O custo de material é `gramas do lote × preço/kg ÷ 1000`. Energia usa `potência média em kW × horas do lote × tarifa`; custos de máquina e mão de obra também usam os totais informados para cada execução. A execução principal e cada componente adicional têm seus próprios materiais, impressoras e custos. Para cada componente, informe quantas unidades entram em um produto final e os custos totais necessários para produzir esse componente para todo o lote. Se a produção exigiu várias execuções, some o tempo e os demais custos das execuções daquele componente antes de preencher; o portal não multiplica tempo por peças. Componentes físicos e custos rateados por peça são multiplicados pela quantidade do lote; custo fixo de lote entra uma vez. Cada item monetário é arredondado para centavos antes da soma. A reserva para falhas incide sobre todos os custos somados. O custo unitário usa arredondamento para cima, evitando que a divisão deixe parte do custo do lote sem cobertura. Preços por canal são calculados por unidade.

O preço por canal é o menor preço em centavos em que o lucro após a tarifa fixa e a taxa percentual arredondada ainda atinge a margem desejada sobre o preço de venda. As taxas ficam vazias inicialmente: a interface não presume tarifas de plataformas.

## Limites atuais

- O histórico mostra os 20 cálculos mais recentes por loja. Os snapshots preservam entradas, canais e resultado; abrir como cópia preenche o formulário sem alterar o registro original. O servidor valida e recalcula os dados ao salvar. Registros podem ser excluídos pelo próprio fabricante.
- O histórico pode ser vinculado a um produto da própria loja; a relação é opcional e aparece junto ao snapshot. O snapshot ainda não vincula arquivo enviado, bico, perfil ou equipamento selecionado.
- O OCR preenche peso e tempo somente depois da revisão; o histórico guarda esses valores normalizados, mas não a imagem, texto OCR completo ou a origem reconhecida.
- Custos da execução principal e de cada componente representam os totais necessários para produzir o lote. O portal calcula a quantidade de componentes exigida (`unidades por produto × produtos no lote`) para conferência, mas não infere consumo do fatiador nem multiplica automaticamente o tempo pela quantidade de peças. Some o tempo de cada execução do componente antes de informar o total.
- Não inclui impostos, frete, tarifa não informada nem valores que o usuário deixou de preencher.
- Equipamentos do maker podem preencher potência média medida, tarifa informada e depreciação por hora quando preço, valor residual e vida útil estão cadastrados. Esses campos continuam editáveis.
- O OCR inicial reconhece rótulos comuns para consumo total, modelo, suportes, comprimento, tempo, trocas, materiais e linhas por filamento/cor quando legíveis. Não garante suporte a todas as versões/localizações dos slicers, perfis ou custos com moeda ambígua. Divergências ficam sem preenchimento.
- Os componentes podem ter materiais e impressoras diferentes e são preservados nos snapshots do histórico. Ainda não há associação desses componentes com arquivos 3D enviados, perfis ou bicos. O controle de consignação é independente das vendas e dos pedidos do marketplace.
- O resultado é uma estimativa baseada nos dados informados e não substitui a validação de custos reais do fabricante.

As fórmulas e os limites do cálculo são exercitados por `src/lib/pricing.test.ts`.
