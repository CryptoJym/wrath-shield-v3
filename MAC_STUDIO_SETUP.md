# Mac Studio Always-On Server Setup

## Prerequisites

- Mac Studio (or any always-on Mac)
- Domain name (can use free Cloudflare registrar)
- Cloudflare account (free)
- UPS recommended for power protection

---

## Step 1: System Configuration

### Prevent Sleep
```bash
# Disable sleep entirely
sudo pmset -a sleep 0
sudo pmset -a disksleep 0
sudo pmset -a displaysleep 0

# Or just prevent sleep when on power
sudo pmset -c sleep 0
```

### Auto-Restart After Power Loss
System Settings → General → Startup & Shutdown → "Start up automatically after power failure"

### Enable SSH (for emergency access)
System Settings → General → Sharing → Remote Login → On

---

## Step 2: Install Dependencies

```bash
# Install Homebrew if not present
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js 20
brew install node@20
echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Install PM2
npm install -g pm2

# Install Cloudflare Tunnel
brew install cloudflared
```

---

## Step 3: Setup Project

```bash
# Navigate to project
cd ~/Projects/apps/wrath-shield-v3

# Install dependencies
npm install

# Create logs directory
mkdir -p logs

# Build for production
npm run build
```

---

## Step 4: Configure PM2

```bash
# Start all processes
pm2 start ecosystem.config.js --env production

# Save process list (survives reboots)
pm2 save

# Generate startup script
pm2 startup
# Run the command it outputs!

# Verify
pm2 status
```

---

## Step 5: Setup Cloudflare Tunnel

### 5.1 Login to Cloudflare
```bash
cloudflared tunnel login
# This opens browser - authorize with your Cloudflare account
```

### 5.2 Create Tunnel
```bash
cloudflared tunnel create wrath-shield
# Note the tunnel ID (UUID) it outputs
```

### 5.3 Configure Tunnel
```bash
# Create config directory
mkdir -p ~/.cloudflared

# Create config file
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: wrath-shield
credentials-file: /Users/jamesbrady/.cloudflared/TUNNEL_ID.json

ingress:
  # Main application
  - hostname: wrath.yourdomain.com
    service: http://localhost:3000

  # Catch-all (required)
  - service: http_status:404
EOF

# Edit the file to add your actual tunnel ID
nano ~/.cloudflared/config.yml
```

### 5.4 Route DNS
```bash
# This creates the DNS record automatically
cloudflared tunnel route dns wrath-shield wrath.yourdomain.com
```

### 5.5 Test Tunnel
```bash
# Run in foreground to test
cloudflared tunnel run wrath-shield

# Visit https://wrath.yourdomain.com in browser
# Ctrl+C to stop
```

### 5.6 Install as System Service
```bash
# Install the service
sudo cloudflared service install

# Start it
sudo launchctl start com.cloudflare.cloudflared

# Verify it's running
sudo launchctl list | grep cloudflare
```

---

## Step 6: Verify Everything Works

```bash
# Check PM2 processes
pm2 status

# Check tunnel is running
sudo launchctl list | grep cloudflare

# Check from external device
curl https://wrath.yourdomain.com/api/health
```

---

## Maintenance

### View Logs
```bash
# PM2 logs
pm2 logs wrath-shield-v3

# All PM2 logs
pm2 logs

# Tunnel logs
sudo cat /Library/Logs/com.cloudflare.cloudflared.err.log
```

### Update Application
```bash
cd ~/Projects/apps/wrath-shield-v3
git pull
npm install
npm run build
pm2 reload ecosystem.config.js --env production
```

### Restart Everything
```bash
pm2 restart all
```

### Check Resource Usage
```bash
pm2 monit
```

---

## Remote Access Options

### Option 1: Web Dashboard (Recommended)
Access `https://wrath.yourdomain.com` from anywhere

### Option 2: SSH (Emergency)
```bash
# From another machine on same network
ssh jamesbrady@192.168.x.x

# From anywhere (requires additional tunnel setup)
# Add to ~/.cloudflared/config.yml:
#   - hostname: ssh.yourdomain.com
#     service: ssh://localhost:22
```

### Option 3: Tailscale (VPN Alternative)
```bash
# Install Tailscale for secure private network
brew install tailscale
sudo tailscaled install-system-daemon
tailscale up

# Access via Tailscale IP from any device with Tailscale
```

---

## Backup Strategy

### Automated SQLite Backup
```bash
# Add to crontab
crontab -e

# Add this line (backs up at 4am daily)
0 4 * * * cp ~/Projects/apps/wrath-shield-v3/data/wrath-shield.db ~/Backups/wrath-shield-$(date +\%Y\%m\%d).db
```

### Sync to iCloud (Optional)
```bash
# Create backup script
cat > ~/backup-wrath.sh << 'EOF'
#!/bin/bash
cp ~/Projects/apps/wrath-shield-v3/data/wrath-shield.db \
   ~/Library/Mobile\ Documents/com~apple~CloudDocs/Backups/wrath-shield-$(date +%Y%m%d).db
EOF
chmod +x ~/backup-wrath.sh

# Add to crontab
0 4 * * * ~/backup-wrath.sh
```

---

## Troubleshooting

### PM2 Not Starting on Boot
```bash
# Regenerate startup script
pm2 unstartup
pm2 startup
# Run the command it outputs
pm2 save
```

### Tunnel Not Connecting
```bash
# Check service status
sudo launchctl list | grep cloudflare

# Restart tunnel
sudo launchctl stop com.cloudflare.cloudflared
sudo launchctl start com.cloudflare.cloudflared

# Check logs
sudo tail -f /Library/Logs/com.cloudflare.cloudflared.err.log
```

### Mac Went to Sleep
```bash
# Verify sleep settings
pmset -g

# Force disable all sleep
sudo pmset -a sleep 0 displaysleep 0 disksleep 0
```

---

## Cost Comparison

| Approach | Monthly Cost |
|----------|-------------|
| Mac Studio (owned) | $0 + electricity (~$10-15) |
| DigitalOcean Droplet | $12-24 |
| Railway | $20-50 |

**Total savings over 2 years:** $288-1,200+

---

## Security Notes

1. **Never expose ports directly** - Always use Cloudflare Tunnel
2. **Enable FileVault** - Encrypt your drive
3. **Use strong passwords** - For SSH and user account
4. **Keep macOS updated** - Enable automatic updates
5. **Firewall** - System Settings → Network → Firewall → On
