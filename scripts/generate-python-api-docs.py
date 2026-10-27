#!/usr/bin/env python3
"""Generate the Fumadocs Python & OpenAPI reference from backend AST, Google docstrings, and Flasgger YAML specs.

Combines:
1. Python AST inspection (classes, Pydantic schemas, dataclasses, functions, type annotations, defaults).
2. Google-style docstring parsing (`Args:`, `Returns:`, `Yields:`, `Raises:`, `Example:`).
3. Flask route & `@swag_from` OpenAPI YAML resolution (`backend/API_docs/*.yml`), rendered with native
   Fumadocs UI components (`<TypeTable>`, `<Tabs>`, `<Tab>`).

Also lints the backend to enforce:
- Uniform Google-style docstrings (no NumPy `----` underlines).
- Docstrings on every public class and function in curated backend modules.
- Valid Python syntax in every `Example:` / `Examples:` fenced code block.
- Valid, non-orphaned Flasgger YAML files for every `@swag_from` decorator.
"""

from __future__ import annotations

import ast
import json
import re
import sys
import textwrap
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT / "backend"
API_DOCS_DIR = BACKEND_DIR / "API_docs"
OUTPUT_DIR = ROOT / "content" / "docs" / "developer-guide" / "api" / "python"

# Ensure PyYAML from backend/.venv is importable even when invoked via system python3
for venv_site in sorted((BACKEND_DIR / ".venv").glob("lib/python*/site-packages")) + sorted(
    (BACKEND_DIR / ".venv").glob("Lib/site-packages")
):
    if str(venv_site) not in sys.path:
        sys.path.insert(0, str(venv_site))

import yaml  # noqa: E402

# Blueprint URL prefixes registered in backend/index.py
BLUEPRINT_PREFIXES: dict[str, str] = {
    "app": "",
    "route_getDataFromDB": "/api/getDataFromDB",
    "route_getColumnNamesDB": "/api/getColumnNamesDB",
    "route_getListOfRelationsDB": "/api/getListOfRelationsDB",
    "route_setFilesToDB": "/api/setFilesToDB",
    "route_setEntryToTable": "/api/setEntryToTable",
    "route_processData": "/api/processData",
    "route_columnMetadata": "/api/columnMetadata",
    "route_manageDB": "/api/manageDB",
}

# Curated module groups rendered into the developer guide Python API reference.
MODULE_GROUPS: list[tuple[str, str, str, list[str]]] = [
    (
        "core",
        "Core & Infrastructure",
        "Flask entry point, multi-worker response cache, Redis upload state, and Gunicorn worker lifecycle.",
        [
            "backend/index.py",
            "backend/types.py",
            "backend/schemas/common.py",
            "backend/cache.py",
            "backend/metadata_utils.py",
            "backend/upload_request.py",
            "backend/upload_state.py",
            "backend/gunicorn.conf.py",
        ],
    ),
    (
        "query-routes",
        "Database Query Routes",
        "Read-only endpoints for tabular queries, aggregations, compact map grids, column names, and relation discovery.",
        [
            "backend/routes/getDataFromDB/route_getDataFromDB.py",
            "backend/routes/getDataFromDB/route_getColumnNamesDB.py",
            "backend/routes/getDataFromDB/route_getListOfRelationsDB.py",
        ],
    ),
    (
        "upload-pipeline",
        "CSV Upload & Ingestion",
        "Streaming CSV header/row parsing, SQL type inference, transactional table replacement, and PostgreSQL COPY.",
        [
            "backend/routes/setFilesToDB/route_setFilesToDB.py",
            "backend/routes/setFilesToDB/uploadFileToDB.py",
            "backend/routes/setFilesToDB/db_utils.py",
            "backend/routes/setFilesToDB/createTable.py",
            "backend/routes/setFilesToDB/insertData.py",
            "backend/routes/setFilesToDB/parseCSVdata.py",
        ],
    ),
    (
        "processing-analytics",
        "Spatial Processing & Uncertainty",
        "Spatial point-to-country assignment, ENSO suitability panels, and UQ calibration/SVG rendering.",
        [
            "backend/routes/processData/route_processData.py",
            "backend/routes/processData/assignGeoPosToCountry.py",
            "backend/routes/processData/aggregateRKIdata.py",
            "backend/routes/processData/ensoSuitability.py",
            "backend/routes/processData/enso_schema.py",
            "backend/routes/processData/uncertaintyVis.py",
            "backend/routes/processData/geo_utils.py",
            "backend/routes/processData/svg_utils.py",
        ],
    ),
    (
        "metadata-admin",
        "Column Metadata & Administration",
        "Localized per-column metadata management, relation administration, and single-cell updates.",
        [
            "backend/routes/columnMetadata/route_columnMetadata.py",
            "backend/routes/manageDB/route_manageDB.py",
            "backend/routes/setEntryToTable/route_setEntryToTable.py",
        ],
    ),
]

