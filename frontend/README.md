# URL Shortener Frontend

A React + Vite + TypeScript single-page application for URL shortening.

## Features

- **URL Shortening**: Enter a long URL and get a shortened version
- **Copy to Clipboard**: One-click copy functionality for shortened URLs
- **Statistics Dashboard**: View all shortened URLs with click statistics
- **Real-time Updates**: Stats automatically refresh every 5 seconds
- **Persistent Storage**: URLs are saved in localStorage for quick access
- **Responsive Design**: Clean, minimal UI that works on all devices

## Prerequisites

- Node.js 16+ installed
- Backend API running on `http://localhost:8000`

## Installation

```bash
# Install dependencies
npm install
```

## Development

```bash
# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

## Build

```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

## API Configuration

The application uses Vite's proxy configuration to forward `/api` requests to the backend:

```typescript
// vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, '')
  }
}
```

## API Endpoints

- `POST /api/shorten` - Create a shortened URL
  - Request: `{ "url": "https://example.com/long-url" }`
  - Response: `{ "short_code": "abc123", "short_url": "...", "original_url": "..." }`

- `GET /api/stats/{short_code}` - Get statistics for a shortened URL
  - Response: `{ "short_code": "abc123", "original_url": "...", "clicks": 42, "created_at": "..." }`

## Technology Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **CSS3** - Styling with gradients and animations

## Project Structure

```
frontend/
├── src/
│   ├── App.tsx         # Main application component
│   ├── App.css         # Application styles
│   ├── index.css       # Global styles
│   └── main.tsx        # Application entry point
├── index.html          # HTML template
├── vite.config.ts      # Vite configuration with proxy
├── tsconfig.json       # TypeScript configuration
└── package.json        # Dependencies and scripts
```

## Usage

1. Start the backend API on port 8000
2. Run `npm run dev` to start the frontend
3. Open `http://localhost:5173` in your browser
4. Enter a URL and click "Shorten"
5. Copy the shortened URL and share it
6. View statistics in the table below
