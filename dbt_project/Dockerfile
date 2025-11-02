FROM python:3.12-slim

WORKDIR /app

# install deps
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt \
    && pip install dbt-core dbt-postgres dbt-duckdb

# copy everything from current folder (context = ./dbt_project)
COPY . /app/

CMD ["dbt", "run"]
