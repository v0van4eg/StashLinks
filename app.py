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
from urllib.parse import quote, unquote  # Добавьте unquote если его нет

# Импортируем фабрику генераторов
from generators import GeneratorFactory
# --- НОВОЕ: Импорт Pillow ---
from PIL import Image
# --- /НОВОЕ ---
# Импортируем фабрику генераторов
from generators import GeneratorFactory

app = Flask(__name__)
app.config.from_object(Config)

RESULTS_FOLDER = 'results'

# Инициализируем папку для результатов
if not os.path.exists(RESULTS_FOLDER):
    os.makedirs(RESULTS_FOLDER)
    print(f"Папка для результатов создана: {RESULTS_FOLDER}")


# --- НОВОЕ: Функция для создания миниатюры ---
def create_thumbnail(source_path, target_path, size=(90, 90)):
    """
    Создает миниатюру изображения.

    Args:
        source_path (str): Путь к исходному изображению.
        target_path (str): Путь для сохранения миниатюры.
        size (tuple): Размер миниатюры (ширина, высота).
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

            # Используем LANCZOS для хорошего качества уменьшения
            img.thumbnail(size, Image.Resampling.LANCZOS)

            # Сохраняем миниатюру в формате JPEG для единообразия
            if not target_path.lower().endswith(('.jpg', '.jpeg')):
                target_path = os.path.splitext(target_path)[0] + '_thumb.jpg'

            # Сохраняем с оптимизацией
            img.save(target_path, "JPEG", quality=85, optimize=True)
            print(f"Миниатюра создана: {target_path}")
            return target_path
    except Exception as e:
        print(f"Ошибка при создании миниатюры {target_path}: {e}")
        return None


# --- /НОВОЕ ---

def safe_folder_name(name: str) -> str:
    """Преобразует строку в безопасное имя папки"""
    if not name:
        return "unnamed"
    name = unicodedata.normalize('NFKD', name)
    name = re.sub(r'[^\w\s-]', '', name, flags=re.UNICODE)
    name = re.sub(r'[-\s]+', '-', name, flags=re.UNICODE).strip('-_')
    return name[:255] if name else "unnamed"


def process_zip_archive(zip_file, template_name):
    """Обрабатывает ZIP-архив и извлекает изображения"""
    image_urls = []
    with tempfile.TemporaryDirectory() as temp_dir:
        zip_path = os.path.join(temp_dir, zip_file.filename)
        zip_file.save(zip_path)

        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)

        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                if file.lower() in ['thumbs.db', '.ds_store']:
                    continue
                if not allowed_file(file):
                    continue

                relative_path = os.path.relpath(root, temp_dir)
                if relative_path == '.':
                    continue

                article = os.path.basename(root) if relative_path.count(os.sep) == 0 else relative_path.split(os.sep)[0]

                template_folder = safe_folder_name(template_name)
                article_folder = safe_folder_name(article)
                full_path = os.path.join(Config.UPLOAD_FOLDER, template_folder, article_folder)
                os.makedirs(full_path, exist_ok=True)

                file_extension = os.path.splitext(file)[1]
                file_name_base = os.path.splitext(file)[0]
                unique_suffix = uuid.uuid4().hex[:6]
                unique_filename = f"{file_name_base}_{unique_suffix}{file_extension}"
                target_file_unique = os.path.join(full_path, unique_filename)
                source_file = os.path.join(root, file)
                shutil.copy2(source_file, target_file_unique)

                # --- НОВОЕ: Создание миниатюры с тем же уникальным суффиксом ---
                thumb_file_name = f"{file_name_base}_{unique_suffix}_thumb.jpg"
                thumb_target_path = os.path.join(full_path, thumb_file_name)
                thumbnail_path = create_thumbnail(target_file_unique, thumb_target_path)

                if not thumbnail_path:
                    # Если не удалось создать миниатюру, используем оригинальное изображение
                    thumb_file_name = unique_filename
                # --- /НОВОЕ ---

                # Генерируем URL для ОРИГИНАЛЬНОГО изображения
                image_url = "{}/images/{}/{}/{}".format(
                    Config.BASE_URL,
                    quote(template_folder, safe=''),
                    quote(article_folder, safe=''),
                    quote(unique_filename, safe='')
                )
                # --- НОВОЕ: Генерируем URL для МИНИАТЮРЫ ---
                thumbnail_url = "{}/images/{}/{}/{}".format(
                    Config.BASE_URL,
                    quote(template_folder, safe=''),
                    quote(article_folder, safe=''),
                    quote(thumb_file_name, safe='')
                )
                # --- /НОВОЕ ---

                image_urls.append({
                    'url': image_url,  # URL оригинала
                    'article': article,
                    'filename': unique_filename,
                    # --- НОВОЕ: Добавляем URL миниатюры ---
                    'thumbnail_url': thumbnail_url
                    # --- /НОВОЕ ---
                })
    return image_urls


def generate_xlsx_document(image_data, template_name):  # Изменено: client_name -> template_name
    """Генерирует XLSX документ используя фабрику генераторов"""
    generator = GeneratorFactory.create_generator(template_name)  # Изменено: client_name -> template_name
    return generator.generate(image_data, template_name)  # Изменено: client_name -> template_name


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
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(results_data, f, ensure_ascii=False, indent=4)
    return result_id


def load_results_from_file(result_id):
    """Загружает результаты из JSON-файла"""
    filename = f"results_{result_id}.json"
    filepath = os.path.join(Config.RESULTS_FOLDER, filename)
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            # Проверяем на наличие image_data
            if 'image_data' in data:  # УБРАНО: and 'template_name' in data
                return data
        except (json.JSONDecodeError, IOError) as e:
            print(f"Ошибка чтения файла {filepath}: {e}")
    return None


def handle_single_upload_logic(request):
    """Логика обработки отдельных изображений"""
    # УБРАНО: template_name = request.form.get('template_name', '').strip()
    product_name = request.form.get('product_name', '').strip()

    if not product_name:  # УБРАНО: or not template_name
        return None, 'Заполните поле product_name'  # УБРАНО: (template_name и product_name должны быть переданы)'

    # УБРАНО: Проверка if template_name not in Config.TEMPLATES:
    # УБРАНО: template_folder = safe_folder_name(template_name)
    template_folder = "generic"  # Используем generic, так как шаблон неизвестен на этапе загрузки
    product_folder = safe_folder_name(product_name)
    full_path = os.path.join(Config.UPLOAD_FOLDER, template_folder,
                             product_folder)  # Изменено: client_folder -> template_folder
    os.makedirs(full_path, exist_ok=True)

    uploaded_files = request.files.getlist('images')

    image_urls = []
    for file in uploaded_files:
        if file and allowed_file(file.filename):
            random_hex = uuid.uuid4().hex[:6]
            file_extension = os.path.splitext(file.filename)[1]
            file_name = os.path.splitext(file.filename)[0]
            unique_filename = f"{file_name}-{random_hex}{file_extension}"
            file_path = os.path.join(full_path, unique_filename)
            file.save(file_path)

            # --- НОВОЕ: Создание миниатюры с тем же уникальным суффиксом ---
            thumb_file_name = f"{file_name}-{random_hex}_thumb.jpg"
            thumb_target_path = os.path.join(full_path, thumb_file_name)
            thumbnail_path = create_thumbnail(file_path, thumb_target_path)

            if not thumbnail_path:
                # Если не удалось создать миниатюру, используем оригинальное изображение
                thumb_file_name = unique_filename
            # --- /НОВОЕ ---

            image_url = "{}/images/{}/{}/{}".format(
                Config.BASE_URL,
                quote(template_folder, safe=''),  # Изменено: client_folder -> template_folder
                quote(product_folder, safe=''),
                quote(unique_filename, safe='')
            )
            # --- НОВОЕ: Генерируем URL для МИНИАТЮРЫ ---
            thumbnail_url = "{}/images/{}/{}/{}".format(
                Config.BASE_URL,
                quote(template_folder, safe=''),
                quote(product_folder, safe=''),
                quote(thumb_file_name, safe='')  # Используем имя миниатюры
            )
            # --- /НОВОЕ ---

            image_urls.append({
                'url': image_url,  # URL оригинала
                'article': product_name,
                'filename': unique_filename,
                # --- НОВОЕ: Добавляем URL миниатюры ---
                'thumbnail_url': thumbnail_url
                # --- /НОВОЕ ---
            })

    if not image_urls:
        return None, 'Не загружено ни одного подходящего изображения'

    # УБРАНО: Передача template_name
    result_id = save_results_to_file(image_urls, product_name)  # УБРАНО: template_name,
    return result_id, None


def handle_archive_upload_logic(request):
    """Логика обработки ZIP архива"""
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
        # Используем album_name как template_name
        image_data = process_zip_archive(archive_file, album_name)
        if not image_data:
            return None, 'В архиве не найдено подходящих изображений'

        # Сохраняем результаты с album_name как product_name
        result_id = save_results_to_file(image_data, album_name)
        return result_id, None
    except Exception as e:
        return None, f'Ошибка при обработке архива: {str(e)}'


# Маршруты Flask
@app.route('/admin', methods=['GET'])
def index():
    # УБРАНО: передача templates и selected_template
    return render_template('index.html',
                           product_name='',
                           image_urls=[],
                           error='')


@app.route('/admin', methods=['POST'])
def handle_upload():
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


@app.route('/admin/results/<result_id>', methods=['GET'])
def view_results(result_id):
    results_data = load_results_from_file(result_id)
    if results_data:
        image_urls = results_data.get('image_data', [])
        # УБРАНО: получение template_name
        # template_name = results_data.get('template_name', '') # Изменено: client_name -> template_name
        product_name = results_data.get('product_name', '')
        # УБРАНО: передача templates и selected_template
        return render_template('index.html',
                               image_urls=image_urls,
                               product_name=product_name,
                               error='')
    else:
        error = 'Результаты не найдены или срок их действия истек.'
        # УБРАНО: передача templates и selected_template
        return render_template('index.html',
                               image_urls=[],
                               product_name='',
                               error=error)


# Маршрут для корня - отображает hello.html
@app.route('/')
def hello():
    return render_template('hello.html')


# app.py
@app.route('/admin/download-xlsx', methods=['POST'])
def download_xlsx():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        image_data = data.get('image_data', [])
        template_name = data.get('template_name', '')
        separator = data.get('separator', 'comma')  # Получаем разделитель

        if not image_data:
            return jsonify({'error': 'No image data provided'}), 400

        if not template_name:
            return jsonify({'error': 'Template name is required for XLSX generation'}), 400

        if template_name not in Config.TEMPLATES:
            return jsonify({'error': f'Invalid template: {template_name}'}), 400

        print(f"Генерация XLSX для шаблона: {template_name}, разделитель: {separator}")

        # --- ИСПРАВЛЕННАЯ ФУНКЦИЯ СОРТИРОВКИ ---
        def sort_key(item):
            # Извлекаем порядковый номер из имени файла URL
            filename_from_url = item['url'].split('/')[-1]

            # Ищем паттерн: артикул_номер_хеш.расширение
            # Пример: 4296278785_2_ffe8e5.jpg -> извлекаем '2'
            match = re.search(r'_(\d+)_[a-f0-9]+\.\w+$', filename_from_url)
            if match:
                try:
                    order_num = int(match.group(1))  # Порядковый номер как число
                except ValueError:
                    order_num = 0
            else:
                order_num = 0

            # Сортируем по article (как строке), затем по порядковому номеру (как числу)
            return (item['article'], order_num)

        image_data.sort(key=sort_key)
        # --- /ИСПРАВЛЕННАЯ ФУНКЦИЯ СОРТИРОВКИ ---

        # Передаем отсортированные image_data и template_name и разделитель
        generator = GeneratorFactory.create_generator(template_name, separator)
        xlsx_buffer = generator.generate(image_data, template_name)

        # Обновляем имя файла с учетом разделителя
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
                print(f"Ошибка при удалении временного файла: {e}")
    except Exception as e:
        app.logger.error(f"Error generating XLSX: {str(e)}")
        return jsonify({'error': f'Ошибка при генерации XLSX-файла: {str(e)}'}), 500


# app.py
@app.route('/admin/archive')
def archive():
    """
    Отображает архив всех загруженных изображений из папки uploads.
    """
    image_data = []
    uploads_path = Config.UPLOAD_FOLDER
    if not os.path.exists(uploads_path):
        print(f"Папка uploads не найдена: {uploads_path}")
        return render_template('archive.html', image_data=image_data, error="Папка uploads пуста или не существует.")

    # Проходим по структуре папок: template_name -> article_name -> файлы
    for template_folder in os.listdir(uploads_path):  # Изменено: client_folder -> template_folder
        template_path = os.path.join(uploads_path, template_folder)  # Изменено: client_path -> template_path
        if os.path.isdir(template_path):  # Это папка шаблона
            for article_folder in os.listdir(template_path):  # Это папка артикула
                article_path = os.path.join(template_path, article_folder)  # Изменено: client_path -> template_path
                if os.path.isdir(article_path):
                    for filename in os.listdir(article_path):
                        file_path = os.path.join(article_path, filename)
                        # Пропускаем файлы миниатюр при добавлении в image_data
                        if os.path.isfile(file_path) and allowed_file(filename) and '_thumb' not in filename:
                            # Генерируем URL для изображения, соответствующий Nginx
                            # Изменено: используем template_folder вместо client_folder
                            image_url = f"{Config.BASE_URL}/images/{quote(template_folder, safe='')}/{quote(article_folder, safe='')}/{quote(filename, safe='')}"  # Изменено: client_folder -> template_folder
                            # Ищем соответствующую миниатюру
                            file_name_base = os.path.splitext(filename)[0]
                            thumb_filename = f"{file_name_base}_thumb.jpg"
                            thumb_path = os.path.join(article_path, thumb_filename)
                            thumbnail_url = image_url  # По умолчанию используем оригинал
                            if os.path.exists(thumb_path):
                                # Если миниатюра существует, используем её URL
                                thumbnail_url = f"{Config.BASE_URL}/images/{quote(template_folder, safe='')}/{quote(article_folder, safe='')}/{quote(thumb_filename, safe='')}"
                            image_data.append({
                                'url': image_url,
                                'article': article_folder,
                                'filename': filename,
                                'template': template_folder,  # Изменено: client -> template
                                'thumbnail_url': thumbnail_url
                            })

    # --- ИСПРАВЛЕННАЯ ФУНКЦИЯ СОРТИРОВКИ ---
    def sort_key(item):
        # Сначала по шаблону
        template_order = item['template']

        # Затем по артикулу
        article_order = item['article']

        # Затем по порядковому номеру из имени файла
        # Ожидаемый формат: <артикул>_<номер>_<хеш>.<расширение>
        # Пример: 4296278785_2_ffe8e5.jpg -> извлекаем '2'
        match = re.search(r'_(\d+)_[a-f0-9]+\.\w+$', item['filename'])
        if match:
            try:
                order_num = int(match.group(1))  # Порядковый номер как число
            except ValueError:
                order_num = 0
        else:
            order_num = 0

        # Сортируем по template, article (как строки), затем по порядковому номеру (как число)
        return (template_order, article_order, order_num)

    image_data.sort(key=sort_key)
    # --- /ИСПРАВЛЕННАЯ ФУНКЦИЯ СОРТИРОВКИ ---

    print(f"Собрано image_data для архива: {len(image_data)} элементов")  # Для отладки
    # Рендерим шаблон archive.html
    return render_template('archive.html', image_data=image_data, error='')


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

        # Получаем относительный путь от /images/
        relative_path = image_url[len(base_path):]

        # Декодируем URL-encoded путь
        decoded_path = unquote(relative_path)

        # Разбираем путь: template_folder/article_folder/filename
        path_parts = decoded_path.split('/')
        if len(path_parts) < 3:
            return jsonify({'error': 'Invalid image path'}), 400

        template_folder = path_parts[0]
        article_folder = path_parts[1]
        filename = '/'.join(path_parts[2:])  # На случай вложенных путей

        # Полный путь к файлу
        file_path = os.path.join(Config.UPLOAD_FOLDER, template_folder, article_folder, filename)

        # Проверяем существование файла
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404

        # Удаляем основной файл
        os.remove(file_path)

        # Пытаемся найти и удалить миниатюру
        file_name_base = os.path.splitext(filename)[0]

        # Варианты имени миниатюры
        thumb_variants = [
            f"{file_name_base}_thumb.jpg",
            f"{file_name_base}_thumb.jpeg",
            f"{file_name_base}_thumb.png"
        ]

        for thumb_name in thumb_variants:
            thumb_path = os.path.join(Config.UPLOAD_FOLDER, template_folder, article_folder, thumb_name)
            if os.path.exists(thumb_path):
                os.remove(thumb_path)
                print(f"Удалена миниатюра: {thumb_path}")

        # Проверяем, пуста ли папка артикула, и удаляем если пуста
        article_folder_path = os.path.join(Config.UPLOAD_FOLDER, template_folder, article_folder)
        if os.path.exists(article_folder_path) and not os.listdir(article_folder_path):
            os.rmdir(article_folder_path)
            print(f"Удалена пустая папка артикула: {article_folder_path}")

            # Проверяем, пуста ли папка шаблона, и удаляем если пуста
            template_folder_path = os.path.join(Config.UPLOAD_FOLDER, template_folder)
            if os.path.exists(template_folder_path) and not os.listdir(template_folder_path):
                os.rmdir(template_folder_path)
                print(f"Удалена пустая папка шаблона: {template_folder_path}")

        return jsonify({'success': True, 'message': 'Изображение и миниатюра удалены'})

    except Exception as e:
        app.logger.error(f"Error deleting image: {str(e)}")
        return jsonify({'error': f'Ошибка при удалении изображения: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
