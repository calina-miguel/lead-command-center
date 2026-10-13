from pathlib import Path
import subprocess
import tempfile
import time

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
OUT_DIR = DOCS / "marketing" / "assets"
OUT = OUT_DIR / "black-glove-marketing-presentation.mp4"
VOICE = DOCS / "assets" / "lead-command-center-voiceover.mp3"
W, H, FPS = 1280, 720, 15
PORT = 8790
SCENES = [
    ("Lead Intake", "New leads enter one organized workspace with source and stated interest attached."),
    ("Campaign Start", "The right follow-up campaign begins as soon as the lead enters the system."),
    ("Email Follow-Up", "Useful, relevant information keeps the next conversation connected to the lead's need."),
    ("CRM Alignment", "Approved contact context, stage, and next action stay current in GHL."),
    ("Native CRM Sync", "When needed, the approved record can stay aligned with the client's existing CRM."),
]


def font(size, bold=False):
    path = Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf")
    return ImageFont.truetype(path, size) if path.exists() else ImageFont.load_default()


def chrome_path():
    for value in ("C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"):
        if Path(value).exists():
            return value
    raise FileNotFoundError("Chrome or Edge was not found.")


def wrap(draw, text, width, face):
    lines, line = [], ""
    for word in text.split():
        candidate = f"{line} {word}".strip()
        if draw.textlength(candidate, font=face) <= width:
            line = candidate
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def capture():
    server = subprocess.Popen(["python", "-m", "http.server", str(PORT), "--directory", str(DOCS)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        path = ROOT / "tools" / "_marketing_presentation.png"
        profile = tempfile.mkdtemp()
        subprocess.run([chrome_path(), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=1280,1500", "--virtual-time-budget=2500", f"--user-data-dir={profile}", f"--screenshot={path}", f"http://127.0.0.1:{PORT}/marketing/"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return path
    finally:
        server.terminate()
        server.wait(timeout=5)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    screenshot = capture()
    base = Image.open(screenshot).convert("RGB").resize((1180, 620), Image.Resampling.LANCZOS)
    frames = ROOT / "tools" / "_marketing_frames"
    frames.mkdir(exist_ok=True)
    list_file = frames / "slides.txt"
    title_face, body_face, label_face = font(38, True), font(22), font(15, True)
    with list_file.open("w", encoding="utf-8") as listing:
        for index, (label, copy) in enumerate(SCENES):
            canvas = Image.new("RGB", (W, H), "#080f1a")
            canvas.paste(base, (50, 22))
            overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay)
            draw.rounded_rectangle((50, 22, 1230, 644), radius=24, outline=(62, 74, 96, 255), width=2)
            draw.text((72, 642), label.upper(), font=label_face, fill=(120, 186, 255, 255))
            draw.text((72, 668), label, font=title_face, fill=(248, 250, 252, 255))
            lines = wrap(draw, copy, 680, body_face)
            for line_index, line in enumerate(lines):
                draw.text((500, 660 + line_index * 25), line, font=body_face, fill=(205, 214, 228, 255))
            frame = frames / f"scene_{index:02d}.png"
            Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB").save(frame)
            listing.write(f"file '{frame.as_posix()}'\n")
            listing.write("duration 6\n")
        listing.write(f"file '{frame.as_posix()}'\n")
    video_only = frames / "video.mp4"
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(list_file), "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "20", "-movflags", "+faststart", str(video_only)], check=True)
    command = ["ffmpeg", "-y", "-i", str(video_only)]
    if VOICE.exists():
        command += ["-i", str(VOICE), "-c:v", "copy", "-c:a", "aac", "-shortest"]
    else:
        command += ["-c:v", "copy"]
    command += ["-movflags", "+faststart", str(OUT)]
    subprocess.run(command, check=True)
    print(OUT)


if __name__ == "__main__":
    main()
