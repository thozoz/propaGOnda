package main

import (
	"bytes"
	"html/template"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestEndpoints(t *testing.T) {
	if err := store.load(); err != nil {
		t.Fatalf("load failed: %v", err)
	}

	// 1. Test Home
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(rw http.ResponseWriter, r *http.Request) {
		all := store.getAll()
		data := PageData{Hero: all[0], Truths: all[1:]}
		tmpl, _ := template.ParseFS(embeddedFiles, "templates/index.html")
		tmpl.Execute(rw, data)
	})
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "propa<span class=\"go-highlight\">GO</span>nda") {
		t.Errorf("missing logo in body")
	}

	// 2. Test Webhook Unauthorized
	hookReq := httptest.NewRequest(http.MethodPost, "/api/webhook/truth", strings.NewReader(`{"quote":"test"}`))
	hookW := httptest.NewRecorder()

	hookHandler := func(rw http.ResponseWriter, r *http.Request) {
		apiKey := r.Header.Get("X-API-Key")
		if apiKey != "propagonda-secret-2026" {
			http.Error(rw, "unauthorized", http.StatusUnauthorized)
			return
		}
		rw.WriteHeader(http.StatusCreated)
	}

	hookHandler(hookW, hookReq)
	if hookW.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 unauthorized, got %d", hookW.Code)
	}

	// 3. Test Webhook Authorized
	authReq := httptest.NewRequest(http.MethodPost, "/api/webhook/truth", bytes.NewBufferString(`{"title":"New Truth","quote":"Go is eternal.","target":"python"}`))
	authReq.Header.Set("X-API-Key", "propagonda-secret-2026")
	authW := httptest.NewRecorder()

	hookHandler(authW, authReq)
	if authW.Code != http.StatusCreated {
		t.Errorf("expected 201 created, got %d", authW.Code)
	}
}
