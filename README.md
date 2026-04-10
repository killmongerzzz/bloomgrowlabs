# BloomGrow Labs 🌸📈 

An AI-powered, autonomous marketing and advertising engine. BloomGrow Labs acts as an AI growth team in a box, fusing multimodal generative AI—for ad creatives and copywriting—with autonomous agents that launch, manage, optimize, and analyze digital ad campaigns.

## 🖥️ Frontend (UI)
The frontend is a modern, highly responsive dashboard built with **React 19**, **TypeScript**, **TailwindCSS 4**, and **Vite**. It provides marketers with granular control over AI agents and a visual interface to manage ad assets.

**Core Pages & Modules:**
- **Dashboard (`Dashboard.tsx`):** High-level overview of ad spend, ROAS, active agents, and top-performing creatives. 
- **Creative Studio (`CreativeStudio.tsx`):** Workspace for AI-driven image and video generation. Integrates with models via Fal Client to produce ad-ready visuals.
- **Copy Generator (`CopyGenerator.tsx`):** AI-powered copywriter that generates variations of primary text, headlines, and descriptions tailored to different psychographics.
- **Campaign Manager (`CampaignManager.tsx`):** Interface to organize ad sets, review generated assets, and deploy campaigns seamlessly to ad networks (Meta/Google).
- **Research (`Research.tsx`):** Visualizer for market sentiment and competitor ad scraping. 
- **Analytics (`Analytics.tsx`):** Deep dive into performance marketing metrics (CTR, CPA, Conversion Rates) with charts powered by `recharts`.
- **Automation Rules (`AutomationRules.tsx`):** Rule builder to configure self-driving thresholds (e.g., kill ad if CPA > $X, scale budget if ROAS > Y).

## ⚙️ Backend (Server)
The backend is a robust RESTful API built with **Python** and **FastAPI**, backed by a PostgreSQL database via **Supabase**. The core intelligence lies in a swarm of specialized, task-specific AI agents.

**The Agentic Architecture:**
- **Research & Strategy:** `research_agent.py` and `competitor_scraper_agent.py` continuously analyze the market to find winning angles.
- **Asset Generation:** `messaging_agent.py` crafts compelling copy, while the `creative_agent.py` creates visuals and syncs them to AWS S3 (`sync_assets.py`).
- **Campaign Execution:** `meta_ads_agent.py` and `ad_launcher_agent.py` programmatically structure campaigns, ad sets, and ads using the Facebook Business / Google Ads SDKs.
- **Lifecycle Optimization:** `ad_lifecycle_agent.py` and `optimization_agent.py` form the "Marketing Brain". They monitor active campaigns, pause losers, and scale winners. 
- **Analytics & Auditing:** `analytics_agent.py` ingests metrics. Under the hood, `bedrock_client.py` uses AWS Bedrock (Claude 3 Haiku) to instantly provide actionable, plain-English explanations for optimization audits.

## 🚀 Getting Started

### 1. Backend Setup
```bash
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
Make sure you have a `.env` file at the root or within the `server` directory containing your necessary keys (Supabase, AWS, Gemini/Bedrock, Meta/Google SDKs, Fal API, Pexels/Unsplash).
```bash
# Start the FastAPI server
uvicorn main:app --reload
```

### 2. Frontend Setup
```bash
# From the project root
npm install

# Start the Vite development server
npm run dev
```

## 🛠️ Built With
- **UI:** React, Vite, TailwindCSS, Recharts, Lucide Icons
- **API & DB:** FastAPI, Supabase (PostgreSQL), AWS DynamoDB
- **AI / LLMs:** Google Generative AI (Gemini), AWS Bedrock (Claude), Fal Client
- **Ad Networks:** Facebook Business SDK, Google Ads API
