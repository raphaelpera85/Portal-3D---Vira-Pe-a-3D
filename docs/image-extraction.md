# Extração de dados de imagens de fatiadores

O importador da calculadora envia capturas de tela a `POST /api/ocr/slicer` e mostra os valores reconhecidos para conferência manual. A implementação usa OCR de texto do Google Cloud Vision e regras genéricas de leitura; ela não identifica o fatiador para escolher um parser específico.

## Acesso, privacidade e limites

- Apenas fabricantes autenticados e aprovados podem usar a rota. A chave `GOOGLE_CLOUD_VISION_API_KEY` existe somente no servidor; a configuração do Google Cloud está em [integrations.md](integrations.md#ocr-de-imagens-de-fatiadores).
- A interface pede consentimento antes de cada envio. O ViraPeça mantém as imagens na memória da requisição, não as grava no Supabase e não salva o texto OCR no histórico de cálculo.
- Uma requisição aceita de uma a três imagens PNG, JPEG ou WebP, com assinatura binária validada, até 2 MiB por imagem e 4 MiB no total. O corpo multipart tem limite de 4,25 MiB.
- A cota é de 30 imagens por fabricante por dia UTC. Ela é debitada antes da chamada ao provedor, portanto imagens enviadas em tentativas que falham no Cloud Vision também podem consumir cota.
- O pedido ao Cloud Vision expira após 20 segundos. O texto retornado é limitado a 6.000 caracteres por imagem e 12.000 caracteres combinados.

## Campos reconhecidos

O parser procura rótulos em português e inglês e só preenche valores associados a rótulos reconhecidos:

| Campo | Normalização |
| --- | --- |
| Peso do modelo, suportes e total | Gramas; kg é convertido para g |
| Purga e torre de limpeza | Gramas, mantidas em campos separados |
| Comprimento de filamento | Metros; mm é convertido para m |
| Tempo de impressão | Horas decimais a partir de `hh:mm`, dias, horas ou minutos |
| Trocas de filamento/cor | Número inteiro |
| Material e fatiador | Nomes reconhecidos no texto |
| Linhas por filamento | Índice, massa, comprimento, material e cor, quando legíveis |
| Custo exibido pelo fatiador | Valor numérico sem moeda assumida |

Os nomes de fatiador reconhecidos são Anycubic Slicer Next, OrcaSlicer, Bambu Studio, Cura, UltiMaker Cura, PrusaSlicer, Creality Print, ElegooSlicer, FlashPrint e ideaMaker. Reconhecer o nome não garante que todos os campos daquele programa ou versão sejam extraídos.

O reconhecimento textual de material preserva nomes de produtos do catálogo, incluindo variantes como PPA-CF, PA11 Carbon Fiber, PETG Carbon Fiber, PC Blend, Water-Wash Resin 2.0 e ABS-Like Resin V3.0. O OCR não associa automaticamente a leitura a um registro ou perfil do catálogo.

## Consolidação de várias imagens

Imagens podem mostrar partes diferentes da mesma tela de resultado. O portal combina leituras do mesmo campo quando não há divergência; campos numéricos divergentes ficam vazios e entram na lista de conflitos. Leituras por filamento são combinadas pelo índice. Se massa, material ou cor do mesmo índice divergirem, o filamento é removido do resultado para revisão; comprimentos divergentes ficam vazios.

O total de filamento é usado quando foi lido explicitamente. Se não houver total e peso do modelo e dos suportes tiverem sido reconhecidos sem conflito, o portal pode mostrar a soma desses dois valores como derivada. Purga e torre de limpeza nunca são somadas automaticamente, pois podem já estar incluídas no total exibido pelo fatiador.

## Revisão e persistência

O OCR não inicia cálculos nem salva resultados por conta própria. O fabricante revisa o texto reconhecido e escolhe **Revisar e preencher dados**; depois, precisa conferir os valores no formulário antes de calcular. A moeda do custo reconhecido deve ser confirmada manualmente. Texto OCR e capturas não são guardados no histórico; somente os campos normalizados que o usuário confirmar podem compor o snapshot do cálculo.

## Limites conhecidos

- O Cloud Vision extrai texto, mas não entende a semântica de cada painel de fatiador. Layouts, idiomas, rótulos, unidades e versões diferentes podem deixar campos vazios ou produzir leituras incorretas.
- Não há confirmação automática de moeda, perfil, impressora, escala, temperatura ou custo por cor. O custo extraído não substitui o motor de precificação.
- Não existe um conjunto de capturas reais versionado para validar todos os fatiadores e versões. A cobertura real deve ser verificada com capturas representativas antes de considerar algum layout garantido.
- Sem `GOOGLE_CLOUD_VISION_API_KEY` na Production, a interface informa que o serviço não está configurado e mantém o cálculo manual disponível.

Os limites de implementação estão descritos junto à [calculadora](pricing-engine.md#limites-atuais), e a preparação da chave e do projeto Google Cloud está em [integrações](integrations.md#ocr-de-imagens-de-fatiadores).
