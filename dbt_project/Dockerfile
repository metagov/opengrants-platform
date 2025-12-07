FROM python:3.12-slim

WORKDIR /app

# ---- Install git & system deps ----
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# install deps
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt 

# copy everything from current folder (context = ./dbt_project)
COPY . /app
ENTRYPOINT ["dbt"]
CMD ["run"]

CMD ["dbt", "debug", "--project-dir", "/app", "--profiles-dir", "/app"]
