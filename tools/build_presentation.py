from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import subprocess
import textwrap

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "docs" / "assets"
FRAMES = ROOT / "tools" / "_presentation_frames"
OUT = ASSETS / "lead-command-center-presentation.mp4"

W, H = 1280, 720

slides = [
    {
        "eyebrow": "Lead Command Center",
        "title": "One workspace for faster lead movement",
        "body": "Import leads, surface priority replies, prepare compliant content, track pipeline stages, and hand off won clients into billing and onboarding.",
        "chips": ["Lead intake", "Hot replies", "Pipeline", "Handoff"],
    },
    {
        "eyebrow": "Command Center",
        "title": "Know what needs attention now",
        "body": "Operators see imported contacts, booked calls, follow-up coverage, and the next actions that keep opportunities from slipping away.",
        "chips": ["2,852 contacts", "37 hot replies", "96% coverage"],
    },
    {
        "eyebrow": "Priority Inbox",
        "title": "Route high-intent prospects quickly",
        "body": "Hot leads are organized by source, intent, and next move so the team knows who needs a reply, a call link, or a tailored update.",
        "chips": ["Ready to book", "Pricing question", "Positive reply"],
    },
    {
        "eyebrow": "Content Studio",
        "title": "Generate policy-safe content in one tap",
        "body": "Create targeted email, social copy, image concepts, and CTA links with consent checks, truthful claims, and approval gates built into the workflow.",
        "chips": ["Email", "Social", "Image concept", "CTA links"],
    },
    {
        "eyebrow": "Pipeline",
        "title": "Connect outreach to revenue",
        "body": "Every lead has a clear stage, from new contact to discovery call, proposal, closed won, billing, and onboarding.",
        "chips": ["New lead", "Discovery", "Proposal", "Won"],
    },
    {
        "eyebrow": "Automation Engine",
        "title": "The workflow under the hood",
        "body": "GoHighLevel powers intake, reply sorting, booked-call prep, and closed-won handoff while the front end keeps the client experience simple.",
        "chips": ["Intake", "Reply routing", "Call prep", "Billing handoff"],
    },
]


def font(size, bold=False):
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_wrapped(draw, text, xy, max_width, fnt, fill, line_gap=8):
    x, y = xy
    lines = []
    for para in text.split("\n"):
        words = para.split()
        line = ""
        for word in words:
            test = f"{line} {word}".strip()
            if draw.textlength(test, font=fnt) <= max_width:
                line = test
            else:
                if line:
                    lines.append(line)
                line = word
        if line:
            lines.append(line)
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += fnt.size + line_gap
    return y


def make_slide(slide, idx):
    img = Image.new("RGB", (W, H), "#eef2f7")
    draw = ImageDraw.Draw(img)

    # Soft iOS-style background fields.
    draw.ellipse((-180, -170, 420, 430), fill="#ddecff")
    draw.ellipse((870, -140, 1480, 470), fill="#ddf5e6")
    draw.ellipse((850, 410, 1460, 1010), fill="#edf0ff")

    rounded(draw, (62, 58, 1218, 662), 34, "#ffffff", "#e4e9f1", 2)
    rounded(draw, (86, 84, 1194, 636), 28, "#f7f9fc", "#eef2f7", 1)

    draw.text((118, 122), slide["eyebrow"].upper(), font=font(22, True), fill="#007aff")
    draw_wrapped(draw, slide["title"], (118, 168), 620, font(56, True), "#101318", line_gap=10)
    draw_wrapped(draw, slide["body"], (118, 330), 620, font(26), "#667085", line_gap=9)

    chip_x, chip_y = 118, 520
    for chip in slide["chips"]:
        tw = int(draw.textlength(chip, font=font(20, True)))
        rounded(draw, (chip_x, chip_y, chip_x + tw + 34, chip_y + 44), 22, "#eaf3ff", None)
        draw.text((chip_x + 17, chip_y + 10), chip, font=font(20, True), fill="#007aff")
        chip_x += tw + 48
        if chip_x > 720:
            chip_x = 118
            chip_y += 56

    # Right-side product card stack.
    x0 = 790
    rounded(draw, (x0, 138, 1138, 244), 24, "#111827", None)
    draw.text((x0 + 28, 164), "Live workspace", font=font(22, True), fill="#ffffff")
    draw.text((x0 + 28, 198), "Review-ready operation", font=font(18), fill="#cbd5e1")

    card_labels = [
        ("Lead intake", "#34c759"),
        ("Content approval", "#007aff"),
        ("Pipeline movement", "#ff9f0a"),
    ]
    cy = 278
    for label, color in card_labels:
        rounded(draw, (x0, cy, 1138, cy + 82), 22, "#ffffff", "#e4e9f1", 2)
        rounded(draw, (x0 + 24, cy + 24, x0 + 58, cy + 58), 17, color, None)
        draw.text((x0 + 78, cy + 28), label, font=font(22, True), fill="#101318")
        cy += 104

    draw.text((1110, 606), f"{idx + 1:02d}/06", font=font(20, True), fill="#8d98aa")
    return img


def main():
    FRAMES.mkdir(parents=True, exist_ok=True)
    for old in FRAMES.glob("*.png"):
        old.unlink()

    frame_paths = []
    for i, slide in enumerate(slides):
        img = make_slide(slide, i)
        path = FRAMES / f"slide_{i:02d}.png"
        img.save(path)
        frame_paths.append(path)

    list_file = FRAMES / "slides.txt"
    with list_file.open("w", encoding="utf-8") as f:
        for path in frame_paths:
            f.write(f"file '{path.as_posix()}'\n")
            f.write("duration 4\n")
        f.write(f"file '{frame_paths[-1].as_posix()}'\n")

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_file),
            "-vf",
            "fps=30,format=yuv420p",
            "-c:v",
            "libx264",
            "-movflags",
            "+faststart",
            str(OUT),
        ],
        check=True,
    )


if __name__ == "__main__":
    main()
