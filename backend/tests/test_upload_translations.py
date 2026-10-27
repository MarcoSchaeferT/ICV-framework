import json
import unittest
from pathlib import Path


class UploadTranslationTests(unittest.TestCase):
    def test_upload_feedback_labels_exist_for_all_locales(self):
        messages_dir = Path(__file__).parents[2] / "messages"

        for locale in ("en", "de"):
            with self.subTest(locale=locale):
                messages = json.loads(
                    (messages_dir / f"{locale}.json").read_text(encoding="utf-8")
                )
                feedback = messages["page_upload"]["feedback"]
                for key in (
                    "progressCountryAssignment",
                    "progressStatusUnavailable",
                ):
                    with self.subTest(locale=locale, key=key):
                        self.assertTrue(feedback[key].strip())


if __name__ == "__main__":
    unittest.main()
