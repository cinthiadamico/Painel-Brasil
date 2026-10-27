#!/usr/bin/env python3
"""Importa exportações JSON estruturadas de Claude Artifacts, sem sincronizar Claude.ai.

Entrada: imports/claude_artifacts/AAAA-MM-DD.json
Itens: title, url, source, summary? category? published_at?
Sem URL ou sem título/fonte = não importado. Nunca fabrica data de publicação.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "imports/claude_artifacts"
ARCHIVE = ROOT / "site/arquivo"


def valid_url(value):
    try:
        u = urlsplit(str(value))
        return u.scheme == "https" and bool(u.netloc) and not u.username and not u.password
    except (TypeError, ValueError):
        return False


def normalize_items(raw, edition):
    if not isinstance(raw, dict) or not isinstance(raw.get("items"), list):
        raise ValueError("Artefato exige objeto JSON com lista items.")
    result, seen = [], set()
    for item in raw["items"]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()[:260]
        url = str(item.get("url") or "").strip()
        source = str(item.get("source") or "").strip()[:100]
        if not title or not source or not valid_url(url):
            continue
        key = hashlib.sha256((title + "\n" + url).encode()).hexdigest()[:16]
        if key in seen:
            continue
        seen.add(key)
        date = item.get("published_at")
        try:
            parsed = dt.datetime.fromisoformat(str(date).replace("Z", "+00:00"))
            date = parsed.isoformat() if parsed.tzinfo else None
        except (ValueError, TypeError):
            date = None
        result.append({
            "id": key, "title": title, "url": url, "source": source,
            "summary": str(item.get("summary") or "").strip()[:1200],
            "category": str(item.get("category") or "Política")[:80],
            "published_at": date, "edition_date": edition,
            "claude_imported": True, "claude_verified": False,
            "archive": True, "origin": "Exportação manual de Claude Artifact",
        })
    return result


def write_if_changed(path, data):
    raw = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == raw:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(raw, encoding="utf-8")
    return True


def run(imports=INPUT, archive=ARCHIVE):
    editions, changed = [], 0
    for path in sorted(Path(imports).glob("20??-??-??.json")):
        try:
            dt.date.fromisoformat(path.stem)
            items = normalize_items(json.loads(path.read_text(encoding="utf-8")), path.stem)
        except (ValueError, json.JSONDecodeError):
            raise ValueError("Artefato inválido: " + path.name) from None
        output = Path(archive) / path.stem[:7] / path.stem / "artifacts.json"
        changed += int(write_if_changed(output, {
            "schema_version": 1, "edition_date": path.stem,
            "verified": False, "count": len(items), "items": items,
            "note": "Importação manual do Claude, sem validação jornalística independente.",
        }))
        editions.append({"edition_date": path.stem, "count": len(items),
                         "path": "arquivo/" + path.stem[:7] + "/" + path.stem + "/artifacts.json"})
    changed += int(write_if_changed(Path(archive) / "artifacts-index.json", {
        "schema_version": 1, "editions": sorted(editions,
                                               key=lambda x: x["edition_date"], reverse=True)
    }))
    return {"editions": len(editions), "changed": changed}


if __name__ == "__main__":
    print(json.dumps(run(), ensure_ascii=False))
