from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
import os
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
ASSETS = DOCS / "assets"
FRAMES = ROOT / "tools" / "_presentation_frames"
SHOTS = ROOT / "tools" / "_app_screenshots"
OUT = ASSETS / "lead-command-center-presentation.mp4"
VIDEO_ONLY_OUT = ASSETS / "lead-command-center-presentation-video-only.mp4"
SCRIPT_OUT = ASSETS / "lead-command-center-video-script.txt"
AUDIO_OUT = ASSETS / "lead-command-center-voiceover.mp3"

W, H = 1280, 720
FPS = 15
PORT = 8787

SCENES = [
    {
        "id": "overview",
        "view": "overview",
        "label": "Command Center",
        "vo": "Meet Lead Command Center, a client-ready growth workspace built for agencies that need faster follow-up, cleaner pipeline visibility, and fewer missed opportunities.",
    },
    {
        "id": "priorities",
        "view": "overview",
        "label": "Priority View",
        "vo": "The first screen shows what matters now: imported leads, positive replies, booked calls, and follow-up coverage, so the team always knows where to act first.",
    },
    {
        "id": "hot-leads",
        "view": "hot-leads",
        "label": "Hot Leads",
        "vo": "Leads can move from BoldTrail intake into organized segments, then into outreach, reply sorting, call scheduling, proposal tracking, billing, and onboarding.",
    },
    {
        "id": "content",
        "view": "content",
        "focus": "content-studio",
        "label": "Content Studio",
        "vo": "For outreach, the content studio creates review-ready email, social copy, image direction, and call-to-action links with consent checks and truthful claim controls built in.",
    },
    {
        "id": "deploy",
        "view": "content",
        "focus": "deployment-composer",
        "label": "Deployment Composer",
        "vo": "Once content is approved, the user chooses the format, such as a post, reel, story, or My Day, selects the social platforms, attaches images or video, adds emoji tone, and queues the final deployment.",
    },
    {
        "id": "pipeline",
        "view": "pipeline",
        "label": "Pipeline",
        "vo": "The pipeline view connects outreach to revenue, showing which prospects are new, which calls are booked, which proposals are active, and which clients are ready for billing.",
    },
    {
        "id": "engine",
        "view": "engine",
        "label": "Operating Engine",
        "vo": "Under the hood, the workflow keeps the system consistent: intake, reply routing, content review, appointment preparation, closed-won handoff, and billing setup.",
    },
    {
        "id": "value",
        "view": "overview",
        "label": "Client Value",
        "vo": "For clients, the value is simple: faster answers, smarter follow-up, compliant outreach, and a system that turns attention into booked conversations.",
    },
]

