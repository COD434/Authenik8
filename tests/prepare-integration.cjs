const {spawnSync} = require("node:child_process");
const net = require("node:net");

const databaseUrl = new URL(
  process.env.DATABASE_URL ??
    "postgresql://seeisa:karabo@localhost:5432/top_user_test"
);
const host = databaseUrl.hostname;
const port = Number(databaseUrl.port || 5432);

const canConnect = () =>
  new Promise((resolve) => {
    const socket = net.createConnection({host, port});

    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    ...options
  });

  if (result.error) {
    return {ok: false, error: result.error};
  }

  return {ok: result.status === 0, status: result.status};
};

const waitForDatabase = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await canConnect()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`PostgreSQL did not become ready at ${host}:${port}`);
};

const main = async () => {
  if (!(await canConnect())) {
    const dockerCheck = spawnSync("docker", ["compose", "version"], {
      stdio: "ignore"
    });

    if (dockerCheck.error || dockerCheck.status !== 0) {
      throw new Error(
        `PostgreSQL is unavailable at ${host}:${port}, and Docker Compose is not installed.`
      );
    }

    console.log("Starting the integration PostgreSQL service...");
    const compose = run("docker", [
      "compose",
      "-f",
      "docker-compose.test.yml",
      "up",
      "-d",
      "db"
    ]);

    if (!compose.ok) {
      throw new Error("Failed to start the integration PostgreSQL service.");
    }

    await waitForDatabase();
  }

  console.log("Applying the Prisma schema to the integration database...");
  const prisma = run(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["prisma", "db", "push", "--skip-generate"],
    {env: {...process.env, DATABASE_URL: databaseUrl.toString()}}
  );

  if (!prisma.ok) {
    throw new Error("Failed to apply the Prisma schema.");
  }
};

main().catch((error) => {
  console.error(`Integration setup failed: ${error.message}`);
  process.exit(1);
});
