import pytest

from windgen.intent import Intent


@pytest.fixture(autouse=True)
def no_live_classifier_in_tests(monkeypatch):
    async def lesson(*args, **kwargs):
        return Intent("lesson")
    monkeypatch.setattr("windgen.api.identify_intent", lesson)
