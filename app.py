# app.py
from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for, session
import os
import uuid
import zipfile
from config import Config, allowed_file
import re
import unicodedata
from urllib.parse import quote
import tempfile
import shutil
import json
from datetime import datetime
from urllib.parse import quote, unquote
import logging
import psutil
import time

# Импортируем фабрику генераторов
from generators import GeneratorFactory
from PIL import Image

app = Flask(__name__)
app.config.from_object(Config)

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

RESULTS_FOLDER = 'results'

# Инициализируем папку для результатов
if not os.path.exists(RESULTS_FOLDER):
    os.makedirs(RESULTS_FOLDER)
    logger.info(f"Папка для результатов создана: {RESULTS_FOLDER}")


# --- Функции для мониторинга ресурсов ---
def check_system_resources():
    """Проверка системных ресурсов (только для информации)"""
    try:
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')

        return {
            'memory_percent': memory.percent,
            'disk_free_gb': disk.free / (1024 ** 3),
            'load_avg': os.getloadavg()[0] if hasattr(os, 'getloadavg') else 0
        }
    except Exception as e:
        logger.warning(f"Ошибка проверки ресурсов: {e}")
        return {
            'memory_percent': 0,
            'disk_free_gb': 100,
            'load_avg': 0
        }


# Убрана проверка should_accept_upload - принимаем все загрузки

# --- Оптимизированная функция создания миниатюры ---
def create_thumbnail(source_path, target_path, size=(90, 90)):
    """
    Создает миниатюру изображения.
    """
    try:
        with Image.open(source_path) as img:
            # Конвертируем в RGB если нужно (для PNG с прозрачностью)
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')

            # Используем LANCZOS для хорошего качества уменьшения
            img.thumbnail(size, Image.Resampling.LANCZOS)

            # Сохраняем миниатюру в формате JPEG для единообразия
            if not target_path.lower().endswith(('.jpg', '.jpeg')):
                target_path = os.path.splitext(target_path)[0] + '_thumb.jpg'

            # Сохраняем с оптимизацией
            img.save(target_path, "JPEG", quality=70, optimize=True)
            logger.debug(f"Миниатюра создана: {target_path}")
            return target_path
    except Exception as e:
        logger.error(f"Ошибка при создании миниатюры {target_path}: {e}")
        return None


# --- Вспомогательные функции ---
def safe_folder_name(name: str) -> str:
    """Преобразует строку в безопасное имя папки"""
    if not name:
        return "unnamed"
    name = unicodedata.normalize('NFKD', name)
    name = re.sub(r'[^\w\s-]', '', name, flags=re.UNICODE)
    name = re.sub(r'[-\s]+', '-', name, flags=re.UNICODE).strip('-_')
    return name[:255] if name else "unnamed"


def get_article_from_path(file_path, temp_dir):
    """Извлекает артикул из пути файла"""
    try:
        relative_path = os.path.relpath(os.path.dirname(file_path), temp_dir)
        if relative_path == '.':
            return "unknown"

        # Артикул - это первая папка в пути
        article = os.path.basename(relative_path) if relative_path.count(os.sep) == 0 else relative_path.split(os.sep)[
            0]
        return article
    except Exception as e:
        logger.warning(f"Ошибка извлечения артикула из {file_path}: {e}")
        return "unknown"


