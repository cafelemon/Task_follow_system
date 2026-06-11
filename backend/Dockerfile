FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml ./
RUN mkdir -p app \
    && touch app/__init__.py \
    && pip install --no-cache-dir -e . \
    && rm -rf app

COPY app ./app

COPY alembic ./alembic
COPY alembic.ini ./

ENV PYTHONUNBUFFERED=1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
