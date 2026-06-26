#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[1]
SIZE_LIMIT_BYTES = 32 * 1024

REQUIRED_FILES = [
    "AGENTS.md",
    "CLAUDE.md",
    ".cursorrules",
    "ARCHITECTURE.md",
    "docs/context-map.md",
    ".github/copilot-instructions.md",
    "src/AGENTS.md",
    "api/AGENTS.md",
    "shared/AGENTS.md",
    "public/data/AGENTS.md",
    "scripts/AGENTS.md",
    "api/scripts/AGENTS.md",
    "docs/AGENTS.md",
]

REQUIRED_INSTRUCTIONS = [
    ".github/instructions/frontend.instructions.md",
    ".github/instructions/api.instructions.md",
    ".github/instructions/shared-contracts.instructions.md",
    ".github/instructions/data.instructions.md",
    ".github/instructions/infra-deploy.instructions.md",
    ".github/instructions/docs-ai-context.instructions.md",
    ".github/instructions/validation.instructions.md",
]

REQUIRED_CLAUDE_COMMANDS = [
    ".claude/commands/test.md",
    ".claude/commands/lint.md",
    ".claude/commands/smoke-test.md",
    ".claude/commands/deploy.md",
    ".claude/commands/verify-deploy.md",
    ".claude/commands/update-arch.md",
]

ALWAYS_ON_FILES = [
    "AGENTS.md",
    "CLAUDE.md",
    ".cursorrules",
    ".github/copilot-instructions.md",
    "src/AGENTS.md",
    "api/AGENTS.md",
    "shared/AGENTS.md",
    "public/data/AGENTS.md",
    "scripts/AGENTS.md",
    "api/scripts/AGENTS.md",
    "docs/AGENTS.md",
]

AI_CONTEXT_DIRS = [".agents", ".github", ".claude"]
PLATFORM_ARTIFACTS = {".DS_Store", "Thumbs.db", "desktop.ini"}
LOCAL_LINK_RE = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")
SECRET_PATTERNS = [
    (re.compile(r"-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----"), "private key block"),
    (re.compile(r"\b(?:sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,})\b"), "known token prefix"),
    (re.compile(r"(?i)\b(?:password|secret|token|api[_-]?key|connection[_-]?string)\s*[:=]\s*[\"']?[A-Za-z0-9_./+=-]{20,}"), "secret-looking assignment"),
    (re.compile(r"(?i)\b(?:COSMOS_KEY|STUDY_SESSION_SECRET|DEPLOY_TOKEN)\s*=\s*[\"']?[^\s\"']{8,}"), "sensitive env assignment"),
]


errors: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def parse_frontmatter(text: str) -> dict[str, str] | None:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None

    result: dict[str, str] = {}
    for line in lines[1:]:
        if line.strip() == "---":
            return result
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        result[key.strip()] = value.strip().strip("'\"")

    return None


def iter_context_files() -> list[Path]:
    files: set[Path] = set()
    for item in REQUIRED_FILES + REQUIRED_INSTRUCTIONS + REQUIRED_CLAUDE_COMMANDS + ALWAYS_ON_FILES:
        path = ROOT / item
        if path.exists() and path.is_file():
            files.add(path)

    for directory in AI_CONTEXT_DIRS:
        root = ROOT / directory
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_file() and path.suffix.lower() in {".md", ".markdown", ".txt"}:
                files.add(path)

    for path in ROOT.rglob("AGENTS.md"):
        ignored_parts = {"node_modules", "dist"}
        if ignored_parts.intersection(path.parts):
            continue
        files.add(path)

    return sorted(files)


def check_required_files() -> None:
    for item in REQUIRED_FILES + REQUIRED_INSTRUCTIONS + REQUIRED_CLAUDE_COMMANDS:
        path = ROOT / item
        if not path.is_file():
            fail(f"Missing required AI context file: {item}")

    if not list((ROOT / ".github" / "instructions").glob("*.instructions.md")):
        fail("Missing .github/instructions/*.instructions.md files")

    if not list((ROOT / ".agents" / "skills").glob("*/SKILL.md")):
        fail("Missing .agents/skills/*/SKILL.md files")