GOOGLE_SECTION_RE = re.compile(
    r"^(Args|Arguments|Parameters|Query Parameters|Returns|Yields|Raises|Attributes|Example|Examples):\s*$"
)
NUMPY_UNDERLINE_RE = re.compile(
    r"^(Parameters|Returns|Yields|Raises|Attributes|Notes|Examples)\s*\n\s*-{3,}\s*$",
    re.MULTILINE,
)
PYTHON_FENCE_RE = re.compile(r"```python\s*\n([\s\S]*?)```")


@dataclass
class ParamMeta:
    name: str
    annotation: str = "Any"
    default: str | None = None
    required: bool = True
    description: str = ""


@dataclass
class RouteMeta:
    methods: list[str]
    path: str
    yaml_file: str | None = None
    openapi: dict[str, Any] | None = None


@dataclass
class SymbolDoc:
    name: str
    kind: str  # "class" | "function" | "async_function"
    signature: str
    docstring: str
    decorators: list[str] = field(default_factory=list)
    params: list[ParamMeta] = field(default_factory=list)
    fields: list[ParamMeta] = field(default_factory=list)
    methods: list["SymbolDoc"] = field(default_factory=list)
    route: RouteMeta | None = None
    lineno: int = 0


def _clean_inline_rst(text: str) -> str:
    """Convert Sphinx double backticks ``foo`` to Markdown `foo`."""
    return re.sub(r"``([^`]+)``", r"`\1`", text)


def _escape_mdx_prose(text: str) -> str:
    """Escape curly braces and angle brackets outside fenced code blocks and inline code."""
    lines = text.splitlines()
    out: list[str] = []
    in_fence = False
    for line in lines:
        if line.strip().startswith("```"):
            in_fence = not in_fence
            out.append(line)
            continue
        if in_fence:
            out.append(line)
            continue
        line = _clean_inline_rst(line)
        parts = re.split(r"(`[^`]*`)", line)
        escaped_parts: list[str] = []
        for idx, part in enumerate(parts):
            if idx % 2 == 1:
                escaped_parts.append(part)
            else:
                escaped = (
                    part.replace("{", "\\{")
                    .replace("}", "\\}")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                )
                escaped_parts.append(escaped)
        out.append("".join(escaped_parts))
    return "\n".join(out)


def _extract_docstring_param_descriptions(docstring: str) -> dict[str, str]:
    """Extract parameter descriptions from Google-style `Args:` / `Parameters:` sections."""
    lines = docstring.splitlines()
    in_param_section = False
    in_fence = False
    descriptions: dict[str, str] = {}
    current_param: str | None = None

    for raw_line in lines:
        stripped = raw_line.strip()
        if stripped.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue

        sec_match = GOOGLE_SECTION_RE.match(stripped)
        if sec_match:
            sec_name = sec_match.group(1)
            in_param_section = sec_name in {
                "Args",
                "Arguments",
                "Parameters",
                "Query Parameters",
                "Attributes",
            }
            current_param = None
            continue

        if not in_param_section:
            continue

        if not stripped:
            in_param_section = False
            current_param = None
            continue

        m = re.match(r"^ {2,8}(\*{0,2}[\w_]+)(?:\s*\([^)]+\))?:\s*(.*)$", raw_line)
        if m:
            raw_name, desc = m.group(1), m.group(2).strip()
            clean_name = raw_name.lstrip("*")
            descriptions[clean_name] = _clean_inline_rst(desc)
            descriptions[raw_name] = _clean_inline_rst(desc)
            current_param = clean_name
        elif current_param and raw_line.startswith("      "):
            descriptions[current_param] += " " + _clean_inline_rst(stripped)

    return descriptions


