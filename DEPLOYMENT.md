# Pranjal's Universe — Deployment & Production Environment Guide

## Production Deployment to Vercel

### Step 1: Push Repository to GitHub
Ensure all source files, migrations, and assets are committed and pushed to your private GitHub repository. Never commit `.env.local` or any file containing plaintext credentials.

### Step 2: Import into Vercel
1. Log in to [vercel.com](https://vercel.com).
2. Click **Add New Project** and select your repository.
3. If deploying from the repository root, set the **Root Directory** to `memory-universe`.
4. Framework preset should be detected automatically as **Next.js**.

### Step 3: Configure Environment Variables
Set the following environment variables in your Vercel Project Settings (**Settings > Environment Variables**). Mark server-only secrets as **Sensitive** in Vercel.

#### Public Configuration (Browser-Visible)
These variables are prefixed with `NEXT_PUBLIC_` and are bundled into client code for authenticated API calls:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL (e.g. `https://<project-ref>.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Public Anon/Publishable Key

#### Server-Only Secrets (Never Browser-Visible)
These variables must **never** be prefixed with `NEXT_PUBLIC_`. They are accessible strictly on the server during Route Handler execution:
- `SUPABASE_SERVICE_ROLE_KEY`: Privileged service-role key for server-side database mutations
- `DATABASE_URL`: PostgreSQL connection string with SSL pooling enabled
- `GEMINI_API_KEY`: Google Generative Language API key for Gemini 2.5 Flash
- `CLOUDINARY_API_KEY`: Cloudinary API Key
- `CLOUDINARY_API_SECRET`: Cloudinary API Secret
- `CLOUDINARY_CLOUD_NAME`: Cloudinary Cloud Name (e.g. `Images`)
- `CLOUDINARY_FOLDER`: Storage folder (default: `pranjal_universe`)
- `CLOUDINARY_PREFIX`: Asset public ID prefix (default: `pranjal_universe_`)

```env
# Public Client Configuration
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>

# Server-Only Production Secrets
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
DATABASE_URL=<your-postgresql-connection-string>
GEMINI_API_KEY=<your-google-gemini-api-key>
CLOUDINARY_API_KEY=<your-cloudinary-api-key>
CLOUDINARY_API_SECRET=<your-cloudinary-api-secret>
CLOUDINARY_CLOUD_NAME=<your-cloudinary-cloud-name>
CLOUDINARY_FOLDER=pranjal_universe
CLOUDINARY_PREFIX=pranjal_universe_
```

---

## Secret Handling & Security Policy

1. **Never Commit Secrets**: Ensure `.env.local` remains in `.gitignore`.
2. **Never Put Secrets in `NEXT_PUBLIC_*`**: Any variable starting with `NEXT_PUBLIC_` is included in the client JavaScript bundle and visible in browser DevTools.
3. **Use Vercel Sensitive Variables**: Enable Vercel's Sensitive Environment Variable toggle for `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `GEMINI_API_KEY`, and `CLOUDINARY_API_SECRET`. Once configured, sensitive variables cannot be read back by users or collaborators in the web UI.
4. **Redeploy After Changes**: Environment variable modifications require a new deployment to take effect. Trigger a redeployment in the Vercel dashboard whenever keys are updated or rotated.

---

## Credential Rotation Procedures

If a production credential has been exposed or compromised:

### 1. Rotating Supabase Service Role Key
1. In the Supabase Dashboard, navigate to **Project Settings > API**.
2. Under **Project API keys**, click **Generate new secret key** next to `service_role`.
3. Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel Environment Variables.
4. Redeploy the application.
5. Invalidate the old service role key in Supabase.

### 2. Rotating PostgreSQL Database Password
1. In the Supabase Dashboard, navigate to **Project Settings > Database**.
2. Click **Reset Database Password** and generate a strong password.
3. Update `DATABASE_URL` in Vercel Environment Variables with the new password.
4. Redeploy the application.

### 3. Rotating Google Gemini API Key
1. In Google AI Studio, navigate to **API Keys**.
2. Click **Create API key** for your project.
3. Update `GEMINI_API_KEY` in Vercel Environment Variables.
4. Redeploy the application.
5. Delete the compromised key in Google AI Studio.

### 4. Rotating Cloudinary API Secret
1. In Cloudinary Console, navigate to **Settings > Access Keys**.
2. Generate a new API Secret.
3. Update `CLOUDINARY_API_SECRET` in Vercel Environment Variables.
4. Redeploy the application.
5. Delete the old API Secret in Cloudinary.

---

## Build & Verification Commands
- Production Build: `npm run build`
- Automated Test Suite: `npm test`
- Production Server: `npm run start`
