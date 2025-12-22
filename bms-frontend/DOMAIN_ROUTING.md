# Domain & Subdomain Routing Guide

## How Domain Routing Works

The BMS system supports two types of domain routing:

### 1. **Subdomain Routing** (Recommended for Development)

- Format: `{subdomain}.localhost:3000` or `{subdomain}.bms.com`
- Example: `acme.localhost:3000` or `acme.bms.com`
- Automatically resolves the organization based on the subdomain
- No DNS configuration needed in development

### 2. **Custom Domain Routing** (Production)

- Format: `example.com` (custom domain)
- Requires DNS configuration to point to your server
- More complex setup, typically for enterprise customers

## Development Setup (localhost:3000)

### Option 1: Using Subdomain with /etc/hosts (Recommended)

1. **Edit your hosts file:**

   ```bash
   sudo nano /etc/hosts
   ```

2. **Add entries for each organization:**

   ```
   127.0.0.1 acme.localhost
   127.0.0.1 sunrise.localhost
   127.0.0.1 testorg.localhost
   ```

3. **Access the application:**
   - Main app: `http://localhost:3000`
   - Organization-specific: `http://acme.localhost:3000`
   - Organization-specific: `http://sunrise.localhost:3000`

### Option 2: Using Query Parameter (Simpler for Testing)

Instead of subdomain, you can use a query parameter:

- `http://localhost:3000?org=acme`
- `http://localhost:3000/dashboard?org=acme`

### Option 3: Using Path-based Routing

Use organization code in the path:

- `http://localhost:3000/org/ACME/dashboard`
- `http://localhost:3000/org/SUNRISE/dashboard`

## How It Works Technically

### Middleware Detection

The middleware (`middleware.ts`) detects subdomain requests:

```typescript
const hostname = request.headers.get('host') || '';
const subdomain = hostname.split('.')[0];

// Check if subdomain exists
if (subdomain && subdomain !== 'localhost' && subdomain !== 'www') {
  // Resolve organization by subdomain
  const org = await findOrganizationBySubdomain(subdomain);
  // Add organization context to request headers
}
```

### Organization Resolution

1. **Subdomain Request** → `acme.localhost:3000`
2. **Extract Subdomain** → `acme`
3. **Database Lookup** → Find organization with `subdomain: "acme"`
4. **Add Context** → Set `x-organization-id` header
5. **Route Handler** → Uses organization context for data scoping

## Testing in Development

### Step 1: Create an Organization with Subdomain

1. Go to `/admin/organizations/new`
2. Fill in organization name (e.g., "Acme Corp")
3. Subdomain will auto-generate (e.g., "acme-corp")
4. You can customize it (e.g., "acme")
5. Click "Create Organization"

### Step 2: Configure Local Hosts File

```bash
# Linux/Mac
sudo nano /etc/hosts

# Add:
127.0.0.1 acme.localhost
```

### Step 3: Access via Subdomain

- Open browser: `http://acme.localhost:3000`
- The middleware will automatically detect the subdomain
- Organization context will be available in all routes

## Production Setup

### For Subdomain Routing (subdomain.bms.com)

1. **DNS Configuration:**
   - Add wildcard DNS: `*.bms.com` → Your server IP
   - Or add specific subdomains: `acme.bms.com` → Your server IP

2. **Server Configuration:**
   - Ensure your server accepts requests for `*.bms.com`
   - SSL certificate should cover `*.bms.com` (wildcard certificate)

### For Custom Domain (example.com)

1. **DNS Configuration:**
   - Point `example.com` → Your server IP
   - Point `www.example.com` → Your server IP

2. **Server Configuration:**
   - Configure virtual host for `example.com`
   - SSL certificate for `example.com`

3. **Application Configuration:**
   - Update middleware to check custom domains
   - Map domain to organization in database

## Current Implementation Status

✅ **Implemented:**

- Subdomain detection in middleware
- Organization lookup by subdomain
- Organization context in request headers
- Auto-generation of subdomain from organization name

🔄 **To Be Implemented:**

- Custom domain routing (requires additional DNS/server config)
- Organization-specific route rewriting
- Branding application based on organization
- Organization-specific theme/colors

## Testing Checklist

- [ ] Create organization with subdomain
- [ ] Add subdomain to `/etc/hosts`
- [ ] Access `http://{subdomain}.localhost:3000`
- [ ] Verify organization context is detected
- [ ] Test organization-specific features
- [ ] Test branding/theme application

## Troubleshooting

### Subdomain not working?

1. Check `/etc/hosts` file has correct entry
2. Clear browser cache
3. Restart Next.js dev server
4. Check organization has subdomain in database

### Organization not found?

1. Verify subdomain matches exactly (case-sensitive in database)
2. Check organization exists in database
3. Verify subdomain field is set (not null)

### Port issues?

- If using custom port, use: `http://acme.localhost:3000`
- Ensure Next.js is running on the correct port



