"""Regenerate the hero scene and write it into site/index.html between its markers.

    python3 tools/inject_hero.py

The scene is drawn by tools/hero_scene.py; edit that file, then run this one.
"""
import pathlib, re, subprocess, sys

root = pathlib.Path(__file__).resolve().parent.parent
page = root / "site" / "index.html"
html = page.read_text(encoding="utf-8")
for part in ("sky", "land"):
    svg = subprocess.run([sys.executable, str(root / "tools" / "hero_scene.py"), part], check=True, capture_output=True, text=True).stdout
    svg = "\n".join("    " + line for line in svg.splitlines())
    pattern = re.compile(rf"(<!-- hero-{part}:start -->).*?([ \t]*<!-- hero-{part}:end -->)", re.S)
    html, n = pattern.subn(lambda m: m.group(1) + "\n" + svg + "\n" + m.group(2), html)
    assert n == 1, f"hero-{part} markers not found"
page.write_text(html, encoding="utf-8")
print("hero scene written to", page)
