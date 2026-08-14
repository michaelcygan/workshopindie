#!/usr/bin/env python3
"""
Source, treat and attach genre-group photography (same pipeline as city-photos.py).

  python3 scripts/geo/group-photos.py source   # find CC/PD candidates on Commons
  python3 scripts/geo/group-photos.py build    # download + brand-treat picked files
  python3 scripts/geo/group-photos.py upload   # upload to storage + write rows.json

Only public domain / CC0 / CC BY / CC BY-SA files are accepted. Every pick keeps
its source URL, author and license so attribution can be shown and re-checked.
"""
import io, json, os, sys, time, urllib.parse, urllib.request, re

OUT = "/tmp/group-photos"
MANIFEST = os.path.join(OUT, "manifest.json")
API = "https://commons.wikimedia.org/w/api.php"
UA = "WorkshopIndie/1.0 (group photos; https://workshopindie.com)"

ALLOWED = re.compile(r"^(cc0|cc-zero|cc-by-\d|cc-by-sa-\d|pd|public domain)", re.I)

BAD_TITLE = re.compile(
    r"(map\b|atlas|flag|seal\b|logo|coat of arms|diagram|chart|screenshot|"
    r"plan of|scan|page \d|document|letter|newspaper|advertisement|"
    r"1[6-8]\d\d)", re.I)

# slug -> ordered Commons search shapes. Craft in motion first, object last.
GROUPS = {
    "photographers": [
        'darkroom enlarger print developing',
        'photographer camera street shooting',
    ],
    "poets": [
        'poetry reading microphone audience',
        'poetry slam performance stage',
    ],
    "screenwriters": [
        'writer typewriter working desk',
        'writing desk notebook coffee laptop',
        'library reading room writing',
    ],
    "comic-artists": [
        'comic convention artist alley drawing',
        'illustrator drawing board studio',
        'manga artist drawing desk',
    ],
    "zine-makers": [
        'zine fair table',
        'risograph printing',
        'photocopier printing workshop',
    ],
    "ceramicists": [
        'potter wheel throwing clay',
        'pottery studio kiln',
    ],
    "tattoo-artists": [
        'tattoo artist working studio',
        'tattoo machine tattooing arm',
    ],
    "type-designers": [
        'letterpress metal type case',
        'lettering sketch typeface drawing',
    ],
    "knitwear-designers": [
        'knitting yarn hands wool',
        'knitting circle group',
    ],
    "podcasters": [
        'podcast recording microphone studio',
        'radio studio microphone headphones desk',
    ],
    "voice-actors": [
        'voice over booth microphone',
        'recording studio microphone pop filter',
    ],
    "dj-club": [
        'dj turntables mixer performing',
        'nightclub dancefloor crowd lights',
    ],
    "lofi-beatmakers": [
        'sampler drum machine studio',
        'home studio synthesizer desk producer',
    ],
    "bedroom-pop": [
        'home recording setup guitar microphone',
        'musician recording laptop audio interface',
    ],
    "soundcloud-rappers": [
        'rapper performing microphone stage',
        'hip hop concert microphone crowd',
    ],
    "documentary": [
        'documentary film crew camera',
        'camera operator filming interview',
    ],
    "experimental-animation": [
        'stop motion animation set puppet',
        'animation studio light table drawing',
        'film strip 16mm editing',
    ],
    "indie-game-devs": [
        'game jam developers laptops',
        'indie game showcase booth players',
        'game developer conference booth',
    ],
    "stand-up-comics": [
        'stand-up comedy performance microphone',
        'comedy club stage brick wall microphone',
        'comedian performing audience',
    ],
    "drag-performers": [
        'drag performer stage performance',
        'drag show performance audience',
    ],
}


def api(params):
    params = dict(params, format="json", formatversion="2")
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.load(r)
        except Exception:  # noqa: BLE001
            if attempt == 3:
                raise
            time.sleep(1.5 * (attempt + 1))
    return {}


