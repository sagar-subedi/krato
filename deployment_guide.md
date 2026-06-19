# Krato Deployment & CI/CD Guide

This guide walks you through the manual steps required to connect your VPS to GitHub Actions and deploy the production Krato cluster.

## 1. Prepare your VPS

Ensure your VPS has Docker and Docker Compose installed.

### Install Docker
```bash
# Update and install dependencies
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
# Logout and login again for group changes to take effect
```

### Setup Firewall
Krato uses several ports in the high range (18xxx-19xxx) to avoid common conflicts. Ensure your VPS firewall (ufw) allows them:
```bash
sudo ufw allow 18080:18082/tcp  # Dashboard & API
sudo ufw allow 17070:17072/udp  # Gossip Protocol (UDP)
sudo ufw allow 19090:19092/tcp  # gRPC (Optional)
sudo ufw allow 22/tcp           # SSH
```

---

## 2. Generate SSH Keys
GitHub Actions needs an SSH key to access your VPS.

1. **On your local machine** (or VPS):
   ```bash
   ssh-keygen -t ed25519 -C "github-actions-krato"
   ```
2. **Add to VPS**: Copy the content of the `.pub` file and add it to `~/.ssh/authorized_keys` on your VPS.
3. **Save Private Key**: You will need the content of the private key file for GitHub Secrets.

---

## 3. Configure GitHub Secrets
Navigate to your repository on GitHub: **Settings > Secrets and variables > Actions**.

Add the following **Repository secrets**:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `VPS_HOST` | The IP address or domain of your VPS | `1.2.3.4` |
| `VPS_USER` | The SSH username (usually root or ubuntu) | `ubuntu` |
| `SSH_PRIVATE_KEY` | The full content of your private SSH key | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `GEMINI_API_KEY` | Your Google Gemini API Key for diagnostics | `AIzaSy...` |

---

## 4. Triggering the Deployment
Once the secrets are set:

1. **Push to main**: Any push to the `main` branch will trigger the workflow.
2. **Monitor Actions**: Go to the **Actions** tab in GitHub to see the build and deployment progress.
3. **Verify**: Once finished, visit `http://YOUR_VPS_IP:18080` to see your live Krato dashboard!

---

## 5. (Optional) Custom Domain & SSL
For a professional setup, use a reverse proxy like **Nginx** to handle HTTPS and port forwarding:

**Nginx Configuration Example (`/etc/nginx/sites-available/krato`):**
```nginx
server {
    listen 80;
    server_name krato.example.com;

    location / {
        proxy_pass http://localhost:18080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
