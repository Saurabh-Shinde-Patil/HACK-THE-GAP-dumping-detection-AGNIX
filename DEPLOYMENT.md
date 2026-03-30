# CleanCity Deployment Guide

Follow these steps to deploy the CleanCity project to production using GitHub, Render, and Vercel.

## 1. GitHub Setup
1. Create a new repository on [GitHub](https://github.com/new).
2. Follow the instructions to push your local repository:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

---

## 2. Backend Deployment (Render)
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New > Web Service**.
2. Connect your GitHub repository.
3. **Settings**:
   - **Name**: `cleancity-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. **Environment Variables**: Add the following in the Render settings:
   - `MONGO_URI`: Your MongoDB Atlas connection string.
   - `JWT_SECRET`: A long random string.
   - `CLIENT_URL`: Your Vercel frontend URL (e.g., `https://cleancity.vercel.app`).
   - `AI_SERVICE_URL`: Your Render AI Service URL.
   - `NODE_ENV`: `production`

---

## 3. AI Service Deployment (Render)
1. Click **New > Web Service**.
2. Connect your GitHub repository.
3. **Settings**:
   - **Name**: `cleancity-ai`
   - **Root Directory**: `ai-service`
   - **Environment**: `Python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python main.py`
4. **Environment Variables**:
   - `PORT`: `8000` (Render usually sets this automatically).

---

## 4. Frontend Deployment (Vercel)
1. Go to [Vercel](https://vercel.com/) and click **Add New > Project**.
2. Import your GitHub repository.
3. **Project Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
4. **Environment Variables**:
   - `VITE_API_URL`: Your Render Backend URL (e.g., `https://cleancity-backend.onrender.com`).
5. Click **Deploy**.

---

> [!NOTE]
> Ensure you update the `CLIENT_URL` in the Backend settings after your Vercel deployment is finished!
