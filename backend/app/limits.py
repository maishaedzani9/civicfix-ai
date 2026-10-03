"""Per-worker abuse protection; put a shared rate limiter in front of multiple replicas."""
from collections import defaultdict, deque
from time import monotonic
from fastapi import HTTPException

requests = defaultdict(deque)

def limit(user_id, action, maximum, seconds=3600):
    now = monotonic()
    key = (str(user_id), action)
    queue = requests[key]
    while queue and queue[0] < now - seconds:
        queue.popleft()
    if len(queue) >= maximum:
        raise HTTPException(429, "Too many requests. Please try again later.")
    queue.append(now)
    # Keep expired user buckets from growing indefinitely.
    if len(requests) > 10000:
        expired = [k for k, values in requests.items() if not values or values[-1] < now - seconds]
        for item in expired:
            requests.pop(item, None)
