const cluster = require("cluster");
const os = require("os");

if (cluster.isPrimary) {
  const CPU_COUNT = Math.min(os.cpus().length, 4);
  console.log(`Primary ${process.pid} — forking ${CPU_COUNT} workers`);

  for (let i = 0; i < CPU_COUNT; i++) cluster.fork();

  cluster.on("exit", (worker, code) => {
    console.warn(`Worker ${worker.process.pid} died (code ${code}). Restarting...`);
    cluster.fork();
  });

  process.on("SIGTERM", () => {
    console.log("SIGTERM received. Shutting down workers...");
    for (const id in cluster.workers) cluster.workers[id].process.kill("SIGTERM");
    setTimeout(() => process.exit(0), 5000);
  });
} else {
  require("./server.js");
}
