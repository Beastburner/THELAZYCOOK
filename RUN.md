Steps:
1. Navigate to the backend directory:
cd backend

2. Activate the virtual environment:
.\venv\Scripts\Activate.ps1

If you get an execution policy error, run this first:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

3. Install dependencies:
python -m pip install -r requirements.txt

Or if pip is available after activation:
pip install -r requirements.txt

4. Run the server:
uvicorn main:app --reload

Complete sequence (copy-paste):
cd backend.\venv\Scripts\Activate.ps1python -m pip install -r requirements.txtuvicorn main:app --reload


   The backend will be available at: **http://localhost:8000**
   - API docs: http://localhost:8000/docs
   - Health check: http://localhost:8000/health

### Frontend (React + Vite)
1. Navigate to the frontend directory:
   ```powershell
   cd lazycook-ui
   ```

2. Start the development server:
   ```powershell
   npm run dev
   ```

   The frontend will be available at: **http://localhost:5173** (or the next available port)

## Running Both at Once

You can run both services in separate terminal windows, or use the PowerShell commands:

**Backend:**
```powershell
cd "C:\Users\parth\Desktop\websites\lazycook payment gateway\backend"
.\venv\Scripts\Activate.ps1
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```powershell
cd "C:\Users\parth\Desktop\websites\lazycook payment gateway\lazycook-ui"
npm run dev
```

## First Time Setup

If you haven't set up the project yet:

1. **Backend setup:**
   ```powershell
   cd backend
   py -m venv venv
   .\venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

2. **Frontend setup:**
   ```powershell
   cd lazycook-ui
   npm install
   ```

## Notes

- The backend uses FastAPI with Uvicorn
- The frontend uses React with Vite
- CORS is configured to allow requests from the frontend
- Backend runs on port 8000 by default
- Frontend runs on port 5173 by default (Vite)

