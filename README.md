# Pranjal's Memory Universe 🌌

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-black?style=for-the-badge&logo=three.js)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Face-API](https://img.shields.io/badge/Face--API-Biometrics-blue?style=for-the-badge)

A highly secure, biometric-locked personal archiving system and interactive 3D universe. This application goes beyond standard photo galleries by using **true 128-Dimensional facial vector embeddings** to authenticate the administrator and protect private memories, alongside advanced AI-driven features like semantic relationship puzzles and generative studios.

---

## ✨ Key Features

### 🔒 Military-Grade Biometric Security
- **128-D Vector Verification**: Uses @vladmandic/face-api mapped directly to Node.js canvas to compute exact facial Euclidean vectors on the backend, completely immune to text-based spoofing.
- **Edge Route Protection**: Employs Next.js edge middleware to strictly wall off all admin-level routes (/gallery, /timeline, /collections, etc.). Visitors can only view the stunning 3D landing page unless they physically pass the webcam lock.
- **Vector Database**: Utilizes Supabase pgvector to store facial embeddings and securely compute mathematical cosine distances in real-time via PostgreSQL RPCs.

### 🌌 Interactive 3D Frontend
- **Three.js Particle Universe**: Built with @react-three/fiber and @react-three/drei to render a lightweight, highly optimized floating 3D particle network representing your memory neural graph.
- **Glassmorphic UI**: Clean, modern aesthetics layered over the 3D canvas, featuring Lucide React iconography and Tailwind CSS animations.

### 🧩 Advanced AI Capabilities
- **Semantic Puzzles Engine**: Automatically generates dynamic puzzles (like *Context Connections* and *Archive Geoguessr*) using true Haversine distance calculations and Gemini AI semantic clustering on your EXIF metadata.
- **Creative Studio**: An integrated AI canvas allowing generative interaction with your secure archive.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router, Server Actions)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **3D Rendering**: [Three.js](https://threejs.org/) / [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- **Database & Storage**: [Supabase](https://supabase.com/) (PostgreSQL + pgvector)
- **Biometrics**: ace-api.js (TensorFlow.js)
- **AI Processing**: Google Gemini API
- **Maps**: Mapbox GL / react-map-gl

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- Supabase Account & Database with pgvector extension enabled
- Google Gemini API Key

### Installation

1. **Clone the repository:**
   `ash
   git clone https://github.com/sailwalpranjal/pranjals-memory-universe.git
   cd pranjals-memory-universe
   `

2. **Install dependencies:**
   `ash
   npm install
   `

3. **Set up Environment Variables:**
   Rename .env.example to .env.local and fill in your keys:
   `env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
   GEMINI_API_KEY=your_gemini_api_key
   NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
   `

4. **Initialize Database:**
   Run the setup script to initialize the PostgreSQL tables, indexes, and RPC functions:
   `ash
   node setup-db.js
   `

5. **Train the Biometric Admin (First Time Setup):**
   Upload exactly 2 clear images of your face to securely seed the database with your 128-D vector mapping.
   `ash
   node train-admin.js
   `

6. **Run the Development Server:**
   `ash
   npm run dev
   `
   Navigate to http://localhost:3000.

---

## ☁️ Deployment (Vercel)

This project is optimized for deployment on Vercel.

1. Push your code to your GitHub repository.
2. Go to your [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New... > Project**.
3. Import this GitHub repository.
4. Add all the environment variables from your .env.local file into the Vercel project settings.
5. In the Build & Development Settings, Vercel will automatically detect Next.js. Leave the build command as 
pm run build.
6. Click **Deploy**.

> **Note on Deployment Dependencies**: 
> The project uses canvas as a backend server component for face-api processing. It is explicitly marked in 
ext.config.mjs under serverComponentsExternalPackages to guarantee Vercel’s Node.js edge functions compile it flawlessly.

---

## 🛡️ Privacy & Security Note

This application processes highly sensitive biometric data. The ace-api.js calculations occur strictly on the server/edge, and raw 128-D vector arrays are securely hashed in the Supabase database. Vector comparisons never expose the underlying logic to the client.

## 📄 License

This project is licensed under the MIT License.
