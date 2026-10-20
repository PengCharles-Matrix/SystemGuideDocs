# SystemGuideDocs

Documentation editor built with React, TypeScript, and Vite, with a Node.js upload server for persistent file attachments.

## Development

```bash
npm install
npm run dev
```

Open http://localhost:5173/. The command starts Vite and the upload API together. Uploaded files are stored on disk in `data/uploads/`, which is excluded from Git.

## Production preview

```bash
npm run build
npm run preview
```

Open http://localhost:4173/. The preview command starts both Vite preview and the upload server. If you already use port 4173, keep using it so your existing browser-local documentation data remains on the same site origin.

For a direct production server instead, run `npm run build` and then `npm start`; it serves the site on port 3001. Changing ports changes browser LocalStorage, so your locally saved docs may not appear on the other origin unless you export/import a JSON backup.

## Upload Files

In Editor, choose **Upload Files**, select a file up to 50 MB, and wait for the upload confirmation. A download link is inserted into the current draft; click **Save** to attach the link to the document. Visitors can download uploaded attachments through the website. Files persist on the host machine in `data/uploads/` across restarts, provided that directory is retained. Uploaded files are not automatically included in JSON documentation backups.

For public internet deployment, use HTTPS and add authentication/access controls before allowing untrusted visitors to upload files.

## Other features

- Documentation sidebar grouped by category.
- Search and topic filtering.
- Reader, Editor, and Manage modes.
- Page creation with browser-local storage.
- JSON export/import for documentation data.
- Share action copies the current page URL.
- Right-side page outline and reading-time metadata.
- Responsive layout for smaller screens.

Frontend source lives in `src/`; upload handling lives in `server.mjs`.

## Authentication and MongoDB setup

The application now has an entry page with **Login as admin** and **Login as guest**. Guest sessions are read-only and can use the Reader view; admin sessions can use Reader, Editor, Manage, JSON backup/import, and file uploads. The Express server validates signed, HTTP-only session cookies and protects upload APIs on the server, not just in the UI.

1. Create a MongoDB database (MongoDB Atlas or a reachable MongoDB server) and a database user with access to the `systemguidedocs` database.
2. In the project directory, copy `.env.example` to `.env`.
3. Edit `.env` and set `MONGODB_URI` to your MongoDB connection string. Set `SESSION_SECRET` and `PASSWORD_SALT` to different random secrets of at least 32 characters each. Set a strong `ADMIN_PASSWORD` and your preferred `ADMIN_USERNAME`. Do not commit or share `.env`.
4. In MongoDB, allow connections from the machine running this app. For Atlas, configure the project network access list and database user.
5. Restart the app with `npm run preview` (production preview) or `npm run dev` (development). Check `http://localhost:3001/api/health`; the response should report `"database":"connected"`.

User records are stored in the MongoDB `users` collection. Admin credentials are configured through environment variables; the password is not stored as plain text in MongoDB. Uploaded files remain in `data/uploads` on the application host. Guests can read documentation and authenticated file links, but cannot upload files or use editing/management controls.

**Deployment:** Do not expose this service publicly until MongoDB is configured, strong secrets/passwords are set, HTTPS is enabled, and network access is appropriately restricted. Set `COOKIE_SECURE=true` when serving over HTTPS.


## AWS EC2 deployment (Ubuntu + Nginx + HTTPS + MongoDB Atlas)

This guide deploys the React/Vite frontend and Express API on one EC2 instance. MongoDB stores user records; uploaded files are stored on the instance under `data/uploads`. Nginx proxies public web traffic to the app on port 3001. **Do not expose port 3001 to the internet.** Never commit `.env` or publish secrets.

### 1. Create AWS resources

1. Launch a supported Ubuntu LTS EC2 instance. Choose instance size and EBS storage based on expected traffic and uploads.
2. Create an SSH key pair and store its private key safely. Allocate an Elastic IP if you need a stable address.
3. In the EC2 security group, allow inbound SSH (TCP 22) from your IP only, and HTTP (TCP 80) and HTTPS (TCP 443) as required. Do not expose TCP 3001 or MongoDB ports.
4. Enable EBS encryption and plan regular backups/snapshots.
5. Create a DNS A record for your domain pointing to the EC2 public or Elastic IP.

AWS references: https://docs.aws.amazon.com/ec2/ and https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html

### 2. Connect and prepare Ubuntu

Run from your computer, substituting your key and IP:

```bash
chmod 400 /path/to/your-key.pem
ssh -i /path/to/your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

The default SSH username for Ubuntu EC2 images is usually `ubuntu`.

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y nginx git curl ca-certificates build-essential
```

Install a currently supported Node.js LTS version compatible with this project (Vite 8 needs a modern Node.js runtime). Verify with `node --version` and `npm --version`.

### 3. Upload the project

**Option A — private Git repository:**

```bash
sudo mkdir -p /opt/systemguidedocs
sudo chown "$USER":"$USER" /opt/systemguidedocs
git clone YOUR_PRIVATE_REPOSITORY_URL /opt/systemguidedocs
cd /opt/systemguidedocs
```

Use a private repository and scoped deploy credentials. Never embed tokens in code.

**Option B — copy from your development computer:** run this locally:

```bash
rsync -av --exclude node_modules --exclude dist --exclude .git --exclude .env --exclude data/uploads ~/Documents/SystemGuideDocs/ ubuntu@YOUR_EC2_PUBLIC_IP:/home/ubuntu/SystemGuideDocs/
```

Connect to EC2. Either move the project to `/opt/systemguidedocs`, or replace that path in subsequent commands with `/home/ubuntu/SystemGuideDocs`. Migrate old uploads separately over a secure connection if needed. Back up data before migration.

Install and build:

```bash
cd /opt/systemguidedocs
npm ci
npm run build
```

Include `package-lock.json` in version control so `npm ci` can install the locked dependencies.

### 4. Configure MongoDB Atlas

1. Create an Atlas cluster and a dedicated database user with only required permissions.
2. In Atlas Network Access, allow the EC2 instance's outbound public IP, or use a private connection supported by your setup. Avoid allowing all IPs.
3. Copy the Node.js connection string. Replace the placeholders; URL-encode special characters in the username/password when needed.
4. Keep the URI secret. Do not place it in source code, screenshots, public issues, or chat.

MongoDB references: https://www.mongodb.com/docs/atlas/connect-your-application/ and https://www.mongodb.com/docs/atlas/security/ip-access-list/

### 5. Set production environment variables

In the project directory:

```bash
cp .env.example .env
nano .env
```

Configure real values (do not use these placeholder values):

```dotenv
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb+srv://YOUR_DB_USER:URL_ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=systemguidedocs
SESSION_SECRET=REPLACE_WITH_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
PASSWORD_SALT=REPLACE_WITH_A_DIFFERENT_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
ADMIN_USERNAME=choose-your-admin-username
ADMIN_PASSWORD=choose-a-long-unique-admin-password
COOKIE_SECURE=true
```

Generate separate secrets with `openssl rand -hex 32` (run twice), and assign one to `SESSION_SECRET` and the other to `PASSWORD_SALT`. Choose a strong unique admin password. Ensure the running server loads `.env` using `dotenv/config` in `server.mjs`.

```bash
chmod 600 .env
```

Never commit `.env`; only `.env.example` with placeholders belongs in version control.

### 6. Prepare persistent uploads

Uploaded files are stored locally, not in MongoDB. Create the directory and ensure the service account can write to it:

```bash
mkdir -p data/uploads
```

For reliable persistence across instance replacement, place uploads on a persistent EBS volume mounted at a stable path, or migrate storage to private Amazon S3. Configure backups and test restoring them. Monitor available disk space; the current per-file upload limit is 50 MB.

### 7. Configure systemd

Create a dedicated service account and set project ownership (adjust the path if your project is elsewhere):

```bash
sudo useradd --system --home /opt/systemguidedocs --shell /usr/sbin/nologin systemguidedocs || true
sudo chown -R systemguidedocs:systemguidedocs /opt/systemguidedocs
sudo chmod 600 /opt/systemguidedocs/.env
sudo mkdir -p /opt/systemguidedocs/data/uploads
sudo chown -R systemguidedocs:systemguidedocs /opt/systemguidedocs/data
```

Create `/etc/systemd/system/systemguidedocs.service` with `sudo nano` and this content:

```ini
[Unit]
Description=SystemGuideDocs web application
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=systemguidedocs
Group=systemguidedocs
WorkingDirectory=/opt/systemguidedocs
Environment=NODE_ENV=production
Environment=PORT=3001
EnvironmentFile=/opt/systemguidedocs/.env
ExecStart=/usr/bin/node /opt/systemguidedocs/server.mjs
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/opt/systemguidedocs/data

[Install]
WantedBy=multi-user.target
```

