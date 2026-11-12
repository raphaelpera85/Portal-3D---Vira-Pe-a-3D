# Google Search Console

## Identidade pública preparada

- Nome do site: **ViraPeça 3D**
- Nome alternativo: **ViraPeça**
- Idioma: **Português do Brasil (pt-BR)**
- Página inicial: **Sua ideia vira realidade**
- Descrição: **Encontre peças feitas por fabricantes independentes ou transforme seu modelo 3D em uma peça real.**
- Título padrão: **ViraPeça 3D — Sua ideia vira realidade**
- Origem pública atual: `https://virapeca3d.vercel.app/`
- Propriedade Search Console recomendada: **Prefixo do URL** `https://virapeca3d.vercel.app/` (a ViraPeça não controla o DNS de `vercel.app` para criar uma propriedade Domínio)
- Sitemap: <https://virapeca3d.vercel.app/sitemap.xml> (inclui as 94 páginas individuais de modelos 3D e anúncios, perfis e lojas públicos)
- Robots: <https://virapeca3d.vercel.app/robots.txt>

A produção está configurada com `NEXT_PUBLIC_SITE_URL=https://virapeca3d.vercel.app`; a homepage pública já responde com URL canônica nessa origem e sitemap/robots estão acessíveis. Produtos demonstrativos não entram no sitemap nem são indexáveis. Produtos reais entram somente quando publicados e acessíveis pelas políticas públicas do banco.

## Criar e verificar a propriedade

1. No Search Console, crie a propriedade **Prefixo do URL** `https://virapeca3d.vercel.app/`.
2. Escolha o método de verificação por tag HTML e copie apenas o conteúdo do atributo `content` fornecido pelo Google para `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` no ambiente de produção. A aplicação publica esse token no `<head>` da página inicial. Não reutilize nem invente o token.
3. Depois de publicar com o token correto, confirme que a página inicial contém `meta name="google-site-verification"` e conclua a verificação no Search Console.
4. Envie `sitemap.xml` no relatório **Sitemaps** e confira `robots.txt`. O sitemap inclui os modelos 3D e páginas públicas de anúncios, perfis de designers e lojas aprovados; ignora parâmetros de busca e filtros.

Ainda não foi criada propriedade no Search Console nem configurado o token de verificação. O token deve ser copiado da própria propriedade do Google após criá-la; o acesso à conta Google é necessário para concluir a verificação e enviar o sitemap.

## Metadados e rastreamento

A aplicação define título, descrição, URL canônica quando o domínio está configurado, Open Graph, Twitter Card e schema `WebSite` na homepage; lojas públicas também têm schema `Store`. Produtos publicados incluem schema `Product`; `Offer` aparece quando o preço exato está visível (incluindo cada licença digital) e a disponibilidade só é informada quando conhecida. Anúncios "a partir de", sob orçamento e com variantes não publicam uma oferta ambígua; conforme as [diretrizes do Google para variantes](https://developers.google.com/search/docs/appearance/structured-data/product-variants), falta permitir URLs que abram cada variante já selecionada. O JSON-LD escapa conteúdo fornecido pelo fabricante antes de inseri-lo na página. Ainda não há nota agregada; avaliações verificadas aparecem no conteúdo visível, sem marcação `AggregateRating`. A conta recebe `noindex`; o callback de autenticação é bloqueado pelo `robots.txt`. Produtos de demonstração recebem `noindex` e não aparecem no sitemap.

O sitemap é dinâmico e usa apenas anúncios físicos/digitais, perfis de designers e lojas com status publicado, respeitando RLS. As rotas `/lojas` e `/designers` são incluídas como páginas fixas, e cada perfil aprovado aparece como URL própria. Arquivos de origem e links assinados de download nunca entram no sitemap. Se o Supabase estiver fora do ar, as páginas institucionais continuam no sitemap e os anúncios, perfis e lojas são omitidos.
