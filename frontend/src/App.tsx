import { useState, useEffect } from 'react'
import './App.css'

interface ShortenedUrl {
  shortCode: string
  originalUrl: string
  clicks: number
  createdAt?: string
}

interface ShortenResponse {
  short_code: string
  short_url: string
  original_url: string
}

interface StatsResponse {
  short_code: string
  original_url: string
  clicks: number
  created_at: string
}

function App() {
  const [longUrl, setLongUrl] = useState('')
  const [shortenedUrls, setShortenedUrls] = useState<ShortenedUrl[]>([])
  const [lastShortened, setLastShortened] = useState<ShortenedUrl | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Load URLs from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('shortenedUrls')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setShortenedUrls(parsed)
      } catch (e) {
        console.error('Failed to parse stored URLs:', e)
      }
    }
  }, [])

  // Fetch stats for all URLs periodically
  useEffect(() => {
    const fetchStats = async () => {
      if (shortenedUrls.length === 0) return

      const updatedUrls = await Promise.all(
        shortenedUrls.map(async (url) => {
          try {
            const response = await fetch(`/api/stats/${url.shortCode}`)
            if (response.ok) {
              const data: StatsResponse = await response.json()
              return {
                ...url,
                clicks: data.clicks,
                createdAt: data.created_at
              }
            }
          } catch (e) {
            console.error(`Failed to fetch stats for ${url.shortCode}:`, e)
          }
          return url
        })
      )

      setShortenedUrls(updatedUrls)
      localStorage.setItem('shortenedUrls', JSON.stringify(updatedUrls))
    }

    fetchStats()
    const interval = setInterval(fetchStats, 5000) // Poll every 5 seconds

    return () => clearInterval(interval)
  }, [shortenedUrls.length])

  const handleShorten = async () => {
    if (!longUrl.trim()) {
      setError('Please enter a URL')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/shorten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: longUrl }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to shorten URL' }))
        throw new Error(errorData.error || errorData.detail || 'Failed to shorten URL')
      }

      const data: ShortenResponse = await response.json()

      const newUrl: ShortenedUrl = {
        shortCode: data.short_code,
        originalUrl: data.original_url,
        clicks: 0,
      }

      setLastShortened(newUrl)

      // Add to list if not already present
      const exists = shortenedUrls.some(u => u.shortCode === newUrl.shortCode)
      if (!exists) {
        const updated = [newUrl, ...shortenedUrls]
        setShortenedUrls(updated)
        localStorage.setItem('shortenedUrls', JSON.stringify(updated))
      }

      setLongUrl('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (shortCode: string) => {
    const shortUrl = `${window.location.origin}/${shortCode}`
    try {
      await navigator.clipboard.writeText(shortUrl)
      setCopiedCode(shortCode)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleShorten()
    }
  }

  return (
    <div className="app">
      <div className="container">
        <h1>URL Shortener</h1>

        <div className="shorten-section">
          <div className="input-group">
            <input
              type="url"
              value={longUrl}
              onChange={(e) => setLongUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter a long URL..."
              className="url-input"
              disabled={loading}
            />
            <button
              onClick={handleShorten}
              disabled={loading || !longUrl.trim()}
              className="shorten-button"
            >
              {loading ? 'Shortening...' : 'Shorten'}
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}

          {lastShortened && (
            <div className="result-section">
              <h3>Shortened URL:</h3>
              <div className="shortened-url-display">
                <a
                  href={`/${lastShortened.shortCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="short-link"
                >
                  {window.location.origin}/{lastShortened.shortCode}
                </a>
                <button
                  onClick={() => handleCopy(lastShortened.shortCode)}
                  className="copy-button"
                >
                  {copiedCode === lastShortened.shortCode ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>

        {shortenedUrls.length > 0 && (
          <div className="stats-section">
            <h2>All Shortened URLs</h2>
            <div className="table-container">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Short URL</th>
                    <th>Original URL</th>
                    <th>Clicks</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shortenedUrls.map((url) => (
                    <tr key={url.shortCode}>
                      <td>
                        <a
                          href={`/${url.shortCode}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="table-link"
                        >
                          /{url.shortCode}
                        </a>
                      </td>
                      <td className="original-url" title={url.originalUrl}>
                        {url.originalUrl}
                      </td>
                      <td className="clicks-cell">{url.clicks}</td>
                      <td>
                        <button
                          onClick={() => handleCopy(url.shortCode)}
                          className="copy-button-small"
                        >
                          {copiedCode === url.shortCode ? '✓' : 'Copy'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