# --- Оптимизированная обработка файлов ---
def process_single_file_efficiently(source_path, filename, template_name, article):
    """Эффективная обработка одного файла"""
    try:
        template_folder = safe_folder_name(template_name)
        article_folder = safe_folder_name(article)
        full_path = os.path.join(Config.UPLOAD_FOLDER, template_folder, article_folder)
        os.makedirs(full_path, exist_ok=True)

        # Генерируем уникальные имена один раз
        file_name_base = os.path.splitext(filename)[0]
        unique_suffix = uuid.uuid4().hex[:6]
        file_extension = os.path.splitext(filename)[1]

        unique_filename = f"{file_name_base}_{unique_suffix}{file_extension}"
        thumb_filename = f"{file_name_base}_{unique_suffix}_thumb.jpg"

        target_file = os.path.join(full_path, unique_filename)
        thumb_target = os.path.join(full_path, thumb_filename)

        # Копируем оригинал
        shutil.copy2(source_path, target_file)

        # Создаем миниатюру
        thumbnail_result = create_thumbnail(source_path, thumb_target)

        # Генерируем URLs
        image_url = "{}/images/{}/{}/{}".format(
            Config.BASE_URL,
            quote(template_folder, safe=''),
            quote(article_folder, safe=''),
            quote(unique_filename, safe='')
        )

        # Используем миниатюру если создана, иначе оригинал
        if thumbnail_result:
            thumbnail_url = "{}/images/{}/{}/{}".format(
                Config.BASE_URL,
                quote(template_folder, safe=''),
                quote(article_folder, safe=''),
                quote(thumb_filename, safe='')
            )
        else:
            thumbnail_url = image_url

        return {
            'url': image_url,
            'article': article,
            'filename': unique_filename,
            'thumbnail_url': thumbnail_url
        }

    except Exception as e:
        logger.error(f"Ошибка обработки файла {filename}: {e}")
        return None


# --- Оптимизированная обработка ZIP-архивов БЕЗ ОГРАНИЧЕНИЙ ---
def process_zip_archive_unlimited(zip_file, template_name):
    """Обработка ZIP-архива без ограничений на количество файлов"""
    image_urls = []

    with tempfile.TemporaryDirectory() as temp_dir:
        zip_path = os.path.join(temp_dir, zip_file.filename)
        zip_file.save(zip_path)

        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                # Получаем информацию о файлах
                file_infos = []
                for file_info in zip_ref.infolist():
                    if (not file_info.is_dir() and
                            allowed_file(file_info.filename) and
                            not any(skip in file_info.filename.lower() for skip in ['thumbs.db', '.ds_store'])):
                        file_infos.append(file_info)

                logger.info(f"Начата обработка {len(file_infos)} файлов")

                # Обрабатываем ВСЕ файлы без ограничений
                for i, file_info in enumerate(file_infos):
                    try:
                        # Извлекаем только один файл
                        zip_ref.extract(file_info, temp_dir)
                        source_file = os.path.join(temp_dir, file_info.filename)

                        # Получаем артикул
                        article = get_article_from_path(source_file, temp_dir)

                        # Обрабатываем файл
                        result = process_single_file_efficiently(
                            source_file,
                            os.path.basename(file_info.filename),
                            template_name,
                            article
                        )

                        if result:
                            image_urls.append(result)

                        # Прогресс каждые 100 файлов
                        if (i + 1) % 100 == 0:
                            logger.info(f"Обработано {i + 1}/{len(file_infos)} файлов")

                        # Очищаем временный файл сразу после обработки
                        try:
                            os.remove(source_file)
                        except OSError as e:
                            logger.warning(f"Не удалось удалить временный файл {source_file}: {e}")

                    except Exception as e:
                        logger.error(f"Ошибка обработки файла {file_info.filename}: {e}")
                        continue

        except zipfile.BadZipFile:
            logger.error("Некорректный ZIP-архив")
            raise Exception("Некорректный ZIP-архив")
        except Exception as e:
            logger.error(f"Ошибка чтения ZIP-архива: {e}")
            raise

    logger.info(f"Успешно обработано {len(image_urls)} файлов")
    return image_urls


# --- Функции для работы с XLSX ---
def generate_xlsx_document(image_data, template_name):
    """Генерирует XLSX документ используя фабрику генераторов"""
    generator = GeneratorFactory.create_generator(template_name)
    return generator.generate(image_data, template_name)


def save_results_to_file(image_data, product_name=None):
    """Сохраняет результаты обработки в JSON-файл"""
    result_id = uuid.uuid4().hex
    results_data = {
        'image_data': image_data,
        'product_name': product_name or '',
        'timestamp': datetime.now().isoformat()
    }
    filename = f"results_{result_id}.json"
    filepath = os.path.join(Config.RESULTS_FOLDER, filename)
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(results_data, f, ensure_ascii=False, indent=4)
        logger.info(f"Результаты сохранены в {filename}")
        return result_id
    except Exception as e:
        logger.error(f"Ошибка сохранения результатов: {e}")
        raise


