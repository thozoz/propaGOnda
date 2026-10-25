// propaGOnda client interactions & dynamic data fetching

let tickerBase = 84920412;
const startTime = Date.now();
let allTruths = [];
let currentFilter = "";

// 1. "if err != nil" ticker
function updateTicker() {
  const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
  const currentCount = tickerBase + (elapsedSeconds * 47219);
  const el = document.getElementById("err-ticker");
  if (el) {
    el.innerText = currentCount.toLocaleString();
  }
}
setInterval(updateTicker, 100);

// 2. Toast notifier
function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.innerText = msg;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 2500);
}

// 3. Copy truth text
function copyTruthText(btn) {
  const card = btn.closest(".hero-card") || btn.closest(".archive-card");
  const quote = card.querySelector(".hero-quote, .archive-card-quote").innerText.trim();
  const text = `${quote}\n\nBroadcast by propa[GO]nda: Spreading the compiled truth since 2009. #golang #propaGOnda`;
  navigator.clipboard.writeText(text).then(() => {
    showToast("✓ Truth copied to clipboard!");
  }).catch(() => {
    showToast("Error copying to clipboard");
  });
}

// 4. Render truth data
function renderTruths() {
  if (!allTruths || allTruths.length === 0) return;

  const filtered = currentFilter
    ? allTruths.filter(t => t.target.toLowerCase() === currentFilter.toLowerCase())
    : allTruths;

  const displayList = filtered.length > 0 ? filtered : allTruths;
  const hero = displayList[0];
  const archives = displayList.slice(1);

  // Update Hero
  document.getElementById("hero-target-badge").innerText = `🔥 ${hero.target_name || hero.target}`;
  document.getElementById("hero-date").innerText = `DATE: ${hero.date}`;
  document.getElementById("hero-decree-num").innerText = `DECREE #${hero.decree_number}`;
  document.getElementById("hero-title").innerText = hero.title;
  document.getElementById("hero-quote").innerText = `“${hero.quote}”`;

  const twitterRaw = `${hero.quote}\n\n- Decree #${hero.decree_number} via propa[GO]nda #golang #propaGOnda`;
  document.getElementById("hero-twitter-btn").href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterRaw)}`;

  // Update Target Badge Widget
  document.getElementById("widget-target-name").innerText = hero.target_name || hero.target;

  // Update Archive count & list
  document.getElementById("archive-count").innerText = `(${archives.length})`;
  const container = document.getElementById("archive-cards-list");
  container.innerHTML = "";

  archives.forEach(t => {
    const card = document.createElement("article");
    card.className = "archive-card";
    const shareText = encodeURIComponent(`${t.quote}\n\n- Decree #${t.decree_number} via propa[GO]nda #golang #propaGOnda`);
    card.innerHTML = `
      <div class="archive-card-meta">
        <span>DECREE #${t.decree_number} &bull; TARGET: <b>${t.target_name || t.target}</b></span>
        <span>${t.date}</span>
      </div>
      <div class="archive-card-quote">“${t.quote}”</div>
      <div>
        <button class="btn btn-sm" onclick="copyTruthText(this)">Copy</button>
        <a class="btn btn-sm btn-primary" href="https://twitter.com/intent/tweet?text=${shareText}" target="_blank" rel="noopener noreferrer">Share</a>
      </div>
    `;
    container.appendChild(card);
  });
}

// 5. Filter switching
function setFilter(target, el) {
  currentFilter = target;
  document.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
  if (el) el.classList.add("active");
  renderTruths();
  return false;
}

// 6. Fetch from API or fallback to static json
async function loadTruths() {
  try {
    const res = await fetch("/api/truths");
    if (res.ok) {
      allTruths = await res.json();
    } else {
      throw new Error("API not ready");
    }
  } catch (e) {
    const fallbackRes = await fetch("/data/truths.json");
    allTruths = await fallbackRes.json();
  }
  renderTruths();
}

// 7. Repent modal snippets
const REPENT_SNIPPETS = [
  {
    title: "Instant Cleansing (Install Go)",
    cmd: "curl -sSL https://go.dev/dl/ | grep -o 'go[0-9.]*.linux-amd64.tar.gz' | head -1"
  },
  {
    title: "10-Second High-Performance HTTP Server",
    cmd: `package main

import (
\t"fmt"
\t"net/http"
)

func main() {
\thttp.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
\t\tfmt.Fprintf(w, "Salvation achieved. No Docker needed.")
\t})
\thttp.ListenAndServe(":8080", nil)
}`
  },
  {
    title: "Concurrency Without Fear",
    cmd: `package main

import "fmt"

func preach(msg string, ch chan string) {
\tch <- msg + " [Sent via goroutine]"
}

func main() {
\tch := make(chan string)
\tgo preach("Go is the way", ch)
\tfmt.Println(<-ch)
}`
  }
];

let repentIndex = 0;
function openRepentModal() {
  const modal = document.getElementById("repent-modal");
  const title = document.getElementById("repent-title");
  const code = document.getElementById("repent-code");
  const snip = REPENT_SNIPPETS[repentIndex % REPENT_SNIPPETS.length];
  repentIndex++;
  title.innerText = snip.title;
  code.innerText = snip.cmd;
  modal.classList.add("active");
}

function closeRepentModal() {
  document.getElementById("repent-modal").classList.remove("active");
}

window.addEventListener("DOMContentLoaded", loadTruths);
