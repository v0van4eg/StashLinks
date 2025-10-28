# generators/megamarket_generator.py
from .base_generator import BaseGenerator
from openpyxl.utils import get_column_letter


class MegamarketGenerator(BaseGenerator):
    def __init__(self):
        super().__init__('В строку')

    def get_worksheet_title(self):
        return "Images"

    def get_headers(self):
        # Создаем заголовки: Артикул + Ссылка 1, Ссылка 2, и т.д.
        headers = ["Артикул"]
        # Определяем максимальное количество ссылок для заголовков
        max_links = 10  # Можно увеличить при необходимости
        for i in range(1, max_links + 1):
            headers.append(f"Ссылка {i}")
        return headers

    def generate_row_data(self, article, urls, template_name):
        # Первая ячейка - артикул
        row_data = [article]

        # Остальные ячейки - ссылки (каждая в отдельной ячейке)
        for url in urls:
            row_data.append(url)

        # Заполняем оставшиеся ячейки пустыми значениями
        # чтобы выровнять количество столбцов
        remaining_cells = len(self.get_headers()) - len(row_data)
        for i in range(remaining_cells):
            row_data.append("")

        return row_data

    def adjust_column_widths(self, ws):
        # Настраиваем ширину столбцов для лучшего отображения
        column_widths = {
            'A': 20,  # Артикул
        }

        # Ширина для столбцов со ссылками
        for i in range(2, len(self.get_headers()) + 1):
            column_letter = get_column_letter(i)
            column_widths[column_letter] = 40

        for col, width in column_widths.items():
            ws.column_dimensions[col].width = width