Check Node's actual path with `command -v node`; update `ExecStart` if it is not `/usr/bin/node`. Ensure the service account owns the project and can write to `data/uploads`.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now systemguidedocs
sudo systemctl status systemguidedocs --no-pager
sudo journalctl -u systemguidedocs -n 100 --no-pager
curl -i http://127.0.0.1:3001/api/health
```

The health endpoint should report `"database":"connected"`. If it says `not configured`, fix the environment/MongoDB connection before making the site public.

### 8. Configure Nginx

Create `/etc/nginx/sites-available/systemguidedocs` and replace `docs.example.com` with your domain:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name docs.example.com;
    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

Enable the site and test the configuration:

```bash
sudo ln -s /etc/nginx/sites-available/systemguidedocs /etc/nginx/sites-enabled/systemguidedocs
sudo nginx -t
sudo systemctl reload nginx
```

If the default site conflicts, disable it only after confirming it does not serve another application.

### 9. Enable HTTPS

Confirm DNS points to the EC2 address and inbound TCP 80/443 are allowed. Install Certbot using its current official Ubuntu instructions. A common Ubuntu package-based setup is:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d docs.example.com
sudo certbot renew --dry-run
```

Follow Certbot prompts and enable HTTP-to-HTTPS redirection. Verify HTTPS in the browser, then confirm `COOKIE_SECURE=true` is configured in `.env` and restart:

```bash
sudo systemctl restart systemguidedocs
```

Certbot guide: https://certbot.eff.org/instructions

### 10. Verify the deployment

- [ ] `systemctl status systemguidedocs` shows the service is active.
- [ ] `nginx -t` succeeds.
- [ ] The local health endpoint reports MongoDB connected.
- [ ] Your domain opens over HTTPS and HTTP redirects to HTTPS.
- [ ] Admin login works; Reader, Editor, Manage, JSON import/export, and upload features work.
- [ ] Guest login works; guests can use Reader but cannot edit, manage, or upload.
- [ ] Direct unauthenticated requests to `/api/uploads` return HTTP 401.
- [ ] An uploaded image renders in the reader and remains available after service restart.
- [ ] Logs show no unresolved errors; backup restoration has been tested.

Follow logs with `sudo journalctl -u systemguidedocs -f`.

### 11. Updating the application

Back up MongoDB and uploaded files before deployment. From the project directory, if deployed with Git:

```bash
cd /opt/systemguidedocs
git pull --ff-only
npm ci
npm run build
sudo systemctl restart systemguidedocs
sudo systemctl status systemguidedocs --no-pager
sudo journalctl -u systemguidedocs -n 100 --no-pager
```

If the project was copied rather than cloned, upload the updated version through your chosen secure transfer process instead of running `git pull`. Do not delete `data/uploads` or overwrite `.env` during updates.

### 12. Operations and backups

- Back up MongoDB using Atlas backup features or a documented process, and test restoration.
- Back up `data/uploads`; EBS snapshots complement but do not replace restore testing.
- Encrypt EBS, monitor disk/CPU/RAM, and keep Ubuntu, Node.js, and dependencies supported.
- Restrict SSH to trusted IPs; consider AWS Systems Manager Session Manager.
- Use IAM roles and least privilege; never store AWS access keys in the repository.
- Consider private S3 storage with controlled access URLs as upload needs grow.
- Before large public launches, add login rate limiting, monitoring, and an explicit account-provisioning policy.

### Troubleshooting

**MongoDB says `not configured`:** verify `MONGODB_URI`, systemd `EnvironmentFile`, Atlas database credentials, IP access list, and outbound connectivity. Inspect `sudo journalctl -u systemguidedocs -n 100 --no-pager`.

**Login says it is not configured:** verify MongoDB is connected and `SESSION_SECRET`, `PASSWORD_SALT`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` are set. Restart after environment changes.

**502 Bad Gateway:** check the systemd service and `curl -i http://127.0.0.1:3001/api/health`; confirm Nginx proxy port matches `PORT`.

**Upload fails:** verify Nginx `client_max_body_size`, free disk space, upload-directory ownership, and server logs.

**HTTPS works but sessions do not persist:** verify HTTPS is active, `COOKIE_SECURE=true` is set, and the service has restarted. Secure cookies will not persist over plain HTTP.

**Files disappear after instance replacement:** uploads are local storage; restore them from backup or migrate them to persistent EBS/S3.
