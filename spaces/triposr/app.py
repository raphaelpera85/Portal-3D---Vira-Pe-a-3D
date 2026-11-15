import os
import subprocess
import sys
import tempfile

import gradio as gr
import numpy as np
import rembg
import spaces
import torch
from PIL import Image

TSR_REVISION = "107cefdc244c39106fa830359024f6a2f1c78871"
TSR_DIR = "/tmp/TripoSR"
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000

if not os.path.exists(os.path.join(TSR_DIR, "tsr", "system.py")):
    subprocess.run(["git", "init", TSR_DIR], check=True)
    subprocess.run(["git", "-C", TSR_DIR, "remote", "add", "origin", "https://github.com/VAST-AI-Research/TripoSR.git"], check=True)
    subprocess.run(["git", "-C", TSR_DIR, "fetch", "--depth", "1", "origin", TSR_REVISION], check=True)
    subprocess.run(["git", "-C", TSR_DIR, "checkout", "FETCH_HEAD"], check=True)
sys.path.insert(0, TSR_DIR)

subprocess.run(
    [sys.executable, "-m", "pip", "install", "--no-build-isolation", "git+https://github.com/tatsy/torchmcubes.git@a9ac95aa329957ba646e7bb057f825f5dfa77f38"],
    env={**os.environ, "TORCH_CUDA_ARCH_LIST": "12.0+PTX"},
    check=True,
)

from tsr.system import TSR
from tsr.utils import remove_background, resize_foreground

device = "cuda:0" if torch.cuda.is_available() else "cpu"
model = TSR.from_pretrained("stabilityai/TripoSR", config_name="config.yaml", weight_name="model.ckpt")
model.renderer.set_chunk_size(131072)
model.to(device)
rembg_session = rembg.new_session()


def validate_image(path):
    if not path or not os.path.isfile(path):
        raise gr.Error("Envie uma imagem válida.")
    if os.path.getsize(path) > MAX_IMAGE_BYTES:
        raise gr.Error("A imagem deve ter até 5 MiB.")
    with Image.open(path) as image:
        if image.format not in ("PNG", "JPEG", "WEBP"):
            raise gr.Error("Use uma imagem PNG, JPEG ou WebP.")
        if image.width * image.height > MAX_IMAGE_PIXELS:
            raise gr.Error("A imagem excede o limite de resolução.")
        return image.convert("RGB")


def fill_background(image):
    pixels = np.asarray(image).astype(np.float32) / 255.0
    if pixels.shape[2] == 4:
        pixels = pixels[:, :, :3] * pixels[:, :, 3:4] + (1 - pixels[:, :, 3:4]) * 0.5
    return Image.fromarray((pixels[:, :, :3] * 255).astype(np.uint8))


@spaces.GPU(duration=120)
def generate(image_path):
    image = validate_image(image_path)
    image = resize_foreground(remove_background(image, rembg_session), 0.85)
    image = fill_background(image)
    scene_codes = model(image, device=device)
    mesh = model.extract_mesh(scene_codes, resolution=192)[0]
    mesh_path = tempfile.NamedTemporaryFile(suffix=".glb", delete=False).name
    mesh.export(mesh_path)
    return mesh_path, mesh_path


with gr.Blocks(title="ViraPeça 3D · TripoSR") as demo:
    gr.Markdown("## Gere um rascunho 3D a partir de uma imagem\nO arquivo GLB é uma prévia inicial e precisa ser revisado antes de qualquer impressão 3D.")
    image = gr.Image(label="Imagem", type="filepath", sources=["upload"])
    submit = gr.Button("Gerar modelo", variant="primary")
    preview = gr.Model3D(label="Prévia 3D", interactive=False)
    download = gr.File(label="Baixar GLB", interactive=False)
    submit.click(generate, inputs=image, outputs=[preview, download], api_name="generate")

demo.queue(max_size=2).launch()
