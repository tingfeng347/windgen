import os
import tempfile
from dataclasses import dataclass, replace
from pathlib import Path

from dotenv import load_dotenv, set_key

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env", override=False)


@dataclass(frozen=True)
class Settings:
    base_url: str = os.getenv("LLM_BASE_URL", "https://api.deepseek.com").rstrip("/")
    model: str = os.getenv("LLM_MODEL", "deepseek-flash")
    api_key: str = os.getenv("LLM_API_KEY", "")
    timeout: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "120"))
    data_dir: Path = ROOT / os.getenv("WINDGEN_DATA_DIR", "data")
    host: str = os.getenv("WINDGEN_HOST", "127.0.0.1")
    port: int = int(os.getenv("WINDGEN_PORT", "8787"))


settings = Settings()


def save_model_settings(current: Settings, base_url: str, model: str, api_key: str) -> Settings:
    """Atomically preserve other dotenv settings; publish the new config only after the write."""
    path = ROOT / ".env"
    values = {"LLM_BASE_URL": base_url, "LLM_MODEL": model, "LLM_API_KEY": api_key}
    fd, temporary = tempfile.mkstemp(prefix=".env-update-", dir=ROOT)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w") as target:
            target.write(path.read_text() if path.exists() else "")
        for key, value in values.items():
            set_key(temporary, key, value, quote_mode="always")
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    os.environ.update(values)
    return replace(current, base_url=base_url, model=model, api_key=api_key)
