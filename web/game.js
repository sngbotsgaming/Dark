// Placeholder game.js for when C++ is not compiled to wasm.
// When using Emscripten, its generated glue will replace or complement this file.
// Keep this lightweight so the page doesn't fail if no wasm exists.

console.log('No compiled game glue present; running JS fallback.');

// Provide a minimal `createGameModule` stub so frontend can call it safely.
window.createGameModule = async function() {
  return {
    update_frame: function(dt) {
      // simple deterministic points based on dt
      return Math.floor(dt * 0.01);
    }
  };
};
