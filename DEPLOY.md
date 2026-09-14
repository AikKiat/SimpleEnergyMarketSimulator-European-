# Deployment

Frontend on Vercel, backend on a single EC2 box behind Cloudflare.

```
Browser ──HTTPS──▶ Vercel (React app, static)
   │
   └────HTTPS────▶ Cloudflare edge ──HTTPS (Origin Cert)──▶ EC2:443 nginx ──▶ app:8080
                                                                                │
                                                                             kafka:9092
```

The AI analyst is switched off, so there is **no Postgres and no Anthropic key**
in this deployment. The backend's only job is the ETL: poll the Carbon Intensity
API, publish to Kafka, project into memory, serve `GET /api/market/live`.

---

## 1. EC2

**Instance:** t3.small (2 vCPU, 2 GB), Ubuntu 24.04 LTS, 20 GB gp3.

t3.micro's 1 GB is not enough — Kafka is capped at 512 MB heap and the JVM
measured ~243 MB at idle, before the OS and Docker.

**Security group inbound:**

| Port | Source | Why |
|---|---|---|
| 443 | Cloudflare IP ranges only | the only path traffic should take |
| 22 | your IP only | SSH |

Do **not** open 9092. Kafka in `docker-compose.prod.yml` deliberately publishes
no ports — it is reachable only from the compose network.

Restricting 443 to Cloudflare's ranges is what stops someone bypassing the edge
by hitting the IP directly. Current ranges:

```bash
curl https://www.cloudflare.com/ips-v4
curl https://www.cloudflare.com/ips-v6
```

**Connect:**

```bash
ssh -i your-key.pem ubuntu@<ec2-public-ip>
```

Ubuntu's default user is `ubuntu`, not `ec2-user`.

**Install Docker** — from Docker's own apt repository, not Ubuntu's `docker.io`
package. Ubuntu's build lags behind and does not ship the Compose v2 plugin, so
`docker compose` (no hyphen) would not exist.

```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl gnupg git

# Docker's signing key
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Their repo, pinned to this machine's architecture and Ubuntu release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
```

Log out and back in for the group change to apply (or run `newgrp docker` for
the current shell only). Then confirm:

```bash
docker --version
docker compose version        # must work without the hyphen
docker run --rm hello-world
```

**Add swap before the first build.** The image build runs Maven and `javac`
inside the container, which on a 2 GB box can be pushed over the edge by the
JVM. t3.small has no swap by default and the kernel's OOM killer will simply
kill the build, usually with a confusing error.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab   # survives reboot
free -h                                                       # confirm 2 Gi swap
```

---

## 2. Cloudflare

1. **DNS** — add an `A` record, e.g. `api` → your EC2 public IP, proxy **on**
   (orange cloud). The orange cloud is what puts Cloudflare in the path; grey
   would expose the origin IP directly.
2. **Origin Certificate** — SSL/TLS → Origin Server → *Create Certificate*.
   Accept the defaults (RSA, 15 years). You get two blocks of text.
3. **SSL/TLS mode** — set to **Full (strict)**. Anything less leaves the
   Cloudflare-to-origin hop unverified.

---

## 3. Deploy

```bash
git clone <your-repo-url> demo && cd demo

# Paste the two blocks from step 2 into these files.
mkdir -p nginx/certs
vi nginx/certs/origin.pem      # the certificate
vi nginx/certs/origin.key      # the private key
chmod 600 nginx/certs/origin.key

# Your hostname, replacing api.example.com
sed -i 's/api\.example\.com/api.yourdomain.com/' nginx/conf.d/api.conf

# Your Vercel origin
cp .env.prod.example .env.prod
vi .env.prod

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Both `nginx/certs/` and `.env.prod` are gitignored. Verify before any commit:

```bash
git check-ignore -q nginx/certs/origin.key && echo "key is safe"
```

**Check it came up:**

```bash
docker compose -f docker-compose.prod.yml ps          # app should read "healthy"
docker compose -f docker-compose.prod.yml logs -f app

curl -s https://api.yourdomain.com/healthz            # {"status":"UP"}
curl -s https://api.yourdomain.com/api/market/live    # live GB feed
```

The health status takes up to 60s to appear — that is the `start-period` in the
Dockerfile, which stops a slow JVM start from being reported as a failure.

---

## 4. Point the frontend at it

In Vercel → Settings → Environment Variables:

```
VITE_API_BASE = https://api.yourdomain.com
```

Then **redeploy**. This is not optional — Vite inlines env vars at build time,
so changing the variable does nothing until the app is rebuilt.

Verify in the browser console on the live site: the Sync panel should show
`generationMix` and `carbonIntensity` as AVAILABLE rather than falling back to
simulated.

---

## Gotchas

**CORS.** `APP_CORS_ALLOWED_ORIGINS` **replaces** the values in
`application.yml`, it does not merge with them. In production the localhost
origins are therefore not allowed — intended, but it means the exact Vercel
origin must be correct down to the scheme and with no trailing slash. A mismatch
shows up as a CORS error in the browser and nothing at all in the app logs.

**nginx caches the upstream IP.** It resolves `app:8080` once at startup. If you
recreate only the app container, run `docker compose restart nginx`.

**Kafka advertised listener.** `KAFKA_ADVERTISED_LISTENERS` must be
`PLAINTEXT://kafka:9092`. Your local container advertises `localhost:9092`,
which would send the app back to its own container and hang on connect.

**Consumer group ids.** The market and insight listeners use different group
suffixes (`-market`, `-insight`). They must stay different: consumers sharing a
group but subscribing to different topics can be assigned partitions for a topic
they are not listening to, and messages vanish silently.

---

## Re-enabling the AI analyst

Four places, all marked with `AI analyst disabled` comments:

1. `config/AnthropicConfig.java` — uncomment `@Configuration`
2. `insight/InsightService.java` — uncomment `@Service`
3. `insight/InsightController.java` — uncomment `@RestController` and `@RequestMapping`
4. `application.yml` — remove the `autoconfigure.exclude` block, uncomment
   `datasource:` and `jpa:`

Then add a Postgres service to the compose file and supply `ANTHROPIC_API_KEY`
from SSM Parameter Store or Secrets Manager at container start — never in
`.env.prod`, and never in the image.
