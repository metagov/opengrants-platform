# og_dagster/Dockerfile
FROM python:3.12-slim

WORKDIR /app

# Copy shared requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy dagster project files
COPY . /app

# Expose Dagster webserver port
EXPOSE 3000

# Start Dagster UI + daemon
CMD ["dagster", "dev", "-w", "workspace.yaml", "-h", "0.0.0.0", "-p", "3000"]
