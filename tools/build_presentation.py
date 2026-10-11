from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import json
import math
import os
import subprocess
import textwrap
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "docs" / "assets"
FRAMES = ROOT / "tools" / "_presentation_frames"
OUT = ASSETS / "lead-command-center-presentation.mp4"
VIDEO_ONLY_OUT = ASSETS / "lead-command-center-presentation-video-only.mp4"
SCRIPT_OUT = ASSETS / "lead-command-center-video-script.txt"
AUDIO_OUT = ASSETS / "lead-command-center-voiceover.mp3"

W, H = 1280, 720
FPS = 30

SCENES = [
    {
        "label": "Black Glove Agency",
        "vo": "Meet Lead Command Center, a client-ready growth workspace built for agencies that need faster follow-up, cleaner pipeline visibility, and fewer missed opportunities.",
        "feature": "Command Center",
        "title": "One workspace for the whole lead operation",
        "caption": "Lead Command Center brings follow-up, pipeline, content, and handoff into one clean workspace.",
        "duration": 7.0,
        "metrics": [("Imported leads", "2,852"), ("Hot replies", "37"), ("Booked calls", "14"), ("Coverage", "96%")],
        "highlight": "overview",
    },
    {
        "label": "Priority Inbox",
        "vo": "The first screen shows what matters now: imported leads, positive replies, booked calls, and follow-up coverage, so the team always knows where to act first.",
        "feature": "Action Queue",
        "title": "The right next action, visible immediately",
        "caption": "Priority cards surface hot replies, pending content approvals, and call preparation.",
        "duration": 7.0,
        "metrics": [("Hot leads", "9"), ("Approvals", "6"), ("Calls to prep", "4"), ("Urgent replies", "3")],
        "highlight": "queue",
    },
    {
        "label": "Lead Journey",
        "vo": "Leads can move from BoldTrail intake into organized segments, then into outreach, reply sorting, call scheduling, proposal tracking, billing, and onboarding.",
        "feature": "Workflow Map",
        "title": "Every lead follows a clear path",
        "caption": "Import, sort, nurture, book, close, bill, and onboard without losing context.",
        "duration": 7.0,
        "metrics": [("Import", "01"), ("Sort", "02"), ("Book", "03"), ("Bill", "04")],
        "highlight": "journey",
    },
    {
        "label": "Content Studio",
        "vo": "For outreach, the content studio creates review-ready email, social copy, image direction, and call-to-action links with consent checks and truthful claim controls built in.",
        "feature": "Content Approval",
        "title": "Review-ready content in one guided flow",
        "caption": "Email, social copy, image direction, and CTA links are prepared behind approval gates.",
        "duration": 7.0,
        "metrics": [("Email", "Ready"), ("Social", "Ready"), ("Image", "Briefed"), ("CTA", "Clear")],
        "highlight": "content",
    },
    {
        "label": "Pipeline",
        "vo": "The pipeline view connects outreach to revenue, showing which prospects are new, which calls are booked, which proposals are active, and which clients are ready for billing.",
        "feature": "Pipeline Board",
        "title": "Revenue movement stays visible",
        "caption": "Every opportunity has a stage, an owner, and a next step.",
        "duration": 7.0,
        "metrics": [("New", "28"), ("Discovery", "14"), ("Proposal", "8"), ("Won", "5")],
        "highlight": "pipeline",
    },
    {
        "label": "Operating Engine",
        "vo": "Under the hood, the workflow keeps the system consistent: intake, reply routing, content review, appointment preparation, closed-won handoff, and billing setup.",
        "feature": "Automation Engine",
        "title": "The operating system behind the offer",
        "caption": "The front end stays simple while the workflow manages the operational handoff.",
        "duration": 7.0,
        "metrics": [("Intake", "Live"), ("Routing", "Live"), ("Prep", "Live"), ("Handoff", "Live")],
        "highlight": "engine",
    },
    {
        "label": "Client Value",
        "vo": "For clients, the value is simple: faster answers, smarter follow-up, compliant outreach, and a system that turns attention into booked conversations.",
        "feature": "SaaS Growth System",
        "title": "A premium operating layer for growth",
        "caption": "Built to help agencies package automation as a clear, client-facing service.",
        "duration": 7.0,
        "metrics": [("Faster replies", "Yes"), ("Clearer pipeline", "Yes"), ("Content control", "Yes"), ("Revenue handoff", "Yes")],
        "highlight": "value",
    },
]

