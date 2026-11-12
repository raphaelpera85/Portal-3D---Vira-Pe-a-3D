# Catálogo de materiais

O primeiro lote publicado em `material_catalog` contém dois materiais Bambu Lab: PLA Basic e PPA-CF. Os dados e cores usados pela rota `/catalogos` foram carregados pelas migrações `20261112052523_seed_initial_technical_catalog.sql` e `20261112052830_enrich_initial_catalog_records.sql`. A temperatura de bico, mesa, densidade, velocidade, secagem e compatibilidade de acessórios são propriedades do produto, não valores universais para cada família.

- [PLA Basic](https://bambulab-us.myshopify.com/products/pla-basic-filament): 1,75 mm, densidade 1,24 g/cm³, bico 190–230 °C, mesa 35–45 °C e velocidade indicada abaixo de 300 mm/s. A secagem é opcional (55 °C por 8 h), conforme o [guia oficial de filamentos](https://cdn1.bambulab.com/filament/filament-guide/wksdyyzd8n9/filament-guide-en.pdf).
- [PPA-CF](https://bambulab-us.myshopify.com/products/ppa-cf): 1,75 mm, densidade 1,25 g/cm³, bico 280–310 °C, mesa 100–120 °C, secagem obrigatória, câmara fechada e bico de aço temperado entre os requisitos publicados.

As fontes foram conferidas em 12 nov. 2026. Administradores podem incluir materiais e resinas em `/admin/catalogos/materiais`; relações de suporte por impressora são mantidas em `/admin/catalogos/bicos`. Recomendações de exposição, lavagem e cura não são generalizadas entre produtos.
