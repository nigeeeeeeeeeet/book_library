# Book Library Manager (DB + Auth + HTML/CSS)

A small FastAPI + SQLite catalogue of books and authors, with session-based
login, image uploads and a Jinja2 front end (linen palette, liquid-metal
buttons, animated cards).

## Structure
```
book_library/
├── app/
│   ├── __init__.py
│   ├── database.py       # engine, SessionLocal, Base, get_db (SQLite)
│   ├── models.py         # Author, Book (1:M), User
│   ├── schemas.py        # Pydantic schemas (incl. UserCreate/UserOut)
│   ├── crud.py           # database operations
│   ├── auth.py           # password hashing (bcrypt) + session check
│   ├── main.py           # JSON API + HTML pages
│   ├── templates/        # Jinja2: base/index/login/add_book + _macros
│   └── static/
│       ├── style.css            # styling
│       ├── liquid-buttons.js    # liquid-metal shader for every button (built, see below)
│       ├── card-gradient.js     # animated WebGL gradient behind each card
│       ├── glow.js              # cursor spotlight + card tilt
│       ├── ui.js                # live search, count-up stats, cover preview
│       └── uploads/             # uploaded covers / author photos
├── frontend/             # source of liquid-buttons.js (optional to touch)
├── requirements.txt
├── test_app.py           # automated check of the DB + authentication
└── README.md
```

## Run
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Open http://127.0.0.1:8000/

On startup the tables `authors`, `books` and `users` are created (FK
`books.author_id -> authors.id`) and, if the `users` table is empty, a default
user is added:

- login: `admin`
- password: `admin123`

Passwords are stored only as bcrypt hashes (`users.password`), never in plain
text.

## Authentication
- Sign in on `/login` (the session is kept in a signed cookie).
- Without signing in, only reading is possible: `GET /`, `GET /books`,
  `GET /books/{author}`.
- Adding, updating and deleting books (`POST/PUT/DELETE /books` and the
  matching `/web/books/...` forms) return `401` without authentication.

## Images
`Author` and `Book` both have an `image` field (a path inside
`static/uploads/`). The "Add a book" form lets you upload a book cover and
(for a new author) the author's photo; without an image a placeholder with
the first letter is shown.

## Front end
- **Buttons:** every button and button-like link uses the `.btn-liquid` class
  (rendered through the `liquid_button` macro in `templates/_macros.html`).
  The metallic rim is the real [Paper Shaders](https://github.com/paper-design/shaders)
  liquid-metal WebGL shader. One shader is rendered off-screen and mirrored
  into each visible button, so the page never runs out of WebGL contexts.
  If WebGL is unavailable, an animated CSS gradient is used instead.
- **Rebuilding the shader bundle** (only needed if you edit
  `frontend/liquid-buttons.src.js`; the built file is already committed):
  ```bash
  cd frontend
  npm install
  npm run build     # writes app/static/liquid-buttons.js
  ```
- Also included: live search (press `/`), animated hero stats, 3D card tilt,
  cursor-following glow and `prefers-reduced-motion` support.

## Check
```bash
python3 test_app.py
```
The script checks that writing without authentication is rejected (401), that
login / wrong password are handled correctly, that CRUD works after login and
is blocked again after logout; it also reads `library.db` directly and prints
the contents of the `users` (with the hash), `authors` and `books` tables and
the foreign key.

> Note: `test_app.py` deletes and recreates `library.db` when it starts.
