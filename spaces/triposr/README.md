---
title: ViraPeça 3D · TripoSR
emoji: 🧊
colorFrom: blue
colorTo: indigo
sdk: gradio
python_version: 3.10.13
app_file: app.py
---

# ViraPeça 3D · geração de rascunho 3D

Space Gradio usado pela página `/gerar-modelo`. O código do TripoSR e os pesos são licenciados sob MIT por Stability AI e Tripo AI; consulte o [repositório](https://github.com/VAST-AI-Research/TripoSR) e o [model card](https://huggingface.co/stabilityai/TripoSR).

## Publicar

1. Crie um Space público com SDK **Gradio** na sua conta Hugging Face.
2. Nas configurações do Space, selecione o hardware **ZeroGPU**. A sugestão no README não seleciona hardware automaticamente.
3. Envie o conteúdo desta pasta para a branch `main` do repositório Git do Space.
4. Aguarde o Space ficar `Running` e copie o identificador `conta/nome-do-space`.
5. Defina esse identificador em `TRIPOSR_SPACE_ID` no `.env.local` e no ambiente Production da Vercel. Não é necessário token HF no portal.

Para hospedar ZeroGPU em conta pessoal gratuita, a Hugging Face exige conta em situação regular, e-mail verificado e mais de 30 dias de existência; a conta pode hospedar até dois Spaces ZeroGPU. O portal chama o Space sem autenticação Hugging Face: a documentação informa atualmente uma cota de 2 minutos de GPU por dia para chamadas sem autenticação. A cota reinicia 24 horas após o primeiro uso; fila, disponibilidade e limites podem mudar. Consulte [Spaces ZeroGPU](https://huggingface.co/docs/hub/spaces-zerogpu).

Para verificar a validação local das imagens: `python -m unittest discover -s . -p 'test_*.py'`.
