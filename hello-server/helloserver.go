package main

import (
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"
	"os"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var serviceVersion string
var overviewTemplate *template.Template
var startTime time.Time

// create a new counter vector
var getCallCounter = prometheus.NewCounterVec(
	prometheus.CounterOpts{
		Name: "http_request_get_total_count", // metric name
		Help: "Number of get requests.",
	},
	[]string{"status"}, // labels
)

type Overview struct {
	Version string
}

// HealthResponse represents the JSON response for healthcheck endpoints
type HealthResponse struct {
	Status  string `json:"status"`
	Version string `json:"version"`
	Uptime  string `json:"uptime"`
}

// create a handler struct
type HTTPHandler struct{}

// implement `ServeHTTP` method on `HttpHandler` struct
func (h HTTPHandler) ServeHTTP(res http.ResponseWriter, req *http.Request) {

	var status string
	defer func() {
		// increment the counter on defer func
		getCallCounter.WithLabelValues(status).Inc()
	}()

	overviewData := Overview{
		Version: serviceVersion,
	}
	overviewTemplate = template.Must(template.ParseFiles("./overview.html"))
	err := overviewTemplate.Execute(res, overviewData)
	if err != nil {
		status = "error"
	}
	status = "success"
}

// healthzHandler responds to health check requests with the service status
func healthzHandler(res http.ResponseWriter, req *http.Request) {
	health := HealthResponse{
		Status:  "ok",
		Version: serviceVersion,
		Uptime:  time.Since(startTime).String(),
	}

	res.Header().Set("Content-Type", "application/json")
	res.WriteHeader(http.StatusOK)
	json.NewEncoder(res).Encode(health)
}

// readyzHandler responds to readiness check requests
func readyzHandler(res http.ResponseWriter, req *http.Request) {
	health := HealthResponse{
		Status:  "ready",
		Version: serviceVersion,
		Uptime:  time.Since(startTime).String(),
	}

	res.Header().Set("Content-Type", "application/json")
	res.WriteHeader(http.StatusOK)
	json.NewEncoder(res).Encode(health)
}

func init() {
	prometheus.MustRegister(getCallCounter)
}

func main() {
	startTime = time.Now()

	if len(os.Args) < 2 {
		fmt.Println("Please provide a version as first parameter")
		os.Exit(1)
	}

	// expecting version as first parameter
	serviceVersion = os.Args[1]
	if serviceVersion == "" {
		fmt.Println("Please provide a version as first parameter")
		os.Exit(1)
	}

	// create a new handler
	handler := HTTPHandler{}

	// service static files
	fileServer := http.FileServer(http.Dir("./static"))

	http.Handle("/", handler)
	http.Handle("/static/", http.StripPrefix("/static/", fileServer))

	// healthcheck endpoints
	http.HandleFunc("/healthz", healthzHandler)
	http.HandleFunc("/readyz", readyzHandler)

	fmt.Println("Serving requests on port 9000")

	http.Handle("/metrics", promhttp.Handler())

	// listen and serve
	http.ListenAndServe(":9000", nil)
}
