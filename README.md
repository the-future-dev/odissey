# Odyssey - AI-Powered Storytelling Platform

Odyssey is an innovative AI-powered storytelling platform designed for children aged 7-12. It features personalized narrative experiences, world co-creation with AI, rolling personality assessment, and coherence-driven story generation.

## 🌟 Features

- **AI-Powered Story Generation**: Personalized narratives based on user personality
- **World Co-Creation**: Collaborative world building with AI assistance
- **Rolling Personality Assessment**: Continuous personality adaptation through interactions
- **Coherence Engine**: Real-time story consistency validation
- **System Prompt Architecture**: Centralized prompt management with personalization
- **Instant Gratification**: Embedded rewards and progressive reveals
- **Demo Mode**: Quick access to pre-built magical worlds

## 🏗️ Architecture

### Backend (Python/FastAPI)
- **FastAPI** async framework with comprehensive error handling
- **Multi-database strategy**: PostgreSQL + MongoDB + Redis
- **JWT authentication** with Google OAuth integration
- **Custom middleware pipeline** for AI features
- **Modular service architecture** with dependency injection

### Frontend (React Native)
- **React Native** with Redux Toolkit state management
- **Component-driven design** with reusable UI components
- **Offline/caching strategies** for seamless experience
- **Audio/animations** for immersive storytelling

## 📋 Prerequisites

- **Python 3.9+**
- **Node.js 16+** (for frontend)
- **PostgreSQL 13+**
- **MongoDB 5.0+**
- **Redis 6.0+**
- **Docker & Docker Compose** (recommended)

## 🚀 Installation

### Option 1: Docker Setup (Recommended)

1. **Clone the repository**
```bash
git clone <repository-url>
cd odissey
```

2. **Create environment file**
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration
```

3. **Start with Docker Compose**
```bash
docker-compose up -d
```

4. **Initialize the database**
```bash
docker-compose exec backend python -c "from app.core.database import create_tables; import asyncio; asyncio.run(create_tables())"
```

### Option 2: Local Development Setup

#### Backend Setup

1. **Navigate to backend directory**
```bash
cd backend
```

2. **Create virtual environment**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Set up databases**

**PostgreSQL:**
```bash
# Create database
createdb odyssey_db

# Create user (optional)
psql -c "CREATE USER odyssey_user WITH PASSWORD 'your_password';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE odyssey_db TO odyssey_user;"
```

**MongoDB:**
```bash
# Start MongoDB service
sudo systemctl start mongodb
# or
brew services start mongodb-community
```

**Redis:**
```bash
# Start Redis service
sudo systemctl start redis
# or
brew services start redis
```

5. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

6. **Initialize database**
```bash
python -c "from app.core.database import create_tables; import asyncio; asyncio.run(create_tables())"
```

7. **Start the backend server**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Setup

1. **Navigate to frontend directory**
```bash
cd frontend
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your backend URL
```

4. **Start the development server**
```bash
npm start
# or
yarn start
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the backend directory with the following variables:

```env
# Application
DEBUG=true
SECRET_KEY=your-secret-key-here
ENVIRONMENT=development

# Database URLs
DATABASE_URL=postgresql://user:password@localhost:5432/odyssey_db
MONGODB_URL=mongodb://localhost:27017
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET_KEY=your-jwt-secret-key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# OAuth (Google)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# AI Services (Optional)
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19006

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60

# Logging
LOG_LEVEL=INFO
```

### Database Configuration

The application uses three databases:

1. **PostgreSQL**: Relational data (users, sessions, analytics)
2. **MongoDB**: World artifacts and story templates
3. **Redis**: Caching and session state

## 🎮 Usage

### Main Commands

#### Backend Commands

```bash
# Start development server
uvicorn app.main:app --reload

# Run with specific host/port
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Database operations
python -c "from app.core.database import create_tables; import asyncio; asyncio.run(create_tables())"

# Run tests
pytest

# Run with coverage
pytest --cov=app

# Code formatting
black app/
isort app/

# Linting
flake8 app/
mypy app/
```

#### Frontend Commands

```bash
# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Code formatting
npm run lint
npm run format
```

#### Docker Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild services
docker-compose build