VOICE_PREFERENCES = ["Rachel", "Jessica", "Serena", "Aria", "Laura", "Nicole"]


def font(size, bold=False):
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


FONTS = {
    "eyebrow": font(20, True),
    "title": font(48, True),
    "body": font(25),
    "small": font(16),
    "small_bold": font(16, True),
    "metric": font(28, True),
    "caption": font(23, True),
}


def ease(t):
    t = max(0.0, min(1.0, t))
    return 0.5 - 0.5 * math.cos(math.pi * t)


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def wrapped_lines(draw, text, max_width, fnt):
    lines = []
    for paragraph in text.split("\n"):
        line = ""
        for word in paragraph.split():
            candidate = f"{line} {word}".strip()
            if draw.textlength(candidate, font=fnt) <= max_width:
                line = candidate
            else:
                if line:
                    lines.append(line)
                line = word
        if line:
            lines.append(line)
    return lines


def draw_wrapped(draw, text, xy, max_width, fnt, fill, gap=8):
    x, y = xy
    for line in wrapped_lines(draw, text, max_width, fnt):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += fnt.size + gap
    return y


def card(draw, box, radius=26, fill="#ffffff", outline="#e1e7f0", width=1):
    rounded(draw, box, radius, fill, outline, width)


def draw_background(draw, progress):
    drift = math.sin(progress * math.pi * 2)
    draw.rectangle((0, 0, W, H), fill="#f5f7fb")
    draw.ellipse((-210 + drift * 18, -170, 440 + drift * 18, 420), fill="#e4f1ff")
    draw.ellipse((830 - drift * 16, -150, 1480 - drift * 16, 470), fill="#e6f8ee")
    draw.ellipse((760 + drift * 10, 460, 1500 + drift * 10, 980), fill="#eef0ff")


def draw_nav(draw, active):
    card(draw, (58, 82, 250, 640), 30, "#f8fafc", "#dbe3ef")
    rounded(draw, (90, 118, 136, 164), 14, "#101827")
    draw.text((102, 131), "BG", font=FONTS["small_bold"], fill="#ffffff")
    draw.text((88, 182), "Black Glove", font=FONTS["small_bold"], fill="#111827")
    draw.text((88, 207), "Lead Command", font=FONTS["small"], fill="#64748b")
    items = ["Overview", "Hot Leads", "Content", "Pipeline", "Engine"]
    for i, item in enumerate(items):
        y = 270 + i * 56
        is_active = item.lower().replace(" ", "-") in active or (active == "queue" and item == "Hot Leads")
        if is_active:
            rounded(draw, (80, y - 12, 228, y + 28), 14, "#eaf3ff", "#bdd8ff")
        color = "#007aff" if is_active else "#64748b"
        rounded(draw, (98, y, 114, y + 16), 5, color)
        draw.text((128, y - 4), item, font=FONTS["small_bold"] if is_active else FONTS["small"], fill="#111827" if is_active else "#64748b")


def draw_metrics(draw, scene, p):
    start_x = 310
    for i, (label, value) in enumerate(scene["metrics"]):
        local = ease((p - i * 0.08) / 0.5)
        y = 226 + int((1 - local) * 24)
        x = start_x + i * 218
        card(draw, (x, y, x + 190, y + 98), 22)
        color = ["#007aff", "#34c759", "#ff9500", "#5856d6"][i % 4]
        draw.ellipse((x + 18, y + 22, x + 34, y + 38), fill=color)
        draw.text((x + 44, y + 18), label, font=FONTS["small"], fill="#667085")
        draw.text((x + 18, y + 52), value, font=FONTS["metric"], fill="#111827")


