import itertools
import threading

from jmcomic import JmOption

_pool_lock = threading.Lock()
_pool = []
_pool_iter = None


def _init_pool():
    global _pool, _pool_iter
    with _pool_lock:
        if _pool:
            return
        option = JmOption.default()
        # 小规模客户端池：JM client 内部有 scramble_id 等缓存，池化可复用会话，
        # 同时支持浏览器并发请求
        _pool = [option.new_jm_client() for _ in range(3)]
        _pool_iter = itertools.cycle(_pool)


def get_client():
    _init_pool()
    return next(_pool_iter)


def get_option():
    return JmOption.default()
