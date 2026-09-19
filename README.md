# Book Library Manager (DB + Auth + HTML/CSS)

## Структура
```
book_library/
├── app/
│   ├── __init__.py
│   ├── database.py     # engine, SessionLocal, Base, get_db (SQLite)
│   ├── models.py        # Author, Book (1:M), User
│   ├── schemas.py        # Pydantic-схеми (у т.ч. UserCreate/UserOut)
│   ├── crud.py            # операції з БД
│   ├── auth.py             # хешування пароля (bcrypt) + перевірка сесії
│   ├── main.py              # JSON API + HTML-сторінки
│   ├── templates/            # Jinja2: base/index/login/add_book
│   └── static/
│       ├── style.css          # оформлення
│       └── uploads/            # завантажені обкладинки/фото авторів
├── requirements.txt
├── test_app.py                  # автоматична перевірка БД + авторизації
└── README.md
```

## Запуск
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Відкрити http://127.0.0.1:8000/

При старті створюються таблиці `authors`, `books`, `users` (FK
`books.author_id -> authors.id`) і, якщо таблиця `users` порожня,
додається користувач за замовчуванням:

- логін: `admin`
- пароль: `admin123`

Пароль зберігається лише як bcrypt-хеш (`users.password`), ніколи у
відкритому вигляді.

## Аутентифікація
- Вхід — сторінка `/login` (сесія зберігається у підписаній cookie).
- Без входу доступні лише читання: `GET /`, `GET /books`, `GET /books/{author}`.
- Додавання, оновлення й видалення книг (`POST/PUT/DELETE /books` та
  відповідні форми `/web/books/...`) без авторизації повертають `401`.

## Картинки
У `Author` і `Book` є поле `image` (шлях до файлу в `static/uploads/`).
Форма «Додати книгу» дозволяє завантажити обкладинку книги та (для
нового автора) його фото; без картинки показується кольоровий
плейсхолдер з першою літерою.

## Перевірка
```bash
python3 test_app.py
```
Скрипт: перевіряє, що запис без авторизації забороняється (401),
що вхід/невірний пароль обробляються правильно, що після входу
CRUD працює, а після виходу знову блокується; напряму читає
`library.db` і показує вміст таблиць `users` (з хешем), `authors`,
`books` та зовнішній ключ.
