# Second Ascent. 

> **Automated Gear Finder for Climbers**

Second Ascent is a web application that automates the search for used climbing gear. By continuously monitoring the MountainProject forums, it allows users to set up alerts for the gear they want and receive email notifications the moment a matching item is posted.

## Key Features

* **Targeted Alerts:** Users set up alerts for the specific gear they are searching for.
* **24/7 Automated Scanning:** A continuous backend pipeline scrapes the Mountain Project "For Sale" forum to ensure users never miss a drop.
* **AI-Powered Parsing:** Utilizes the Google Gemini API to translate unstructured, raw-text forum posts into clean, strictly typed JSON data.
* **Instant Notifications:** Sends you an email as soon as a new item matches your alert.
* **Browse Feed:** A dynamic, client-side filtered UI that allows users to browse a curated feed of recent gear without needing to set up any alerts.

## Tech Stack

### Frontend (React / Vite)
* **Framework:** React with TypeScript, built using Vite.
* **Styling:** Tailwind CSS & DaisyUI.
* **Hosting:** Vercel.

### Backend Pipeline (Python)
* **Scraping Engine:** `requests` & `BeautifulSoup4`.
* **Data Extraction:** Google Gemini API (LLM-based entity extraction).
* **Execution:** Scheduled via Cron jobs on a remote Linux server.

### Database & Auth (Supabase)
* **Database:** PostgreSQL utilizing an **Entity-Attribute-Value (EAV)** schema to allow for infinite scaling of gear categories without structural migrations.
* **Authentication:** Passwordless Magic Link authentication.
* **Security:** Row Level Security (RLS) ensures users can only access their own active alerts and notifications.

## Architecture & Project Structure

The project is decoupled into three distinct environments: the web application, the database, and the scraping pipeline:

```text
second-ascent/
├── frontend/                  # React SPA
│   ├── src/
│   │   ├── pages/             # Route components (Dashboard, Browse, etc.)
│   │   ├── services/          # Supabase client initialization
│   │   └── App.tsx            # Main router
│   └── vercel.json            # Deployment configuration for SPA routing
│
├── backend/                   # Database Utilities
│   └── app/
│       └── db_client.py       # Supabase connection and EAV insertion logic
│
└── scraper/                   # Python Scraper Pipeline
    ├── main.py                # Pipeline entry point
    ├── crawler.py             # New URL discovery
    ├── extractor.py           # Raw HTML text extraction
    ├── ai_parser.py           # LLM prompt and JSON structuring
    ├── matcher.py             # Alert comparison engine
    └── notifier.py            # SMTP email dispatch 
