# Цены. Сумму заказа всегда считает сервер по этой таблице: цене из браузера доверять нельзя.
#
# TODO: поставить настоящие цены до запуска! Сейчас это заглушки.
# Для каждого предмета и уровня: (цена месяца, цена одного занятия), в рублях.
# Занятие по отдельности специально дороже, чем месяц / 8.

from typing import Optional

PRICES: dict[str, dict[str, tuple[int, int]]] = {
    "informatics": {"base": (4900, 790), "advanced": (5900, 950)},
    "physics": {"base": (4900, 790), "advanced": (5900, 950)},
    "math": {"base": (4900, 790), "advanced": (5900, 950)},
    "base-math": {"base": (3900, 650)},
    "russian": {"base": (4500, 750), "advanced": (5500, 890)},
    "english": {"base": (4500, 750), "advanced": (5500, 890)},
}

GROUP_CAPACITY = 6  # максимум учеников на одном занятии


def get_prices(subject_id: Optional[str], level: Optional[str]) -> Optional[tuple[int, int]]:
    if not subject_id or not level:
        return None
    return PRICES.get(subject_id, {}).get(level)
