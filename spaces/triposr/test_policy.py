import unittest

from policy import validate_image_metadata, validate_image_size


class ImagePolicyTest(unittest.TestCase):
    def test_accepts_supported_image_at_limits(self):
        validate_image_size(5 * 1024 * 1024)
        validate_image_metadata("PNG", 5000, 4000)

    def test_rejects_oversized_file(self):
        with self.assertRaisesRegex(ValueError, "5 MiB"):
            validate_image_size(5 * 1024 * 1024 + 1)

    def test_rejects_unsupported_format(self):
        with self.assertRaisesRegex(ValueError, "PNG, JPEG ou WebP"):
            validate_image_metadata("GIF", 100, 100)

    def test_rejects_oversized_or_invalid_dimensions(self):
        with self.assertRaisesRegex(ValueError, "resolução"):
            validate_image_metadata("JPEG", 5001, 4000)
        with self.assertRaisesRegex(ValueError, "resolução"):
            validate_image_metadata("WEBP", 0, 10)


if __name__ == "__main__":
    unittest.main()
