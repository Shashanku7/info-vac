import psycopg, json

conn = psycopg.connect("postgresql://infovac:infovac_dev@localhost:5432/infovac")
c = conn.cursor()

c.execute("SELECT id, name, status, created_at FROM programs ORDER BY created_at DESC LIMIT 3")
progs = c.fetchall()
print("=== LATEST PROGRAMS ===")
for r in progs:
    print(r)

if progs:
    latest_id = progs[0][0]
    c.execute(
        "SELECT stage, progress, detail, created_at FROM pipeline_events "
        "WHERE program_id = %s ORDER BY created_at DESC LIMIT 20",
        (latest_id,)
    )
    rows = c.fetchall()
    print(f"\n=== LAST 20 EVENTS FOR {latest_id} ===")
    for r in reversed(rows):
        t = r[3].strftime("%H:%M:%S")
        detail = str(r[2])[:120]
        try:
            d = json.loads(r[2])
            if isinstance(d, dict):
                detail = d.get("message", d.get("detail", detail))[:120]
        except Exception:
            pass
        print(f"  [{t}] {r[0]} ({float(r[1]):.2f}) -- {detail}")

conn.close()
