# Servitec Map - Deployment Guide for Kids 🚀

This guide explains how to deploy the Servitec Map app - so easy that even a kid could do it!

## What is this app?

The Servitec Map application has two main parts:
- **Backend**: This is like the brain 🧠 of the app that does all the thinking
- **Frontend**: This is what you see 👀 on your screen and interact with

## How to Deploy the App (Super Easy Way)

1. Open your terminal
2. Go to the main folder of the app
3. Run this command:
   ```bash
   ./deploy_app.sh
   ```
4. Type "y" when asked if you want to continue
5. Enter the database password when asked
6. Wait for the deployment to finish
7. At the end, you'll get two links:
   - The backend API link (for the app's brain)
   - The frontend link (what users will use)

That's it! The app is now running in the cloud! 🎉

## Files You Need to Know About

### Main Files
- `deploy_app.sh` - The main script that deploys everything
- `backend/deploy_final.sh` - Deploys just the backend part
- `frontend/deploy_frontend.sh` - Deploys just the frontend part

### Important Folders
- `backend/` - Contains all the brain stuff (API code)
- `frontend/` - Contains all the display stuff (what users see)
- `deployment/` - Contains helpful tools for deployment

## Pictures of How It Works

```
┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │
│    Frontend     │────►│     Backend     │
│  (What you see) │     │  (The brain)    │
│                 │◄────│                 │
└─────────────────┘     └─────────────────┘
        ▲                       ▲
        │                       │
        │                       │
        │                       │
┌───────┴───────────────────────┴──────────┐
│                                          │
│             Google Cloud Run             │
│                                          │
└──────────────────────────────────────────┘
                    ▲
                    │
                    │
         ┌──────────┴─────────┐
         │                    │
         │      Database      │
         │                    │
         └────────────────────┘
```

## For Grown-Ups: Advanced Deployment Options

If you need more control, you can:

1. Deploy just the backend:
   ```bash
   cd backend
   ./deploy_final.sh
   ```

2. Deploy just the frontend:
   ```bash
   cd frontend
   ./deploy_frontend.sh
   ```

3. Change configurations by editing these files:
   - `backend/deploy_final.sh` - For backend settings
   - `frontend/deploy_frontend.sh` - For frontend settings

For more detailed information, check:
- `backend/DEPLOYMENT.md`
- `frontend/DEPLOYMENT.md`
- `deployment/README.md` 