def strip_html(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    return re.sub(r"\s+", " ", s).strip()



# Commons categories, preferred over free-text search (much higher hit rate).
CATS = {
    "photographers": ["Darkrooms", "Photographers at work"],
    "poets": ["Poetry readings", "Poetry slams"],
    "screenwriters": ["Writers at work", "Typewriters in use"],
    "comic-artists": ["Comics artists at work", "Artist alley"],
    "zine-makers": ["Zine fairs", "Risography", "Zines"],
    "ceramicists": ["Potters at work", "Potter's wheels in use", "Pottery workshops"],
    "tattoo-artists": ["Tattoo artists at work", "Tattoo parlours"],
    "type-designers": ["Letterpress printing", "Movable type"],
    "knitwear-designers": ["People knitting", "Knitting"],
    "podcasters": ["Podcasting", "Podcast studios"],
    "voice-actors": ["Voice-over booths", "Recording booths", "Sound recording studios"],
    "dj-club": ["Disc jockeys at work", "Nightclubs interiors", "DJ booths"],
    "lofi-beatmakers": ["Drum machines", "Music production studios", "Samplers (musical instrument)"],
    "bedroom-pop": ["Home recording studios", "Home studios"],
    "soundcloud-rappers": ["Rappers performing", "Hip hop concerts"],
    "documentary": ["Film crews at work", "Documentary filmmaking", "Camera operators at work"],
    "experimental-animation": ["Stop motion animation", "Animation studios", "Animation stands"],
    "indie-game-devs": ["Game jams", "Independent Games Festival", "Video game developers at work"],
    "stand-up-comics": ["Stand-up comedians performing", "Comedy clubs"],
    "drag-performers": ["Drag queens performing", "Drag shows"],
}

# ---- wave 2: remaining genre, scene and micro groups (+ Fort Lauderdale) ----
GROUPS.update({
    "film-video": ['film set camera crew lighting', 'cinema camera operator shooting'],
    "music": ['band rehearsal studio instruments', 'recording studio mixing console'],
    "writing": ['writer typewriter working desk', 'notebook writing hand desk'],
    "visual-art": ['painter studio easel painting', 'art studio canvases brushes'],
    "games-tech": ['programmer coding screens desk', 'software developers working office'],
    "indie-filmmakers": ['independent film shoot camera', 'film crew small set'],
    "food-vloggers": ['food photography kitchen camera', 'cooking filming kitchen'],
    "kpop-dance-cover": ['dance practice studio mirror group', 'street dance performance group'],
    "synthwave": ['analog synthesizer modular studio', 'neon light night city street'],
    "ttrpg-gms": ['tabletop role playing game dice table', 'dungeons dragons game session'],
    # scenes
    "afrofuturism": ['afrofuturism art installation', 'african contemporary art gallery'],
    "climate-fiction": ['solar panels landscape green', 'green architecture plants building'],
    "cosplay": ['cosplay convention costume', 'comic con cosplayers'],
    "cottagecore": ['cottage garden countryside', 'baking bread rustic kitchen'],
    "creadores-en-espanol": ['madrid street cafe people', 'mexico city street mural'],
    "createurs-francophones": ['paris street cafe people', 'french bookshop street'],
    "creativi-in-italiano": ['milan street architecture people', 'rome street cafe'],
    "criadores-em-portugues": ['lisbon street tram people', 'sao paulo street art'],
    "kreative-auf-deutsch": ['berlin street art building', 'hamburg street night'],
    "nihongo-creators": ['tokyo street night signage', 'shibuya street crowd'],
    "diy-punk": ['punk concert basement crowd', 'punk band live small venue'],
    "dreampop": ['concert stage fog lights guitar', 'shoegaze band live pedals'],
    "drill": ['rapper performing microphone stage', 'hip hop concert crowd'],
    "hyperpop": ['electronic music live laser lights', 'laptop live set performance'],
    "indie-sleaze": ['party flash photography crowd night', 'nightclub crowd 2000s'],
    "jazz-revival": ['jazz club performance saxophone', 'jazz trio playing stage'],
    "latin-trap": ['reggaeton concert crowd stage', 'latin music festival performance'],
    "new-weird": ['experimental art installation dark', 'surreal sculpture gallery'],
    "queer-cinema": ['film festival screening audience', 'pride parade street crowd'],
    "sneakerheads": ['sneakers display shop shelves', 'sneaker convention crowd'],
    "vaporwave-revival": ['shopping mall interior fountain', 'arcade neon interior night'],
    "y2k-revival": ['crt monitors computers 2000s', 'old computer lab beige'],
    "workshop-street-team": ['flyers posters wall street', 'street poster wheatpaste wall'],
    # micro sprints
    "48-hour-film": ['film crew shooting street camera', 'clapperboard film set'],
    "album-in-a-weekend": ['recording studio mixing console', 'band recording studio session'],
    "beat-battle": ['drum machine sampler hands', 'music producer studio controller'],
    "demo-day-prep": ['startup pitch presentation stage', 'conference presentation speaker slides'],
    "hackathon-crews": ['hackathon participants laptops', 'coding event team laptops'],
    "nanowrimo-sprint": ['writing laptop cafe desk', 'stack of manuscript pages desk'],
    "one-take-music-video": ['steadicam operator filming', 'music video shoot camera'],
    "open-mic-night": ['open mic performance microphone', 'small venue acoustic performance'],
    "podcast-pilot-week": ['podcast recording microphone studio', 'radio studio microphone desk'],
    "reel-a-day": ['smartphone filming gimbal street', 'vlogger filming camera street'],
    "rpg-one-shot-crew": ['tabletop game dice miniatures table', 'board game session players'],
    "sketch-a-day": ['sketchbook drawing pencil hand', 'urban sketching outdoors'],
    "solo-dev-jam": ['game developer desk computer', 'pixel art game development screen'],
    # city
    "fort-lauderdale": ['Fort Lauderdale street', 'Fort Lauderdale downtown building'],
})

CATS.update({
    "film-video": ["Film crews at work", "Film shooting", "Movie cameras in use"],
    "music": ["Recording studios", "Music rehearsals", "Bands performing"],
    "writing": ["Writers at work", "Typewriters in use"],
    "visual-art": ["Painters at work", "Artists' studios"],
    "games-tech": ["Programmers at work", "Software developers at work"],
    "indie-filmmakers": ["Independent films", "Film crews at work"],
    "food-vloggers": ["Food photography", "Cooking"],
    "kpop-dance-cover": ["Dance rehearsals", "Dance studios"],
    "synthwave": ["Modular synthesizers", "Synthesizers"],
    "ttrpg-gms": ["Role-playing game sessions", "Tabletop role-playing games"],
    "afrofuturism": ["Afrofuturism", "Contemporary African art"],
    "climate-fiction": ["Solar power plants", "Green roofs"],
    "cosplay": ["Cosplay", "Cosplayers"],
    "cottagecore": ["Cottage gardens", "Bread baking"],
    "creadores-en-espanol": ["Streets in Madrid", "Streets in Mexico City"],
    "createurs-francophones": ["Streets in Paris", "Cafés in Paris"],
    "creativi-in-italiano": ["Streets in Milan", "Streets in Rome"],
    "criadores-em-portugues": ["Streets in Lisbon", "Street art in São Paulo"],
    "kreative-auf-deutsch": ["Street art in Berlin", "Streets in Berlin"],
    "nihongo-creators": ["Streets in Tokyo", "Shibuya"],
    "diy-punk": ["Punk rock concerts", "Punk rock bands performing"],
    "dreampop": ["Rock concerts", "Concert lighting"],
    "drill": ["Rappers performing", "Hip hop concerts"],
    "hyperpop": ["Electronic music concerts", "Laser lighting displays"],
    "indie-sleaze": ["Nightclubs interiors", "Parties"],
    "jazz-revival": ["Jazz clubs", "Jazz musicians performing"],
    "latin-trap": ["Reggaeton", "Latin music concerts"],
    "new-weird": ["Installation art", "Contemporary art exhibitions"],
    "queer-cinema": ["Film festivals", "LGBT film festivals"],
    "sneakerheads": ["Sneakers", "Shoe shops"],
    "vaporwave-revival": ["Shopping mall interiors", "Video arcades"],
    "y2k-revival": ["CRT monitors", "Personal computers of the 1990s"],
    "workshop-street-team": ["Wheatpaste posters", "Posters on walls"],
    "48-hour-film": ["Film crews at work", "Clapperboards"],
    "album-in-a-weekend": ["Recording studios", "Mixing consoles"],
    "beat-battle": ["Drum machines", "Music production studios"],
    "demo-day-prep": ["Presentations", "Conference speakers"],
    "hackathon-crews": ["Hackathons"],
    "nanowrimo-sprint": ["Writers at work", "Manuscripts"],
    "one-take-music-video": ["Steadicams", "Music video production"],
    "open-mic-night": ["Open mic nights", "Acoustic performances"],
    "podcast-pilot-week": ["Podcasting", "Podcast studios"],
    "reel-a-day": ["Smartphone photography", "Video bloggers"],
    "rpg-one-shot-crew": ["Role-playing game sessions", "Tabletop games"],
    "sketch-a-day": ["Sketchbooks", "Urban sketching"],
    "solo-dev-jam": ["Video game developers at work", "Game jams"],
    "fort-lauderdale": ["Fort Lauderdale, Florida", "Buildings in Fort Lauderdale, Florida"],
})




def search_category(cat):
    out = []
    data = api({
        "action": "query", "generator": "categorymembers",
        "gcmtitle": "Category:" + cat, "gcmtype": "file", "gcmlimit": "50",
        "prop": "imageinfo",
        "iiprop": "url|size|extmetadata|mime", "iiurlwidth": "1600",
    })
    for p in (data.get("query", {}).get("pages") or []):
        title = p.get("title")
        ii = (p.get("imageinfo") or [{}])[0]
        meta = ii.get("extmetadata") or {}
        lic = strip_html(meta.get("LicenseShortName", {}).get("value"))
        if not title or not lic:
            continue
        if not ALLOWED.match(lic.replace(" ", "-")) and not ALLOWED.match(lic):
            continue
        w, h = ii.get("width", 0), ii.get("height", 0)
        if w < 1300 or h < 800 or w < h * 1.05:
            continue
        if ii.get("mime") not in ("image/jpeg", "image/png", "image/webp"):
            continue
        if BAD_TITLE.search(title):
            continue
        out.append({
            "title": title,
            "descriptionurl": ii.get("descriptionurl"),
            "download": ii.get("thumburl") or ii.get("url"),
            "width": w, "height": h,
            "license": lic,
            "license_url": strip_html(meta.get("LicenseUrl", {}).get("value")) or None,
            "author": strip_html(meta.get("Artist", {}).get("value")) or "Unknown",
            "cat": cat,
            "rank": -1,
        })
    return out

def search_group(shapes):
    seen, out = set(), []
    for i, shape in enumerate(shapes):
        data = api({
            "action": "query", "generator": "search",
            "gsrsearch": "filetype:bitmap " + shape,
            "gsrnamespace": "6", "gsrlimit": "40",
            "prop": "imageinfo",
            "iiprop": "url|size|extmetadata|mime",
            "iiurlwidth": "1600",
        })
        for p in (data.get("query", {}).get("pages") or []):
            title = p.get("title")
            if not title or title in seen:
                continue
            seen.add(title)
            ii = (p.get("imageinfo") or [{}])[0]
            meta = ii.get("extmetadata") or {}
            lic = strip_html(meta.get("LicenseShortName", {}).get("value"))
            if not lic or (not ALLOWED.match(lic.replace(" ", "-")) and not ALLOWED.match(lic)):
                continue
            w, h = ii.get("width", 0), ii.get("height", 0)
            if w < 1300 or h < 800 or w < h * 1.05:
                continue
            if ii.get("mime") not in ("image/jpeg", "image/png", "image/webp"):
                continue
            if BAD_TITLE.search(title):
                continue
            out.append({
                "title": title,
                "descriptionurl": ii.get("descriptionurl"),
                "download": ii.get("thumburl") or ii.get("url"),
                "width": w, "height": h,
                "license": lic,
                "license_url": strip_html(meta.get("LicenseUrl", {}).get("value")) or None,
                "author": strip_html(meta.get("Artist", {}).get("value")) or "Unknown",
                "rank": i,
            })
    return out


def cmd_source(only=None):
    os.makedirs(OUT, exist_ok=True)
    manifest = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}
    for slug, shapes in GROUPS.items():
        if only and slug not in only:
            continue
        if not only and manifest.get(slug, {}).get("pick"):
            print(f"= {slug} already picked")
            continue
        cands = []
        for ci, cat in enumerate(CATS.get(slug, [])):
            got = search_category(cat)
            for g in got:
                g["rank"] = -100 + ci
            cands += got
            print(f"  cat {cat}: {len(got)}")
        cands += search_group(shapes)
        if not cands:
            print(f"! {slug} no candidates")
            continue
        cands.sort(key=lambda c: (c["rank"], -c["width"]))
        manifest[slug] = {"pick": cands[0], "alts": cands[1:8]}
        print(f"+ {slug}: {cands[0]['title']} [{cands[0]['license']}] ({len(cands)} ok)")
        json.dump(manifest, open(MANIFEST, "w"), indent=1)
    json.dump(manifest, open(MANIFEST, "w"), indent=1)
    print("manifest:", MANIFEST, len(manifest), "groups")


