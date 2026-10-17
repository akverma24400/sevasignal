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

## 3. Initialize the database and optionally create hackathon accounts

For the initial one-instance deployment, the production Compose file runs
migrations, seeds the service catalogue, optionally seeds fictional demo data,
and then starts Express. Keep minimum and maximum application instances at 1
for this setup. Database connectivity and the RDS certificate must work first.

To create the sample centres, services, history, and operator accounts through
the AWS Console, add these Beanstalk environment properties:

- ENABLE_DEMO_SEED: true
- DEMO_PASSWORD: a unique password of at least 12 characters, entered literally
  (not URL-encoded). This is a website login password, not the RDS password.

Publish the updated images, use their successful CI commit SHA as IMAGE_TAG,
and upload a new ZIP containing the updated production Compose file and certs/.
Adding environment properties alone does not update an old image or Compose file.
Never commit the password to GitHub or include a real .env in the ZIP.

The fictional operator accounts are:
- roorkee@sevasignal.demo
- dehradun@sevasignal.demo
- haridwar@sevasignal.demo

All newly created demo accounts use DEMO_PASSWORD, stored as a password hash.
Existing accounts, passwords, and centre records are preserved. Changing this
environment property later will not reset existing passwords. Sample statuses
expire normally; the seed does not refresh them on each restart.

Once the sample records exist, set ENABLE_DEMO_SEED=false and apply the change.
The existing records remain. Login still requires HTTPS and the correct
CLIENT_ORIGIN; enabling seeding does not change cookie security.

If you want your own centre/operator instead of the fictional accounts, use
the browser terminal connected to the existing Beanstalk EC2 instance:

```bash
cd /var/app/current
sudo docker compose exec backend npm run centre:create
sudo docker compose exec backend npm run operator:create
```

Before enabling multiple instances or overlapping deployment batches, move the
migration/initialization commands into a controlled one-off deployment job and
change the backend command to node src/server.js. Back up the database before
schema changes.

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
