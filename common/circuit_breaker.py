"""
common/circuit_breaker.py
IntelliFlow Circuit Breaker Pattern
"""
import time
import logging
from enum import Enum
from threading import Lock
from typing import Optional

logger = logging.getLogger("intelliflow.circuit_breaker")


class CBState(Enum):
    CLOSED = "closed"       # Normal operation
    OPEN = "open"           # Failing — reject all calls
    HALF_OPEN = "half_open" # Testing recovery


class CircuitBreaker:
    """
    Three-state circuit breaker for agent fault tolerance.
    CLOSED → failure_threshold failures → OPEN
    OPEN   → reset_timeout seconds  → HALF_OPEN
    HALF_OPEN → 1 success → CLOSED, 1 failure → OPEN
    """

    def __init__(self, failure_threshold: int = 3, reset_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self._state = CBState.CLOSED
        self._failures = 0
        self._last_failure_time: Optional[float] = None
        self._lock = Lock()

    def is_open(self) -> bool:
        with self._lock:
            if self._state == CBState.OPEN:
                # Check if we should transition to half-open
                if self._last_failure_time and time.time() - self._last_failure_time > self.reset_timeout:
                    self._state = CBState.HALF_OPEN
                    logger.info("Circuit breaker moving to HALF_OPEN")
                    return False  # Allow one test request
                return True
            return False

    def record_success(self):
        with self._lock:
            self._failures = 0
            if self._state == CBState.HALF_OPEN:
                logger.info("Circuit breaker CLOSED — agent recovered")
            self._state = CBState.CLOSED

    def record_failure(self):
        with self._lock:
            self._failures += 1
            self._last_failure_time = time.time()
            if self._failures >= self.failure_threshold:
                self._state = CBState.OPEN
                logger.warning(f"Circuit breaker OPENED after {self._failures} failures")

    @property
    def state(self) -> str:
        return self._state.value
