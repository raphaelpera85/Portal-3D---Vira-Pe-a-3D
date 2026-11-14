import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";

export const metadata: Metadata = {
  title: "Termos de Uso | ViraPeça 3D",
  description: "Regras de uso do marketplace e dos recursos ViraPeça 3D.",
  robots: process.env.SITE_LEGAL_PAGES_APPROVED === "true" && [process.env.SITE_LEGAL_NAME, process.env.SITE_LEGAL_ID, process.env.SITE_LEGAL_ADDRESS, process.env.SITE_PRIVACY_EMAIL].every((value) => value?.trim())
    ? { index: true, follow: true }
    : { index: false, follow: true },
};

export default function TermsPage() {
  return <LegalDocument title="Termos de Uso" intro="Estas regras descrevem como usar o marketplace, publicar conteúdo e acompanhar compras e serviços." updatedAt="14 de novembro de 2026" sections={[
    { title: "Sobre o portal", content: <p>ViraPeça 3D conecta pessoas que compram produtos, arquivos digitais e serviços de fabricação com fabricantes e designers independentes. A disponibilidade de cada anúncio depende da loja responsável e da operação dos prestadores conectados.</p> },
    { title: "Conta e segurança", content: <p>Informe dados verdadeiros, mantenha seus meios de acesso seguros e use a conta conforme sua finalidade. Avise a equipe se suspeitar de acesso indevido. O portal pode limitar temporariamente atividades para proteger contas, pedidos e outros usuários.</p> },
    { title: "Anúncios, arquivos e direitos", content: <><p>Quem publica um produto, arquivo, imagem ou projeto declara ter direitos e autorizações para disponibilizá-lo. Não envie conteúdo ilegal, enganoso, malicioso ou que viole direitos de terceiros. Denúncias podem ser analisadas pela equipe e o conteúdo pode ser ocultado durante a revisão.</p><p>Descrições, licenças, materiais, dimensões, variações, prazo e preço devem ser informados pela loja ou designer responsável. Um arquivo digital pode ter licença de uso própria; confira essa licença antes de comprar ou fabricar a peça.</p></> },
    { title: "Pedidos, pagamentos e frete", content: <><p>O pedido fica sujeito à confirmação da loja e ao pagamento pelo meio apresentado no checkout. Valores, descontos e frete são exibidos antes da confirmação; o pagamento é processado por prestador externo.</p><p>Quando o comprador escolhe entrega, os dados necessários são compartilhados com a loja e com o transportador. A disponibilidade, prazo, custo e rastreio dependem da opção oferecida e da confirmação dos prestadores.</p></> },
    { title: "Orçamentos e fabricação", content: <p>Um orçamento depende das informações do arquivo, quantidade, material, acabamento e condições descritas na proposta. A análise automática de dimensões ou compatibilidade é informativa; ela não garante que uma peça possa ser fabricada ou que terá resultado específico.</p> },
    { title: "Cancelamentos e direitos do consumidor", content: <p>Solicitações de cancelamento, arrependimento, reembolso, garantia e atendimento seguem as regras aplicáveis à compra e à legislação brasileira. Nada nestes termos limita direitos que a lei não permite renunciar. Use <a href="/suporte">/suporte</a> para registrar uma solicitação e consultar o andamento.</p> },
    { title: "Responsabilidades e disponibilidade", content: <p>O portal mantém ferramentas para anúncios, comunicação, pagamentos e acompanhamento, mas recursos externos podem ficar indisponíveis. Cada participante deve revisar os dados e condições do pedido antes de confirmar. A responsabilidade de cada participante é definida pelos fatos da operação e pela legislação aplicável.</p> },
    { title: "Mudanças e encerramento de acesso", content: <p>Podemos atualizar recursos e estes termos. Em caso de uso abusivo, fraude ou violação de direitos, o portal pode restringir conteúdo ou acesso após análise, preservando obrigações legais e o atendimento de pedidos em andamento.</p> },
    { title: "Referências oficiais", content: <ul><li><a href="https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm" rel="noreferrer">Código de Defesa do Consumidor</a></li><li><a href="https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm" rel="noreferrer">Decreto do comércio eletrônico</a></li></ul> },
  ]} />;
}
