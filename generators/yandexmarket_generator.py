# generators/yandexmarket_generator.py
from .base_generator import BaseGenerator


class YandexmarketGenerator(BaseGenerator):
    def __init__(self, separator='comma'):
        super().__init__('В ячейку', separator)

    def get_worksheet_title(self):
        return "Images"

    def get_headers(self):
        # Только два столбца: Артикул и Ссылки
        return ["Артикул", "Ссылки на изображения"]

    def generate_row_data(self, article, urls, template_name):
        # Используем разделитель из настроек
        separator = self.get_separator()
        links_text = separator.join(urls) if urls else ""
        return [article, links_text]

    def adjust_column_widths(self, ws):
        # Настраиваем ширину в зависимости от разделителя
        if self.separator == 'newline':
            # Для переносов строк делаем колонку уже, но выше
            column_widths = {
                'A': 20,  # Артикул
                'B': 60,  # Ссылки (уже, так как вертикально)
            }
        else:
            # Для запятых - широкая колонка
            column_widths = {
                'A': 20,  # Артикул
                'B': 100,  # Ссылки (широкая колонка для текста с запятыми)
            }

        for col, width in column_widths.items():
            ws.column_dimensions[col].width = width