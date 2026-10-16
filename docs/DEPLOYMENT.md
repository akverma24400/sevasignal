# Deploy SevaSignal from Docker Hub

The frontend image now runs Nginx on port 5173 and proxies /api/ to backend:5000.
The existing root Compose file remains a local HTTP demo with PostgreSQL.
Run `docker compose up -d --build` to rebuild it after pulling changes.

## 1. Publish the images

Push to main and wait for all CI jobs, including both Docker Hub pushes, to pass.
Use that full commit SHA as IMAGE_TAG for both images. The CI checks builds;
a successful build alone does not verify an AWS deployment.
This setup assumes public Docker Hub repositories and x86_64 Beanstalk instances.

## 2. Prepare AWS

Create RDS PostgreSQL with a database named sevasignal. Keep it private and allow
TCP 5432 only from the application/admin security groups that need access.
Use a Docker on Amazon Linux 2023 Beanstalk environment with an Application Load
Balancer. Configure an ACM certificate and HTTPS listener; redirect HTTP to HTTPS.
Allow instance port 80 only from the load balancer security group. Do not publish
backend port 5000. TRUST_PROXY_HOPS=2 assumes exactly ALB -> Nginx -> Express.
If the proxy topology changes, review this setting.

Set Beanstalk environment properties:
- IMAGE_TAG: the full successful CI commit SHA.
- DATABASE_URL: postgresql://USER:PASSWORD@RDS_ENDPOINT:5432/sevasignal.
  URL-encode special characters in credentials. Do not add sslmode parameters;
  the application configures verified TLS separately.
- CLIENT_ORIGIN: the exact HTTPS website origin, without a path.

Use the example in deploy/beanstalk/.env.example. Store actual credentials in AWS,
never commit them. Production login requires HTTPS because cookies are Secure.

## 3. Initialize the database before the first application deployment

From an authorized admin machine with network access to RDS and Docker installed,
create a temporary working directory containing the production Compose file,
a private .env containing the three environment properties, and certs/global-bundle.pem
(download command below). Restrict .env permissions with chmod 600.

Run from that directory:

```bash
docker compose pull backend
docker compose run --rm --no-deps backend npm run db:migrate
docker compose run --rm --no-deps backend npm run catalog:seed
docker compose run --rm --no-deps backend npm run centre:create
docker compose run --rm --no-deps backend npm run operator:create
```

The last two commands prompt for centre and operator details.
Do not run db:seed in production; it creates demo accounts.
For later releases, run migrations once through this controlled admin process
before deploying compatible application code. Do not run migrations independently
on every autoscaled instance. Back up the database before schema changes.

## 4. Build the deployment ZIP

From the repository root:

```bash
mkdir -p /tmp/sevasignal-eb/certs
cp deploy/beanstalk/docker-compose.yml /tmp/sevasignal-eb/docker-compose.yml
curl --fail --show-error --location \
  https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
  --output /tmp/sevasignal-eb/certs/global-bundle.pem
(cd /tmp/sevasignal-eb && zip -r "$OLDPWD/sevasignal-eb.zip" docker-compose.yml certs)
```

Use the same certificate download for the admin setup in step 3.
The ZIP must contain docker-compose.yml and certs/ at its root.
Do not include .env, the local demo Compose file, or source Dockerfiles.
Refresh the RDS CA bundle when AWS rotates certificates.

## 5. Deploy and verify

Upload sevasignal-eb.zip to Beanstalk after setting the environment properties.
Set the load balancer health check path to /api/health on traffic port 80.
Beanstalk Compose uses the frontend container as the proxy.

Verify:
1. HTTPS /api/health returns status ok.
2. The directory loads and deep links survive a page refresh.
3. The operator can log in, add services, and update their status.
4. Data survives an application redeployment.

A new Docker Hub push does not redeploy Beanstalk. For every release, select its
published IMAGE_TAG and deploy/update the environment explicitly. Automated CD
can be added after this manual path works. Roll back using a previously verified
image tag, subject to database schema compatibility.

Application logs go to container stdout/stderr. Configure Beanstalk/CloudWatch log
streaming separately; this change does not provision AWS resources or monitoring.

References:
- https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/single-container-docker-configuration.html
- https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/create_deploy_docker.container.console.html
- https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html
