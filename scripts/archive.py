#!/usr/bin/env python3
"""Arquivo permanente do Painel Brasil por mes e dia, sem copiar artigos completos.

Estrutura: site/arquivo/YYYY-MM/YYYY-MM-DD/materias.json, com catalogo em
site/arquivo/index.json. A cada coleta, novos links entram no dia da
publicacao em horario de Brasilia e os dias anteriores sao preservados.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
NEWS_PATH = ROOT / "site" / "data" / "news.json"
ARCHIVE_ROOT = ROOT / "site" / "arquivo"
BRASILIA = ZoneInfo("America/Sao_Paulo")
CLAUDE_DATE = "2026-10-16"


def publication_day(item: dict, now: dt.datetime | None = None) -> str | None:
    raw = item.get("published_at")
    try:
        published = dt.datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        if published.tzinfo is None:
            return None
        if now and published > now + dt.timedelta(hours=4):
            return None
        day = published.astimezone(BRASILIA).date().isoformat()
        return day if day >= "2026-01-01" else None
    except (TypeError, ValueError, OverflowError):
        return None


def item_key(item: dict) -> str:
    url = str(item.get("url") or "")
    parts = urlsplit(url)
    query = urlencode([(k, v) for k, v in parse_qsl(parts.query)
                       if k.lower() not in ("fbclid", "gclid")
                       and not k.lower().startswith("utm_")])
    return urlunsplit((parts.scheme, parts.netloc.lower(),
                       parts.path.rstrip("/"), query, "")) or str(item.get("id", ""))


def is_valid(item: dict) -> bool:
    if not isinstance(item, dict) or item.get("archive"):
        return False
    url = str(item.get("url", ""))
    try:
        p = urlsplit(url)
        return p.scheme in ("https", "http") and bool(p.netloc) and bool(item.get("title"))
    except ValueError:
        return False


def write_if_changed(path: Path, value: dict) -> bool:
    data = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    if path.is_file() and path.read_text(encoding="utf-8") == data:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    pending = path.with_suffix(".tmp")
    pending.write_text(data, encoding="utf-8")
    pending.replace(path)
    return True


def write_archive(news_path: Path = NEWS_PATH, archive_root: Path = ARCHIVE_ROOT,
                  now: dt.datetime | None = None) -> dict:
    now = now or dt.datetime.now(dt.timezone.utc)
    try:
        snapshot = json.loads(news_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        snapshot = {}
    by_day: dict[str, list[dict]] = {}
    for item in snapshot.get("items", []):
        if not is_valid(item):
            continue
        day = publication_day(item, now)
        if day:
            by_day.setdefault(day, []).append(item)

    written = 0
    for day, items in by_day.items():
        path = archive_root / day[:7] / day / "materias.json"
        try:
            previous = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            previous = {}
        merged = {}
        for item in previous.get("items", []) + items:
            if is_valid(item):
                merged[item_key(item)] = item
        ordered = sorted(merged.values(), key=lambda x: x.get("published_at", ""), reverse=True)
        payload = {"schema_version": 1, "date": day,
                   "claude_original": day == CLAUDE_DATE,
                   "items": ordered}
        written += int(write_if_changed(path, payload))

    # A edicao do Claude de 16/10/2026 esta embutida no HTML do painel.
    # O arquivo-destaque desse dia tambem aparece no indice por data.
    legacy = archive_root / CLAUDE_DATE[:7] / CLAUDE_DATE / "materias.json"
    if not legacy.exists():
        written += int(write_if_changed(legacy, {
            "schema_version": 1, "date": CLAUDE_DATE,
            "claude_original": True, "items": []
        }))

    months: dict[str, list[dict]] = {}
    for path in sorted(archive_root.glob("20??-??/20??-??-??/materias.json")):
        try:
            content = json.loads(path.read_text(encoding="utf-8"))
            day = str(content.get("date", path.parent.name))
            dt.date.fromisoformat(day)
            if path.parent.name != day or path.parent.parent.name != day[:7]:
                continue
            items = content.get("items", [])
            months.setdefault(day[:7], []).append({
                "date": day, "count": len(items),
                "claude_original": bool(content.get("claude_original")),
                "path": f"arquivo/{day[:7]}/{day}/materias.json",
            })
        except (ValueError, TypeError, OSError):
            continue
    index = {"schema_version": 1, "months": [
        {"month": month, "days": sorted(days, key=lambda x: x["date"], reverse=True)}
        for month, days in sorted(months.items(), reverse=True)
    ]}
    written += int(write_if_changed(archive_root / "index.json", index))
    return {"saved_days": sum(len(x["days"]) for x in index["months"]),
            "months": len(index["months"]), "files_updated": written}


if __name__ == "__main__":
    print(json.dumps(write_archive(), ensure_ascii=False))