def _format_google_docstring(docstring: str, *, omit_args_if_table: bool = False) -> str:
    """Convert a Google-style docstring into clean Markdown for Fumadocs MDX."""
    lines = docstring.splitlines()
    rendered: list[str] = []
    in_section: str | None = None
    in_fence = False

    i = 0
    while i < len(lines):
        raw_line = lines[i]
        stripped = raw_line.strip()

        if stripped.startswith("```"):
            in_fence = not in_fence
            rendered.append(stripped)
            i += 1
            continue

        if in_fence:
            rendered.append(re.sub(r"^ {1,8}", "", raw_line))
            i += 1
            continue

        section_match = GOOGLE_SECTION_RE.match(stripped)
        if section_match:
            in_section = section_match.group(1)
            if omit_args_if_table and in_section in {"Args", "Arguments", "Parameters"}:
                i += 1
                continue
            rendered.append("")
            rendered.append(f"**{in_section}**")
            rendered.append("")
            i += 1
            continue

        if omit_args_if_table and in_section in {"Args", "Arguments", "Parameters"}:
            if not stripped:
                in_section = None
            i += 1
            continue

        if in_section in {
            "Args",
            "Arguments",
            "Parameters",
            "Query Parameters",
            "Raises",
            "Attributes",
        }:
            if not stripped:
                in_section = None
                rendered.append("")
            elif re.match(r"^ {2,8}(\*{0,2}[\w_]+(?:\s*\([^)]+\))?):\s*(.*)$", raw_line):
                m = re.match(
                    r"^ {2,8}(\*{0,2}[\w_]+(?:\s*\([^)]+\))?):\s*(.*)$", raw_line
                )
                assert m is not None
                param_name, desc = m.group(1), m.group(2)
                rendered.append(f"- `{param_name}`: {_escape_mdx_prose(desc)}")
            elif raw_line.startswith("      ") and rendered and rendered[-1].startswith("- "):
                rendered[-1] += " " + _escape_mdx_prose(stripped)
            else:
                rendered.append(_escape_mdx_prose(stripped))
        elif in_section in {"Returns", "Yields"}:
            if not stripped:
                in_section = None
                rendered.append("")
            else:
                rendered.append(_escape_mdx_prose(stripped))
        elif in_section in {"Example", "Examples"}:
            rendered.append(_escape_mdx_prose(raw_line.lstrip()))
        else:
            rendered.append(_escape_mdx_prose(raw_line))
        i += 1

    return "\n".join(rendered).strip()


def _extract_ast_params(
    node: ast.FunctionDef | ast.AsyncFunctionDef, doc_descriptions: dict[str, str]
) -> list[ParamMeta]:
    """Extract typed parameters and defaults from a Python function definition."""
    params: list[ParamMeta] = []
    args = node.args

    pos_args = list(args.posonlyargs) + list(args.args)
    num_defaults = len(args.defaults)
    default_start = len(pos_args) - num_defaults

    for idx, arg in enumerate(pos_args):
        if arg.arg in {"self", "cls"}:
            continue
        ann = ast.unparse(arg.annotation) if arg.annotation else "Any"
        has_default = idx >= default_start
        default_val = (
            ast.unparse(args.defaults[idx - default_start]) if has_default else None
        )
        params.append(
            ParamMeta(
                name=arg.arg,
                annotation=ann,
                default=default_val,
                required=not has_default,
                description=doc_descriptions.get(arg.arg, ""),
            )
        )

    if args.vararg:
        name = f"*{args.vararg.arg}"
        ann = ast.unparse(args.vararg.annotation) if args.vararg.annotation else "Any"
        params.append(
            ParamMeta(
                name=name,
                annotation=ann,
                default=None,
                required=False,
                description=doc_descriptions.get(args.vararg.arg, doc_descriptions.get(name, "")),
            )
        )

    for idx, kwarg in enumerate(args.kwonlyargs):
        ann = ast.unparse(kwarg.annotation) if kwarg.annotation else "Any"
        kw_default_node = args.kw_defaults[idx]
        has_default = kw_default_node is not None
        default_val = ast.unparse(kw_default_node) if kw_default_node is not None else None
        params.append(
            ParamMeta(
                name=kwarg.arg,
                annotation=ann,
                default=default_val,
                required=not has_default,
                description=doc_descriptions.get(kwarg.arg, ""),
            )
        )

    if args.kwarg:
        name = f"**{args.kwarg.arg}"
        ann = ast.unparse(args.kwarg.annotation) if args.kwarg.annotation else "Any"
        params.append(
            ParamMeta(
                name=name,
                annotation=ann,
                default=None,
                required=False,
                description=doc_descriptions.get(args.kwarg.arg, doc_descriptions.get(name, "")),
            )
        )

    return params


