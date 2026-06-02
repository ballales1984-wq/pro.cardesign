from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any
from ..config import Config

class BaseStage(ABC):
    name = "base"
    model_name = "undefined"

    def __init__(self) -> None:
        pass

    @abstractmethod
    def run(self, image: Any, context: dict[str, Any], config: Config) -> Any:
        raise NotImplementedError("Stage must implement run()")
