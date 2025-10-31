FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt /app

RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

COPY . /app

# CMD ["python", "app.py"]

EXPOSE 5000

# Новая команда для запуска Gunicorn
# Пример: 4 рабочих процесса, привязка к localhost:5000
#CMD ["gunicorn", "--workers", "8", "--bind", "0.0.0.0:5000", "app:app"]
# Используем конфигурационный файл
CMD ["gunicorn", "--config", "gunicorn_config.py", "app:app"]
