### Lint and Type Check

Usage

Lint & auto-fix:

`ruff check . --fix`


Format:

`black .`


Type check:

`mypy og_dagster dlt_pipelines`

Yaml Schema check:

`yamale -s <Schema_manifest file path>  <Source schema file path>


Docker version 28.5.1, build e180ab8


# 1. Docker is running
docker version

# 2. Docker Compose works
docker-compose version

# 3. Can pull images
docker pull hello-world
docker run hello-world

# 4. Check disk space (important!)
df -h

# 5. Check memory
free -h