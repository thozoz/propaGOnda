# propa[GO]nda - The Ministry of Go Supremacy

Satirical, viral web application dedicated to daily Golang supremacy propaganda.
Supports both **100% Serverless Cloudflare Pages** and **Pure Go Stdlib Server**.

---

## 1. Cloudflare Pages (100% Serverless)

### Structure
- `public/`: Static frontend assets (`index.html`, `style.css`, `app.js`, `data/truths.json`)
- `functions/api/truths.js`: Edge endpoint serving truths from KV (with fallback)
- `functions/api/webhook/truth.js`: Authenticated webhook for n8n

### Local Dev with Cloudflare Pages
```bash
npx wrangler pages dev public --kv PROPAGONDA_KV
```

### Deploy to Cloudflare Pages
1. **CLI Deploy**:
   ```bash
   npx wrangler pages deploy public
   ```
2. **Or GitHub Integration**:
   - Push to GitHub.
   - In Cloudflare Dashboard ➔ Workers & Pages ➔ Create application ➔ Pages.
   - Build output directory: `public`
   - Bind KV namespace: `PROPAGONDA_KV` (Workers & Pages ➔ Settings ➔ Functions ➔ KV namespace bindings).
   - Environment Variable: `PROPAGONDA_API_KEY` = `<your-secret-key>`

---

## 2. n8n Daily AI Webhook Setup

### Workflow Steps in n8n:
1. **Schedule Trigger**: Daily at 08:00 AM.
2. **AI Agent / Web Search Node**:
   - Prompt: Search trending developer drama on X/Reddit/HackerNews (Python dependency hell, Rust lifetime borrow errors, JavaScript/npm bloat, etc.).
   - Output JSON format:
     ```json
     {
       "title": "Decree #121: The Async/Await Pyramid",
       "quote": "JavaScript devs spent the morning chaining 12 Promises. Gophers typed 'go worker()' and went to get coffee.",
       "target": "javascript",
       "target_name": "JavaScript"
     }
     ```
3. **HTTP Request Node**:
   - **Method**: `POST`
   - **URL**: `https://<your-pages-app>.pages.dev/api/webhook/truth`
   - **Headers**:
     - `Content-Type`: `application/json`
     - `X-API-Key`: `<your-secret-key>` (default: `<your-secret-key>`)
   - **Body**: Output from AI node.

---

## 3. Alternative: Pure Go Server Mode
Run standalone binary without Cloudflare:
```bash
go run .
# Server runs at http://localhost:8080
```