def draw_feature_panel(draw, scene, p):
    y = 364
    card(draw, (310, y, 1158, 590), 30)
    draw.text((340, y + 28), scene["feature"], font=font(24, True), fill="#111827")
    draw.text((340, y + 66), scene["caption"], font=FONTS["body"], fill="#667085")

    labels = {
        "overview": ["Lead intake", "Reply routing", "Call prep", "Billing handoff"],
        "queue": ["Urgent reply", "Pricing question", "Ready to book", "Follow-up due"],
        "journey": ["Import", "Segment", "Nurture", "Book", "Close", "Bill"],
        "content": ["Email", "Social", "Image brief", "CTA link"],
        "pipeline": ["New", "Discovery", "Proposal", "Won"],
        "engine": ["Intake", "Routing", "Review", "Appointment", "Handoff"],
        "value": ["Fast response", "Compliance guardrails", "Clear reporting", "Client-ready"],
    }[scene["highlight"]]

    x = 344
    for i, label in enumerate(labels):
        local = ease((p - 0.22 - i * 0.055) / 0.44)
        yy = y + 138 + int((1 - local) * 18)
        fill = ["#eaf3ff", "#ecfdf3", "#fff5e6", "#f0efff", "#eef2f7"][i % 5]
        ink = ["#007aff", "#22863a", "#b65c00", "#5856d6", "#475569"][i % 5]
        tw = int(draw.textlength(label, font=FONTS["small_bold"]))
        rounded(draw, (x, yy, x + tw + 42, yy + 44), 22, fill)
        draw.ellipse((x + 16, yy + 15, x + 29, yy + 28), fill=ink)
        draw.text((x + 38, yy + 11), label, font=FONTS["small_bold"], fill="#111827")
        x += tw + 62
        if x > 1020:
            x = 344
            y += 58


def draw_caption_bar(draw, scene, frame, total_frames):
    vo_lines = wrapped_lines(draw, scene["vo"], 980, FONTS["caption"])
    box_h = 42 + len(vo_lines) * 32
    y0 = H - box_h - 30
    rounded(draw, (110, y0, 1170, H - 30), 28, "#111827", "#273244")
    y = y0 + 22
    for line in vo_lines:
        draw.text((140, y), line, font=FONTS["caption"], fill="#f8fafc")
        y += 32

    progress_w = int(1000 * (frame / max(1, total_frames - 1)))
    rounded(draw, (140, H - 48, 1140, H - 42), 3, "#334155")
    rounded(draw, (140, H - 48, 140 + progress_w, H - 42), 3, "#007aff")


def make_frame(scene, scene_idx, frame, total_frames):
    p = frame / max(1, total_frames - 1)
    img = Image.new("RGB", (W, H), "#f5f7fb")
    draw = ImageDraw.Draw(img)
    draw_background(draw, scene_idx / max(1, len(SCENES) - 1) + p * 0.04)

    scale = 1 + (1 - ease(p)) * 0.012
    shell = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shell)
    rounded(sd, (38, 42, 1242, 666), 40, "#ffffff", "#dbe3ef", 2)
    shell = shell.filter(ImageFilter.GaussianBlur(0.2))
    draw.rounded_rectangle((38, 42, 1242, 666), radius=40, fill="#ffffff", outline="#dbe3ef", width=2)
    rounded(draw, (38, 42, 1242, 100), 40, "#fbfcff")
    draw.rectangle((38, 72, 1242, 100), fill="#fbfcff")
    for x, color in [(74, "#ff3b30"), (102, "#ff9500"), (130, "#34c759")]:
        draw.ellipse((x, 63, x + 13, 76), fill=color)
    rounded(draw, (186, 55, 620, 83), 14, "#eef2f7")
    draw.text((210, 60), "lead-command-center.app / operations", font=FONTS["small"], fill="#64748b")

    draw_nav(draw, scene["highlight"])

    title_y = 120 + int((1 - ease(p)) * 18)
    draw.text((310, title_y), scene["label"].upper(), font=FONTS["eyebrow"], fill="#007aff")
    draw_wrapped(draw, scene["title"], (310, title_y + 34), 820, FONTS["title"], "#111827", 6)

    draw_metrics(draw, scene, p)
    draw_feature_panel(draw, scene, p)
    draw_caption_bar(draw, scene, frame, total_frames)

    if scale != 1:
        nw, nh = int(W * scale), int(H * scale)
        img = img.resize((nw, nh), Image.Resampling.LANCZOS)
        left, top = (nw - W) // 2, (nh - H) // 2
        img = img.crop((left, top, left + W, top + H))
    return img


