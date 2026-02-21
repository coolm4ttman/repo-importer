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
    slack_webhook_url: str = field(default_factory=lambda: os.getenv("SLACK_WEBHOOK_URL", ""))

    # --- Run & Compare: code execution settings ---
    code_execution_timeout: int = field(
        default_factory=lambda: int(os.getenv("CODE_EXECUTION_TIMEOUT", "30"))
    )
    code_execution_memory_mb: int = field(
        default_factory=lambda: int(os.getenv("CODE_EXECUTION_MEMORY_MB", "256"))
    )
    python2_path: str = field(
        default_factory=lambda: os.getenv("PYTHON2_PATH", "python2")
    )
    python3_path: str = field(
        default_factory=lambda: os.getenv("PYTHON3_PATH", "python3")
    )
    max_output_bytes: int = field(
        default_factory=lambda: int(os.getenv("MAX_OUTPUT_BYTES", str(10 * 1024 * 1024)))
    )


settings = Settings()
