"""Search EcoFlow's Shopify product catalog to find correct handles."""
import json, urllib.request
HEADERS = {"User-Agent": "Mozilla/5.0"}

def fetch(url):
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        return None

# Search all products across pages
store = "https://ca.ecoflow.com"
page = 1
all_handles = []
while True:
    data = fetch(f"{store}/products.json?limit=250&page={page}")
    if not data:
        break
    products = data.get("products", [])
    if not products:
        break
    for p in products:
        title = p.get("title","").lower()
        handle = p.get("handle","")
        if any(kw in title for kw in ["river 3","delta 3 max","delta 3 ultra","delta 2 extra","delta pro extra","delta pro 3 extra"]):
            imgs = p.get("images",[])
            img_src = imgs[0]["src"] if imgs else "no image"
            print(f"  {p['title']:60s}  handle={handle}")
            print(f"    img: {img_src[:90]}")
    page += 1
    if page > 5:
        break
