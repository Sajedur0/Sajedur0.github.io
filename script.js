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

// Hash-based routing: intercept internal nav clicks
const routeMap = {
  "#home": "home",
  "#about": "about",
  "#skills": "skills",
  "#experience": "experience",
  "#projects": "projects",
  "#contact": "contact"
};

function navigateTo(hash) {
  const sectionId = routeMap[hash];
  if (!sectionId) return;
  const target = document.getElementById(sectionId);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth" });
  history.pushState(null, "", hash);
}

document.querySelectorAll('a[href]').forEach(link => {
  const href = link.getAttribute("href");
  if (href && routeMap[href]) {
    link.addEventListener("click", e => {
      e.preventDefault();
      navigateTo(href);
    });
  }
});

window.addEventListener("popstate", () => {
  const hash = window.location.hash;
  const sectionId = routeMap[hash];
  if (sectionId) {
    const target = document.getElementById(sectionId);
    if (target) target.scrollIntoView({ behavior: "smooth" });
  }
});

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
  .map(link => {
    const hash = link.getAttribute("href");
    const sectionId = routeMap[hash];
    return sectionId ? document.getElementById(sectionId) : null;
  })
  .filter(Boolean);

if ("IntersectionObserver" in window && sections.length) {
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const hash = "#" + entry.target.id;
      navLinks.forEach(l => {
        l.classList.toggle("active", l.getAttribute("href") === hash);
      });
      if (routeMap[hash]) history.replaceState(null, "", hash);
    });
  }, { rootMargin: "-45% 0px -50% 0px" });

  sections.forEach(section => navObserver.observe(section));
}

// Scroll to section if URL has a hash on page load
(function() {
  var hash = window.location.hash;
  if (hash && routeMap[hash]) {
    setTimeout(function() {
      var target = document.getElementById(hash.replace('#', ''));
      if (target) target.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }
})();

// Dynamic footer year
document.getElementById("footer-year").textContent = new Date().getFullYear();

// Dynamic repo count in hero-stats
(function() {
  var el = document.getElementById("repo-count");
  if (!el) return;

  fetch("https://api.github.com/users/Sajedur0/repos?per_page=1")
    .then(function(res) {
      var link = res.headers.get("Link");
      if (link && link.includes('rel="last"')) {
        var match = link.match(/page=(\d+)>; rel="last"/);
        if (match) { el.textContent = match[1]; return; }
      }
      return res.json();
    })
    .then(function(repos) {
      if (Array.isArray(repos)) el.textContent = repos.length;
    })
    .catch(function() {});
})();

// Dynamic GitHub Projects
(function() {
  var grid = document.getElementById("projects-grid");
  if (!grid) return;

  var CACHE_KEY = "gh_repos_cache";
  var CACHE_TTL = 5 * 60 * 1000;

  function getCached() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (Date.now() - data.ts > CACHE_TTL) return null;
      return data.repos;
    } catch (e) { return null; }
  }

  function setCache(repos) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), repos: repos })); } catch (e) {}
  }

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
      if (repo.stargazers_count > 0 || repo.forks_count > 0) {
        meta = '<div class="project-meta">';
        if (repo.stargazers_count > 0) meta += '<span class="stars">&#9733; ' + repo.stargazers_count + '</span>';
        if (repo.forks_count > 0) meta += '<span class="forks">' + repo.forks_count + ' forks</span>';
        meta += '</div>';
      }

      var desc = repo.description ? repo.description : "No description available.";
      var lang = repo.language ? repo.language : "N/A";

      card.innerHTML = meta +
        '<h3 class="project-name">' + repo.name + '</h3>' +
        '<p class="text-muted text-sm">' + desc + '</p>' +
        '<span class="tag">' + lang + '</span>';

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

  function showError() {
    var cached = getCached();
    if (cached) {
      renderRepos(cached);
      return;
    }
    grid.innerHTML = '<p class="text-muted text-sm">Could not load projects. <a href="https://github.com/Sajedur0?tab=repositories" target="_blank" rel="noopener noreferrer">View on GitHub</a></p>';
  }

  var cached = getCached();
  if (cached) {
    renderRepos(cached);
    return;
  }

  var retries = 3;
  function fetchWithRetry() {
    fetch("https://api.github.com/users/Sajedur0/repos?sort=updated&per_page=100")
      .then(function(res) {
        if (!res.ok) throw new Error(res.status);
        return res.json();
      })
      .then(function(repos) {
        setCache(repos);
        renderRepos(repos);
      })
      .catch(function() {
        retries--;
        if (retries > 0) {
          setTimeout(fetchWithRetry, 1500);
        } else {
          showError();
        }
      });
  }

  fetchWithRetry();
})();
