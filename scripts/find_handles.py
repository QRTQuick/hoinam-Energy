import json, urllib.request
HEADERS = {"User-Agent": "Mozilla/5.0"}
STORES = ["https://ca.ecoflow.com","https://us.ecoflow.com","https://uk.ecoflow.com"]
TRIES = {
    "river-3-ups.png":               ["river-3-ups","ecoflow-river-3-ups-portable-power-station","river-3-ups-power-station","river-3-ups-portable-power-station-1"],
    "river-3-max-plus.png":          ["river-3-max-plus","ecoflow-river-3-max-plus","river-3-max-plus-power-station","river-3-max-plus-portable-power-station"],
    "delta-3-max.png":               ["delta-3-max","ecoflow-delta-3-max","delta-3-max-portable-power-station","delta-3-max-power-station"],
    "delta-3-ultra.png":             ["delta-3-ultra","ecoflow-delta-3-ultra","delta-3-ultra-portable-power-station"],
    "delta-2-extra-battery.png":     ["delta-2-extra-battery","ecoflow-delta-2-extra-battery","delta-2-eb","delta-2-extra-battery-1"],
    "delta-2-max-extra-battery.png": ["delta-2-max-extra-battery","ecoflow-delta-2-max-extra-battery","delta-2-max-eb"],
    "delta-pro-extra-battery.png":   ["delta-pro-extra-battery","ecoflow-delta-pro-extra-battery","delta-pro-eb","delta-pro-extra-battery-1"],
}
for fname, handles in TRIES.items():
    found = False
    for store in STORES:
        for handle in handles:
            try:
                req = urllib.request.Request(f"{store}/products/{handle}.json", headers=HEADERS)
                with urllib.request.urlopen(req, timeout=10) as r:
                    data = json.loads(r.read())
                    imgs = data.get("product",{}).get("images",[])
                    if imgs:
                        src = imgs[0]["src"]
                        print(f"FOUND {fname}: {store}/products/{handle}")
                        print(f"  IMG: {src[:100]}")
                        found = True
                        break
            except Exception:
                pass
        if found:
            break
    if not found:
        print(f"NOT FOUND: {fname}")
