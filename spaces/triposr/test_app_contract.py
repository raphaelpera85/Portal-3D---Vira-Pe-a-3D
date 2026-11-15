import ast
from pathlib import Path
import unittest


class AppContractTests(unittest.TestCase):
    def test_numpy_stays_compatible_with_the_pinned_trimesh_exporter(self):
        requirements = Path(__file__).with_name("requirements.txt").read_text()
        self.assertIn("numpy<2", requirements.splitlines())

    def test_extract_mesh_enables_vertex_colors_required_by_pinned_model_api(self):
        app = ast.parse(Path(__file__).with_name("app.py").read_text())
        calls = [
            node
            for node in ast.walk(app)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "extract_mesh"
        ]
        self.assertEqual(len(calls), 1)
        self.assertGreaterEqual(len(calls[0].args), 2)
        self.assertIs(calls[0].args[1].value, True)


if __name__ == "__main__":
    unittest.main()
