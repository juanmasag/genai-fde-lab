#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
docker compose up -d
"$HOME/.local/bin/npm" run build
mkdir -p "$HOME/.local/state"
if [[ -f "$HOME/.local/state/rag-engine-lab.pid" ]]; then
  old="$(cat "$HOME/.local/state/rag-engine-lab.pid")"
  if [[ -d "/proc/$old" ]] && [[ "$(readlink -f "/proc/$old/cwd" 2>/dev/null || true)" == "$(pwd)" ]]; then
    kill "$old" 2>/dev/null || true
  fi
fi
nohup "$HOME/.local/bin/node" server.js > "$HOME/.local/state/rag-engine-lab.log" 2>&1 < /dev/null &
echo $! > "$HOME/.local/state/rag-engine-lab.pid"
echo "RAG Engine Lab iniciado en http://127.0.0.1:4173"
