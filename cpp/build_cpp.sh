#!/usr/bin/env bash
set -e
# Build script for C++ -> WebAssembly using Emscripten (emcc)
# Outputs: ../web/game.wasm and ../web/game.js (glue)

if ! command -v emcc >/dev/null 2>&1; then
  echo "emcc not found. Install Emscripten and ensure 'emcc' is on PATH." >&2
  exit 2
fi
mkdir -p ../web
emcc game.cpp -O2 -s WASM=1 -s EXPORTED_FUNCTIONS='["_update_frame"]' -s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' -o ../web/game.js

echo "WASM build complete: ../web/game.wasm and ../web/game.js"
