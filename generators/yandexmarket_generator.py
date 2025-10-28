# generators/yandexmarket_generator.py
from .base_generator import BaseGenerator

class YandexmarketGenerator(BaseGenerator):
    def __init__(self):
        super().__init__('В ячейку')

    def get_worksheet_title(self):
        return "Images"

    def get_headers(self):
        # Только два столбца: Артикул и Ссылки
        return ["Артикул", "Ссылки на изображения"]

    def generate_row_data(self, article, urls, template_name):
        # Первая ячейка - артикул
        # Вторая ячейка - все ссылки через запятую
        links_text = ", ".join(urls) if urls else ""
        return [article, links_text]

    def adjust_column_widths(self, ws):
        # Широкая вторая колонка для размещения всех ссылок
        column_widths = {
            'A': 20,   # Артикул
            'B': 100,  # Ссылки (широкая колонка для текста с запятыми)
        }
        for col, width in column_widths.items():
            ws.column_dimensions[col].width = width
