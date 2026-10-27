import datetime as dt
import io
import json
import pathlib
import sys
import tempfile
import unittest
from urllib.error import HTTPError

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "scripts"))
import claude_enrich as ai
import import_artifacts as artifacts


class ClaudeAPITest(unittest.TestCase):
    def setUp(self):
        self.now = dt.datetime(2026, 10, 27, 12, tzinfo=dt.timezone.utc)
        self.item = {
            "id": "abc", "title": "Senado examina projeto de lei sobre educação",
            "url": "https://www12.senado.leg.br/noticias/teste",
            "source": "Agência Senado", "category": "Câmara e Senado",
            "published_at": self.now.isoformat(),
        }

    def test_filters_old_or_invalid_articles(self):
        old = dict(self.item, id="old",
                   published_at=(self.now - dt.timedelta(days=5)).isoformat())
        bad = dict(self.item, id="bad", url="javascript:alert(1)")
        selected = ai.select_articles({"items": [old, bad, self.item]}, now=self.now)
        self.assertEqual([a["id"] for a in selected], ["abc"])

    def test_no_invented_entry_ids(self):
        answer = {"content": [{"type": "text", "text": json.dumps({"entries": [
            {"id": "forjado", "question": "Quem venceu a eleição?"},
            {"id": "abc", "question": "Quais são os próximos passos da discussão?"},
        ]})}]}
        result = ai.parse_response(answer, [self.item])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["title"], self.item["title"])
        self.assertFalse(result[0]["verified"])

    def test_rejects_new_numbers_in_question(self):
        answer = {"content": [{"type": "text", "text": json.dumps({"entries": [
            {"id": "abc", "question": "O projeto foi aprovado por 87 senadores?"},
        ]})}]}
        with self.assertRaises(ValueError):
            ai.parse_response(answer, [self.item])

    def test_invalid_api_output_fails_closed(self):
        with self.assertRaises(ValueError):
            ai.parse_response({"content": [{"type": "text", "text": "texto livre"}]},
                              [self.item])

    def test_api_http_diagnostic_does_not_expose_private_response(self):
        for code, kind in ((401, "authentication_error"),
                           (402, "billing_error"), (403, "permission_error"),
                           (429, "rate_limit_error")):
            body = json.dumps({"error": {"type": kind, "message":
                        "PRIVATE_TOKEN_123 should not appear"}}).encode()
            def fail_request(*args, **kwargs):
                raise HTTPError(ai.API_URL, code, "private reason", {},
                                io.BytesIO(body))
            with self.assertRaises(ai.ClaudeAPIError) as caught:
                ai.call_api([self.item], "PRIVATE_TOKEN_123",
                            opener=fail_request)
            diagnostic = str(caught.exception)
            self.assertEqual(caught.exception.code, code)
            self.assertIn(kind, diagnostic)
            self.assertNotIn("PRIVATE_TOKEN_123", diagnostic)
            self.assertNotIn("private reason", diagnostic)

    def test_dry_run_no_api_call_and_missing_key_does_not_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = pathlib.Path(tmp) / "news.json"
            target = pathlib.Path(tmp) / "claude-insights.json"
            source.write_text(json.dumps({"items": [self.item]}), encoding="utf-8")
            target.write_text("VERSAO ANTIGA", encoding="utf-8")
            result = ai.generate(source, target, key="", now=self.now, dry_run=True)
            self.assertEqual(result["selected"], 1)
            with self.assertRaises(RuntimeError):
                ai.generate(source, target, key="", now=self.now)
            self.assertEqual(target.read_text(encoding="utf-8"), "VERSAO ANTIGA")

    def test_api_generation_and_provenance(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, target = (pathlib.Path(tmp) / p
                              for p in ["news.json", "claude-insights.json"])
            source.write_text(json.dumps({"items": [self.item]}), encoding="utf-8")
            def fake_api(articles, key):
                self.assertEqual(key, "example")
                return [dict(articles[0], question="Quais são os próximos passos?",
                             origin="Claude API", verified=False)]
            report = ai.generate(source, target, key="example", now=self.now,
                                 api_call=fake_api)
            self.assertEqual(report["published"], 1)
            self.assertEqual(json.loads(target.read_text(encoding="utf-8"))["model"],
                             ai.MODEL)


class ArtifactImportTest(unittest.TestCase):
    def test_unverified_and_no_fabricated_date(self):
        raw = {"items": [
            {"title": "Mudança em pauta", "url": "https://example.org/a",
             "source": "Agência Brasil", "summary": "Texto exportado do Claude"},
            {"title": "Sem fonte", "url": "https://example.org/b"},
            {"title": "Link inseguro", "url": "javascript:alert(1)", "source": "Portal"},
        ]}
        parsed = artifacts.normalize_items(raw, "2026-10-27")
        self.assertEqual(len(parsed), 1)
        self.assertIsNone(parsed[0]["published_at"])
        self.assertFalse(parsed[0]["claude_verified"])

    def test_idempotent_import(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            folder = root / "imports"
            folder.mkdir()
            (folder / "2026-10-27.json").write_text(json.dumps({"items": [
                {"title": "Projeto discutido", "url": "https://example.org/a",
                 "source": "Senado"}]}), encoding="utf-8")
            self.assertGreater(artifacts.run(folder, root / "arquivo")["changed"], 0)
            self.assertEqual(artifacts.run(folder, root / "arquivo")["changed"], 0)


if __name__ == "__main__":
    unittest.main()
