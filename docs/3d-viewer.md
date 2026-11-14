# Visualizador 3D

## Disponível nesta etapa

- Página `/visualizador` para arquivos STL, OBJ, 3MF, GLB e GLTF de até 20 MB por conjunto.
- Leitura e renderização no navegador por padrão; compradores autenticados podem salvar o conjunto na biblioteca privada da conta.
- Orbit, zoom, panorâmica, vistas frontal/traseira/superior/inferior/laterais, enquadramento, grade, eixos, tela cheia e captura PNG.
- Dimensões do limite da malha e escala proporcional de 10% a 300% na prévia.
- Relatório de compatibilidade com seleção de impressora, material e bico, considerando a escala atual e os modos de volume publicados para a máquina. O relatório compara processo, material, diâmetro, bico, temperaturas, recursos cadastrados e volume; informações ausentes aparecem como não verificadas.
- Para arquivos com duas ou mais cores visuais, é possível solicitar a verificação do uso multicolorido. A cor visual não associa automaticamente filamentos ou confirma um perfil de fatiamento.
- STL e OBJ não carregam uma unidade padronizada. O usuário precisa confirmá-la antes que as dimensões sejam mostradas.
- 3MF lê a unidade do arquivo (milímetro por padrão no padrão 3MF); unidades desconhecidas precisam de confirmação manual. GLB/GLTF usam metros, como definido pelo glTF. A dimensão pode ser mostrada em mm, cm ou m.
- A paleta mostra cores de vértice, materiais e atribuições presentes no arquivo, como aparência visual, sem atribuir filamentos. Selecione uma amostra para realçar os componentes correspondentes no modelo e na lista.
- Quando um 3MF inclui metadados de fatiamento, a página mostra o consumo, material, cor e slot registrados por filamento; esses dados de slot não associam automaticamente um filamento a uma malha visível.
- Malhas de uma cena podem ser ocultadas individualmente quando o formato as mantém separadas.
- Escala proporcional de 10% a 300% pode ser baixada como uma nova cópia GLB. A unidade original é convertida para metros conforme o padrão glTF; componentes ocultos não entram na cópia.
- A página pública do produto permite selecionar perfis de impressão comunitários ou oficiais aprovados e consultar o lote, os parâmetros e o consumo declarados pelo fabricante.
- Produtos digitais publicados incluem uma prévia GLB interativa na página do anúncio. O fabricante envia a cópia GLB separada do STL/3MF vendido; o GLB pode ser baixado por qualquer visitante enquanto o link assinado curto estiver válido e não deve conter dados que precisem permanecer exclusivos.

## Limites atuais

- OBJ/GLTF podem ser selecionados junto com arquivos externos MTL, BIN e texturas. Os nomes dos recursos precisam corresponder aos caminhos do modelo; em caso de ambiguidade por nomes repetidos, use um pacote GLB/3MF.
- Texturas baseadas em arquivo são renderizadas, mas não são convertidas em swatches de cor de filamento.
- A verificação dimensional compara a caixa da peça com os eixos da área retangular cadastrada; não cobre inclinações, formato da mesa, folgas, suportes ou garante que a impressão será bem-sucedida. Volumes cilíndricos ou ausentes aparecem como não verificados.
- O catálogo ainda não valida exposição ou comprimento de onda de resinas contra cada impressora. A compatibilidade técnica é uma triagem; confirme perfil, fatiamento e estado real do equipamento antes de fabricar.
- Perfis ainda não são associados a uma malha aberta no visualizador local; a seleção e o consumo declarado aparecem na página do produto.
- A exportação cria um GLB com a geometria, materiais e componentes visíveis compatíveis com glTF; metadados específicos de impressão ou do formato de origem podem não ser preservados. O arquivo original permanece intacto.
- A biblioteca usa bucket privado, limita os arquivos e o conjunto a 20 MB e verifica a propriedade antes de registrar o upload. A migração `20261112040057_private_model_uploads.sql` está aplicada ao projeto Supabase configurado.
- Com a migração `20261112040236_custom_print_requests.sql`, o comprador pode pedir impressão para um modelo salvo. As dimensões calculadas pelo visualizador após confirmação da unidade são salvas e ficam bloqueadas no formulário; se estiverem ausentes, é necessário reabrir o modelo com a unidade correta e salvá-lo novamente. O banco compara as dimensões enviadas com as armazenadas, mas elas ainda dependem do cliente e devem ser conferidas pelo fabricante no fatiador. O acesso do fabricante aos arquivos depende de convite e usa links assinados de 2 minutos.
- Uploads locais aceitam até 20 MiB por conjunto; arquivos 3MF do catálogo podem ter até 50 MiB comprimidos. A extração de qualquer pacote 3MF é limitada a 300 MiB descompactados para reduzir risco de arquivos ZIP desproporcionais.

## Implementação

Three.js e seus loaders são carregados sob demanda na rota do visualizador. 3MF usa o `ThreeMFLoader` e `fflate` para ler a unidade declarada no pacote. A geometria não é enviada à API. Malhas antigas e materiais são descartados da GPU ao trocar de arquivo.