def _extract_route_meta(
    decorators: list[ast.expr],
    errors: list[str],
    rel_path: str,
    referenced_yamls: set[str],
) -> RouteMeta | None:
    methods: list[str] = []
    full_path: str | None = None
    yaml_file: str | None = None

    for dec in decorators:
        if not isinstance(dec, ast.Call):
            continue
        func_str = ast.unparse(dec.func)

        # Match @app.route(...) or @route_*.route(...)
        if func_str.endswith(".route"):
            bp_name = func_str.split(".")[0]
            prefix = BLUEPRINT_PREFIXES.get(bp_name, "")
            subpath = ""
            if dec.args and isinstance(dec.args[0], ast.Constant) and isinstance(dec.args[0].value, str):
                subpath = dec.args[0].value
            full_path = f"{prefix}{subpath}" or "/"
            methods = ["GET"]
            for kw in dec.keywords:
                if kw.arg == "methods" and isinstance(kw.value, (ast.List, ast.Tuple)):
                    methods = [
                        elt.value
                        for elt in kw.value.elts
                        if isinstance(elt, ast.Constant) and isinstance(elt.value, str)
                    ]

        # Match @swag_from(...)
        elif func_str == "swag_from" and dec.args:
            arg0 = dec.args[0]
            raw_target = ast.unparse(arg0)
            m = re.search(r"([A-Za-z0-9_]+\.ya?ml)", raw_target)
            if m:
                yaml_file = m.group(1)
                referenced_yamls.add(yaml_file)

    if full_path is None and yaml_file is None:
        return None

    openapi_data: dict[str, Any] | None = None
    if yaml_file:
        yaml_path = API_DOCS_DIR / yaml_file
        if not yaml_path.exists():
            errors.append(f"{rel_path}: @swag_from references missing YAML file '{yaml_file}'")
        else:
            try:
                openapi_data = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
            except Exception as exc:
                errors.append(f"{rel_path}: failed to parse '{yaml_file}': {exc}")

    return RouteMeta(
        methods=methods or ["GET"],
        path=full_path or "/",
        yaml_file=yaml_file,
        openapi=openapi_data,
    )


def _render_type_table(items: list[ParamMeta]) -> list[str]:
    """Render a Fumadocs `<TypeTable>` JSX component from parameter/field metadata."""
    if not items:
        return []
    table_obj: dict[str, dict[str, Any]] = {}
    for item in items:
        entry: dict[str, Any] = {
            "type": item.annotation,
            "required": item.required,
        }
        if item.description:
            entry["description"] = item.description
        if item.default is not None:
            entry["default"] = item.default
        table_obj[item.name] = entry

    json_payload = json.dumps(table_obj, ensure_ascii=False)
    return [f"<TypeTable type={{{json_payload}}} />", ""]


def _schema_to_example_obj(schema: dict[str, Any]) -> Any:
    """Synthesize a concise example JSON value from an OpenAPI/Flasgger schema block."""
    if not isinstance(schema, dict):
        return None
    if "example" in schema:
        return schema["example"]
    schema_type = schema.get("type")
    if schema_type == "object" or "properties" in schema:
        props = schema.get("properties", {})
        result: dict[str, Any] = {}
        for k, v in props.items():
            if isinstance(v, dict):
                ex = _schema_to_example_obj(v)
                result[k] = ex if ex is not None else f"<{v.get('type', 'value')}>"
        return result
    if schema_type == "array":
        items_schema = schema.get("items", {})
        item_ex = _schema_to_example_obj(items_schema)
        return [item_ex] if item_ex is not None else []
    if "default" in schema:
        return schema["default"]
    if "enum" in schema and isinstance(schema["enum"], list) and schema["enum"]:
        return schema["enum"][0]
    return None


