📦 Installation
1. Clone the Repository
git clone <your-repository-url>
cd lazycook-ui

2. Install Dependencies
npm install


This installs all required dependencies including React, TypeScript, Vite, Tailwind CSS v4, Markdown support, and PDF generation libraries.

🔐 Environment Variables

Create a .env file in the root of the project:

VITE_API_BASE=http://localhost:8000


Note:
VITE_API_BASE should point to your backend API URL.

▶️ Running the App
Start Development Server
npm run dev


The app will be available at:

http://localhost:5173


(Vite will auto-select another port if this one is busy.)

🛠️ Available Scripts
Development
npm run dev


Starts the development server with Hot Module Replacement (HMR).

Build for Production
npm run build


Creates an optimized production build in the dist/ directory.

Preview Production Build
npm run preview


Preview the production build locally.

Linting
npm run lint


Runs ESLint for code quality checks.

📁 Project Structure
lazycook-ui/
├── src/
│   ├── App.tsx              # Main app component
│   ├── App.css              # Global styles
│   ├── MarkdownContent.tsx  # Markdown renderer
│   ├── CodeBlock.tsx        # Code block (copy/edit/download)
│   └── components/          # Reusable components
├── public/                  # Static assets
├── index.html               # HTML template
├── package.json             # Scripts & dependencies
├── tsconfig.json            # TypeScript config
├── vite.config.ts           # Vite config
├── postcss.config.js        # PostCSS (Tailwind v4)
└── tailwind.config.js       # Tailwind theme

⚙️ Configuration
Tailwind CSS v4

Uses the new PostCSS plugin

Config files:

postcss.config.js

tailwind.config.js

TypeScript

Strict type checking enabled

Configured in tsconfig.json

Vite

Uses rolldown-vite for faster builds

Config in vite.config.ts

🌐 Backend Connection

Make sure your backend is running before starting the frontend.

Backend URL: http://localhost:8000

Update VITE_API_BASE if backend runs elsewhere

Backend must allow CORS requests from the frontend

🐛 Troubleshooting
Port Already in Use

Vite will automatically use the next available port.

Module Not Found Errors
rm -rf node_modules package-lock.json
npm install

Tailwind CSS Not Working
npm install -D @tailwindcss/postcss

Build Errors
rm -rf dist node_modules/.vite
npm run build

TypeScript Errors
npx tsc --noEmit

📦 Production Deployment
Build
npm run build

Deploy the dist/ Folder To:

Vercel

Netlify

AWS S3

Nginx

Production Environment Variables

Set VITE_API_BASE in your hosting provider’s environment settings.

✨ Features

💬 Real-time AI chat interface

📝 Markdown rendering with syntax highlighting

📄 Export chat to PDF

🎯 Editable & downloadable code blocks

😊 Emoji-enhanced responses

🔄 Regenerate AI responses

📱 Fully responsive design

🤝 Contributing

Fork the repository

Create a feature branch

git checkout -b feature/awesome-feature


Commit changes

git commit -m "Add awesome feature"


Push to branch

git push origin feature/awesome-feature


Open a Pull Request