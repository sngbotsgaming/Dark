Browser Game Scaffold

This repository provides a minimal scaffold for a browser-based game that demonstrates frontend (HTML/CSS/JS), C++ code compiled to WebAssembly (optional), and a C# static file server to host the game.

Contents
- web/: frontend (index.html, style.css, app.js)
- cpp/: C++ sample intended for compilation to WebAssembly with Emscripten
- cs/Server/: minimal ASP.NET Core static-file server to serve `web/`

Quick start (static file serving)
1. Serve statically with Python (fastest):

```bash
# from repo root
python3 -m http.server 8080 --directory web
# then open http://localhost:8080
```

Build C++ to WebAssembly (optional, requires Emscripten)
1. Install Emscripten: https://emscripten.org/docs/getting_started/downloads.html
2. From `cpp/`:

```bash
./build_cpp.sh
# outputs web/game.wasm and web/game.js
```

C# server (optional, requires .NET SDK)
1. Install .NET SDK (>=8.0)
2. From `cs/Server/`:

```bash
dotnet restore
dotnet run --urls "http://localhost:5000"
# open http://localhost:5000
```

Files of interest
- [web/index.html](web/index.html)
- [web/app.js](web/app.js)
- [cpp/game.cpp](cpp/game.cpp)
- [cpp/build_cpp.sh](cpp/build_cpp.sh)
- [cs/Server/Program.cs](cs/Server/Program.cs)
- [cs/Server/Server.csproj](cs/Server/Server.csproj)

Notes
- The frontend will try to load `game.wasm` if present; if not, it falls back to a pure-JS implementation.
- The C# project is a minimal static-file host; you can replace it with any backend you prefer.