def write_script():
    lines = ["Lead Command Center Video Presentation Script", ""]
    for i, scene in enumerate(SCENES, 1):
        lines.append(f"{i}. {scene['label']}")
        lines.append(scene["vo"])
        lines.append("")
    SCRIPT_OUT.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")


def build_video():
    FRAMES.mkdir(parents=True, exist_ok=True)
    for old in FRAMES.glob("*.png"):
        old.unlink()

    frame_count = 0
    for scene_idx, scene in enumerate(SCENES):
        total = int(scene["duration"] * FPS)
        for frame in range(total):
            img = make_frame(scene, scene_idx, frame, total)
            img.save(FRAMES / f"frame_{frame_count:05d}.png", optimize=True)
            frame_count += 1

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-framerate",
            str(FPS),
            "-i",
            str(FRAMES / "frame_%05d.png"),
            "-vf",
            "format=yuv420p",
            "-c:v",
            "libx264",
            "-crf",
            "20",
            "-movflags",
            "+faststart",
            str(VIDEO_ONLY_OUT),
        ],
        check=True,
    )


def elevenlabs_request(path, payload=None, method="GET"):
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        return None

    data = None
    headers = {"xi-api-key": api_key, "accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["content-type"] = "application/json"

    request = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/{path}",
        data=data,
        headers=headers,
        method=method,
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read()


def choose_elevenlabs_voice():
    raw = elevenlabs_request("voices")
    if not raw:
        return None

    voices = json.loads(raw.decode("utf-8")).get("voices", [])
    for preferred in VOICE_PREFERENCES:
        for voice in voices:
            if voice.get("name", "").lower() == preferred.lower():
                return voice.get("voice_id")
    return voices[0].get("voice_id") if voices else None


def render_voiceover():
    if not os.environ.get("ELEVENLABS_API_KEY"):
        return False

    voice_id = choose_elevenlabs_voice()
    if not voice_id:
        return False

    narration = "\n\n".join(scene["vo"] for scene in SCENES)
    payload = {
        "text": narration,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.72,
            "similarity_boost": 0.8,
            "style": 0.18,
            "use_speaker_boost": True,
        },
    }
    data = elevenlabs_request(f"text-to-speech/{voice_id}", payload=payload, method="POST")
    if not data:
        return False
    AUDIO_OUT.write_bytes(data)
    return True


def mux_final_video(has_voiceover):
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(VIDEO_ONLY_OUT),
    ]
    if has_voiceover:
        command.extend(["-i", str(AUDIO_OUT), "-c:v", "copy", "-c:a", "aac", "-shortest"])
    else:
        command.extend(["-c:v", "copy"])
    command.extend(["-movflags", "+faststart", str(OUT)])
    subprocess.run(command, check=True)


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    write_script()
    build_video()
    has_voiceover = False
    try:
        has_voiceover = render_voiceover()
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as error:
        print(f"ElevenLabs voiceover could not be rendered: {error}")
    mux_final_video(has_voiceover)
    if not has_voiceover:
        print("ELEVENLABS_API_KEY not found; video was rendered with word-for-word captions and no external voiceover.")
    print(OUT)
    print(SCRIPT_OUT)


if __name__ == "__main__":
    main()