def cmd_pick(slug, index):
    """Promote an alternate candidate to the pick."""
    manifest = json.load(open(MANIFEST))
    row = manifest[slug]
    alts = row["alts"]
    chosen = alts[int(index)]
    row["alts"] = [row["pick"]] + [a for a in alts if a is not chosen]
    row["pick"] = chosen
    json.dump(manifest, open(MANIFEST, "w"), indent=1)
    print("picked", slug, chosen["title"])


# ------------------------------------------------------------------ treatment
def treat(src_bytes, size, sat=0.22, cool=(0.98, 1.0, 1.06)):
    from PIL import Image, ImageEnhance, ImageOps
    im = Image.open(io.BytesIO(src_bytes)).convert("RGB")
    im = ImageOps.exif_transpose(im)
    im = ImageOps.fit(im, size, method=Image.LANCZOS, centering=(0.5, 0.45))
    im = ImageEnhance.Color(im).enhance(sat)
    im = ImageEnhance.Contrast(im).enhance(1.12)
    im = ImageEnhance.Brightness(im).enhance(0.95)
    r, g, b = im.split()
    r = r.point(lambda v: min(255, int(v * cool[0])))
    g = g.point(lambda v: min(255, int(v * cool[1])))
    b = b.point(lambda v: min(255, int(v * cool[2])))
    im = Image.merge("RGB", (r, g, b))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=82, optimize=True, progressive=True)
    return buf.getvalue()


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read()
        except Exception:  # noqa: BLE001 - Commons rate limits aggressively
            if attempt == 5:
                raise
            time.sleep(5 * (attempt + 1))
    return b""