VOICE_PREFERENCES = [
    "Eric - Smooth, Trustworthy",
    "Brian - Deep, Resonant and Comforting",
    "George - Warm, Captivating Storyteller",
    "Bella - Professional, Bright, Warm",
    "Sarah - Mature, Reassuring, Confident",
    "Rachel",
    "Serena",
    "Aria",
    "Nicole",
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


CAPTION_FONT = font(22, True)
SMALL_FONT = font(15, True)


def wrapped_lines(draw, text, max_width, fnt):
    lines = []
    line = ""
    for word in text.split():
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


def chrome_path():
    for path in [
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
        "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    ]:
        if Path(path).exists():
            return path
    raise FileNotFoundError("Chrome or Edge was not found for screenshot capture.")


def crop_focus_scene(scene, screenshot_path):
    if not scene.get("focus"):
        return

    crop_top = {
        "content": 360,
        "deploy": 1390,
    }.get(scene["id"], 0)

    image = Image.open(screenshot_path).convert("RGB")
    max_top = max(0, image.height - H)
    crop_top = min(crop_top, max_top)
    image.crop((0, crop_top, W, crop_top + H)).save(screenshot_path)


def capture_screenshots():
    SHOTS.mkdir(parents=True, exist_ok=True)
    for old in SHOTS.glob("*.png"):
        old.unlink()

    server = subprocess.Popen(
        ["python", "-m", "http.server", str(PORT), "--directory", str(DOCS)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        time.sleep(1.2)
        browser = chrome_path()
        for scene in SCENES:
            url = f"http://127.0.0.1:{PORT}/?view={scene['view']}"
            out = SHOTS / f"{scene['id']}.png"
            height = 2200 if scene.get("focus") else H
            with tempfile.TemporaryDirectory() as profile:
                subprocess.run(
                    [
                        browser,
                        "--headless=new",
                        "--disable-gpu",
                        "--hide-scrollbars",
                        "--force-device-scale-factor=1",
                        "--virtual-time-budget=3000",
                        "--run-all-compositor-stages-before-draw",
                        f"--window-size={W},{height}",
                        f"--user-data-dir={profile}",
                        f"--screenshot={out}",
                        url,
                    ],
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            crop_focus_scene(scene, out)
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()


def draw_caption(img, scene, progress=1):
    app = img.resize((1180, 620), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (W, H), "#080f1a")
    canvas.paste(app, (50, 24))
    draw = ImageDraw.Draw(canvas)
    lines = wrapped_lines(draw, scene["vo"], 1080, CAPTION_FONT)
    y0 = 622
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle((50, 24, 1230, 644), radius=24, outline=(62, 74, 96, 255), width=2)
    od.text((68, y0), scene["label"].upper(), font=SMALL_FONT, fill=(120, 186, 255, 255))
    y = y0 + 24
    for line in lines:
        od.text((104, y), line, font=CAPTION_FONT, fill=(248, 250, 252, 255))
        y += 30
    od.rounded_rectangle((50, H - 8, W - 50, H - 4), radius=2, fill=(51, 65, 85, 255))
    od.rounded_rectangle((50, H - 8, 50 + int((W - 100) * progress), H - 4), radius=2, fill=(0, 122, 255, 255))
    return Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB")


def write_script():
    lines = ["Lead Command Center Video Presentation Script", ""]
    for i, scene in enumerate(SCENES, 1):
        lines.append(f"{i}. {scene['label']}")
        lines.append(scene["vo"])
        lines.append("")
    SCRIPT_OUT.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")


def media_duration(path):
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def build_video(scene_duration=7):
    FRAMES.mkdir(parents=True, exist_ok=True)
    for old in FRAMES.glob("*.png"):
        old.unlink()

    list_file = FRAMES / "slides.txt"
    with list_file.open("w", encoding="utf-8") as f:
        for index, scene in enumerate(SCENES):
            shot = Image.open(SHOTS / f"{scene['id']}.png").convert("RGB").resize((W, H))
            img = draw_caption(shot, scene)
            frame_path = FRAMES / f"scene_{index:02d}.png"
            img.save(frame_path)
            f.write(f"file '{frame_path.as_posix()}'\n")
            f.write(f"duration {scene_duration:.3f}\n")
        f.write(f"file '{frame_path.as_posix()}'\n")

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
    request = urllib.request.Request(f"https://api.elevenlabs.io/v1/{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read()


def choose_elevenlabs_voice():
    raw = elevenlabs_request("voices")
    if not raw:
        return None
    voices = json.loads(raw.decode("utf-8")).get("voices", [])
    default_voices = [voice for voice in voices if voice.get("category") in {"premade", "professional", "generated"}]
    candidates = default_voices or voices
    for preferred in VOICE_PREFERENCES:
        for voice in candidates:
            if voice.get("name", "").lower() == preferred.lower():
                return voice.get("voice_id")
    return candidates[0].get("voice_id") if candidates else None


def render_voiceover():
    if not os.environ.get("ELEVENLABS_API_KEY"):
        return False
    voice_id = choose_elevenlabs_voice()
    if not voice_id:
        return False
    payload = {
        "text": "\n\n".join(scene["vo"] for scene in SCENES),
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.56, "similarity_boost": 0.82, "style": 0.28, "use_speaker_boost": True},
    }
    data = elevenlabs_request(f"text-to-speech/{voice_id}", payload=payload, method="POST")
    if not data:
        return False
    AUDIO_OUT.write_bytes(data)
    return True


def mux_final_video(has_voiceover):
    command = ["ffmpeg", "-y", "-i", str(VIDEO_ONLY_OUT)]
    if has_voiceover:
        command.extend(["-i", str(AUDIO_OUT), "-c:v", "copy", "-c:a", "aac", "-shortest"])
    else:
        command.extend(["-c:v", "copy"])
    command.extend(["-movflags", "+faststart", str(OUT)])
    subprocess.run(command, check=True)


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    write_script()
    capture_screenshots()
    has_voiceover = False
    try:
        has_voiceover = render_voiceover()
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as error:
        print(f"ElevenLabs voiceover could not be rendered: {error}")
    scene_duration = 7
    if has_voiceover:
        scene_duration = max(7, (media_duration(AUDIO_OUT) + 2) / len(SCENES))
    build_video(scene_duration)
    mux_final_video(has_voiceover)
    if not has_voiceover:
        print("ELEVENLABS_API_KEY not found; video was rendered with word-for-word captions and no external voiceover.")
    print(OUT)
    print(SCRIPT_OUT)


if __name__ == "__main__":
    main()
