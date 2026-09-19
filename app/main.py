import os
import shutil
import uuid
from typing import List, Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from starlette.middleware.sessions import SessionMiddleware

from . import auth, crud, schemas
from .database import Base, SessionLocal, engine, get_db

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "static", "uploads")

app = FastAPI(title="Book Library Manager")
app.add_middleware(SessionMiddleware, secret_key="library-secret-key-change-me")
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))


@app.on_event("startup")
def on_startup() -> None:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    # seed one default user so the "users" table is never empty
    db = SessionLocal()
    try:
        if crud.get_user_by_login(db, "admin") is None:
            crud.create_user(db, "admin", auth.hash_password("admin123"))
    finally:
        db.close()


def save_upload(file: Optional[UploadFile]) -> Optional[str]:
    if file is None or not file.filename:
        return None
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(UPLOAD_DIR, filename)
    with open(dest, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return f"uploads/{filename}"


# ---------------------------------------------------------------------------
# JSON API -- unauthenticated GETs, authenticated POST/PUT/DELETE
# ---------------------------------------------------------------------------


@app.post("/books", response_model=schemas.BookOut, status_code=201)
def create_book(
    book: schemas.BookCreate,
    db: Session = Depends(get_db),
    user=Depends(auth.get_current_user),
):
    return crud.create_book(db, book.title, book.author, book.pages, book.image)


@app.get("/books", response_model=List[schemas.BookOut])
def get_books(author: Optional[str] = None, db: Session = Depends(get_db)):
    if author is None:
        return crud.get_all_books(db)
    books = crud.get_books_by_author(db, author)
    if books is None:
        raise HTTPException(status_code=404, detail="Author not found")
    return books


@app.get("/books/{author}", response_model=List[schemas.BookOut])
def get_books_by_author(author: str, db: Session = Depends(get_db)):
    books = crud.get_books_by_author(db, author)
    if books is None:
        raise HTTPException(status_code=404, detail="Author not found")
    return books


@app.put("/books", response_model=schemas.BookOut)
def update_book(
    data: schemas.BookUpdate,
    db: Session = Depends(get_db),
    user=Depends(auth.get_current_user),
):
    if crud.get_author_by_name(db, data.author) is None:
        raise HTTPException(status_code=404, detail="Author not found")
    book = crud.update_book(db, data.author, data.title, data.new_pages)
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@app.delete("/books", status_code=204)
def delete_book(
    data: schemas.BookDelete,
    db: Session = Depends(get_db),
    user=Depends(auth.get_current_user),
):
    if crud.get_author_by_name(db, data.author) is None:
        raise HTTPException(status_code=404, detail="Author not found")
    ok = crud.delete_book(db, data.author, data.title)
    if not ok:
        raise HTTPException(status_code=404, detail="Book not found")


# ---------------------------------------------------------------------------
# HTML pages
# ---------------------------------------------------------------------------


@app.get("/")
def index(request: Request, db: Session = Depends(get_db)):
    books = crud.get_all_books(db)
    user = auth.get_optional_user(request, db)
    return templates.TemplateResponse(
        request, "index.html", {"books": books, "user": user}
    )


@app.get("/login")
def login_form(request: Request, error: Optional[str] = None):
    return templates.TemplateResponse(
        request, "login.html", {"error": error}
    )


@app.post("/login")
def login_submit(
    request: Request,
    login: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    user = auth.authenticate_user(db, login, password)
    if user is None:
        return RedirectResponse(
            url="/login?error=1", status_code=status.HTTP_303_SEE_OTHER
        )
    request.session["user"] = user.login
    return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)


@app.get("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)


@app.get("/web/books/add")
def add_book_form(request: Request, user=Depends(auth.get_current_user)):
    return templates.TemplateResponse(
        request, "add_book.html", {"user": user}
    )


@app.post("/web/books/add")
def add_book_submit(
    request: Request,
    title: str = Form(...),
    author: str = Form(...),
    pages: int = Form(...),
    book_image: Optional[UploadFile] = File(None),
    author_image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    user=Depends(auth.get_current_user),
):
    book_image_path = save_upload(book_image)
    author_image_path = save_upload(author_image)
    crud.create_book(db, title, author, pages, book_image_path, author_image_path)
    return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)


@app.post("/web/books/update")
def update_book_web(
    request: Request,
    title: str = Form(...),
    author: str = Form(...),
    new_pages: int = Form(...),
    db: Session = Depends(get_db),
    user=Depends(auth.get_current_user),
):
    crud.update_book(db, author, title, new_pages)
    return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)


@app.post("/web/books/delete")
def delete_book_web(
    request: Request,
    title: str = Form(...),
    author: str = Form(...),
    db: Session = Depends(get_db),
    user=Depends(auth.get_current_user),
):
    crud.delete_book(db, author, title)
    return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)
