---
title: ViraPeça 3D · TripoSR
emoji: 🧊
colorFrom: blue
colorTo: indigo
sdk: gradio
sdk_version: 5.49.1
python_version: 3.10.13
app_file: app.py
---

# ViraPeça 3D · geração de rascunho 3D

Space Gradio usado pela página `/gerar-modelo`. O código do TripoSR e os pesos são licenciados sob MIT por Stability AI e Tripo AI; consulte o [repositório](https://github.com/VAST-AI-Research/TripoSR) e o [model card](https://huggingface.co/stabilityai/TripoSR).

Space público do piloto: [raphaelpera85/virapeca-triposr](https://huggingface.co/spaces/raphaelpera85/virapeca-triposr). Está configurado como ZeroGPU e o endpoint `/generate` foi validado com uma imagem de teste.

## Publicar

1. Crie um Space público com SDK **Gradio** na sua conta Hugging Face e selecione o hardware **ZeroGPU**.
2. Crie um token Hugging Face com permissão de escrita somente nesse Space e salve-o como segredo `HF_TOKEN` em **GitHub → repositório → Settings → Secrets and variables → Actions**. O token não deve ser salvo em arquivo nem como variável pública.
3. No GitHub, abra **Actions → Publish TripoSR Space → Run workflow** para publicar `spaces/triposr/` no Space. Se `HF_TOKEN` estiver ausente, o workflow falha explicitamente e não publica.
4. Aguarde o Space ficar `Running` e defina o identificador `conta/nome-do-space` em `TRIPOSR_SPACE_ID` no `.env.local` e no ambiente Production da Vercel. Não é necessário token HF no portal.

Revisão publicada em 15/11/2026: `751c2a7`. A página do Space e a configuração Gradio responderam HTTP 200 após a publicação; a inferência não foi executada nessa atualização para preservar a cota diária gratuita.

Para hospedar ZeroGPU em conta pessoal gratuita, a Hugging Face exige conta em situação regular, e-mail verificado e mais de 30 dias de existência; a conta pode hospedar até dois Spaces ZeroGPU. O portal chama o Space sem autenticação Hugging Face: a documentação informa atualmente uma cota de 2 minutos de GPU por dia para chamadas sem autenticação. A cota reinicia 24 horas após o primeiro uso; fila, disponibilidade e limites podem mudar. Consulte [Spaces ZeroGPU](https://huggingface.co/docs/hub/spaces-zerogpu).

O código versionado do Space limita o upload a 5 MiB e limpa o cache de imagens enviadas e resultados após 24 horas, em verificações horárias. Arquivos em cache são acessíveis por URL a quem obtiver o link do Gradio; uma reinicialização do Space também pode removê-los antes desse prazo. Essas regras passam a valer quando a revisão é publicada pelo workflow e o Space volta a `Running`. Não envie conteúdo confidencial.

Para verificar a validação local das imagens: `python -m unittest discover -s . -p 'test_*.py'`.
