// propaGOnda client interactions

// 1. "if err != nil" ticker
let tickerBase = 84920412;
const startTime = Date.now();

function updateTicker() {
  const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
  // simulate ~47,200 if err != nil checks written per second globally
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

// 4. Repent and Convert snippets
const REPENT_SNIPPETS = [
  {
    title: "Instant Cleansing (Install Go)",
    cmd: "curl -sSL https://golang.org/dl/ | grep -o 'go[0-9.]*.linux-amd64.tar.gz' | head -1"
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
  const modal = document.getElementById("repent-modal");
  modal.classList.remove("active");
}
