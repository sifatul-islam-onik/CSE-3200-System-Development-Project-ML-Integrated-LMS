# CSE-3200-System-Development-Project-ML-Integrated-LMS

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- Python 3.8+ (for ML server)
- **Redis** (for OCR job queue - see [REDIS_SETUP.md](REDIS_SETUP.md))

### Server Setup
```bash
cd server
npm install
npm run seed-po    # Seed Program Outcomes (run once)
npm run dev        # Start development server
```

### OCR Processing with Redis + Bull
The system uses Redis with Bull for reliable OCR job queuing. See **[REDIS_SETUP.md](REDIS_SETUP.md)** for complete setup instructions.

**Quick Redis Setup:**
```bash
# Windows (using Docker)
docker run -d -p 6379:6379 --name redis redis:latest

# macOS
brew install redis && brew services start redis

# Linux
sudo apt-get install redis-server && sudo systemctl start redis
```

### Reference Data
Program Outcomes (PO_A to PO_L) must be seeded before use:
```bash
npm run seed-po
```

See [PROGRAM_OUTCOME_REFERENCE.md](PROGRAM_OUTCOME_REFERENCE.md) for details.