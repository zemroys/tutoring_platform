# Ограничение попыток: считаем запросы с одного IP-адреса.
# Вынесено в отдельный файл, чтобы лимиты можно было ставить и в main.py, и в других модулях.

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
