# gunicorn_config.py
bind = "0.0.0.0:5000"
workers = 8  # Или вычислите динамически
worker_class = "sync"  # sync, gevent, eventlet и др. sync - стандартный
worker_connections = 1000 # Для sync worker_class не используется, но полезно для async
timeout = 600 # Увеличено, если у вас долгие операции
keepalive = 2
max_requests = 1000 # Перезапуск воркера после N запросов (помогает с утечками памяти)
max_requests_jitter = 100 # Добавляет случайности к max_requests
preload_app = True # Загружает приложение перед форком воркеров (может ускорить запуск и снизить потребление памяти)
