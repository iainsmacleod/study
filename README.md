# Math Study Guide

A web-based math study application with interactive problem solving and progress tracking.

## Features

- 40 math problems covering various topics
- Answer validation with attempt tracking
- Progress bar and score tracking
- Responsive design

## Running with Docker

### Using Docker Compose (Recommended)

```bash
docker-compose up -d
```

The application will be available at `http://localhost:8080`

### Using Docker directly

```bash
# Build the image
docker build -t math-study-guide .

# Run the container
docker run -d -p 8080:8080 --name math-study-guide math-study-guide
```

### Stop the container

```bash
# With docker-compose
docker-compose down

# With docker directly
docker stop math-study-guide
docker rm math-study-guide
```

## Security Features

- Runs as non-root user
- Security headers configured
- Read-only filesystem (with tmpfs for nginx)
- No new privileges
- Content Security Policy enabled

## Development

For local development without Docker, simply open `index.html` in a web browser. Note that some features may require a local web server due to CORS restrictions.

## License

This project is for educational purposes.

