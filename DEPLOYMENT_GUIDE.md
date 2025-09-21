
# Event Connect Deployment Guide

## Overview
This guide will help you deploy your Event Connect app to your custom domain `event-connect.site`.

## Architecture
- **Frontend**: Deployed to Vercel at `https://event-connect.site`
- **Backend**: Deployed to Railway at `https://backend.event-connect.site`

## Step 1: Frontend Deployment (Vercel)

### 1.1 Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account
2. Click "New Project"
3. Import your Event Connect repository
4. Configure build settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

### 1.2 Add Environment Variables in Vercel
In your Vercel project settings → Environment Variables, add:
```
VITE_BACKEND_URL=https://backend.event-connect.site
VITE_FRONTEND_URL=https://event-connect.site
```

### 1.3 Configure Custom Domain
1. In Vercel project settings → Domains
2. Add `event-connect.site` and `www.event-connect.site`
3. Vercel will provide DNS records to configure

## Step 2: Backend Deployment (Railway)

### 2.1 Deploy to Railway
1. Go to [railway.app](https://railway.app) and sign in
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your Event Connect repository
4. Set root directory to `backend`

### 2.2 Configure Railway Settings
- **Start Command**: `npm start`
- **Build Command**: `npm install`

### 2.3 Add Environment Variables in Railway
Add all variables from `backend/.env.production`:
```
MONGODB_URI=mongodb+srv://ralfanta0112:Capricorn_01122004@cluster0.peajodp.mongodb.net/eventConnect?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=Capricorn_01122004_Renheart_Alfanta
JWT_EXPIRE=7d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_production_email@gmail.com
EMAIL_PASS=your_production_app_password
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://event-connect.site
BACKEND_URL=https://backend.event-connect.site
```

### 2.4 Configure Custom Domain in Railway
1. In Railway project settings → Domains
2. Add custom domain: `backend.event-connect.site`

## Step 3: DNS Configuration (Namecheap)

### 3.1 Configure DNS Records
In your Namecheap domain panel, add these DNS records:

**For Frontend (Vercel):**
```
Type: A
Host: @
Value: 76.76.19.61

Type: CNAME
Host: www
Value: cname.vercel-dns.com
```

**For Backend (Railway):**
```
Type: CNAME
Host: backend
Value: [Railway will provide this - check Railway domains section]
```

## Step 4: Email Configuration

### 4.1 Set up Gmail App Password
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password for your application
3. Update the environment variables in Railway:
   - `EMAIL_USER`: Your Gmail address
   - `EMAIL_PASS`: The generated app password

## Step 5: Final Verification

1. Visit `https://event-connect.site` to test frontend
2. Test API endpoints at `https://backend.event-connect.site/api`
3. Test user registration/login to verify email sending
4. Test event creation and QR code generation

## Troubleshooting

### Common Issues:
1. **CORS Errors**: Ensure `FRONTEND_URL` is correctly set in backend environment
2. **Email Not Sending**: Verify Gmail app password is correctly configured
3. **Database Connection**: Check MongoDB Atlas network access allows Railway IPs
4. **Domain Not Loading**: DNS propagation can take up to 48 hours

### Useful Commands:
```bash
# Test backend API
curl https://backend.event-connect.site/api/auth/test

# Check DNS propagation
nslookup event-connect.site
```

## Security Checklist

- [ ] All sensitive environment variables are set in production
- [ ] MongoDB Atlas has proper network access rules
- [ ] JWT secrets are strong and unique
- [ ] Email credentials are secure app passwords
- [ ] HTTPS is enforced on all domains