def _render_openapi_section(route: RouteMeta) -> list[str]:
    """Render the Flask OpenAPI contract (`@swag_from`) using Fumadocs `<TypeTable>` and `<Tabs>`."""
    lines: list[str] = []
    methods_badge = " | ".join(f"`{m}`" for m in route.methods)
    spec = route.openapi or {}
    summary = spec.get("summary", "")
    tags = spec.get("tags", [])
    tag_suffix = f" ({', '.join(tags)})" if tags else ""

    lines.append(
        f"**HTTP Endpoint:** {methods_badge} `{route.path}`"
        + (f" — {_escape_mdx_prose(summary)}{_escape_mdx_prose(tag_suffix)}" if summary else "")
    )
    lines.append("")

    if route.yaml_file:
        lines.append(f"*OpenAPI Specification:* `backend/API_docs/{route.yaml_file}`")
        lines.append("")

    # Render OpenAPI parameters as a Fumadocs <TypeTable>
    raw_params = spec.get("parameters", [])
    if isinstance(raw_params, list) and raw_params:
        oa_params: list[ParamMeta] = []
        body_schema_example: Any = None
        for p in raw_params:
            if not isinstance(p, dict):
                continue
            pname = str(p.get("name", "param"))
            pin = str(p.get("in", "query"))
            preq = bool(p.get("required", False))
            pdesc = str(p.get("description", "")).strip()
            pschema = p.get("schema", {}) if isinstance(p.get("schema"), dict) else {}
            ptype = str(p.get("type") or pschema.get("type") or "object")
            if pschema.get("enum"):
                enum_vals = " | ".join(repr(v) for v in pschema["enum"])
                ptype = f"{ptype} ({enum_vals})"
            pdefault_val = p.get("default", pschema.get("default"))
            pdefault = repr(pdefault_val) if pdefault_val is not None else None
            pexample = p.get("example", pschema.get("example"))
            if pexample is not None and pdefault is None:
                pdesc = f"{pdesc} (Example: `{pexample}`)".strip()

            if pin == "body" and pschema:
                body_schema_example = _schema_to_example_obj(pschema)

            oa_params.append(
                ParamMeta(
                    name=f"{pname} ({pin})",
                    annotation=ptype,
                    default=pdefault,
                    required=preq,
                    description=_clean_inline_rst(pdesc),
                )
            )

        lines.append("**OpenAPI Request Parameters**")
        lines.append("")
        lines.extend(_render_type_table(oa_params))

        if body_schema_example is not None:
            lines.append("**Request Body Schema Example**")
            lines.append("")
            lines.append("```json")
            lines.append(json.dumps(body_schema_example, indent=2, ensure_ascii=False))
            lines.append("```")
            lines.append("")

    # Render OpenAPI responses as Fumadocs <Tabs> / <Tab>
    responses = spec.get("responses", {})
    if isinstance(responses, dict) and responses:
        tab_items = [f"HTTP {code}" for code in responses.keys()]
        lines.append("**OpenAPI Responses**")
        lines.append("")
        lines.append(f"<Tabs items={{{json.dumps(tab_items)}}}>")
        for code, resp_obj in responses.items():
            tab_label = f"HTTP {code}"
            lines.append(f"<Tab value={json.dumps(tab_label)}>")
            lines.append("")
            if isinstance(resp_obj, dict):
                rdesc = str(resp_obj.get("description", "")).strip()
                if rdesc:
                    lines.append(_escape_mdx_prose(rdesc))
                    lines.append("")
                content_map = resp_obj.get("content", {})
                if isinstance(content_map, dict):
                    for mime, mime_obj in content_map.items():
                        lines.append(f"- **Content-Type:** `{mime}`")
                        if isinstance(mime_obj, dict) and isinstance(mime_obj.get("schema"), dict):
                            ex_obj = _schema_to_example_obj(mime_obj["schema"])
                            if ex_obj is not None:
                                lines.append("")
                                lang = "json" if "json" in mime else "text"
                                lines.append(f"```{lang}")
                                if isinstance(ex_obj, (dict, list)):
                                    lines.append(json.dumps(ex_obj, indent=2, ensure_ascii=False))
                                else:
                                    lines.append(str(ex_obj))
                                lines.append("```")
                        lines.append("")
                elif isinstance(resp_obj.get("schema"), dict):
                    ex_obj = _schema_to_example_obj(resp_obj["schema"])
                    if ex_obj is not None:
                        lines.append("```json")
                        lines.append(json.dumps(ex_obj, indent=2, ensure_ascii=False))
                        lines.append("```")
                        lines.append("")
            lines.append("</Tab>")
        lines.append("</Tabs>")
        lines.append("")

    return lines


