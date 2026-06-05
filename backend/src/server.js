require("dotenv").config();

const { app } = require("./app");
const { prisma } = require("./lib/prisma");
const env = require("./config/env");

const server = app.listen(env.PORT, () => {
  console.log(JSON.stringify({ event: "server_start", port: env.PORT, env: env.NODE_ENV }));
});

let shuttingDown = false;

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ event: "shutdown_signal", signal }));

  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log(JSON.stringify({ event: "shutdown_complete" }));
      process.exit(0);
    } catch (err) {
      console.error(JSON.stringify({ event: "shutdown_error", error: err.message }));
      process.exit(1);
    }
  });

  // Força encerramento após 30s se conexões não fecharem
  setTimeout(() => {
    console.error(JSON.stringify({ event: "shutdown_forced" }));
    process.exit(1);
  }, 30_000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
