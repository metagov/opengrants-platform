# FROM python:3.12-slim
# WORKDIR /app

# # Copy shared requirements

# COPY requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt

# # Copy dagster project files
# COPY . /app

# # Expose Dagster webserver port
# EXPOSE 3000
# ENV PYTHONPATH=/app

# # Start Dagster UI + daemon
# CMD ["dagster", "dev", "-w", "workspace.yaml", "-h", "0.0.0.0", "-p", "3000"]


# ===========================
#   Stage 1 — Base builder
# ===========================
FROM python:3.12-slim AS base
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# System deps (Dagster sometimes needs git / build tools)
RUN apt-get update && apt-get install -y git build-essential --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copy ONLY the top-level requirements.txt (this exists in your repo root)
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# ===========================
#   Stage 2 — Final runtime
# ===========================
FROM python:3.12-slim AS final
WORKDIR /app
ENV PYTHONPATH=/app

# Copy Dagster project ONLY (not the whole repo)
COPY og_dagster/ ./og_dagster
COPY og_dagster/workspace.yaml ./workspace.yaml


# Copy Dagster dependencies from builder layer
COPY --from=base /usr/local/lib/python3.12 /usr/local/lib/python3.12
COPY --from=base /usr/local/bin /usr/local/bin

EXPOSE 3000

CMD ["dagster", "dev", "-w", "workspace.yaml", "-h", "0.0.0.0", "-p", "3000"]
