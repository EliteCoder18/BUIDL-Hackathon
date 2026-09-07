"""Regression tests for the module entry point used by the demo launcher."""
import subprocess
import sys


def test_risk_service_imports_as_a_package_module():
    result = subprocess.run(
        [sys.executable, "-c", "import services.ml.app"],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
