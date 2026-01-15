#include <emscripten.h>
#include <cstdlib>

extern "C" {

EMSCRIPTEN_KEEPALIVE
int update_frame(int delta_ms) {
    // simple logic: award 1 point per 10ms
    return delta_ms / 10;
}

}
