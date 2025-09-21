# Cloudflare Tunnel Setup Guide

This guide will help you replace ngrok with Cloudflare Tunnel for your Event Connect application.

## Prerequisites

1. **Download Cloudflared**: Download the Windows executable from:
   https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe

2. **Rename and Place**: Rename it to `cloudflared.exe` and place it in your project root directory.

## Quick Start

### Option 1: Using the Batch Script (Recommended)

1. Run the provided batch script:
   ```cmd
   start-tunnel.bat
   ```

2. The script will start two tunnels:
   - Frontend tunnel (port 5173)
   - Backend tunnel (port 5000)

3. Note down the URLs displayed in the terminal windows (they look like: `https://random-string.trycloudflare.com`)

### Option 2: Manual Setup

1. **Start Backend Tunnel**:
   ```cmd
   cloudflared.exe tunnel --url http://localhost:5000
   ```

2. **Start Frontend Tunnel** (in another terminal):
   ```cmd
   cloudflared.exe tunnel --url http://localhost:5173
   ```

## Configuration

### Update Environment Variables

1. **Backend (.env file in /backend/)**:
   ```env
   FRONTEND_URL=https://your-frontend-tunnel.trycloudflare.com
   BACKEND_URL=https://your-backend-tunnel.trycloudflare.com
   ```

2. **Frontend (.env file in root)**:
   ```env
   VITE_BACKEND_URL=https://your-backend-tunnel.trycloudflare.com
   VITE_FRONTEND_URL=https://your-frontend-tunnel.trycloudflare.com
   ```

### Important Notes

- **Free Tier**: Cloudflare Tunnel's free tier provides temporary URLs that change each time you restart
- **Custom Domains**: For persistent URLs, you need a Cloudflare account and custom domain
- **HTTPS Only**: Cloudflare Tunnel only provides HTTPS URLs (more secure than ngrok's mixed approach)

## Development Workflow

1. **Start Your Development Servers**:
   ```cmd
   # Backend (in /backend/)
   npm start

   # Frontend (in root)
   npm run dev
   ```

2. **Start Tunnels**:
   ```cmd
   # Run the batch script
   start-tunnel.bat
   ```

3. **Update URLs**: Copy the tunnel URLs and update your .env files

4. **Test**: Access your app via the frontend tunnel URL

## Advantages over ngrok

✅ **Free Forever**: No session limits or account required  
✅ **Better Performance**: Cloudflare's global network  
✅ **More Secure**: Built-in DDoS protection  
✅ **HTTPS Only**: Always secure connections  
✅ **No "Visit Site" Warning**: Cleaner user experience  

## Troubleshooting

### Common Issues

1. **Port Already in Use**: Make sure your dev servers are running on the correct ports
2. **Tunnel Not Starting**: Check if cloudflared.exe is in the correct location
3. **CORS Errors**: Ensure your .env files have the correct tunnel URLs

### Debugging

1. Check tunnel status:
   ```cmd
   tasklist | findstr cloudflared
   ```

2. Stop all tunnels:
   ```cmd
   taskkill /f /im cloudflared.exe
   ```

## Security Considerations

- Never commit tunnel URLs to version control
- Rotate tunnel URLs regularly in production
- Consider using Cloudflare's authenticated tunnels for production

## Next Steps

For production deployment, consider:
1. Setting up a Cloudflare account
2. Using custom domains
3. Implementing Cloudflare Access for authentication
4. Setting up permanent tunnel configurations