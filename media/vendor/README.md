# ZFP browser decoder

`zfp.js` and `wasm-zfp.wasm` are the browser bundle and WebAssembly binary from [`wasm-zfp` 3.0.0](https://www.npmjs.com/package/wasm-zfp). The JavaScript entry point was bundled for vivi's Webview and uses `globalThis.ViviZfpWasmUrl` to load the binary from the extension's local media URI. The upstream wrapper is MIT licensed; see `wasm-zfp-LICENSE`. The bundled ZFP library is BSD 3-Clause licensed; see `zfp-LICENSE`.
