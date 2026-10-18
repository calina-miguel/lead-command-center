from html.parser import HTMLParser
from pathlib import Path
import argparse
import json
import re
import subprocess
import sys
import time
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
LIVE_URL = "https://calina-miguel.github.io/lead-command-center/"

REQUIRED_VIEWS = {"overview", "hot-leads", "content", "pipeline", "engine"}
REQUIRED_ACTIONS = {
    "prepare-outreach",
    "approve-selected",
    "review-card",
    "approve-card",
    "queue-review",
    "queue-deployment",
    "attach-media",
}

FORBIDDEN_PUBLIC_TERMS = [
    "End-to-End Setup",
    "Implementation readiness",
    "GHL API",
    "OAuth",
    "environment variables",
    "Vercel API Layer",
    "Setup Readiness",
    "CSV/API pending",
    "Sandbox placeholder",
    "Admin setup",
    "asking for help",
    "AI-assisted",
    "Demo Mode",
    "Read Script",
]


class AppHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sections = set()
        self.nav_views = set()
        self.view_jumps = set()
        self.actions = set()
        self.asset_refs = []
        self.scripts = []
        self.styles = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        element_id = attrs.get("id")
        if tag == "section" and element_id:
            self.sections.add(element_id)
        if attrs.get("data-view"):
            self.nav_views.add(attrs["data-view"])
        if attrs.get("data-view-jump"):
            self.view_jumps.add(attrs["data-view-jump"])
        if attrs.get("data-action"):
            self.actions.add(attrs["data-action"])

        for key in ("src", "href", "poster"):
            value = attrs.get(key)
            if not value or value.startswith(("http:", "https:", "mailto:")):
                continue
            if value.startswith("./"):
                self.asset_refs.append(value[2:].split("?", 1)[0])
            elif value.startswith("/"):
                continue

        if tag == "script" and attrs.get("src"):
            self.scripts.append(attrs["src"])
        if tag == "link" and attrs.get("href"):
            self.styles.append(attrs["href"])


def result(name, passed, detail):
    return {"name": name, "passed": bool(passed), "detail": detail}


def run(command):
    return subprocess.run(command, cwd=ROOT, capture_output=True, text=True, shell=False)


def read_text(path):
    return path.read_text(encoding="utf-8")


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "LeadCommandCenterQA/1.0"})
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read().decode("utf-8", errors="replace")


def check_local_files():
    checks = []
    required = [
        DOCS / "index.html",
        DOCS / "script.js",
        DOCS / "styles.css",
        DOCS / "assets" / "lead-command-center-presentation.mp4",
    ]
    missing = [str(path.relative_to(ROOT)) for path in required if not path.exists()]
    checks.append(result("required files", not missing, "missing: " + ", ".join(missing) if missing else "all present"))
    return checks


def check_html_structure():
    html = read_text(DOCS / "index.html")
    parser = AppHTMLParser()
    parser.feed(html)

    checks = []
    checks.append(result("required views", REQUIRED_VIEWS.issubset(parser.sections), f"views: {sorted(parser.sections)}"))
    checks.append(result("nav targets", parser.nav_views == REQUIRED_VIEWS, f"nav: {sorted(parser.nav_views)}"))

    bad_jumps = sorted(target for target in parser.view_jumps if target not in parser.sections)
    checks.append(result("view jump targets", not bad_jumps, f"bad jumps: {bad_jumps}" if bad_jumps else "all valid"))

    missing_actions = sorted(REQUIRED_ACTIONS - parser.actions)
    checks.append(result("workflow actions", not missing_actions, f"missing: {missing_actions}" if missing_actions else "all wired"))

    missing_assets = []
    for ref in parser.asset_refs:
        if ref.startswith("#") or not ref:
            continue
        path = DOCS / ref
        if not path.exists():
            missing_assets.append(ref)
    checks.append(result("asset references", not missing_assets, f"missing: {missing_assets}" if missing_assets else "all local refs exist"))

    forbidden = [term for term in FORBIDDEN_PUBLIC_TERMS if re.search(re.escape(term), html, re.IGNORECASE)]
    checks.append(result("public sensitive wording", not forbidden, f"found: {forbidden}" if forbidden else "clean"))
    return checks


def check_script_logic():
    checks = []
    syntax = run(["node", "--check", str(DOCS / "script.js")])
    checks.append(result("javascript syntax", syntax.returncode == 0, syntax.stderr.strip() or "ok"))

    script = read_text(DOCS / "script.js")
    forbidden = [term for term in FORBIDDEN_PUBLIC_TERMS if re.search(re.escape(term), script, re.IGNORECASE)]
    checks.append(result("script sensitive wording", not forbidden, f"found: {forbidden}" if forbidden else "clean"))

    for action in REQUIRED_ACTIONS:
      checks.append(result(f"handler: {action}", f'action === "{action}"' in script, "present" if f'action === "{action}"' in script else "missing"))
    return checks


def check_video_audio():
    video = DOCS / "assets" / "lead-command-center-presentation.mp4"
    if not video.exists():
        return [result("presentation video", False, "missing")]
    probe = run([
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type",
        "-of",
        "default=noprint_wrappers=1",
        str(video),
    ])
    if probe.returncode != 0:
        return [result("presentation video probe", False, probe.stderr.strip())]
    streams = probe.stdout.strip().splitlines()
    return [
        result("presentation video stream", "codec_type=video" in streams, str(streams)),
        result("presentation audio stream", "codec_type=audio" in streams, str(streams)),
    ]


def check_live_site(url):
    checks = []
    cache_bust = f"{url.rstrip('/')}/?qa={int(time.time())}"
    try:
        html = fetch(cache_bust)
    except Exception as error:
        return [result("live fetch", False, str(error))]

    checks.append(result("live fetch", True, cache_bust))
    forbidden = [term for term in FORBIDDEN_PUBLIC_TERMS if re.search(re.escape(term), html, re.IGNORECASE)]
    checks.append(result("live sensitive wording", not forbidden, f"found: {forbidden}" if forbidden else "clean"))
    checks.append(result("live public title", "Black Glove Systems" in html, "title present" if "Black Glove Systems" in html else "title missing"))
    checks.append(result("live video cache", "lead-command-center-presentation.mp4?v=client-showcase" in html, "client video linked"))
    return checks


def main():
    parser = argparse.ArgumentParser(description="Persistent QA checks for Black Glove Systems.")
    parser.add_argument("--live", action="store_true", help="Also check the live GitHub Pages URL.")
    parser.add_argument("--url", default=LIVE_URL, help="Live URL to check.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
    args = parser.parse_args()

    checks = []
    checks.extend(check_local_files())
    checks.extend(check_html_structure())
    checks.extend(check_script_logic())
    checks.extend(check_video_audio())
    if args.live:
        checks.extend(check_live_site(args.url))

    passed = all(item["passed"] for item in checks)
    payload = {"passed": passed, "checks": checks}
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        for item in checks:
            mark = "PASS" if item["passed"] else "FAIL"
            print(f"{mark} {item['name']}: {item['detail']}")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