def _format_signature(node: ast.FunctionDef | ast.AsyncFunctionDef) -> str:
    prefix = "async def" if isinstance(node, ast.AsyncFunctionDef) else "def"
    args_str = ast.unparse(node.args)
    ret_str = f" -> {ast.unparse(node.returns)}" if node.returns is not None else ""
    return f"{prefix} {node.name}({args_str}){ret_str}"


def _format_decorator(dec: ast.expr) -> str:
    return f"@{ast.unparse(dec)}"


def _parse_module(
    rel_path: str, errors: list[str], referenced_yamls: set[str]
) -> tuple[str, list[SymbolDoc]]:
    path = ROOT / rel_path
    source = path.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=rel_path)
    mod_doc = ast.get_docstring(tree) or ""

    if not mod_doc:
        errors.append(f"{rel_path}: missing module docstring")

    symbols: list[SymbolDoc] = []

    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            doc = ast.get_docstring(node) or ""
            is_public = not node.name.startswith("_")
            if is_public and not doc:
                errors.append(
                    f"{rel_path}:{node.lineno}: public class '{node.name}' is missing a docstring"
                )
            if not doc:
                continue

            doc_descriptions = _extract_docstring_param_descriptions(doc)
            bases = [ast.unparse(b) for b in node.bases]
            base_suffix = f"({', '.join(bases)})" if bases else ""
            fields: list[ParamMeta] = []
            methods: list[SymbolDoc] = []

            for idx, item in enumerate(node.body):
                if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                    field_type = ast.unparse(item.annotation)
                    has_default = item.value is not None
                    default_str = ast.unparse(item.value) if item.value is not None else None
                    attr_doc = ""
                    if idx + 1 < len(node.body):
                        next_item = node.body[idx + 1]
                        if (
                            isinstance(next_item, ast.Expr)
                            and isinstance(next_item.value, ast.Constant)
                            and isinstance(next_item.value.value, str)
                        ):
                            attr_doc = next_item.value.value.strip()
                    desc = doc_descriptions.get(item.target.id, "") or attr_doc
                    fields.append(
                        ParamMeta(
                            name=item.target.id,
                            annotation=field_type,
                            default=default_str,
                            required=not has_default,
                            description=desc,
                        )
                    )
                elif isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    m_doc = ast.get_docstring(item) or ""
                    if not item.name.startswith("_") and not m_doc:
                        errors.append(
                            f"{rel_path}:{item.lineno}: public method '{node.name}.{item.name}' is missing a docstring"
                        )
                    if m_doc or not item.name.startswith("_"):
                        m_desc = _extract_docstring_param_descriptions(m_doc)
                        methods.append(
                            SymbolDoc(
                                name=item.name,
                                kind="async_function"
                                if isinstance(item, ast.AsyncFunctionDef)
                                else "function",
                                signature=_format_signature(item),
                                docstring=m_doc,
                                decorators=[_format_decorator(d) for d in item.decorator_list],
                                params=_extract_ast_params(item, m_desc),
                                lineno=item.lineno,
                            )
                        )

            symbols.append(
                SymbolDoc(
                    name=node.name,
                    kind="class",
                    signature=f"class {node.name}{base_suffix}",
                    docstring=doc,
                    decorators=[_format_decorator(d) for d in node.decorator_list],
                    fields=fields,
                    methods=methods,
                    lineno=node.lineno,
                )
            )

        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            doc = ast.get_docstring(node) or ""
            is_public = not node.name.startswith("_")
            if is_public and not doc:
                errors.append(
                    f"{rel_path}:{node.lineno}: public function '{node.name}' is missing a docstring"
                )
            if not doc:
                continue
            f_desc = _extract_docstring_param_descriptions(doc)
            route_meta = _extract_route_meta(
                node.decorator_list, errors, rel_path, referenced_yamls
            )
            symbols.append(
                SymbolDoc(
                    name=node.name,
                    kind="async_function"
                    if isinstance(node, ast.AsyncFunctionDef)
                    else "function",
                    signature=_format_signature(node),
                    docstring=doc,
                    decorators=[_format_decorator(d) for d in node.decorator_list],
                    params=_extract_ast_params(node, f_desc),
                    route=route_meta,
                    lineno=node.lineno,
                )
            )

    # Lint all docstrings in this module for NumPy underlines and example syntax
    for walk_node in ast.walk(tree):
        if isinstance(
            walk_node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)
        ):
            d = ast.get_docstring(walk_node)
            if not d:
                continue
            node_name = getattr(walk_node, "name", "<module>")
            if NUMPY_UNDERLINE_RE.search(d):
                errors.append(
                    f"{rel_path} ({node_name}): uses NumPy-style underline section header; use Google-style instead"
                )
            for match in PYTHON_FENCE_RE.finditer(d):
                snippet = textwrap.dedent(match.group(1)).strip()
                try:
                    ast.parse(snippet)
                except SyntaxError as exc:
                    errors.append(
                        f"{rel_path} ({node_name}): invalid Python syntax in @example/Example block: {exc}"
                    )

    return mod_doc, symbols