def load_results_from_file(result_id):
    """Загружает результаты из JSON-файла"""
    filename = f"results_{result_id}.json"
    filepath = os.path.join(Config.RESULTS_FOLDER, filename)
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if 'image_data' in data:
                return data
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Ошибка чтения файла {filepath}: {e}")
    return None


# --- Логика обработки загрузок БЕЗ ОГРАНИЧЕНИЙ ---
def handle_single_upload_logic(request):
    """Логика обработки отдельных изображений БЕЗ ограничений"""
    product_name = request.form.get('product_name', '').strip()

    if not product_name:
        return None, 'Заполните поле product_name'

    # БЕЗ ограничения количества файлов
    uploaded_files = request.files.getlist('images')
    logger.info(f"Начата обработка {len(uploaded_files)} отдельных файлов")

    template_folder = "generic"
    product_folder = safe_folder_name(product_name)
    full_path = os.path.join(Config.UPLOAD_FOLDER, template_folder, product_folder)
    os.makedirs(full_path, exist_ok=True)

    image_urls = []
    for i, file in enumerate(uploaded_files):
        if file and allowed_file(file.filename):
            try:
                random_hex = uuid.uuid4().hex[:6]
                file_extension = os.path.splitext(file.filename)[1]
                file_name = os.path.splitext(file.filename)[0]
                unique_filename = f"{file_name}-{random_hex}{file_extension}"
                file_path = os.path.join(full_path, unique_filename)
                file.save(file_path)

                # Создание миниатюры
                thumb_file_name = f"{file_name}-{random_hex}_thumb.jpg"
                thumb_target_path = os.path.join(full_path, thumb_file_name)
                thumbnail_path = create_thumbnail(file_path, thumb_target_path)

                if not thumbnail_path:
                    thumb_file_name = unique_filename

                image_url = "{}/images/{}/{}/{}".format(
                    Config.BASE_URL,
                    quote(template_folder, safe=''),
                    quote(product_folder, safe=''),
                    quote(unique_filename, safe='')
                )

                thumbnail_url = "{}/images/{}/{}/{}".format(
                    Config.BASE_URL,
                    quote(template_folder, safe=''),
                    quote(product_folder, safe=''),
                    quote(thumb_file_name, safe='')
                )

                image_urls.append({
                    'url': image_url,
                    'article': product_name,
                    'filename': unique_filename,
                    'thumbnail_url': thumbnail_url
                })

                # Прогресс каждые 50 файлов
                if (i + 1) % 50 == 0:
                    logger.info(f"Обработано {i + 1}/{len(uploaded_files)} отдельных файлов")

            except Exception as e:
                logger.error(f"Ошибка обработки файла {file.filename}: {e}")
                continue

    if not image_urls:
        return None, 'Не загружено ни одного подходящего изображения'

    try:
        result_id = save_results_to_file(image_urls, product_name)
        return result_id, None
    except Exception as e:
        return None, f'Ошибка сохранения результатов: {str(e)}'


def handle_archive_upload_logic(request):
    """Логика обработки ZIP архива БЕЗ ограничений"""
    album_name = request.form.get('album_name', '').strip()
    archive_file = request.files['archive']

    if not archive_file or archive_file.filename == '':
        return None, 'Выберите архив'

    if not archive_file.filename.lower().endswith('.zip'):
        return None, 'Файл должен быть ZIP архивом'

    # Если имя каталога не указано, используем имя ZIP-архива (без расширения)
    if not album_name:
        album_name = os.path.splitext(archive_file.filename)[0]
        album_name = safe_folder_name(album_name)

    try:
        # Используем обработку БЕЗ ограничений
        start_time = time.time()
        image_data = process_zip_archive_unlimited(archive_file, album_name)
        processing_time = time.time() - start_time

        logger.info(f"Архив обработан за {processing_time:.2f} секунд, файлов: {len(image_data)}")

        if not image_data:
            return None, 'В архиве не найдено подходящих изображений'

        # Сохраняем результаты
        result_id = save_results_to_file(image_data, album_name)
        return result_id, None
    except Exception as e:
        logger.error(f"Ошибка при обработке архива: {str(e)}")
        return None, f'Ошибка при обработке архива: {str(e)}'


