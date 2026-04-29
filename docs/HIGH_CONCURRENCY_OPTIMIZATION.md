# High-Concurrency Optimization Guide

## Overview
This document outlines the optimizations made to handle 300+ concurrent payments and logins.

## Database Optimizations

### 1. Connection Pooling
**File:** `backend/database.py`
- **Pool Type:** QueuePool (thread-safe, production-ready)
- **Pool Size:** 30 persistent connections
- **Max Overflow:** 60 additional connections
- **Pool Recycle:** 3600 seconds (1 hour)
- **Pre-ping:** Enabled to verify connections before use

This configuration allows handling of up to 90 concurrent connections (pool_size + max_overflow) with automatic cleanup.

### 2. Query Optimization with Indexes
**File:** `backend/models.py`

Added indexes on frequently queried columns:
- `User.full_name` - for duplicate user check
- `User.role` - for admin filtering
- `User.is_active` - for active user filtering
- `Order.status` - for order status queries
- `Order.payment_status` - for payment filtering
- `Order.payment_method` - for payment method filtering
- `Payment.payment_method` - for payment filtering
- `Payment.status` - for payment status queries

### 3. Database Maintenance
To keep the database performant:
- Vacuum and analyze tables regularly
- Delete old, completed transactions periodically
- Monitor slow queries using database logs

### 4. Transaction Handling
**Best Practices:**
- Use explicit transactions for multi-step operations
- Keep transactions short and focused
- Use `db_session().flush()` before critical operations
- Always use try/finally for session cleanup

## API Optimizations

### 1. Request Throttling & Rate Limiting
Consider adding middleware to prevent abuse:
```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)
```

### 2. Response Caching
For static data (products, stores), implement caching:
```python
from flask import jsonify
from functools import lru_cache

@lru_cache(maxsize=128)
def cached_products():
    # Load products
    pass
```

### 3. Pagination
Implement pagination for large datasets:
```python
page = request.args.get('page', 1, type=int)
per_page = 20
products = db_session().query(Product).paginate(page, per_page)
```

## Frontend Optimizations

### 1. Authentication
- Use localStorage to cache auth tokens
- Implement token refresh strategy
- Load the auth loading page during authentication

### 2. Request Batching
- Combine multiple small requests into fewer larger ones
- Use GraphQL in the future for query optimization

### 3. Progressive Loading
- Load critical data first, less critical data later
- Use lazy loading for images and components

## Server Configuration

### Environment Variables
Add to `.env` for production:

```bash
# Database pooling
DATABASE_POOL_SIZE=30
DATABASE_MAX_OVERFLOW=60

# Connection timeout
DATABASE_POOL_RECYCLE=3600

# Request timeout
REQUEST_TIMEOUT=30

# Flask settings
FLASK_ENV=production
FLASK_DEBUG=False

# Gunicorn workers
WEB_CONCURRENCY=4
WORKER_PROCESSES=4
WORKER_THREADS=4
```

### Production Server Configuration

#### Using Gunicorn with multiple workers:
```bash
gunicorn \
  --worker-class sync \
  --workers 4 \
  --worker-connections 100 \
  --max-requests 1000 \
  --max-requests-jitter 50 \
  --timeout 30 \
  --keep-alive 2 \
  api.index:app
```

#### Using Gunicorn with async workers (better concurrency):
```bash
gunicorn \
  --worker-class gevent \
  --workers 4 \
  --worker-connections 1000 \
  --max-requests 1000 \
  --timeout 30 \
  api.index:app
```

To install gevent:
```bash
pip install gevent gevent-websocket
```

## Monitoring & Metrics

### Database Health Checks
Monitor:
- Connection pool utilization
- Slow queries (>1 second)
- Connection timeouts
- Transaction duration

### Application Health Checks
Use endpoints like:
```bash
GET /api/health
```

### Stress Testing
Test with load testing tools:
```bash
# Using Apache Bench
ab -n 1000 -c 300 https://your-site.com/api/products

# Using wrk
wrk -t12 -c300 -d30s https://your-site.com/api/products
```

## Scaling Strategies

### Horizontal Scaling (Multiple Servers)
1. Use a load balancer (nginx, HAProxy)
2. Share session state (Redis)
3. Share database connection (already centralized)
4. Use CDN for static assets

### Vertical Scaling (Single Server)
1. Increase CPU cores
2. Increase RAM for connection pools
3. Optimize database indexes
4. Implement caching

### Example Nginx Load Balancing:
```nginx
upstream app_servers {
    server localhost:8000;
    server localhost:8001;
    server localhost:8002;
    server localhost:8003;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://app_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Performance Benchmarks

### Expected Performance with Optimizations:
- **Concurrent Connections:** 300+
- **Requests per Second:** 500+
- **Database Queries per Second:** 1000+
- **Average Response Time:** <200ms
- **Peak Response Time:** <1s

### Real-World Testing
Always test with production-like data and load:
1. Test with 300+ concurrent users
2. Monitor response times and error rates
3. Check database connection pool usage
4. Monitor memory usage
5. Identify bottlenecks and optimize

## Troubleshooting

### High Response Times
- Check database query slow logs
- Verify connection pool is not exhausted
- Look for N+1 query problems
- Verify indexes are being used

### Database Connection Errors
- Increase `pool_size` and `max_overflow`
- Increase database max connections
- Reduce application response time (free up connections faster)
- Use connection pooling properly

### Out of Memory
- Check for connection leaks
- Reduce connection pool size
- Implement query result pagination
- Use streaming for large responses

## Security Considerations

- Always use HTTPS in production
- Implement CSRF protection
- Validate and sanitize all inputs
- Use parameterized queries (SQLAlchemy handles this)
- Implement rate limiting
- Log and monitor suspicious activity
