from hashlib import sha256

from data.generate_dataset import DATASET_NAME, generate_dataset


def test_generator_is_byte_reproducible(tmp_path):
    first = generate_dataset(tmp_path / "one")
    second = generate_dataset(tmp_path / "two")

    assert (tmp_path / "one" / DATASET_NAME).read_bytes() == (tmp_path / "two" / DATASET_NAME).read_bytes()
    assert first["sha256"] == second["sha256"]
    assert first["sha256"] == sha256((tmp_path / "one" / DATASET_NAME).read_bytes()).hexdigest()
