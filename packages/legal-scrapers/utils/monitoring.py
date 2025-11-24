"""
Monitoring and Metrics Collection for Legal Advocate AI
Tracks performance, errors, and system health
"""

import time
import logging
import json
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass, field
from functools import wraps
from threading import Lock

logger = logging.getLogger(__name__)


@dataclass
class MetricData:
    """Represents a single metric data point"""
    timestamp: datetime
    value: float
    tags: Dict[str, str] = field(default_factory=dict)


@dataclass
class PerformanceMetric:
    """Performance metrics for a specific operation"""
    operation_name: str
    call_count: int = 0
    total_duration: float = 0.0
    min_duration: float = float('inf')
    max_duration: float = 0.0
    error_count: int = 0
    last_error: Optional[str] = None
    recent_durations: deque = field(default_factory=lambda: deque(maxlen=100))

    @property
    def avg_duration(self) -> float:
        """Calculate average duration"""
        return self.total_duration / self.call_count if self.call_count > 0 else 0.0

    @property
    def success_rate(self) -> float:
        """Calculate success rate percentage"""
        if self.call_count == 0:
            return 0.0
        return ((self.call_count - self.error_count) / self.call_count) * 100

    @property
    def p95_duration(self) -> float:
        """Calculate 95th percentile duration"""
        if not self.recent_durations:
            return 0.0
        sorted_durations = sorted(self.recent_durations)
        index = int(len(sorted_durations) * 0.95)
        return sorted_durations[index] if index < len(sorted_durations) else sorted_durations[-1]

    def to_dict(self) -> Dict:
        """Convert to dictionary for reporting"""
        return {
            'operation': self.operation_name,
            'call_count': self.call_count,
            'avg_duration_ms': round(self.avg_duration * 1000, 2),
            'min_duration_ms': round(self.min_duration * 1000, 2) if self.min_duration != float('inf') else 0,
            'max_duration_ms': round(self.max_duration * 1000, 2),
            'p95_duration_ms': round(self.p95_duration * 1000, 2),
            'error_count': self.error_count,
            'success_rate': round(self.success_rate, 2),
            'last_error': self.last_error
        }


class MetricsCollector:
    """
    Collects and aggregates application metrics

    Features:
    - Performance metrics (duration, count, errors)
    - Custom metrics (counters, gauges)
    - Error rate tracking
    - Health status monitoring
    """

    def __init__(self):
        self._metrics: Dict[str, PerformanceMetric] = {}
        self._counters: Dict[str, int] = defaultdict(int)
        self._gauges: Dict[str, float] = {}
        self._custom_metrics: Dict[str, List[MetricData]] = defaultdict(list)
        self._lock = Lock()
        self._start_time = datetime.now(timezone.utc)

    def record_performance(
        self,
        operation: str,
        duration: float,
        success: bool = True,
        error: Optional[str] = None
    ):
        """
        Record performance metrics for an operation

        Args:
            operation: Operation name
            duration: Duration in seconds
            success: Whether operation succeeded
            error: Error message if failed
        """
        with self._lock:
            if operation not in self._metrics:
                self._metrics[operation] = PerformanceMetric(operation_name=operation)

            metric = self._metrics[operation]
            metric.call_count += 1
            metric.total_duration += duration
            metric.min_duration = min(metric.min_duration, duration)
            metric.max_duration = max(metric.max_duration, duration)
            metric.recent_durations.append(duration)

            if not success:
                metric.error_count += 1
                metric.last_error = error

    def increment_counter(self, name: str, value: int = 1, **tags):
        """
        Increment a counter metric

        Args:
            name: Counter name
            value: Value to add (default 1)
            **tags: Additional tags for the metric
        """
        with self._lock:
            key = self._make_key(name, tags)
            self._counters[key] += value

    def set_gauge(self, name: str, value: float, **tags):
        """
        Set a gauge metric (point-in-time value)

        Args:
            name: Gauge name
            value: Current value
            **tags: Additional tags for the metric
        """
        with self._lock:
            key = self._make_key(name, tags)
            self._gauges[key] = value

    def record_metric(self, name: str, value: float, **tags):
        """
        Record a custom metric

        Args:
            name: Metric name
            value: Metric value
            **tags: Additional tags
        """
        with self._lock:
            metric_data = MetricData(
                timestamp=datetime.now(timezone.utc),
                value=value,
                tags=tags
            )
            self._custom_metrics[name].append(metric_data)

            # Keep only last 1000 data points per metric
            if len(self._custom_metrics[name]) > 1000:
                self._custom_metrics[name] = self._custom_metrics[name][-1000:]

    def get_performance_metrics(self) -> Dict[str, Dict]:
        """Get all performance metrics"""
        with self._lock:
            return {
                name: metric.to_dict()
                for name, metric in self._metrics.items()
            }

    def get_counters(self) -> Dict[str, int]:
        """Get all counter values"""
        with self._lock:
            return dict(self._counters)

    def get_gauges(self) -> Dict[str, float]:
        """Get all gauge values"""
        with self._lock:
            return dict(self._gauges)

    def get_health_status(self) -> Dict:
        """
        Get overall system health status

        Returns:
            Health status with metrics summary
        """
        with self._lock:
            uptime = (datetime.now(timezone.utc) - self._start_time).total_seconds()
            total_calls = sum(m.call_count for m in self._metrics.values())
            total_errors = sum(m.error_count for m in self._metrics.values())
            overall_success_rate = ((total_calls - total_errors) / total_calls * 100) if total_calls > 0 else 100.0

            return {
                'status': 'healthy' if overall_success_rate > 95 else 'degraded' if overall_success_rate > 80 else 'unhealthy',
                'uptime_seconds': round(uptime, 2),
                'total_operations': total_calls,
                'total_errors': total_errors,
                'success_rate': round(overall_success_rate, 2),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }

    def get_error_summary(self) -> Dict:
        """Get summary of errors"""
        with self._lock:
            errors = []
            for metric in self._metrics.values():
                if metric.error_count > 0:
                    errors.append({
                        'operation': metric.operation_name,
                        'error_count': metric.error_count,
                        'error_rate': round((metric.error_count / metric.call_count * 100), 2),
                        'last_error': metric.last_error
                    })

            return {
                'total_errors': sum(e['error_count'] for e in errors),
                'operations_with_errors': len(errors),
                'error_details': sorted(errors, key=lambda x: x['error_count'], reverse=True)
            }

    def reset_metrics(self):
        """Reset all metrics (useful for testing)"""
        with self._lock:
            self._metrics.clear()
            self._counters.clear()
            self._gauges.clear()
            self._custom_metrics.clear()
            self._start_time = datetime.now(timezone.utc)

    @staticmethod
    def _make_key(name: str, tags: Dict) -> str:
        """Create a unique key from name and tags"""
        if not tags:
            return name
        tag_str = ','.join(f"{k}={v}" for k, v in sorted(tags.items()))
        return f"{name}[{tag_str}]"


