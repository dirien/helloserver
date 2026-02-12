package main

import (
	"net/http"
	"os"
)

// healthcheck is a minimal binary used by Docker HEALTHCHECK.
// It exits 0 if the /healthz endpoint returns HTTP 200, otherwise exits 1.
func main() {
	resp, err := http.Get("http://localhost:9000/healthz")
	if err != nil || resp.StatusCode != http.StatusOK {
		os.Exit(1)
	}
	os.Exit(0)
}