def _render_symbol(sym: SymbolDoc, heading_level: str = "###") -> list[str]:
    lines: list[str] = [f"{heading_level} `{sym.name}`", ""]

    if sym.route:
        lines.extend(_render_openapi_section(sym.route))

    lines.append("```python")
    for dec in sym.decorators:
        lines.append(dec)
    lines.append(sym.signature)
    lines.append("```")
    lines.append("")

    has_param_table = bool(sym.params)
    if sym.docstring:
        formatted_doc = _format_google_docstring(
            sym.docstring, omit_args_if_table=has_param_table
        )
        if formatted_doc:
            lines.append(formatted_doc)
            lines.append("")

    if sym.params:
        lines.append("**Parameters**")
        lines.append("")
        lines.extend(_render_type_table(sym.params))

    if sym.fields:
        lines.append("**Attributes & Schema Fields**")
        lines.append("")
        lines.extend(_render_type_table(sym.fields))

    for method in sym.methods:
        lines.append(f"#### `{sym.name}.{method.name}`")
        lines.append("")
        lines.append("```python")
        for dec in method.decorators:
            lines.append(dec)
        lines.append(method.signature)
        lines.append("```")
        lines.append("")
        has_m_params = bool(method.params)
        if method.docstring:
            formatted_mdoc = _format_google_docstring(
                method.docstring, omit_args_if_table=has_m_params
            )
            if formatted_mdoc:
                lines.append(formatted_mdoc)
                lines.append("")
        if method.params:
            lines.append("**Parameters**")
            lines.append("")
            lines.extend(_render_type_table(method.params))

    return lines


