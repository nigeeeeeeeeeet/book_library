"""Manual verification: DB/tables/relationships + auth-protected write endpoints."""
import os
import sqlite3

if os.path.exists("library.db"):
    os.remove("library.db")

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
client.__enter__()  # triggers the startup event (creates tables + seeds admin user)

# 1. writes are blocked without auth
r = client.post("/books", json={"title": "Kobzar", "author": "Taras Shevchenko", "pages": 200})
print("POST /books (no auth) ->", r.status_code)
assert r.status_code == 401

# 2. wrong credentials
r = client.post("/login", data={"login": "admin", "password": "wrong"}, follow_redirects=False)
print("POST /login (wrong pwd) ->", r.status_code, r.headers.get("location"))
assert r.status_code == 303 and "error=1" in r.headers["location"]

# 3. correct login
r = client.post("/login", data={"login": "admin", "password": "admin123"}, follow_redirects=False)
print("POST /login (correct) ->", r.status_code, r.headers.get("location"))
assert r.status_code == 303
assert "session" in client.cookies

# 4. writes now succeed
r = client.post("/books", json={"title": "Kobzar", "author": "Taras Shevchenko", "pages": 200})
print("POST /books (auth) ->", r.status_code, r.json())
assert r.status_code == 201

r = client.post("/books", json={"title": "Lisova Pisnya", "author": "Lesya Ukrainka", "pages": 150})
assert r.status_code == 201

r = client.post("/books", json={"title": "Zapovit", "author": "Taras Shevchenko", "pages": 50})
assert r.status_code == 201

r = client.get("/books")
print("GET /books (public) ->", r.status_code, len(r.json()), "books")
assert len(r.json()) == 3

r = client.get("/books/Taras Shevchenko")
assert len(r.json()) == 2

r = client.put("/books", json={"title": "Zapovit", "author": "Taras Shevchenko", "new_pages": 60})
print("PUT /books (auth) ->", r.status_code, r.json())
assert r.json()["pages"] == 60

r = client.request("DELETE", "/books", json={"title": "Zapovit", "author": "Taras Shevchenko"})
print("DELETE /books (auth) ->", r.status_code)
assert r.status_code == 204

# 5. HTML pages: home renders, add-book form requires auth
r = client.get("/")
print("GET / ->", r.status_code, "admin" in r.text)
assert r.status_code == 200 and "admin" in r.text

r = client.get("/web/books/add")
print("GET /web/books/add (auth) ->", r.status_code)
assert r.status_code == 200

# 6. logout -> writes blocked again
r = client.get("/logout", follow_redirects=False)
assert r.status_code == 303
r = client.post("/books", json={"title": "X", "author": "Someone Else", "pages": 20})
print("POST /books (after logout) ->", r.status_code)
assert r.status_code == 401

r = client.get("/web/books/add")
print("GET /web/books/add (no auth) ->", r.status_code)
assert r.status_code == 401

# 7. inspect the actual sqlite file: tables, FK, hashed password
conn = sqlite3.connect("library.db")
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [row[0] for row in cur.fetchall()]
print("\nTables in library.db:", tables)
assert set(["authors", "books", "users"]).issubset(tables)

cur.execute("PRAGMA foreign_key_list(books)")
print("Foreign keys on 'books':", cur.fetchall())

cur.execute("SELECT id, login, password FROM users")
users = cur.fetchall()
print("users table:", users)
assert len(users) == 1
assert users[0][1] == "admin"
assert users[0][2] != "admin123"          # never plaintext
assert users[0][2].startswith("$2b$")     # bcrypt hash

cur.execute("SELECT id, name, image FROM authors")
print("authors table:", cur.fetchall())
cur.execute("SELECT id, title, pages, image, author_id FROM books")
print("books table:", cur.fetchall())

conn.close()
print("\nAll checks passed: users/authors/books tables, hashing and auth guard all work.")
