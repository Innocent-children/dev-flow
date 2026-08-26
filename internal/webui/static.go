package webui

import (
	"fmt"
	"html"
	"io/fs"
	"net/http"
	"strings"
)

func newStaticHandler(sessionValue string) (http.Handler, error) {
	generated, err := fs.Sub(Assets, "assets/generated")
	if err != nil {
		return nil, fmt.Errorf("open embedded WebUI assets: %w", err)
	}
	index, err := fs.ReadFile(generated, "index.html")
	if err != nil {
		return nil, fmt.Errorf("read embedded WebUI index: %w", err)
	}
	marker := []byte("</head>")
	meta := []byte(`<meta name="dev-flow-session" content="` + html.EscapeString(sessionValue) + `" />`)
	if !strings.Contains(string(index), string(marker)) {
		return nil, fmt.Errorf("embedded WebUI index has no head boundary")
	}
	index = []byte(strings.Replace(string(index), string(marker), string(meta)+"\n  "+string(marker), 1))
	files := http.FileServer(http.FS(generated))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Security-Policy", "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		if r.URL.Path == "/" || (!strings.HasPrefix(r.URL.Path, "/assets/") && !strings.HasPrefix(r.URL.Path, "/api/")) {
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write(index)
			return
		}
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		files.ServeHTTP(w, r)
	}), nil
}
