import { useState, useEffect, useCallback } from 'react'

interface LinkStat {
  short_code: string
  original_url: string
  clicks: number
  created_at: string
}

function App() {
  const [url, setUrl] = useState('')
  const [shortUrl, setShortUrl] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [stats, setStats] = useState<LinkStat[]>([])
  const [loading, setLoading] = useState(false)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats')
      if (!res.ok) return
      const data: LinkStat[] = await res.json()
      setStats(data)
    } catch {
      // silently ignore stats fetch errors
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const handleShorten = async () => {
    setError('')
    setShortUrl('')
    setCopied(false)
    if (!url.trim()) {
      setError('Please enter a URL.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      if (!res.ok) {
        const text = await res.text()
        setError(`Error: ${res.status} ${text}`)
        return
      }
      const data = await res.json()
      const code: string = data.short_code ?? data.code ?? data.short ?? ''
      const base = window.location.origin
      setShortUrl(`${base}/r/${code}`)
      await fetchStats()
    } catch (e) {
      setError(`Request failed: ${String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shortUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Failed to copy to clipboard.')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleShorten()
  }

  return (
    <div className="container">
      <h1>URL Shortener</h1>

      <div className="shorten-form">
        <input
          type="url"
          placeholder="https://example.com/long/url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          className="url-input"
          disabled={loading}
        />
        <button onClick={handleShorten} disabled={loading} className="btn-primary">
          {loading ? 'Shortening…' : 'Shorten'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {shortUrl && (
        <div className="result">
          <a href={shortUrl} target="_blank" rel="noopener noreferrer" className="short-url">
            {shortUrl}
          </a>
          <button onClick={handleCopy} className="btn-copy">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      <section className="stats-section">
        <h2>All Links</h2>
        {stats.length === 0 ? (
          <p className="empty">No links yet.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Short Code</th>
                  <th>Original URL</th>
                  <th>Clicks</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => (
                  <tr key={row.short_code}>
                    <td>
                      <a href={`/r/${row.short_code}`} target="_blank" rel="noopener noreferrer">
                        {row.short_code}
                      </a>
                    </td>
                    <td className="url-cell">
                      <a href={row.original_url} target="_blank" rel="noopener noreferrer">
                        {row.original_url}
                      </a>
                    </td>
                    <td className="num">{row.clicks}</td>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default App
