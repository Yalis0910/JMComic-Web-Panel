import functools
from concurrent.futures import ThreadPoolExecutor
from typing import Callable, TypeVar

import anyio

T = TypeVar("T")

# 隔离同步的网络请求（curl-cffi）和图像处理（Pillow），防止阻塞 FastAPI asyncio 事件循环
_io_limiter = anyio.CapacityLimiter(16)
_cpu_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="jm-img-cpu")


async def run_blocking(fn: Callable[..., T], *args, **kwargs) -> T:
    """在受控工作线程中执行同步阻塞 I/O（如 jmcomic 请求）。"""
    call = functools.partial(fn, *args, **kwargs)
    return await anyio.to_thread.run_sync(call, limiter=_io_limiter)


async def run_cpu(fn: Callable[..., T], *args, **kwargs) -> T:
    """在独立 CPU 线程池中执行图像处理与加解密密集操作。"""
    import asyncio

    loop = asyncio.get_running_loop()
    call = functools.partial(fn, *args, **kwargs)
    return await loop.run_in_executor(_cpu_executor, call)
