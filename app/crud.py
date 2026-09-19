from typing import List, Optional

from sqlalchemy.orm import Session

from . import models


def get_author_by_name(db: Session, name: str) -> Optional[models.Author]:
    return db.query(models.Author).filter(models.Author.name == name).first()


def get_or_create_author(
    db: Session, name: str, image: Optional[str] = None
) -> models.Author:
    author = get_author_by_name(db, name)
    if author is None:
        author = models.Author(name=name, image=image)
        db.add(author)
        db.commit()
        db.refresh(author)
    elif image and not author.image:
        author.image = image
        db.commit()
        db.refresh(author)
    return author


def find_book(db: Session, author_name: str, title: str) -> Optional[models.Book]:
    author = get_author_by_name(db, author_name)
    if author is None:
        return None
    for book in author.books:
        if book.title == title:
            return book
    return None


def create_book(
    db: Session,
    title: str,
    author_name: str,
    pages: int,
    image: Optional[str] = None,
    author_image: Optional[str] = None,
) -> models.Book:
    author = get_or_create_author(db, author_name, author_image)
    book = models.Book(title=title, pages=pages, image=image, author=author)
    db.add(book)
    db.commit()
    db.refresh(book)
    return book


def get_all_books(db: Session) -> List[models.Book]:
    return db.query(models.Book).all()


def get_books_by_author(db: Session, author_name: str) -> Optional[List[models.Book]]:
    author = get_author_by_name(db, author_name)
    if author is None:
        return None
    return author.books


def update_book(
    db: Session, author_name: str, title: str, new_pages: int
) -> Optional[models.Book]:
    book = find_book(db, author_name, title)
    if book is None:
        return None
    book.pages = new_pages
    db.commit()
    db.refresh(book)
    return book


def delete_book(db: Session, author_name: str, title: str) -> bool:
    book = find_book(db, author_name, title)
    if book is None:
        return False
    author = book.author
    db.delete(book)
    db.commit()
    if not author.books:
        db.delete(author)
        db.commit()
    return True


def get_user_by_login(db: Session, login: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.login == login).first()


def create_user(db: Session, login: str, hashed_password: str) -> models.User:
    user = models.User(login=login, password=hashed_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