# --- Маршруты Flask ---
@app.route('/admin', methods=['GET'])
def index():
    return render_template('index.html',
                           product_name='',
                           image_urls=[],
                           error='')


@app.route('/admin', methods=['POST'])
def handle_upload():
    try:
        if 'archive' in request.files and request.files['archive'].filename != '':
            result_id, error = handle_archive_upload_logic(request)
        else:
            result_id, error = handle_single_upload_logic(request)

        if error:
            session['error'] = error
            return redirect(url_for('index'))

        if result_id:
            return redirect(url_for('view_results', result_id=result_id))

        return redirect(url_for('index'))
    except Exception as e:
        logger.error(f"Ошибка в handle_upload: {e}")
        session['error'] = f'Внутренняя ошибка сервера: {str(e)}'
        return redirect(url_for('index'))


@app.route('/admin/results/<result_id>', methods=['GET'])
def view_results(result_id):
    try:
        results_data = load_results_from_file(result_id)
        if results_data:
            image_urls = results_data.get('image_data', [])
            product_name = results_data.get('product_name', '')
            return render_template('index.html',
                                   image_urls=image_urls,
                                   product_name=product_name,
                                   error='')
        else:
            error = 'Результаты не найдены или срок их действия истек.'
            return render_template('index.html',
                                   image_urls=[],
                                   product_name='',
                                   error=error)
    except Exception as e:
        logger.error(f"Ошибка в view_results: {e}")
        return render_template('index.html',
                               image_urls=[],
                               product_name='',
                               error='Ошибка загрузки результатов')


@app.route('/')
def hello():
    return render_template('hello.html')


