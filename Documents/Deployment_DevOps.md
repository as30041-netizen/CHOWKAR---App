# CHOWKAR - Deployment & DevOps Guide

## 1. Infrastructure Overview (AWS/GCP)

For the MVP, we recommend a containerized architecture for scalability and ease of rollback.

### 1.1 Architecture Diagram
```mermaid
[Client App (CDN)] --> [Load Balancer] --> [API Server (Node.js Cluster)]
                                        --> [Redis Cache]
                                        --> [PostgreSQL (PostGIS)]
                                        --> [Gemini API (Google Cloud)]
```

### 1.2 Environment Variables (`.env.production`)
| Variable | Description | Security Note |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL Connection String | Use SSL mode |
| `REDIS_URL` | Redis Connection String | Password protected |
| `API_KEY` | Google Gemini API Key | **CRITICAL:** Server-side only |
| `JWT_SECRET` | Token Signing Key | Min 32 chars random |
| `FIREBASE_ADMIN_CONFIG` | Service Account JSON | Encoded Base64 |
| `AWS_ACCESS_KEY` | S3 Uploads | Least Privilege (PutObject only) |

---

## 2. Docker Configuration

### 2.1 Backend `Dockerfile`
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

### 2.2 Frontend `Dockerfile` (Static Serving)
```dockerfile
FROM node:20-alpine as builder
WORKDIR /app
COPY . .
RUN npm install && npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## 3. CI/CD Pipeline (GitHub Actions)

### 3.1 Workflow: `deploy-production.yml`
**Trigger:** Push to `main` branch.

**Steps:**
1.  **Test:** Run `npm test` (Unit tests).
2.  **Lint:** Run ESLint checks.
3.  **Build:** Build Docker images for Backend and Frontend.
4.  **Push:** Push images to ECR (AWS) or GCR (Google).
5.  **Deploy:**
    *   *Frontend:* Sync `dist/` folder to AWS S3 + CloudFront invalidation.
    *   *Backend:* Update ECS Service / Kubernetes Deployment with new image tag.
6.  **Migrate:** Run `prisma migrate deploy` automatically before swapping containers.

---

## 4. Monitoring & Logging
1.  **Application Logs:** Stream logs to CloudWatch or Datadog.
    *   *Alert:* 5xx Error Rate > 1%.
    *   *Alert:* AI Response Latency > 5s.
2.  **Health Checks:**
    *   Endpoint: `/health` (Returns 200 OK if DB and Redis are connected).
    *   Uptime Robot: Ping every 5 mins.
