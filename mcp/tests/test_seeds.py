"""Specs for the seed record schema and loader (Ticket 1.1)."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml
from pydantic import ValidationError

from qoq_mcp.seeds import Example, PatternRecord, SeedError, load_seeds


def _example(after_count: int = 1) -> dict:
    return {
        "before": {"lang": "ts", "code": "before code"},
        "after": [
            {"lang": "ts", "code": f"after code {i}", "note": None}
            for i in range(after_count)
        ],
        "note": None,
    }


def _index_entry(order: int = 1) -> dict:
    return {"order": order, "smell": "smell", "cost": "cost", "cheaper": "cheaper"}


def _record_data(**overrides) -> dict:
    data = {
        "slug": "strategy",
        "stack": "base",
        "title": "Strategy",
        "intro": "intro text",
        "smell": "smell text",
        "cheaper": "cheaper text",
        "cost": "cost text",
        "wrong_call": "wrong call text",
        "further_reading": "further reading text",
        "examples": [_example()],
        "index_entries": [_index_entry()],
    }
    data.update(overrides)
    return data


def _write_yaml(directory: Path, name: str, data: dict) -> Path:
    path = directory / name
    path.write_text(yaml.safe_dump(data), encoding="utf-8")
    return path


def test_load_seeds_unknown_key_raises_seed_error_with_path_and_field(tmp_path):
    data = _record_data()
    data["smel"] = "typo"
    path = _write_yaml(tmp_path, "provider.yaml", data)

    with pytest.raises(SeedError) as exc_info:
        load_seeds(tmp_path)

    message = str(exc_info.value)
    assert str(path) in message
    assert "smel" in message


def test_load_seeds_missing_key_raises_seed_error_with_path_and_field(tmp_path):
    data = _record_data()
    del data["intro"]
    path = _write_yaml(tmp_path, "provider.yaml", data)

    with pytest.raises(SeedError) as exc_info:
        load_seeds(tmp_path)

    message = str(exc_info.value)
    assert str(path) in message
    assert "intro" in message


def test_base_record_derives_name_and_asset_path():
    record = PatternRecord(**_record_data(stack="base", slug="strategy"))

    assert record.name == "strategy"
    assert record.asset_path == "assets/patterns/strategy.md"


def test_react_record_derives_name_and_asset_path():
    record = PatternRecord(**_record_data(stack="react", slug="provider"))

    assert record.name == "react/provider"
    assert record.asset_path == "assets/patterns/react/provider.md"


def test_record_with_empty_examples_fails_validation():
    with pytest.raises(ValidationError):
        PatternRecord(**_record_data(examples=[]))


def test_record_with_empty_index_entries_fails_validation():
    with pytest.raises(ValidationError):
        PatternRecord(**_record_data(index_entries=[]))


def test_example_with_empty_after_fails_validation():
    with pytest.raises(ValidationError):
        Example(before={"lang": "ts", "code": "x"}, after=[], note=None)


def test_load_seeds_loads_valid_base_and_react_files(tmp_path):
    react_dir = tmp_path / "react"
    react_dir.mkdir()
    _write_yaml(tmp_path, "strategy.yaml", _record_data(slug="strategy", stack="base"))
    _write_yaml(react_dir, "provider.yaml", _record_data(slug="provider", stack="react"))

    records = {record.name: record for record in load_seeds(tmp_path)}

    assert records["strategy"].asset_path == "assets/patterns/strategy.md"
    assert records["react/provider"].asset_path == "assets/patterns/react/provider.md"


def test_load_seeds_raises_before_returning_when_one_file_invalid(tmp_path):
    valid_data = _record_data(slug="valid", stack="base")
    _write_yaml(tmp_path, "valid.yaml", valid_data)

    invalid_data = _record_data(slug="broken", stack="base")
    del invalid_data["cost"]
    _write_yaml(tmp_path, "broken.yaml", invalid_data)

    with pytest.raises(SeedError):
        load_seeds(tmp_path)
