# 🤖 Automated Job Application & Resume Tailoring Pipeline

> An end-to-end system that automates job discovery, resume matching, and tailored application generation — maximizing interview chances by aligning every application with role requirements.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Services](#services)
- [Tech Stack](#tech-stack)
- [AI Strategy](#ai-strategy)
- [Getting Started](#getting-started)
- [Roadmap](#roadmap)

---

## Overview

This pipeline automates the entire job application process using a decoupled microservices architecture and a multi-model AI workflow. Each service handles a distinct stage of the pipeline — from scraping job postings to generating a perfectly tailored resume and uploading it to the cloud.

---

## Architecture

The system uses **RabbitMQ** as an event-driven message broker connecting three independent microservices:

```
[ Scraper Service ]
        │
        ▼  (job postings)
   [ RabbitMQ ]
        │
        ▼
[ Matcher Service ]
        │
        ▼  (matched jobs)
   [ RabbitMQ ]
        │
        ▼
[ Tailor Service ]
        │
        ▼
[ Google Cloud Storage ]
```

---

## Services

### 1. 🔍 Scraper Service
- Uses **Playwright** to scrape job postings from target sources
- Sanitizes and normalizes raw job data
- Publishes structured job objects to the message broker

### 2. 🧠 Matcher Service
- Receives job postings and compares them against your base resume
- Uses AI to score and filter relevant matches
- Publishes high-match jobs to the next queue

### 3. ✍️ Tailor Service
- Generates a strategic briefing for each matched role
- Rewrites and tailors the resume using AI
- Compiles the final document as a **PDF via LaTeX**
- Uploads the output to **Google Cloud Storage**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| API Framework | Express |
| Database | MongoDB |
| Message Broker | RabbitMQ |
| Scraping | Playwright |
| Document Generation | LaTeX |
| Cloud Storage | Google Cloud Storage |
| Containerization | Docker |

---

## AI Strategy

Each service uses a model optimized for its specific task:

| Service | Model | Reason |
|---|---|---|
| Scraper | GPT-4o-mini | Fast, low-cost data extraction |
| Matcher | GPT-4o | Nuanced job-resume analysis |
| Tailor | DeepSeek-Reasoner | Human-like, strategic rewriting |

---

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js (v18+)
- A RabbitMQ instance (or use the included Docker config)
- MongoDB connection string
- Google Cloud Storage credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/job-pipeline.git
cd job-pipeline

# Copy and configure environment variables
cp .env.example .env

# Start all services
docker-compose up --build
```

### Environment Variables

```env
RABBITMQ_URL=amqp://localhost
MONGODB_URI=mongodb://localhost:27017/jobpipeline
OPENAI_API_KEY=your_openai_key
DEEPSEEK_API_KEY=your_deepseek_key
GCS_BUCKET_NAME=your_bucket_name
GCS_PROJECT_ID=your_project_id
```

---

## Key Achievements

- ✅ Scalable, fault-tolerant microservices architecture
- ✅ Advanced multi-model AI workflow across the pipeline
- ✅ Full DevOps containerization & orchestration with Docker

---

## Roadmap

- [ ] REST API for campaign control
- [ ] React dashboard for monitoring & review
- [ ] Dead-letter queue for resilience and error handling

---

## License

MIT License — see [LICENSE](./LICENSE) for details.
