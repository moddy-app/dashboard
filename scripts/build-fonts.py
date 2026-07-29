#!/usr/bin/env python3
"""Génère les woff2 de Google Sans servis par le dashboard.

Source : les TTF Google Sans (Regular/Medium/SemiBold/Bold + italiques), non
versionnés — les récupérer et les poser dans le dossier passé en argument.

Chaque face est découpée par plage Unicode (latin, latin-ext, greek, cyrillic,
vietnamese) comme le fait fonts.googleapis.com : le navigateur ne télécharge que
les sous-ensembles réellement rendus (~25 Ko pour du latin) au lieu des ~470 Ko
de la face complète, tout en gardant la couverture complète pour les pseudos
Discord en cyrillique ou en grec.

Usage :
    pip install fonttools brotli
    python3 scripts/build-fonts.py <dossier-ttf> [dossier-sortie]

La sortie par défaut est app/public/fonts/. Le CSS @font-face correspondant vit
dans app/src/index.css et doit être mis à jour si les faces changent ici.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

# Plages reprises telles quelles des feuilles servies par fonts.googleapis.com.
SUBSETS = {
    "latin": (
        "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
        "U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2190-2193,"
        "U+2212,U+2215,U+FEFF,U+FFFD"
    ),
    "latin-ext": (
        "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,"
        "U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,"
        "U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"
    ),
    "greek": "U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF",
    "greek-ext": "U+1F00-1FFF",
    "cyrillic": "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116",
    "cyrillic-ext": (
        "U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F"
    ),
    "vietnamese": (
        "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,"
        "U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,"
        "U+1EA0-1EF9,U+20AB"
    ),
}

# (fichier TTF source, poids CSS, style CSS)
FACES = [
    ("GoogleSans-Regular.ttf", 400, "normal"),
    ("GoogleSans-Italic.ttf", 400, "italic"),
    ("GoogleSans-Medium.ttf", 500, "normal"),
    ("GoogleSans-MediumItalic.ttf", 500, "italic"),
    ("GoogleSans-SemiBold.ttf", 600, "normal"),
    ("GoogleSans-SemiBoldItalic.ttf", 600, "italic"),
    ("GoogleSans-Bold.ttf", 700, "normal"),
    ("GoogleSans-BoldItalic.ttf", 700, "italic"),
]


def face_slug(weight: int, style: str) -> str:
    return f"{weight}italic" if style == "italic" else str(weight)


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2

    src_dir = Path(sys.argv[1])
    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else (
        Path(__file__).resolve().parent.parent / "app" / "public" / "fonts"
    )
    out_dir.mkdir(parents=True, exist_ok=True)

    total = 0
    for filename, weight, style in FACES:
        src = src_dir / filename
        if not src.is_file():
            print(f"introuvable : {src}", file=sys.stderr)
            return 1

        for subset, unicodes in SUBSETS.items():
            out = out_dir / f"google-sans-{face_slug(weight, style)}-{subset}.woff2"
            subprocess.run(
                [
                    "pyftsubset",
                    str(src),
                    f"--unicodes={unicodes}",
                    "--layout-features=*",
                    "--flavor=woff2",
                    f"--output-file={out}",
                ],
                check=True,
            )
            size = out.stat().st_size
            total += size
            print(f"{out.name:44} {size / 1024:6.1f} Ko")

    print(f"\n{len(FACES) * len(SUBSETS)} fichiers, {total / 1024:.0f} Ko au total")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
