# Pranjal's Memory Universe

A highly advanced, AI-native personal gallery and social network designed specifically for archiving, analyzing, and interactively exploring memories. Built with Next.js 14, Supabase, and Google Gemini 1.5 Pro.

## 🚀 Features

- **Automated AI Archiving (Gemini Multimodal):** Upload photos, audio, or video clips, and Gemini instantly processes the media in the background. It generates poetic titles, extracts EXIF data, tags elements, and filters out non-conventional media (e.g., screenshots/receipts) into an archive automatically.
- **Zero-Shot Facial & Voice Recognition:** The system natively recognizes Pranjal (Admin) and clusters distinct faces and voices into social profiles dynamically. No client-side heavy lifting—entirely serverless.
- **Visitor Restricted Mode:** A secure privacy toggle. When guests use the app, they can enter their name, and the backend SQL policies instantly filter the entire universe to *only* show memories where they are visually or audibly present.
- **Interactive Multi-player Puzzles:** Advanced cognitive games designed for ages 16+ including *Archive Geoguessr*, *Memory Sequence*, *Context Connections*, and *Odd One Out*.
- **Creative Studio (Frame Inspector):** A boundless canvas to lay out photos beautifully, with touch-draggable physics and intelligent bottom-sheet property inspectors.
- **The Lab (Node Graph):** Visualize how your memories interlink via tags, dates, and people in a stunning SVG node network.
- **Meet Tab with PiP:** Engage in video calls with native Picture-in-Picture mode and screen sharing, while solving co-op puzzles.

## 🛠 Tech Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
- **Styling:** Tailwind CSS + custom CSS animations
- **Database & Auth:** [Supabase](https://supabase.com/) (PostgreSQL + pgvector for faces)
- **AI Engine:** Google GenAI (Gemini 2.5 Flash for Images, Gemini 1.5 Pro for Video/Audio)
- **Storage:** Cloudinary (Primary Media CDN) + Supabase Storage (Private Backup)
- **Mapping:** Maplibre GL JS (for Places tab)

## 📦 Getting Started

### 1. Environment Variables
Create a \`.env.local\` file in the root directory and add the following:
\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
GEMINI_API_KEY=your_gemini_api_key
CLOUDINARY_URL=your_cloudinary_url
\`\`\`

### 2. Installation
Install the required dependencies:
\`\`\`bash
npm install
\`\`\`

### 3. Run Development Server
Start the Next.js development server:
\`\`\`bash
npm run dev
\`\`\`
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Production Build
To create an optimized production build for Vercel/Netlify:
\`\`\`bash
npm run build
npm start
\`\`\`

## 🔒 Security & Privacy

This project strictly protects privacy. The \`photo_faces\` and \`people\` tables serve as access-control layers during Visitor Mode. Ensure \`.env.local\` is never committed to GitHub.

## 📝 License

Private and proprietary. Built for Pranjal.
