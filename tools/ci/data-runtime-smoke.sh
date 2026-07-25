#!/usr/bin/env bash
set -euo pipefail

api_log="$(mktemp)"
api_pid=""

cleanup() {
  if [[ -n "$api_pid" ]] && kill -0 "$api_pid" 2>/dev/null; then
    kill "$api_pid"
    wait "$api_pid" 2>/dev/null || true
  fi
}

trap cleanup EXIT

pnpm generate
pnpm db:migrate
pnpm db:status
pnpm --filter @edu-mentor/api test:integration
pnpm db:seed
pnpm db:seed
pnpm --filter @edu-mentor/api test:seed-integration
pnpm build

pnpm --filter @edu-mentor/api start >"$api_log" 2>&1 &
api_pid="$!"

live_body=""
ready_body=""

for _attempt in $(seq 1 30); do
  if ! kill -0 "$api_pid" 2>/dev/null; then
    sed -n '1,240p' "$api_log"
    exit 1
  fi

  live_body="$(curl --fail --silent --show-error \
    "http://127.0.0.1:${PORT:-3101}/api/v1/health/live" 2>/dev/null || true)"
  ready_body="$(curl --fail --silent --show-error \
    "http://127.0.0.1:${PORT:-3101}/api/v1/health/ready" 2>/dev/null || true)"

  if [[ -n "$live_body" && -n "$ready_body" ]]; then
    break
  fi

  sleep 1
done

if [[ -z "$live_body" || -z "$ready_body" ]]; then
  sed -n '1,240p' "$api_log"
  exit 1
fi

node -e '
  const live = JSON.parse(process.argv[1]);
  const ready = JSON.parse(process.argv[2]);

  if (live.service !== "api" || live.status !== "ok") {
    throw new Error("Liveness response is invalid.");
  }

  if (
    ready.service !== "api" ||
    ready.status !== "ok" ||
    ready.dependencies?.postgres !== "ok" ||
    ready.dependencies?.redis !== "ok"
  ) {
    throw new Error("Readiness response is invalid.");
  }
' "$live_body" "$ready_body"

echo "data_runtime_smoke=ok"
