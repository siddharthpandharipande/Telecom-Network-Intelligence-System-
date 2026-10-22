import sqlite3
from backend.app.geo import resolve_location_from_coords

conn = sqlite3.connect('backend/data/nexusnet.db')
cur = conn.cursor()
cur.execute("SELECT asset_id, latitude, longitude, country FROM assets WHERE continent IS NULL OR continent = '' OR continent = 'None'")
rows = cur.fetchall()
print(f"Assets needing continent update: {len(rows)}")

for r in rows:
    aid, lat, lng, country = r
    resolved = resolve_location_from_coords(lat, lng)
    cont = resolved.get("continent") or "Asia"
    cur.execute("UPDATE assets SET continent = ? WHERE asset_id = ?", (cont, aid))

conn.commit()
print("Updated successfully.")

cur.execute("SELECT count(*) FROM assets WHERE continent IS NULL")
print("Remaining null continents:", cur.fetchone()[0])
conn.close()
