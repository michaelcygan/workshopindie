#!/usr/bin/env python3
"""
Source, treat and attach city-group photography.

  python3 scripts/geo/city-photos.py source     # find CC/PD candidates on Commons
  python3 scripts/geo/city-photos.py build      # download + brand-treat picked files
  python3 scripts/geo/city-photos.py upload     # upload to storage + print SQL

Only public domain / CC0 / CC BY / CC BY-SA files are accepted. Every pick keeps
its source URL, author and license so attribution can be shown and re-checked.
"""
import io, json, os, sys, time, urllib.parse, urllib.request, re

OUT = "/tmp/city-photos"
MANIFEST = os.path.join(OUT, "manifest.json")
API = "https://commons.wikimedia.org/w/api.php"
UA = "WorkshopIndie/1.0 (city group photos; https://workshopindie.com)"

ALLOWED = re.compile(r"^(cc0|cc-zero|cc-by-\d|cc-by-sa-\d|pd|public domain)", re.I)

CITIES = [
    ("akron", "Akron, Ohio"), ("ann-arbor", "Ann Arbor, Michigan"),
    ("austin", "Austin, Texas"), ("berlin", "Berlin"),
    ("bloomington", "Bloomington, Indiana"), ("chicago", "Chicago"),
    ("cincinnati", "Cincinnati"), ("cleveland", "Cleveland"),
    ("columbus", "Columbus, Ohio"), ("des-moines", "Des Moines, Iowa"),
    ("detroit", "Detroit"), ("fort-wayne", "Fort Wayne, Indiana"),
    ("grand-rapids", "Grand Rapids, Michigan"), ("indianapolis", "Indianapolis"),
    ("iowa-city", "Iowa City, Iowa"), ("kansas-city", "Kansas City, Missouri"),
    ("lawrence", "Lawrence, Kansas"), ("lincoln", "Lincoln, Nebraska"),
    ("london", "London"), ("los-angeles", "Los Angeles"),
    ("madison", "Madison, Wisconsin"), ("mexico-city", "Mexico City"),
    ("milwaukee", "Milwaukee"), ("minneapolis", "Minneapolis"),
    ("new-york", "New York City"), ("omaha", "Omaha, Nebraska"),
    ("rockford", "Rockford, Illinois"), ("saint-louis", "St. Louis"),
    ("saint-paul", "Saint Paul, Minnesota"), ("san-francisco", "San Francisco"),
    ("south-bend", "South Bend, Indiana"), ("tokyo", "Tokyo"),
    ("toledo", "Toledo, Ohio"), ("toronto", "Toronto"),
    ("wichita", "Wichita, Kansas"),
]

# Street-level / architecture / neighborhood texture first, skyline last.
QUERY_SHAPES = [
    'intitle:"{c}" (street OR downtown OR avenue OR neighborhood OR mural)',
    '"{c}" (downtown OR street OR theater OR building OR night)',
    '"{c}" skyline',
]


def api(params):
    params = dict(params, format="json", formatversion="2")
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            if attempt == 3:
                raise
            time.sleep(1.5 * (attempt + 1))
    return {}


def strip_html(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    return re.sub(r"\s+", " ", s).strip()


def search_city(name):
    seen, out = set(), []
    for shape in QUERY_SHAPES:
        data = api({
            "action": "query", "generator": "search",
            "gsrsearch": "filetype:bitmap " + shape.format(c=name),
            "gsrnamespace": "6", "gsrlimit": "30",
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
            if not lic or not ALLOWED.match(lic.replace(" ", "-")) and not ALLOWED.match(lic):
                continue
            w, h = ii.get("width", 0), ii.get("height", 0)
            if w < 1600 or h < 900 or w < h:
                continue
            if ii.get("mime") not in ("image/jpeg", "image/png", "image/webp"):
                continue
            out.append({
                "title": title,
                "descriptionurl": ii.get("descriptionurl"),
                "download": ii.get("thumburl") or ii.get("url"),
                "width": w, "height": h,
                "license": lic,
                "license_url": strip_html(meta.get("LicenseUrl", {}).get("value")) or None,
                "author": strip_html(meta.get("Artist", {}).get("value")) or "Unknown",
                "credit": strip_html(meta.get("Credit", {}).get("value")) or None,
                "shape": shape,
            })
    return out


def cmd_source():
    os.makedirs(OUT, exist_ok=True)
    manifest = {}
    if os.path.exists(MANIFEST):
        manifest = json.load(open(MANIFEST))
    for slug, name in CITIES:
        if slug in manifest and manifest[slug].get("pick"):
            print(f"= {slug} already picked")
            continue
        cands = search_city(name)
        if not cands:
            print(f"! {slug} no candidates")
            continue
        # prefer earlier query shapes (street level), then bigger images
        order = {s: i for i, s in enumerate(QUERY_SHAPES)}
        cands.sort(key=lambda c: (order.get(c["shape"], 9), -c["width"]))
        manifest[slug] = {"city": name, "pick": cands[0], "alts": cands[1:6]}
        print(f"+ {slug}: {cands[0]['title']} [{cands[0]['license']}] ({len(cands)} ok)")
        json.dump(manifest, open(MANIFEST, "w"), indent=1)
    json.dump(manifest, open(MANIFEST, "w"), indent=1)
    print("manifest:", MANIFEST, len(manifest), "cities")


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
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()


def cmd_build(only=None):
    manifest = json.load(open(MANIFEST))
    os.makedirs(os.path.join(OUT, "cover"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "avatar"), exist_ok=True)
    for slug, row in manifest.items():
        if only and slug not in only:
            continue
        pick = row["pick"]
        raw = fetch(pick["download"])
        open(os.path.join(OUT, "cover", slug + ".jpg"), "wb").write(treat(raw, (1600, 1000)))
        open(os.path.join(OUT, "avatar", slug + ".jpg"), "wb").write(treat(raw, (512, 512)))
        print("built", slug)


def cmd_upload():
    manifest = json.load(open(MANIFEST))
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    rows = []
    for slug in manifest:
        for kind, folder in (("cover", "cover"), ("avatar", "avatar")):
            path = f"city/{folder}/{slug}.jpg"
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
            "cover_url": f"{base}/storage/v1/object/public/covers/city/cover/{slug}.jpg",
            "avatar_url": f"{base}/storage/v1/object/public/covers/city/avatar/{slug}.jpg",
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
        cmd_source()
    elif cmd == "build":
        cmd_build(sys.argv[2:] or None)
    elif cmd == "upload":
        cmd_upload()
    else:
        raise SystemExit("unknown command " + cmd)
