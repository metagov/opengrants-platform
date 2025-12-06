FROM python:3.12-slim

WORKDIR /app

# ---- Install git & system deps ----
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# install deps
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt \
    && pip install dbt-core dbt-postgres dbt-duckdb

# copy everything from current folder (context = ./dbt_project)
COPY . /app
ENTRYPOINT ["dbt"]
CMD ["run"]

#CMD ["dbt", "debug", "--project-dir", "/app", "--profiles-dir", "/app"]
# ===========================
# FROM python:3.12-slim AS base

# WORKDIR /app

# ENV PYTHONUNBUFFERED=1
# ENV PYTHONDONTWRITEBYTECODE=1

# RUN apt-get update && apt-get install -y git build-essential --no-install-recommends \
#     && rm -rf /var/lib/apt/lists/*

# # Copy LOCAL requirements.txt (includes root req via -r)
# COPY requirements.txt /tmp/requirements.txt

# RUN pip install --no-cache-dir -r /tmp/requirements.txt

# FROM python:3.12-slim AS final
# WORKDIR /app
# ENV PYTHONPATH=/app

# COPY --from=base /usr/local/lib/python3.12 /usr/local/lib/python3.12
# COPY --from=base /usr/local/bin /usr/local/bin

# COPY . /app

# CMD ["python", "loaders/privote_loader.py"]
