# Stage 1 — Base builder
FROM python:3.12-slim AS base
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y git build-essential ca-certificates --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Stage 2 — Final runtime
FROM python:3.12-slim AS final
WORKDIR /app
ENV PYTHONPATH=/app

RUN apt-get update && apt-get install -y ca-certificates --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copy git for dbt operations
COPY --from=base /usr/bin/git /usr/bin/git
COPY --from=base /usr/lib/git-core /usr/lib/git-core

# Copy Python dependencies
COPY --from=base /usr/local/lib/python3.12 /usr/local/lib/python3.12
COPY --from=base /usr/local/bin /usr/local/bin

# Bake in DigitalOcean Postgres CA cert for SSL connections
COPY nextjs-dashboard/ca.crt /usr/local/share/ca-certificates/do-postgres.crt
COPY nextjs-dashboard/ca.crt /app/ca.crt
RUN update-ca-certificates

# Copy application code (build context = repo root)
COPY og_dagster/ /app/
COPY dbt_project/ /app/dbt_project/

EXPOSE 3000

CMD ["/bin/sh", "-c", "dbt parse --project-dir /app/dbt_project --profiles-dir /app/dbt_project 2>/dev/null || echo 'dbt parse skipped'; exec dagster dev -h 0.0.0.0 -p 3000 -w workspace.yaml"]
