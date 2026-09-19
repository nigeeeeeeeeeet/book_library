import bcrypt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from . import crud, models
from .database import get_db


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def authenticate_user(db: Session, login: str, password: str):
    user = crud.get_user_by_login(db, login)
    if user is None or not verify_password(password, user.password):
        return None
    return user


def get_current_user(request: Request, db: Session = Depends(get_db)) -> models.User:
    """Raises 401 if there is no valid session -- used to protect write endpoints."""
    login = request.session.get("user")
    if not login:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Необхідна аутентифікація",
        )
    user = crud.get_user_by_login(db, login)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Необхідна аутентифікація",
        )
    return user


def get_optional_user(request: Request, db: Session):
    """Same lookup, but returns None instead of raising -- used for page rendering."""
    login = request.session.get("user")
    if not login:
        return None
    return crud.get_user_by_login(db, login)
