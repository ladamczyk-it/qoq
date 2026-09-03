"""Seed record schema and loader for pattern YAML files."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError


class SeedError(Exception):
    """Raised when a seed YAML file fails to load or validate."""


class CodeBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lang: str
    code: str


class AfterBlock(CodeBlock):
    note: str | None = None


class Example(BaseModel):
    model_config = ConfigDict(extra="forbid")

    before: CodeBlock
    after: list[AfterBlock] = Field(min_length=1)
    note: str | None = None


class IndexEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order: int
    smell: str
    cost: str
    cheaper: str


class PatternRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: str
    stack: Literal["base", "react"]
    title: str
    aliases: list[str] = Field(default_factory=list)
    intro: str
    smell: str
    cheaper: str
    cost: str
    wrong_call: str
    further_reading: str
    examples: list[Example] = Field(min_length=1)
    index_entries: list[IndexEntry] = Field(min_length=1)

    @property
    def name(self) -> str:
        if self.stack == "base":
            return self.slug
        return f"{self.stack}/{self.slug}"

    @property
    def asset_path(self) -> str:
        if self.stack == "base":
            return f"assets/patterns/{self.slug}.md"
        return f"assets/patterns/{self.stack}/{self.slug}.md"


def _validation_error_to_seed_error(path: Path, error: ValidationError) -> SeedError:
    # Prefer an "extra field" or "missing field" error if one is present, since
    # those are the two shapes the contract's message format names explicitly.
    for err in error.errors():
        field = str(err["loc"][-1]) if err["loc"] else "<root>"
        if err["type"] == "extra_forbidden":
            return SeedError(f"{path}: unknown field '{field}'")
        if err["type"] == "missing":
            return SeedError(f"{path}: missing required field '{field}'")

    first = error.errors()[0]
    field = str(first["loc"][-1]) if first["loc"] else "<root>"
    return SeedError(f"{path}: {first['msg']} ({field})")


def load_seeds(root: Path) -> list[PatternRecord]:
    """Load and validate every seed YAML file under `root`.

    Every file is read and validated before any record is returned to the
    caller — a `SeedError` on one file aborts the whole load rather than
    handing back a partial corpus.
    """
    records: list[PatternRecord] = []
    for path in sorted(Path(root).rglob("*.yaml")):
        with path.open("r", encoding="utf-8") as handle:
            data = yaml.safe_load(handle)
        try:
            records.append(PatternRecord(**(data or {})))
        except ValidationError as error:
            raise _validation_error_to_seed_error(path, error) from error
    return records
