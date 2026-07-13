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

// Path-based routing: intercept internal nav clicks
const routeMap = {
  "/home": "home",
  "/about": "about",
  "/skills": "skills",
  "/experience": "experience",
  "/projects": "projects",
  "/contact": "contact"
};

function navigateTo(path) {
  const sectionId = routeMap[path];
  if (!sectionId) return;
  const target = document.getElementById(sectionId);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth" });
  history.pushState(null, "", path);
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
  const path = window.location.pathname;
  const sectionId = routeMap[path];
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
    const path = link.getAttribute("href");
    const sectionId = routeMap[path];
    return sectionId ? document.getElementById(sectionId) : null;
  })
  .filter(Boolean);

if ("IntersectionObserver" in window && sections.length) {
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const path = "/" + entry.target.id;
      navLinks.forEach(l => {
        l.classList.toggle("active", l.getAttribute("href") === path);
      });
      if (routeMap[path]) history.replaceState(null, "", path);
    });
  }, { rootMargin: "-45% 0px -50% 0px" });

  sections.forEach(section => navObserver.observe(section));
}
