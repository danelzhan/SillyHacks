import { execSync } from "child_process";

const port = Number(process.argv[2] ?? 8787);

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function killOnWindows(targetPort) {
  const output = run(`netstat -ano -p tcp | findstr :${targetPort}`);
  const pids = unique(
    output
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/).pop())
  );

  const killed = [];
  for (const pid of pids) {
    const task = run(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`).toLowerCase();
    if (!task.includes("node.exe")) continue;
    run(`taskkill /PID ${pid} /F`);
    killed.push(pid);
  }

  return killed;
}

function killOnUnix(targetPort) {
  const output = run(`lsof -ti tcp:${targetPort}`);
  const pids = unique(output.split(/\r?\n/).map((pid) => pid.trim()));

  const killed = [];
  for (const pid of pids) {
    const command = run(`ps -p ${pid} -o comm=`).toLowerCase();
    if (!command.includes("node")) continue;
    run(`kill -9 ${pid}`);
    killed.push(pid);
  }

  return killed;
}

const killedPids =
  process.platform === "win32" ? killOnWindows(port) : killOnUnix(port);

if (killedPids.length) {
  console.log(
    `[predev] Killed orphaned Node process(es) on port ${port}: ${killedPids.join(", ")}`
  );
} else {
  console.log(`[predev] No orphaned Node process found on port ${port}`);
}