def main() -> int:
    errors: list[str] = []
    referenced_yamls: set[str] = set()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    group_pages: list[str] = ["index"]
    total_modules = 0
    total_symbols = 0
    discovered_routes: list[tuple[str, str, str, str, str]] = []
    covid_routes: list[tuple[str, str, str, str, str]] = []

    rendered_pages: dict[str, list[str]] = {}

    for slug, title, description, rel_paths in MODULE_GROUPS:
        group_pages.append(slug)
        page_lines: list[str] = [
            "---",
            f"title: {title}",
            f"description: {description}",
            "---",
            "",
            description,
            "",
        ]

        for rel_path in rel_paths:
            total_modules += 1
            mod_doc, symbols = _parse_module(rel_path, errors, referenced_yamls)
            total_symbols += len(symbols)
            guard_module = rel_path == "backend/routes/processData/aggregateRKIdata.py"
            if guard_module:
                page_lines.extend(["<ShowCovGuard>", ""])
            page_lines.append(
                f"<h2><code>{rel_path}</code></h2>" if guard_module else f"## `{rel_path}`"
            )
            page_lines.append("")
            if mod_doc:
                page_lines.append(_format_google_docstring(mod_doc))
                page_lines.append("")
            for sym in symbols:
                if sym.route:
                    methods_str = ", ".join(sym.route.methods)
                    summary_str = (
                        (sym.route.openapi or {}).get("summary")
                        or sym.docstring.splitlines()[0]
                    )
                    route_list = covid_routes if sym.name == "aggregate_rki" else discovered_routes
                    route_list.append(
                        (
                            methods_str,
                            sym.route.path,
                            sym.name,
                            slug,
                            summary_str,
                        )
                    )
                guard_symbol = sym.name in {"AggregateRkiParams", "aggregate_rki"}
                if guard_symbol:
                    page_lines.extend(["<ShowCovGuard>", ""])
                symbol_lines = _render_symbol(sym)
                if guard_symbol:
                    symbol_lines[0] = f'<h3 id="{sym.name.lower()}"><code>{sym.name}</code></h3>'
                page_lines.extend(symbol_lines)
                if guard_symbol:
                    page_lines.extend(["</ShowCovGuard>", ""])

            if guard_module:
                page_lines.extend(["</ShowCovGuard>", ""])

        rendered_pages[slug] = page_lines

    # Check for orphaned YAML files in backend/API_docs/
    existing_yamls = {p.name for p in API_DOCS_DIR.glob("*.yml")} | {
        p.name for p in API_DOCS_DIR.glob("*.yaml")
    }
    orphaned_yamls = sorted(existing_yamls - referenced_yamls)
    if orphaned_yamls:
        errors.append(
            f"Orphaned OpenAPI YAML files in backend/API_docs not referenced by @swag_from: {orphaned_yamls}"
        )

    index_lines: list[str] = [
        "---",
        "title: Python & OpenAPI",
        "description: Generated reference for Flask OpenAPI endpoints, Pydantic schemas, and Python backend pipelines.",
        "---",
        "",
        "**ICV Python & OpenAPI Reference**",
        "",
        "***",
        "",
        "Generated automatically from the Python AST, Google-style docstrings, and Flasgger OpenAPI specs (`backend/API_docs/*.yml`). Do not edit the generated `.mdx` files under `content/docs/developer-guide/api/python/` by hand — run `npm run docs:api` after changing backend docstrings, signatures, or OpenAPI YAML files.",
        "",
        "## Module Groups",
        "",
    ]

    for slug, title, description, _ in MODULE_GROUPS:
        index_lines.append(f"- [{title}](./{slug}) — {description}")

    index_lines.extend(
        [
            "",
            "## Flask OpenAPI Endpoints",
            "",
            "| Method | Endpoint Path | Handler | Summary |",
            "| :--- | :--- | :--- | :--- |",
        ]
    )
    for methods_str, route_path, handler_name, slug, summary_str in discovered_routes:
        anchor = handler_name.lower()
        index_lines.append(
            f"| `{methods_str}` | `{route_path}` | [`{handler_name}`](./{slug}#{anchor}) | {_escape_mdx_prose(summary_str)} |"
        )
    index_lines.append("")
    if covid_routes:
        index_lines.extend(["<ShowCovGuard>", "", "<h3>RKI aggregation endpoint</h3>", ""])
        for methods_str, route_path, handler_name, slug, summary_str in covid_routes:
            anchor = handler_name.lower()
            index_lines.append(
                f"- `{methods_str}` `{route_path}` — [`{handler_name}`](./{slug}#{anchor}): {_escape_mdx_prose(summary_str)}"
            )
        index_lines.extend(["", "</ShowCovGuard>", ""])

    for slug, page_lines in rendered_pages.items():
        (OUTPUT_DIR / f"{slug}.mdx").write_text(
            "\n".join(page_lines).rstrip() + "\n", encoding="utf-8"
        )

    (OUTPUT_DIR / "index.mdx").write_text(
        "\n".join(index_lines).rstrip() + "\n", encoding="utf-8"
    )

    meta_payload = {
        "title": "Python & OpenAPI",
        "pages": group_pages,
    }
    (OUTPUT_DIR / "meta.json").write_text(
        json.dumps(meta_payload, indent=2) + "\n", encoding="utf-8"
    )

    if errors:
        for err in errors:
            print(f"[python-api-docs] ERROR: {err}", file=sys.stderr)
        return 1

    print(
        f"[python-api-docs] Generated Python & OpenAPI reference from {total_modules} modules "
        f"({total_symbols} symbols, {len(discovered_routes)} HTTP routes, {len(referenced_yamls)} OpenAPI YAML specs)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
