import os
from dataclasses import dataclass, field


@dataclass
class Settings:
    app_name: str = "CodeShift AI"
    app_version: str = "0.1.0"
    description: str = "AI-powered legacy code migration platform"
    gemini_api_key: str = field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    gemini_model: str = "gemini-3-flash-preview"
    upload_dir: str = field(default_factory=lambda: os.getenv("UPLOAD_DIR", "/tmp/codeshift_projects"))
    max_file_size_mb: int = 10


settings = Settings()
