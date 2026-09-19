from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class AuthorBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=30)
    image: Optional[str] = None


class AuthorOut(AuthorBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class BookBase(BaseModel):
    title: str = Field(..., min_length=1)
    pages: int = Field(..., gt=10)
    image: Optional[str] = None


class BookCreate(BookBase):
    author: str = Field(..., min_length=3, max_length=30)


class BookOut(BookBase):
    id: int
    author: AuthorOut

    model_config = ConfigDict(from_attributes=True)


class BookUpdate(BaseModel):
    title: str
    author: str
    new_pages: int = Field(..., gt=10)


class BookDelete(BaseModel):
    title: str
    author: str


class AuthorWithBooks(AuthorOut):
    books: List[BookBase] = []

    model_config = ConfigDict(from_attributes=True)


class UserBase(BaseModel):
    login: str = Field(..., min_length=3, max_length=50)


class UserCreate(UserBase):
    password: str = Field(..., min_length=4)


class UserOut(UserBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