# Global metrics collector instance
metrics = MetricsCollector()


def log_metric(name: str, value: int = 1, **tags):
    """
    Helper function to log a metric count

    Args:
        name: Metric name
        value: Metric value (default: 1)
        **tags: Optional tags for the metric
    """
    metrics.increment_counter(name, value, **tags)


def track_performance(operation_name: Optional[str] = None):
    """
    Decorator to track performance metrics for a function

    Args:
        operation_name: Optional custom operation name (defaults to function name)

    Example:
        @track_performance()
        def process_document(doc):
            # Processing logic
            pass
    """
    def decorator(func: Callable) -> Callable:
        op_name = operation_name or func.__name__

        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            success = True
            error = None

            try:
                result = func(*args, **kwargs)
                return result
            except Exception as e:
                success = False
                error = str(e)
                raise
            finally:
                duration = time.time() - start_time
                metrics.record_performance(
                    operation=op_name,
                    duration=duration,
                    success=success,
                    error=error
                )

                # Log slow operations
                if duration > 5.0:  # 5 seconds threshold
                    logger.warning(
                        f"Slow operation detected: {op_name} took {duration:.2f}s",
                        extra={
                            'operation': op_name,
                            'duration_seconds': duration,
                            'threshold_seconds': 5.0
                        }
                    )

        return wrapper
    return decorator


def count_calls(counter_name: Optional[str] = None, **tags):
    """
    Decorator to count function calls

    Args:
        counter_name: Optional custom counter name
        **tags: Additional tags for the counter

    Example:
        @count_calls(counter_name="document_processed", doc_type="pdf")
        def process_document(doc):
            pass
    """
    def decorator(func: Callable) -> Callable:
        name = counter_name or f"{func.__name__}_calls"

        @wraps(func)
        def wrapper(*args, **kwargs):
            metrics.increment_counter(name, **tags)
            return func(*args, **kwargs)

        return wrapper
    return decorator


class HealthCheck:
    """
    Health check utilities for system monitoring

    Can be integrated with FastAPI or other web frameworks
    """

    @staticmethod
    def check_system_health() -> Dict:
        """
        Perform comprehensive health check

        Returns:
            Health check results with detailed status
        """
        health_status = metrics.get_health_status()

        # Add additional health checks
        checks = {
            'metrics_collection': health_status['status'],
            'database': 'unknown',  # TODO: Add database health check
            'external_apis': 'unknown',  # TODO: Add API health checks
        }

        # Determine overall status
        statuses = [v for v in checks.values() if v in ['healthy', 'degraded', 'unhealthy']]
        if all(s == 'healthy' for s in statuses):
            overall_status = 'healthy'
        elif any(s == 'unhealthy' for s in statuses):
            overall_status = 'unhealthy'
        else:
            overall_status = 'degraded'

        return {
            'status': overall_status,
            'checks': checks,
            'metrics': health_status,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }

    @staticmethod
    def get_metrics_report() -> Dict:
        """
        Get comprehensive metrics report

        Returns:
            Detailed metrics including performance, errors, and health
        """
        return {
            'health': metrics.get_health_status(),
            'performance': metrics.get_performance_metrics(),
            'errors': metrics.get_error_summary(),
            'counters': metrics.get_counters(),
            'gauges': metrics.get_gauges(),
        }


# Example usage
if __name__ == "__main__":
    import logging
    from .logging_config import setup_logging

    # Setup logging
    setup_logging(level="DEBUG")

    # Example: Track performance
    @track_performance()
    def example_operation():
        time.sleep(0.1)
        return "success"

    # Run operations
    for i in range(10):
        try:
            example_operation()
            metrics.increment_counter("operations", status="success")
        except Exception as e:
            metrics.increment_counter("operations", status="error")

    # Generate report
    health = HealthCheck.check_system_health()
    report = HealthCheck.get_metrics_report()

    print("\nHealth Status:")
    print(json.dumps(health, indent=2))

    print("\nMetrics Report:")
    print(json.dumps(report, indent=2))
