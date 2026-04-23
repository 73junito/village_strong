import os
import sqlite3
import sys
default_db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'dev.db')
p = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('DB_PATH', default_db_path)
try:
    conn = sqlite3.connect(p)
except Exception as e:
    print('ERROR connecting to DB:', e)
    sys.exit(1)
cur = conn.cursor()
print('Tables:')
for row in cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"):
    print(' -', row[0])

inspect = ['attempts','attempt_items','grade_sync_records','items','assessments','courses','lms_platforms']
print('\nTable column details:')
for t in inspect:
    try:
        cols = [r for r in cur.execute(f"PRAGMA table_info('{t}')")]
        if not cols:
            print(f"\n{t}: (missing)")
            continue
        print('\n' + t)
        for c in cols:
            # cid, name, type, notnull, dflt_value, pk
            print(f"  - {c[1]} ({c[2]}) notnull={c[3]} pk={c[5]} dflt={c[4]}")
    except Exception as e:
        print(f"\n{t}: error {e}")

conn.close()