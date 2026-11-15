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

Contas gratuitas precisam atender os critérios de elegibilidade da Hugging Face para hospedar ZeroGPU. A cota gratuita é pequena e compartilhada conforme autenticação/conta do usuário; fila e disponibilidade não são garantidas.
