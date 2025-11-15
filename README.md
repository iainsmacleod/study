# Math Study Guide

A full-stack web-based math study application with database storage, user authentication, and interactive problem solving.

## Features

- 40+ math problems organized by category
- Category-based question selection with multi-select support
- Random question selection across all categories
- Question count selection (5, 10, 20, 30, or All)
- Answer validation with attempt tracking (3 attempts per question)
- Progress bar and score tracking
- User authentication (Google, Apple, OpenID Connect)
- User progress persistence across sessions
- Responsive design

## Architecture

- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Backend**: Node.js with Express
- **Database**: SQLite
- **Authentication**: Passport.js with Google, Apple, and OpenID strategies
- **Web Server**: Nginx (reverse proxy for API)

## Running with Docker

### Prerequisites

- Docker and Docker Compose installed
- OAuth credentials (optional, for authentication features)

### Using Docker Compose (Recommended)

1. Create a `.env` file (optional, for OAuth credentials):
```bash
SESSION_SECRET=your-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
# ... other OAuth credentials
```

2. Start the application:
```bash
docker-compose up -d
```

The application will be available at `http://localhost:8080`

### Using Pre-built Image

The application uses the pre-built image `iainsmacleod/mathtest:latest`. To build your own:

```bash
docker build -t math-study-guide .
```

### Stop the container

```bash
docker-compose down
```

## Local Development

### Prerequisites

- Node.js 18+ installed
- npm installed

### Setup

1. Install dependencies:
```bash
npm install
```

2. Initialize the database:
```bash
npm run init-db
```

3. Create a `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Update `.env` with your configuration

5. Start the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

For the frontend, you'll need to serve it through a web server or use the Docker setup.

## API Endpoints

- `GET /api/categories` - List all question categories
- `GET /api/questions` - Get questions (with query params: `categories`, `count`, `random`)
- `GET /api/auth/user` - Get current user
- `GET /api/auth/google` - Google OAuth login
- `GET /api/auth/apple` - Apple OAuth login
- `GET /api/auth/openid` - OpenID Connect login
- `POST /api/auth/logout` - Logout
- `GET /api/progress` - Get user progress (requires auth)
- `POST /api/progress` - Save user progress (requires auth)

## Database Schema

- **categories**: Question categories
- **questions**: Math problems with answers
- **users**: User accounts (OAuth)
- **user_progress**: User progress tracking

## Security Features

- Runs as non-root user
- Security headers configured
- Read-only filesystem (with tmpfs for runtime files)
- No new privileges
- Content Security Policy enabled
- SQL injection protection (parameterized queries)
- Session-based authentication

## Environment Variables

See `.env.example` for all available environment variables.

## License

This project is for educational purposes.

