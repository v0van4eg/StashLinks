# Dockerfile - оптимизация
FROM python:3.11-slim

# Установка только необходимых пакетов
RUN apt-get update && apt-get install -y \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Кэширование зависимостей
COPY requirements.txt .
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

# Копирование только необходимых файлов
COPY app.py config.py gunicorn_config.py ./
COPY generators/ ./generators/
COPY templates/ ./templates/
COPY static/ ./static/

# Настройка Python для оптимизации памяти
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 5000
CMD ["gunicorn", "--config", "gunicorn_config.py", "app:app"]