def check_size_limits() -> None:
    for item in ALWAYS_ON_FILES + REQUIRED_INSTRUCTIONS:
        path = ROOT / item
        if path.is_file() and path.stat().st_size > SIZE_LIMIT_BYTES:
            fail(f"{item} is {path.stat().st_size} bytes, over {SIZE_LIMIT_BYTES} bytes")


def check_copilot_apply_to() -> None:
    for path in sorted((ROOT / ".github" / "instructions").glob("*.instructions.md")):
        frontmatter = parse_frontmatter(read_text(path))
        if not frontmatter or not frontmatter.get("applyTo"):
            fail(f"{rel(path)} is missing applyTo frontmatter")


def check_skill_frontmatter(path: Path) -> None:
    frontmatter = parse_frontmatter(read_text(path))
    if not frontmatter:
        fail(f"{rel(path)} is missing YAML frontmatter")
        return

    for key in ("name", "description"):
        if not frontmatter.get(key):
            fail(f"{rel(path)} is missing {key} frontmatter")

    expected_name = path.parent.name
    if frontmatter.get("name") and frontmatter["name"] != expected_name:
        fail(f"{rel(path)} frontmatter name does not match folder name {expected_name}")


def check_skill_mirrors() -> None:
    agents_root = ROOT / ".agents" / "skills"
    github_root = ROOT / ".github" / "skills"
    agent_skills = {path.parent.name: path for path in agents_root.glob("*/SKILL.md")}
    github_skills = {path.parent.name: path for path in github_root.glob("*/SKILL.md")}

    for name, github_skill in sorted(github_skills.items()):
        agent_skill = agent_skills.get(name)
        if not agent_skill:
            fail(f"{rel(github_skill)} has no mirror in .agents/skills")
            continue
        if agent_skill.read_bytes() != github_skill.read_bytes():
            fail(f"Skill mirror mismatch: .agents/skills/{name}/SKILL.md and .github/skills/{name}/SKILL.md")

    for name, agent_skill in sorted(agent_skills.items()):
        github_skill = github_skills.get(name)
        if not github_skill:
            fail(f"{rel(agent_skill)} has no mirror in .github/skills")

    for path in sorted(agent_skills.values()) + sorted(github_skills.values()):
        check_skill_frontmatter(path)


def normalize_link_target(raw_target: str, source: Path) -> Path | None:
    target = raw_target.strip()
    if not target:
        return None

    if target.startswith("<") and target.endswith(">"):
        target = target[1:-1].strip()

    target = target.split(None, 1)[0]
    if re.match(r"^[a-z][a-z0-9+.-]*:", target, re.IGNORECASE):
        return None
    if target.startswith("#"):
        return None

    target = unquote(target.split("#", 1)[0])
    if not target:
        return None

    candidate = Path(target)
    if candidate.is_absolute():
        return candidate

    resolved = (source.parent / candidate).resolve()
    if resolved.exists():
        return resolved

    repo_relative = (ROOT / candidate).resolve()
    return repo_relative


def check_markdown_links() -> None:
    for path in iter_context_files():
        if path.suffix.lower() not in {".md", ".markdown"}:
            continue
        for match in LOCAL_LINK_RE.finditer(read_text(path)):
            target = normalize_link_target(match.group(1), path)
            if target and not target.exists():
                fail(f"{rel(path)} has broken local markdown link: {match.group(1)}")


def check_platform_artifacts() -> None:
    for directory in AI_CONTEXT_DIRS:
        root = ROOT / directory
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.name in PLATFORM_ARTIFACTS:
                fail(f"Platform artifact found in AI context directory: {rel(path)}")


def check_obvious_secrets() -> None:
    for path in iter_context_files():
        text = read_text(path)
        for pattern, label in SECRET_PATTERNS:
            if pattern.search(text):
                fail(f"{rel(path)} contains an obvious {label}")


def main() -> int:
    check_required_files()
    check_size_limits()
    check_copilot_apply_to()
    check_skill_mirrors()
    check_markdown_links()
    check_platform_artifacts()
    check_obvious_secrets()

    if errors:
        print("AI context validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("AI context validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
