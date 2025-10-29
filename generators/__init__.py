# generators/__init__.py
from .megamarket_generator import MegamarketGenerator
from .yandexmarket_generator import YandexmarketGenerator

class GeneratorFactory:
    @staticmethod
    def create_generator(template_name, separator='comma'):
        if template_name == 'В строку':
            return MegamarketGenerator()
        elif template_name == 'В ячейку':
            return YandexmarketGenerator(separator)
        else:
            raise ValueError(f"Unknown template: {template_name}")