def cmd_build(only=None):
    manifest = json.load(open(MANIFEST))
    os.makedirs(os.path.join(OUT, "cover"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "avatar"), exist_ok=True)
    for slug, row in manifest.items():
        if only and slug not in only:
            continue
        cover_path = os.path.join(OUT, "cover", slug + ".jpg")
        if os.path.exists(cover_path) and not only:
            continue
        raw = fetch(row["pick"]["download"])
        time.sleep(1.0)
        open(cover_path, "wb").write(treat(raw, (1600, 1000)))
        open(os.path.join(OUT, "avatar", slug + ".jpg"), "wb").write(treat(raw, (512, 512)))
        print("built", slug)


def cmd_upload():
    manifest = json.load(open(MANIFEST))
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    rows = []
    for slug in manifest:
        for folder in ("cover", "avatar"):
            path = f"group/{folder}/{slug}.jpg"
            data = open(os.path.join(OUT, folder, slug + ".jpg"), "rb").read()
            req = urllib.request.Request(
                f"{base}/storage/v1/object/covers/{path}", data=data, method="POST",
                headers={"Authorization": f"Bearer {key}", "apikey": key,
                         "Content-Type": "image/jpeg", "x-upsert": "true"})
            with urllib.request.urlopen(req, timeout=120) as r:
                r.read()
        pick = manifest[slug]["pick"]
        rows.append({
            "slug": slug,
            "cover_url": f"{base}/storage/v1/object/public/covers/group/cover/{slug}.jpg",
            "avatar_url": f"{base}/storage/v1/object/public/covers/group/avatar/{slug}.jpg",
            "source_url": pick["descriptionurl"],
            "author": pick["author"][:200],
            "license": pick["license"],
            "license_url": pick["license_url"],
            "title": pick["title"],
        })
        print("uploaded", slug)
    json.dump(rows, open(os.path.join(OUT, "rows.json"), "w"), indent=1)
    print("rows:", os.path.join(OUT, "rows.json"))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "source"
    if cmd == "source":
        cmd_source(sys.argv[2:] or None)
    elif cmd == "list":
        import json as _j
        m = _j.load(open(MANIFEST))
        for slug, row in m.items():
            print("##", slug)
            print("   pick:", row["pick"]["title"])
            for i, a in enumerate(row["alts"]):
                print(f"    [{i}]", a["title"])
    elif cmd == "pick":
        cmd_pick(sys.argv[2], sys.argv[3])
    elif cmd == "build":
        cmd_build(sys.argv[2:] or None)
    elif cmd == "upload":
        cmd_upload()
    else:
        raise SystemExit("unknown command " + cmd)
