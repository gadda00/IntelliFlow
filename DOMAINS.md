# Custom Domain Setup Guide

## busaraai.com → Netlify

### Step 1: Add Domain in Netlify
1. Go to https://app.netlify.com → your Busara site
2. **Domain settings** → **Add custom domain** → enter `busaraai.com`
3. Also add `www.busaraai.com` → set as redirect to `busaraai.com`

### Step 2: Configure DNS at Spaceship.com
Log into your Spaceship account and add these DNS records:

```
Type: A
Name: @
Value: 75.2.60.5
TTL: 3600

Type: A
Name: @
Value: 75.2.60.5
(TTL: 3600)

Type: CNAME
Name: www
Value: busara-ai.netlify.app.
TTL: 3600
```

**Note:** Netlify will show you the exact A records to use — they may differ slightly. Check the Netlify dashboard for the exact IP addresses.

### Step 3: Verify
- Wait 5-30 minutes for DNS propagation
- Netlify will show "DNS verified" in the domain settings
- Enable "Force HTTPS" once the SSL certificate is provisioned (automatic via Let's Encrypt)

---

## victorndunda.com → GitHub Pages

### Step 1: CNAME File (Already Done)
The `CNAME` file is already in the `victor-portfolio` repo root, containing `victorndunda.com`.

### Step 2: Configure DNS at Spaceship.com
Log into your Spaceship account and add these DNS records:

```
Type: A
Name: @
Value: 185.199.108.153
TTL: 3600

Type: A
Name: @
Value: 185.199.109.153
TTL: 3600

Type: A
Name: @
Value: 185.199.110.153
TTL: 3600

Type: A
Name: @
Value: 185.199.111.153
TTL: 3600

Type: CNAME
Name: www
Value: gadda00.github.io.
TTL: 3600
```

### Step 3: Verify in GitHub
1. Go to https://github.com/gadda00/victor-portfolio/settings/pages
2. Under "Custom domain", you should see `victorndunda.com`
3. Wait for "DNS check successful" message
4. Enable "Enforce HTTPS"

### Step 4: Wait for SSL
GitHub Pages automatically provisions an SSL certificate via Let's Encrypt. This can take 10-30 minutes after DNS propagates.

---

## Verification

After DNS propagates (check with `dig busaraai.com` or `dig victorndunda.com`):

- **busaraai.com** should show the Busara app
- **victorndunda.com** should show your portfolio

Both should have valid HTTPS certificates automatically.
