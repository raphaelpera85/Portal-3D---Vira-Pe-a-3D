# Google Search Console

## Identidade pública preparada

- Nome do site: **ViraPeça 3D**
- Nome alternativo: **ViraPeça**
- Idioma: **Português do Brasil (pt-BR)**
- Página inicial: **Sua ideia vira realidade**
- Descrição: **Encontre peças feitas por fabricantes independentes ou transforme seu modelo 3D em uma peça real.**
- Título padrão: **ViraPeça 3D — Sua ideia vira realidade**
- Sitemap: `https://<domínio-publicado>/sitemap.xml`
- Robots: `https://<domínio-publicado>/robots.txt`

O domínio público ainda não foi definido. Configure `NEXT_PUBLIC_SITE_URL` com a origem HTTPS exata antes de publicar; páginas canônicas, Open Graph e sitemap usam esse endereço. Produtos demonstrativos não entram no sitemap nem são indexáveis. Produtos reais entram somente quando publicados e acessíveis pelas políticas públicas do banco.

## Criar e verificar a propriedade

1. No Search Console, crie uma propriedade **Domínio** se tiver acesso ao DNS. Esse método cobre protocolos e subdomínios e exige um registro TXT no provedor DNS.
2. Se não puder editar o DNS, crie uma propriedade **Prefixo do URL** usando a origem completa do site, por exemplo `https://www.exemplo.com/`. O método de tag HTML só se aplica a propriedades de prefixo.
3. Para a verificação por tag HTML, copie apenas o conteúdo do atributo `content` fornecido pelo Google para `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` no ambiente de produção. A aplicação publica esse token no `<head>` da página inicial. Não reutilize nem invente o token.
4. Após publicar com o domínio e o token corretos, confirme que a página inicial contém `meta name="google-site-verification"` e conclua a verificação no Search Console.
5. Envie `/sitemap.xml` no relatório **Sitemaps** e confira `/robots.txt`. O sitemap inclui páginas públicas da plataforma e anúncios publicados; ignora parâmetros de busca e filtros.

Não foi criada propriedade no Search Console, não foi enviado DNS e nenhum token de verificação foi configurado. Isso só pode ser concluído após definir o domínio e ter acesso ao Search Console/DNS.

## Metadados e rastreamento

A aplicação define `title`, descrição, URL canônica quando o domínio está configurado, Open Graph, Twitter Card e schema `WebSite` com o nome e idioma da marca. A conta recebe `noindex`; o callback de autenticação é bloqueado pelo `robots.txt`. Produtos de demonstração recebem `noindex` e não aparecem no sitemap. Não há dados estruturados de oferta ou avaliação enquanto checkout, preço real e avaliações verificadas não existirem.

O sitemap é dinâmico e usa apenas anúncios físicos/digitais e perfis de designers com status publicado, respeitando RLS. A rota `/designers` é incluída como página fixa, e cada perfil aprovado aparece como URL própria. Arquivos de origem e links assinados de download nunca entram no sitemap. Se o Supabase estiver fora do ar, as páginas institucionais continuam no sitemap e os anúncios/perfis são omitidos.
