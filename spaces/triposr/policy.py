MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
ACCEPTED_IMAGE_FORMATS = {"PNG", "JPEG", "WEBP"}


def validate_image_size(file_size):
    if file_size <= 0 or file_size > MAX_IMAGE_BYTES:
        raise ValueError("A imagem deve ter até 5 MiB.")


def validate_image_metadata(image_format, width, height):
    if image_format not in ACCEPTED_IMAGE_FORMATS:
        raise ValueError("Use uma imagem PNG, JPEG ou WebP.")
    if width <= 0 or height <= 0 or width * height > MAX_IMAGE_PIXELS:
        raise ValueError("A imagem excede o limite de resolução.")