@app.route('/admin/download-xlsx', methods=['POST'])
def download_xlsx():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        image_data = data.get('image_data', [])
        template_name = data.get('template_name', '')
        separator = data.get('separator', 'comma')

        if not image_data:
            return jsonify({'error': 'No image data provided'}), 400

        if not template_name:
            return jsonify({'error': 'Template name is required for XLSX generation'}), 400

        if template_name not in Config.TEMPLATES:
            return jsonify({'error': f'Invalid template: {template_name}'}), 400

        logger.info(f"Генерация XLSX для шаблона: {template_name}, файлов: {len(image_data)}")

        # Сортировка данных
        def sort_key(item):
            filename_from_url = item['url'].split('/')[-1]
            match = re.search(r'_(\d+)_[a-f0-9]+\.\w+$', filename_from_url)
            if match:
                try:
                    order_num = int(match.group(1))
                except ValueError:
                    order_num = 0
            else:
                order_num = 0
            return (item['article'], order_num)

        image_data.sort(key=sort_key)

        # Генерация XLSX
        generator = GeneratorFactory.create_generator(template_name, separator)
        xlsx_buffer = generator.generate(image_data, template_name)

        separator_suffix = "_перенос" if separator == 'newline' else "_запятые"
        filename = f"{safe_folder_name(template_name)}{separator_suffix}_images.xlsx"

        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx', mode='w+b') as temp_file:
            temp_file.write(xlsx_buffer.getvalue())
            temp_file_path = temp_file.name

        try:
            response = send_file(
                temp_file_path,
                as_attachment=True,
                download_name=filename,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            return response
        finally:
            try:
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
            except Exception as e:
                logger.error(f"Ошибка при удалении временного файла: {e}")

    except Exception as e:
        logger.error(f"Error generating XLSX: {str(e)}")
        return jsonify({'error': f'Ошибка при генерации XLSX-файла: {str(e)}'}), 500


@app.route('/admin/archive')
def archive():
    """
    Отображает архив всех загруженных изображений из папки uploads.
    """
    try:
        image_data = []
        uploads_path = Config.UPLOAD_FOLDER
        if not os.path.exists(uploads_path):
            logger.warning(f"Папка uploads не найдена: {uploads_path}")
            return render_template('archive.html', image_data=image_data,
                                   error="Папка uploads пуста или не существует.")

        # Проходим по структуре папок
        for template_folder in os.listdir(uploads_path):
            template_path = os.path.join(uploads_path, template_folder)
            if os.path.isdir(template_path):
                for article_folder in os.listdir(template_path):
                    article_path = os.path.join(template_path, article_folder)
                    if os.path.isdir(article_path):
                        for filename in os.listdir(article_path):
                            file_path = os.path.join(article_path, filename)
                            if (os.path.isfile(file_path) and
                                    allowed_file(filename) and
                                    '_thumb' not in filename):

                                image_url = f"{Config.BASE_URL}/images/{quote(template_folder, safe='')}/{quote(article_folder, safe='')}/{quote(filename, safe='')}"
                                file_name_base = os.path.splitext(filename)[0]
                                thumb_filename = f"{file_name_base}_thumb.jpg"
                                thumb_path = os.path.join(article_path, thumb_filename)
                                thumbnail_url = image_url

                                if os.path.exists(thumb_path):
                                    thumbnail_url = f"{Config.BASE_URL}/images/{quote(template_folder, safe='')}/{quote(article_folder, safe='')}/{quote(thumb_filename, safe='')}"

                                image_data.append({
                                    'url': image_url,
                                    'article': article_folder,
                                    'filename': filename,
                                    'template': template_folder,
                                    'thumbnail_url': thumbnail_url
                                })

        # Сортировка данных
        def sort_key(item):
            template_order = item['template']
            article_order = item['article']
            match = re.search(r'_(\d+)_[a-f0-9]+\.\w+$', item['filename'])
            if match:
                try:
                    order_num = int(match.group(1))
                except ValueError:
                    order_num = 0
            else:
                order_num = 0
            return (template_order, article_order, order_num)

        image_data.sort(key=sort_key)

        logger.info(f"Собрано {len(image_data)} элементов для архива")
        return render_template('archive.html', image_data=image_data, error='')

    except Exception as e:
        logger.error(f"Ошибка в archive: {e}")
        return render_template('archive.html', image_data=[], error='Ошибка загрузки архива')


@app.route('/admin/delete-image', methods=['POST'])
def delete_image():
    """Удаляет изображение и его миниатюру"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        image_url = data.get('image_url')
        if not image_url:
            return jsonify({'error': 'No image URL provided'}), 400

        # Извлекаем путь из URL
        base_path = f"{Config.BASE_URL}/images/"
        if not image_url.startswith(base_path):
            return jsonify({'error': 'Invalid image URL'}), 400

        relative_path = image_url[len(base_path):]
        decoded_path = unquote(relative_path)
        path_parts = decoded_path.split('/')

        if len(path_parts) < 3:
            return jsonify({'error': 'Invalid image path'}), 400

        template_folder = path_parts[0]
        article_folder = path_parts[1]
        filename = '/'.join(path_parts[2:])

        # Полный путь к файлу
        file_path = os.path.join(Config.UPLOAD_FOLDER, template_folder, article_folder, filename)

        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404

        # Удаляем основной файл
        os.remove(file_path)

        # Пытаемся найти и удалить миниатюру
        file_name_base = os.path.splitext(filename)[0]
        thumb_variants = [
            f"{file_name_base}_thumb.jpg",
            f"{file_name_base}_thumb.jpeg",
            f"{file_name_base}_thumb.png"
        ]

        for thumb_name in thumb_variants:
            thumb_path = os.path.join(Config.UPLOAD_FOLDER, template_folder, article_folder, thumb_name)
            if os.path.exists(thumb_path):
                os.remove(thumb_path)
                logger.info(f"Удалена миниатюра: {thumb_path}")

        # Очистка пустых папок
        article_folder_path = os.path.join(Config.UPLOAD_FOLDER, template_folder, article_folder)
        if os.path.exists(article_folder_path) and not os.listdir(article_folder_path):
            os.rmdir(article_folder_path)
            logger.info(f"Удалена пустая папка артикула: {article_folder_path}")

            template_folder_path = os.path.join(Config.UPLOAD_FOLDER, template_folder)
            if os.path.exists(template_folder_path) and not os.listdir(template_folder_path):
                os.rmdir(template_folder_path)
                logger.info(f"Удалена пустая папка шаблона: {template_folder_path}")

        return jsonify({'success': True, 'message': 'Изображение и миниатюра удалены'})

    except Exception as e:
        logger.error(f"Error deleting image: {str(e)}")
        return jsonify({'error': f'Ошибка при удалении изображения: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
