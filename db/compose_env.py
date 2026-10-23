"""Docker Compose env-file values.

Compose strips quotes and applies escapes before a value reaches a container.
A copy that keeps the quote characters does not match the password Postgres stored.
"""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import quote as url_quote


def quote(value: str) -> str:
    """Double-quoted Compose value that load() reads back as value."""
    escaped = (
        value.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t")
        .replace("$", "$$")
    )
    return f'"{escaped}"'


def postgres_uri(user: str, password: str, host: str, port: str, database: str) -> str:
    """Connection URI whose decoded password is the literal role password."""
    encoded = url_quote(password, safe="")
    return f"postgres://{user}:{encoded}@{host}:{port}/{database}"


def load(path: str | Path, environ: dict[str, str] | None = None) -> dict[str, str]:
    source = os.environ if environ is None else environ
    text = Path(path).read_text()
    values: dict[str, str] = {}

    def lookup(name: str) -> tuple[bool, str]:
        if name in source:
            return True, source[name]
        if name in values:
            return True, values[name]
        return False, ""

    lines = text.splitlines()
    index = 0
    while index < len(lines):
        raw_line = lines[index]
        index += 1
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        key, raw = _split_assignment(line)
        if key is None:
            continue
        value, index = _parse_value(raw, lines, index, lookup)
        values[key] = value
    return values


def _split_assignment(line: str) -> tuple[str | None, str]:
    candidates = [i for i in (line.find("="), line.find(":")) if i != -1]
    if not candidates:
        return None, ""
    idx = min(candidates)
    key = line[:idx].strip()
    if not key:
        return None, ""
    return key, line[idx + 1 :]


def _parse_value(
    raw: str,
    lines: list[str],
    index: int,
    lookup,
) -> tuple[str, int]:
    raw = raw.lstrip()
    if raw.startswith("'"):
        return _parse_single(raw[1:], lines, index)
    if raw.startswith('"'):
        return _parse_double(raw[1:], lookup), index
    return _interpolate(_strip_plain_comment(raw), lookup), index


def _strip_plain_comment(raw: str) -> str:
    comment = raw.find(" #")
    if comment != -1:
        raw = raw[:comment]
    return raw.rstrip()


def _parse_single(body: str, lines: list[str], index: int) -> tuple[str, int]:
    chunks: list[str] = []
    while True:
        value, closed = _scan_single(body)
        chunks.append(value)
        if closed:
            return "".join(chunks), index
        if index >= len(lines):
            raise SystemExit("unclosed quote in env file")
        body = "\n" + lines[index]
        index += 1


def _scan_single(body: str) -> tuple[str, bool]:
    out: list[str] = []
    i = 0
    while i < len(body):
        ch = body[i]
        if ch == "\\" and i + 1 < len(body) and body[i + 1] in "\\'":
            out.append(body[i + 1])
            i += 2
            continue
        if ch == "'":
            return "".join(out), True
        out.append(ch)
        i += 1
    return "".join(out), False


def _parse_double(body: str, lookup) -> str:
    out: list[str] = []
    i = 0
    escapes = {"n": "\n", "r": "\r", "t": "\t", "\\": "\\", '"': '"', "'": "'"}
    while i < len(body):
        ch = body[i]
        if ch == "\\":
            if i + 1 >= len(body):
                out.append("\\")
                break
            nxt = body[i + 1]
            if nxt in escapes:
                out.append(escapes[nxt])
            else:
                out.append("\\")
                out.append(nxt)
            i += 2
            continue
        if ch == "$":
            expanded, i = _parse_dollar(body, i, lookup)
            out.append(expanded)
            continue
        if ch == '"':
            return "".join(out)
        out.append(ch)
        i += 1
    raise SystemExit("unclosed double quote in env file")


def _interpolate(value: str, lookup) -> str:
    out: list[str] = []
    i = 0
    while i < len(value):
        if value[i] != "$":
            out.append(value[i])
            i += 1
            continue
        expanded, i = _parse_dollar(value, i, lookup)
        out.append(expanded)
    return "".join(out)


def _parse_dollar(value: str, i: int, lookup) -> tuple[str, int]:
    if i + 1 < len(value) and value[i + 1] == "$":
        return "$", i + 2
    if i + 1 < len(value) and value[i + 1] == "{":
        end = value.find("}", i + 2)
        if end == -1:
            return value[i:], len(value)
        return _expand_expr(value[i + 2 : end], lookup), end + 1
    if i + 1 < len(value) and (value[i + 1].isalpha() or value[i + 1] == "_"):
        j = i + 2
        while j < len(value) and (value[j].isalnum() or value[j] == "_"):
            j += 1
        found, resolved = lookup(value[i + 1 : j])
        return (resolved if found else ""), j
    return "$", i + 1


def _expand_expr(expr: str, lookup) -> str:
    if not expr or not (expr[0].isalpha() or expr[0] == "_"):
        return ""
    i = 1
    while i < len(expr) and (expr[i].isalnum() or expr[i] == "_"):
        i += 1
    name = expr[:i]
    rest = expr[i:]
    op = None
    operand = ""
    for candidate in (":-", ":?", ":+", "-", "?", "+"):
        if rest.startswith(candidate):
            op = candidate
            operand = rest[len(candidate) :]
            break
    if op is None and rest:
        return ""
    found, value = lookup(name)
    if op is None:
        return value if found else ""
    if op == ":-":
        return value if found and value != "" else operand
    if op == "-":
        return value if found else operand
    if op == ":?":
        if found and value != "":
            return value
        raise SystemExit(operand or f"{name} is unset or empty")
    if op == "?":
        if found:
            return value
        raise SystemExit(operand or f"{name} is unset")
    if op == ":+":
        return operand if found and value != "" else ""
    if op == "+":
        return operand if found else ""
    return ""
