const header = document.getElementById("site-header");
const menuToggle = document.getElementById("menu-toggle");
const mobileMenu = document.getElementById("mobile-menu");
const iconMenu = menuToggle.querySelector(".icon-menu");
const iconClose = menuToggle.querySelector(".icon-close");

window.addEventListener("scroll", () => {
  header.classList.toggle("scrolled", window.scrollY > 20);
}, { passive: true });

menuToggle.addEventListener("click", () => {
  const isOpen = mobileMenu.classList.toggle("open");
  iconMenu.style.display = isOpen ? "none" : "block";
  iconClose.style.display = isOpen ? "block" : "none";
});

mobileMenu.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    mobileMenu.classList.remove("open");
    iconMenu.style.display = "block";
    iconClose.style.display = "none";
  });
});

// Smooth scroll without hash in URL
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    const id = link.getAttribute("href").slice(1);
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
      history.replaceState(null, "", window.location.pathname);
    }
  });
});

// Strip hash from URL on load
if (window.location.hash) {
  const target = document.getElementById(window.location.hash.slice(1));
  history.replaceState(null, "", window.location.pathname);
  if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth" }), 100);
}

// Fade-up reveal for cards as they enter the viewport.
const revealTargets = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window && revealTargets.length) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add("revealed"), i * 60);
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -60px 0px" });

  revealTargets.forEach(el => revealObserver.observe(el));
} else {
  revealTargets.forEach(el => el.classList.add("revealed"));
}

// Highlight the current section's nav link while scrolling.
const navLinks = document.querySelectorAll(".nav-links a");
const sections = Array.from(navLinks)
  .map(link => document.getElementById(link.getAttribute("href").replace("#", "")))
  .filter(Boolean);

if ("IntersectionObserver" in window && sections.length) {
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const hash = "#" + entry.target.id;
      navLinks.forEach(l => {
        l.classList.toggle("active", l.getAttribute("href") === hash);
      });
    });
  }, { rootMargin: "-45% 0px -50% 0px" });

  sections.forEach(section => navObserver.observe(section));
}

// Dynamic footer year
document.getElementById("footer-year").textContent = new Date().getFullYear();

// Obfuscated backend endpoint (XOR-decoded at runtime)
(function () {
  var _k = [17, 23, 5, 11, 2, 31, 7, 13];
  var _c = [121,99,113,123,113,37,40,34,98,118,111,110,102,106,117,61,60,112,108,127,106,106,101,32,120,120,40,105,99,124,108,104,127,115,43,125,103,109,100,104,125,57,100,123,114];
  var _s = "";
  for (var _i = 0; _i < _c.length; _i++) _s += String.fromCharCode(_c[_i] ^ _k[_i % _k.length]);
  window.__API_BASE__ = _s;
})();
var API_BASE = window.__API_BASE__;

// Dynamic repo count in hero-stats (fallback if SSE not connected yet)
(function() {
  var el = document.getElementById("repo-count");
  if (!el) return;

  function refreshCount() {
    fetch(API_BASE + "/api/repos/count")
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.count !== undefined && el.textContent != data.count) {
          el.textContent = data.count;
          el.classList.remove("flash-update");
          void el.offsetWidth;
          el.classList.add("flash-update");
        }
      })
      .catch(function() {});
  }

  refreshCount();
  setInterval(refreshCount, 30000);

  document.addEventListener("visibilitychange", function() {
    if (!document.hidden) refreshCount();
  });
})();

// Dynamic GitHub Projects
(function() {
  var grid = document.getElementById("projects-grid");
  if (!grid) return;

  function renderRepos(repos) {
    grid.innerHTML = "";
    var shown = repos.slice(0, 9);

    shown.forEach(function(repo) {
      var card = document.createElement("a");
      card.href = repo.html_url;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
      card.className = "card project-card reveal";

      var meta = "";
      if (repo.stars > 0 || repo.forks > 0) {
        meta = '<div class="project-meta">';
        if (repo.stars > 0) meta += '<span class="stars">&#9733; ' + repo.stars + '</span>';
        if (repo.forks > 0) meta += '<span class="forks">' + repo.forks + ' forks</span>';
        meta += '</div>';
      }

      card.innerHTML = meta +
        '<h3 class="project-name">' + repo.name + '</h3>' +
        '<p class="text-muted text-sm">' + repo.description + '</p>' +
        '<span class="tag">' + repo.language + '</span>';

      grid.appendChild(card);
    });

    if (repos.length > 9) {
      var allCard = document.createElement("a");
      allCard.href = "projects.html";
      allCard.className = "card project-card project-card-last reveal";
      allCard.innerHTML = '<h3 class="project-name">See all repos</h3>' +
        '<p class="text-muted text-sm">Browse all ' + repos.length + ' public repositories.</p>' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="arrow-icon"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>';
      grid.appendChild(allCard);
    }

    grid.querySelectorAll(".reveal").forEach(function(el) {
      if ("IntersectionObserver" in window) {
        var obs = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("revealed");
              obs.unobserve(entry.target);
            }
          });
        }, { threshold: 0.15 });
        obs.observe(el);
      } else {
        el.classList.add("revealed");
      }
    });
  }

  var retries = 3;
  function fetchWithRetry() {
    fetch(API_BASE + "/api/repos")
      .then(function(res) {
        if (!res.ok) throw new Error(res.status);
        return res.json();
      })
      .then(function(data) {
        renderRepos(data.repos);
        var countEl = document.getElementById("repo-count");
        if (countEl && data.count !== undefined) countEl.textContent = data.count;
        connectSSE();
      })
      .catch(function() {
        retries--;
        if (retries > 0) {
          setTimeout(fetchWithRetry, 1500);
        } else {
          grid.innerHTML = '<p class="text-muted text-sm">Could not load projects. <a href="https://github.com/Sajedur0?tab=repositories" target="_blank" rel="noopener noreferrer">View on GitHub</a></p>';
        }
      });
  }

  function connectSSE() {
    var es = new EventSource(API_BASE + "/api/events");
    es.addEventListener("repos-updated", function(e) {
      try {
        var data = JSON.parse(e.data);
        if (data.repos) renderRepos(data.repos);
        var countEl = document.getElementById("repo-count");
        if (countEl && data.count !== undefined) countEl.textContent = data.count;
      } catch {}
    });
    es.addEventListener("connected", function() {
      console.log("SSE connected — will receive instant updates");
    });
    es.onerror = function() {
      es.close();
      setTimeout(connectSSE, 5000);
    };
  }

  fetchWithRetry();

  function flashGrid() {
    grid.classList.remove("flash-update");
    void grid.offsetWidth;
    grid.classList.add("flash-update");
  }

  function pollRepos() {
    fetch(API_BASE + "/api/repos")
      .then(function(res) {
        if (!res.ok) throw new Error(res.status);
        return res.json();
      })
      .then(function(data) {
        if (data.repos) renderRepos(data.repos);
        var countEl = document.getElementById("repo-count");
        if (countEl && data.count !== undefined) countEl.textContent = data.count;
        flashGrid();
      })
      .catch(function() {});
  }

  var pollTimer = setInterval(pollRepos, 30000);

  document.addEventListener("visibilitychange", function() {
    if (document.hidden) return;
    clearInterval(pollTimer);
    pollRepos();
    pollTimer = setInterval(pollRepos, 30000);
  });
})();
