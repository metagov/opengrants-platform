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

### Production Stuff

#### Connect to prod db.
 ```psql "postgresql://doadmin:<instanceid>@<db_link>/defaultdb?sslmode=require" ```

### Dashboard reboot
# 1. Go to the app
cd ~/opengrants-platform/nextjs-dashboard
NODE_EXTRA_CA_CERTS=./ca.crt pnpm run dev 

# 2. Pull latest code
git pull

# 3. Install deps (safe even if unchanged)
pnpm install

# 4. Build for production
pnpm run build

# 5. Restart the app via PM2
pm2 restart opengrants-dashboard

# 6. Verify status
pm2 status
