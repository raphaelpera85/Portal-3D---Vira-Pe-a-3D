import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";

export const metadata: Metadata = {
  title: "Política de Privacidade | ViraPeça 3D",
  description: "Como a ViraPeça 3D usa e protege dados pessoais no marketplace.",
  robots: process.env.SITE_LEGAL_PAGES_APPROVED === "true" && [process.env.SITE_LEGAL_NAME, process.env.SITE_LEGAL_ID, process.env.SITE_LEGAL_ADDRESS, process.env.SITE_PRIVACY_EMAIL].every((value) => value?.trim())
    ? { index: true, follow: true }
    : { index: false, follow: true },
};

export default function PrivacyPage() {
  return <LegalDocument title="Política de Privacidade" intro="Entenda quais dados o portal usa, para quais finalidades e quais serviços podem recebê-los." updatedAt="14 de novembro de 2026" sections={[
    { title: "Dados que o portal usa", content: <><p>Podemos tratar nome, e-mail, dados de perfil, endereços, contatos de notificação, solicitações, propostas, pedidos, avaliações e informações necessárias para suporte e segurança.</p><p>Arquivos 3D e imagens que você envia podem ser tratados para visualização, orçamento e prestação dos recursos que escolher. A biblioteca privada de modelos exige autenticação e não torna o arquivo público.</p></> },
    { title: "Finalidades", content: <><p>Usamos esses dados para criar e proteger contas, conectar compradores a lojas e designers, calcular orçamentos, processar pedidos, acompanhar entregas, responder ao suporte, prevenir fraude e cumprir obrigações aplicáveis.</p><p>Dados de contato usados para avisos de pedido também servem para manter você informado sobre o serviço. Mensagens de WhatsApp exigem o consentimento aplicável ao canal.</p></> },
    { title: "Compartilhamento com prestadores e vendedores", content: <><p>Quando necessário para concluir uma compra, os dados do pedido e de entrega são compartilhados com a loja responsável. Dados de envio podem ser transmitidos ao Melhor Envio. O processamento do pagamento ocorre no Mercado Pago; o portal não solicita nem armazena o número completo do cartão.</p><p>O portal usa Supabase para autenticação e armazenamento, Vercel para hospedagem e, quando configurados, Resend e WhatsApp Business para notificações. Com autorização, capturas de tela para OCR e imagens para busca visual são transmitidas ao Google Cloud Vision para extrair informações de fatiamento ou sugerir termos de busca. O portal não persiste as imagens durante a leitura; se você marcar a opção própria ao salvar um cálculo, os arquivos fonte selecionados ficam no histórico privado desse cálculo.</p></> },
    { title: "Endereços e arquivos", content: <><p>Endereços salvos ficam restritos à conta. No pedido, o endereço completo fica disponível à loja responsável pela entrega e pode ser enviado ao provedor de frete escolhido.</p><p>Antes de enviar arquivos, confirme que tem autorização para usá-los. Não publique arquivos ou imagens que contenham dados pessoais de terceiros sem base legítima.</p></> },
    { title: "Retenção e segurança", content: <p>Guardamos dados enquanto forem necessários para manter a conta, cumprir o serviço, resolver disputas, prevenir abuso e atender obrigações legais. Depois, os dados são excluídos ou anonimizados quando permitido. Controles de acesso e políticas do banco limitam o acesso a informações privadas; nenhum serviço conectado elimina todo risco de segurança.</p> },
    { title: "Seus direitos e contato", content: <><p>Você pode solicitar confirmação e acesso aos dados, correção, informações sobre compartilhamento, oposição ou eliminação quando aplicável. Use a central <a href="/suporte">/suporte</a> ou o contato de privacidade indicado no início desta página.</p><p>Pedidos podem exigir confirmação de identidade para proteger sua conta e outras pessoas. A resposta depende dos prazos e exceções previstos na legislação.</p></> },
    { title: "Atualizações", content: <p>Podemos revisar esta política quando recursos, prestadores ou obrigações mudarem. A data no início indica a revisão mais recente. Mudanças relevantes devem ser comunicadas pelos canais disponíveis no portal.</p> },
    { title: "Referências oficiais", content: <ul><li><a href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm" rel="noreferrer">Lei Geral de Proteção de Dados Pessoais (LGPD)</a></li><li><a href="https://www.gov.br/anpd/pt-br" rel="noreferrer">Autoridade Nacional de Proteção de Dados</a></li></ul> },
  ]} />;
}