# Scale backend service
docker-compose up -d --scale backend=3
```

## 📚 API Documentation

### Base URL
- Development: `http://localhost:8000`
- API Version: `v1`
- Full API Base: `http://localhost:8000/api/v1`

### Authentication
The API uses JWT tokens for authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Main Endpoints

#### World Management
- `POST /api/v1/worlds` - Create a new world
- `GET /api/v1/worlds` - List user's worlds
- `GET /api/v1/worlds/public` - List public worlds
- `GET /api/v1/worlds/{world_id}` - Get world details
- `PUT /api/v1/worlds/{world_id}` - Update world
- `DELETE /api/v1/worlds/{world_id}` - Delete world

#### AI Co-Creation
- `POST /api/v1/worlds/{world_id}/co-create` - AI-assisted world creation
- `POST /api/v1/worlds/{world_id}/apply-suggestions` - Apply AI suggestions
- `POST /api/v1/worlds/{world_id}/refine/{element_type}/{element_id}` - Refine elements

#### Story Sessions
- `POST /api/v1/sessions` - Create story session
- `GET /api/v1/sessions` - List user sessions
- `GET /api/v1/sessions/{session_id}` - Get session details
- `POST /api/v1/sessions/{session_id}/messages` - Send message/get AI response
- `POST /api/v1/sessions/{session_id}/end` - End session

#### Quick Actions
- `POST /api/v1/sessions/{session_id}/quick-action` - Execute quick action
- `POST /api/v1/sessions/{session_id}/choices/{choice_id}` - Make specific choice
- `GET /api/v1/sessions/{session_id}/suggestions` - Get action suggestions

### Interactive API Documentation
- **Swagger UI**: `http://localhost:8000/docs` (development only)
- **ReDoc**: `http://localhost:8000/redoc` (development only)

## 🧪 Testing

### Backend Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_worlds.py

# Run specific test
pytest tests/test_worlds.py::test_create_world

# Run with verbose output
pytest -v

# Run tests in parallel
pytest -n auto
```

### Frontend Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm test -- --coverage

# Run E2E tests
npm run test:e2e

# Run specific test file
npm test -- --testPathPattern=World.test.js
```

## 🔧 Development

### Code Quality

The project uses several tools to maintain code quality:

#### Backend
- **Black**: Code formatting
- **isort**: Import sorting
- **flake8**: Linting
- **mypy**: Type checking
- **pytest**: Testing

#### Frontend
- **ESLint**: Linting
- **Prettier**: Code formatting
- **Jest**: Testing
- **Detox**: E2E testing

### Pre-commit Hooks

Install pre-commit hooks to ensure code quality:

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Run hooks manually
pre-commit run --all-files
```

## 🚢 Deployment

### Production Setup

1. **Build Docker images**
```bash
docker build -t odyssey-backend ./backend
docker build -t odyssey-frontend ./frontend
```

2. **Configure production environment**
```bash
# Set production environment variables
export ENVIRONMENT=production
export DEBUG=false
```

3. **Deploy with Docker Compose**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Health Checks

- Backend health: `GET /health`
- Database connectivity: Built into health check
- Redis connectivity: Built into health check

## 📊 Monitoring

### Logs

Logs are structured using Loguru with the following levels:
- **INFO**: General information
- **WARNING**: Warning conditions
- **ERROR**: Error conditions
- **DEBUG**: Debug information (development only)

### Metrics

Key metrics to monitor:
- API response times
- Database query performance
- AI service latency
- User engagement scores
- Personality assessment accuracy
- Story coherence scores

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Check the [documentation](docs/)
- Open an [issue](issues/)
- Contact the development team

## 🗂️ Project Structure

```
odissey/
├── backend/                 # Python/FastAPI backend
│   ├── app/
│   │   ├── ai/             # AI integration layer
│   │   ├── api/            # API endpoints
│   │   ├── core/           # Core configuration
│   │   ├── models/         # Data models
│   │   └── services/       # Business logic
│   ├── tests/              # Backend tests
│   └── requirements.txt    # Python dependencies
├── frontend/               # React Native frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── screens/        # Screen components
│   │   ├── services/       # API services
│   │   └── types/          # TypeScript types
│   └── package.json        # Node dependencies
├── docker-compose.yml      # Development setup
├── docker-compose.prod.yml # Production setup
└── README.md              # This file
```
