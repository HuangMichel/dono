
import io
import shutil
import zipfile
from pathlib import Path
from urllib.request import urlopen

SKILLS = {
    "python-pro": (
        "jeffallan/claude-skills",
        "python-pro",
    ),
    "backend-testing": (
        "o0o0o0admin/SKILLS-REPO_supercent-io-skills-template",
        "backend-testing",
    ),
     "supabase": (
        "supabase/agent-skills",
        "supabase",
    ),
    "supabase-postgres-best-practices": (
        "supabase/agent-skills",
        "supabase-postgres-best-practices",
    ),
    "archify": (
    "tt-a1i/archify",
    "archify",
),
}

DEST = Path(".agents/skills")


def install_skill(name, repo, skill_dir):
    url = f"https://github.com/{repo}/archive/HEAD.zip"

    with urlopen(url, timeout=30) as response:
        data = response.read()

    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        files = archive.namelist()

        matches = [
            p for p in files
            if p.endswith(f"/{skill_dir}/SKILL.md")
        ]

        if not matches:
            raise RuntimeError(f"Skill introuvable : {name}")

        prefix = matches[0].removesuffix("SKILL.md")
        target = DEST / name
        target.mkdir(parents=True, exist_ok=True)

        for member in archive.infolist():
            if not member.filename.startswith(prefix):
                continue

            relative = Path(member.filename[len(prefix):])

            if not relative.parts or member.is_dir():
                continue

            if ".." in relative.parts:
                raise RuntimeError("Chemin invalide")

            output = target / relative
            output.parent.mkdir(parents=True, exist_ok=True)

            with archive.open(member) as source:
                with output.open("wb") as dest:
                    shutil.copyfileobj(source, dest)

        print(f"Installed: {name} -> {target}")


for name, (repo, skill_dir) in SKILLS.items():
    install_skill(name, repo, skill_dir)
