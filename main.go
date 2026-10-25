package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

//go:embed static/* templates/* data/truths.json
var embeddedFiles embed.FS

type Truth struct {
	ID           string `json:"id"`
	Slug         string `json:"slug"`
	Title        string `json:"title"`
	Quote        string `json:"quote"`
	Target       string `json:"target"`
	TargetName   string `json:"target_name"`
	Date         string `json:"date"`
	DecreeNumber int    `json:"decree_number"`
}

func (t Truth) TwitterText() string {
	raw := fmt.Sprintf("%s\n\n- Decree #%d via propa[GO]nda #golang #propaGOnda", t.Quote, t.DecreeNumber)
	return url.QueryEscape(raw)
}

type PageData struct {
	Hero         Truth
	Truths       []Truth
	ActiveFilter string
	TotalDecrees int
}

type Store struct {
	mu     sync.RWMutex
	truths []Truth
}

var store = &Store{}

func (s *Store) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Try reading from disk first (in case updated by webhook)
	var raw []byte
	diskBytes, err := os.ReadFile("data/truths.json")
	if err == nil {
		raw = diskBytes
	} else {
		// Fallback to embedded
		embeddedBytes, embErr := embeddedFiles.ReadFile("data/truths.json")
		if embErr != nil {
			return embErr
		}
		raw = embeddedBytes
	}

	return json.Unmarshal(raw, &s.truths)
}

func (s *Store) save() error {
	bytes, err := json.MarshalIndent(s.truths, "", "  ")
	if err != nil {
		return err
	}
	_ = os.MkdirAll("data", 0755)
	return os.WriteFile("data/truths.json", bytes, 0644)
}

func (s *Store) getAll() []Truth {
	s.mu.RLock()
	defer s.mu.RUnlock()
	copied := make([]Truth, len(s.truths))
	copy(copied, s.truths)
	return copied
}

func (s *Store) getFiltered(target string) []Truth {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if target == "" {
		copied := make([]Truth, len(s.truths))
		copy(copied, s.truths)
		return copied
	}
	var res []Truth
	for _, t := range s.truths {
		if strings.EqualFold(t.Target, target) {
			res = append(res, t)
		}
	}
	return res
}

func (s *Store) add(t Truth) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if t.ID == "" {
		t.ID = fmt.Sprintf("%d", time.Now().Unix())
	}
	if t.Date == "" {
		t.Date = time.Now().Format("2006-01-02")
	}
	if t.DecreeNumber == 0 {
		t.DecreeNumber = len(s.truths) + 101
	}
	if t.TargetName == "" {
		t.TargetName = strings.ToUpper(t.Target[:1]) + t.Target[1:]
	}

	// Prepend so it becomes the latest/Hero
	s.truths = append([]Truth{t}, s.truths...)
	return s.save()
}

func main() {
	if err := store.load(); err != nil {
		log.Fatalf("failed loading truths: %v", err)
	}

	tmpl, err := template.ParseFS(embeddedFiles, "templates/index.html")
	if err != nil {
		log.Fatalf("failed parsing templates: %v", err)
	}

	mux := http.NewServeMux()

	// 1. Static file server
	mux.HandleFunc("/static/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		data, err := embeddedFiles.ReadFile(path)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		if strings.HasSuffix(path, ".css") {
			w.Header().Set("Content-Type", "text/css; charset=utf-8")
		} else if strings.HasSuffix(path, ".js") {
			w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		}
		w.Write(data)
	})

	// 2. Home page
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}

		all := store.getAll()
		if len(all) == 0 {
			http.Error(w, "No truths available yet", http.StatusNotFound)
			return
		}

		data := PageData{
			Hero:         all[0],
			Truths:       all[1:],
			ActiveFilter: "",
			TotalDecrees: len(all),
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if err := tmpl.Execute(w, data); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	})

	// 3. Victims filter: /victims/{lang}
	mux.HandleFunc("/victims/", func(w http.ResponseWriter, r *http.Request) {
		target := strings.TrimPrefix(r.URL.Path, "/victims/")
		target = strings.TrimSpace(target)

		filtered := store.getFiltered(target)
		if len(filtered) == 0 {
			// If none found for specific filter, fallback to all with warning
			all := store.getAll()
			filtered = all
		}

		data := PageData{
			Hero:         filtered[0],
			Truths:       filtered[1:],
			ActiveFilter: target,
			TotalDecrees: len(filtered),
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if err := tmpl.Execute(w, data); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	})

	// 4. API: GET /api/truths (returns all truths)
	mux.HandleFunc("/api/truths", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(store.getAll())
	})

	// 5. Webhook: POST /api/webhook/truth (for n8n cron job)
	mux.HandleFunc("/api/webhook/truth", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Security: verify API key from header
		expectedKey := os.Getenv("PROPAGONDA_API_KEY")
		if expectedKey == "" {
			expectedKey = "dev-secret-change-me"
		}

		apiKey := r.Header.Get("X-API-Key")
		if apiKey == "" {
			authHeader := r.Header.Get("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				apiKey = strings.TrimPrefix(authHeader, "Bearer ")
			}
		}

		if apiKey != expectedKey {
			http.Error(w, `{"error":"unauthorized - invalid api key"}`, http.StatusUnauthorized)
			return
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, `{"error":"cannot read body"}`, http.StatusBadRequest)
			return
		}
		defer r.Body.Close()

		var newTruth Truth
		if err := json.Unmarshal(body, &newTruth); err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"invalid json: %s"}`, err.Error()), http.StatusBadRequest)
			return
		}

		if strings.TrimSpace(newTruth.Quote) == "" {
			http.Error(w, `{"error":"quote field is required"}`, http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(newTruth.Title) == "" {
			newTruth.Title = "Ministry Flash Dispatch"
		}
		if strings.TrimSpace(newTruth.Target) == "" {
			newTruth.Target = "all"
		}

		if err := store.add(newTruth); err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"failed to persist: %s"}`, err.Error()), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "success",
			"message": "Decree promulgated successfully",
			"decree":  newTruth.Title,
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("propa[GO]nda server running at http://localhost:%s\n", port)
	fmt.Printf("Webhook endpoint ready for n8n: POST http://localhost:%s/api/webhook/truth\n", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
