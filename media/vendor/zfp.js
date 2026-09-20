var ViviZfp = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __commonJS = (cb, mod) => function __require2() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // ../../../../../private/tmp/vivi-zfp-check/package/dist/wasm-zfp.wasm
  var require_wasm_zfp = __commonJS({
    "../../../../../private/tmp/vivi-zfp-check/package/dist/wasm-zfp.wasm"(exports, module) {
      module.exports = globalThis.ViviZfpWasmUrl;
    }
  });

  // ../../../../../private/tmp/vivi-zfp-check/package/dist/wasm-zfp.js
  var require_wasm_zfp2 = __commonJS({
    "../../../../../private/tmp/vivi-zfp-check/package/dist/wasm-zfp.js"(exports, module) {
      var Module = (() => {
        var _scriptDir = typeof document !== "undefined" && document.currentScript ? document.currentScript.src : void 0;
        if (typeof __filename !== "undefined") _scriptDir = _scriptDir || __filename;
        return (function(Module2) {
          Module2 = Module2 || {};
          var Module2 = typeof Module2 != "undefined" ? Module2 : {};
          var readyPromiseResolve, readyPromiseReject;
          Module2["ready"] = new Promise(function(resolve, reject) {
            readyPromiseResolve = resolve;
            readyPromiseReject = reject;
          });
          var nodePath;
          if (typeof process !== "undefined") {
            Module2["ENVIRONMENT"] = process.env.WASM_ZFP_ENVIRONMENT;
          }
          Module2.locateFile = function(input) {
            if (ENVIRONMENT_IS_NODE) {
              nodePath = { normalize: function(any) {
                return any;
              } };
              return __dirname + "/" + input;
            } else if (input.endsWith(".wasm")) {
              const wasmPath = require_wasm_zfp();
              return wasmPath;
            } else {
              return input;
            }
          };
          var moduleOverrides = Object.assign({}, Module2);
          var arguments_ = [];
          var thisProgram = "./this.program";
          var quit_ = (status, toThrow) => {
            throw toThrow;
          };
          var ENVIRONMENT_IS_WEB = typeof window == "object";
          var ENVIRONMENT_IS_WORKER = typeof importScripts == "function";
          var ENVIRONMENT_IS_NODE = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string";
          var scriptDirectory = "";
          function locateFile(path) {
            if (Module2["locateFile"]) {
              return Module2["locateFile"](path, scriptDirectory);
            }
            return scriptDirectory + path;
          }
          var read_, readAsync, readBinary, setWindowTitle;
          function logExceptionOnExit(e) {
            if (e instanceof ExitStatus) return;
            let toLog = e;
            err("exiting due to exception: " + toLog);
          }
          if (ENVIRONMENT_IS_NODE) {
            var fs = __require("fs");
            var nodePath = __require("path");
            if (ENVIRONMENT_IS_WORKER) {
              scriptDirectory = nodePath.dirname(scriptDirectory) + "/";
            } else {
              scriptDirectory = __dirname + "/";
            }
            read_ = (filename, binary) => {
              filename = isFileURI(filename) ? new URL(filename) : nodePath.normalize(filename);
              return fs.readFileSync(filename, binary ? void 0 : "utf8");
            };
            readBinary = (filename) => {
              var ret = read_(filename, true);
              if (!ret.buffer) {
                ret = new Uint8Array(ret);
              }
              return ret;
            };
            readAsync = (filename, onload, onerror) => {
              filename = isFileURI(filename) ? new URL(filename) : nodePath.normalize(filename);
              fs.readFile(filename, function(err2, data) {
                if (err2) onerror(err2);
                else onload(data.buffer);
              });
            };
            if (process["argv"].length > 1) {
              thisProgram = process["argv"][1].replace(/\\/g, "/");
            }
            arguments_ = process["argv"].slice(2);
            quit_ = (status, toThrow) => {
              if (keepRuntimeAlive()) {
                process["exitCode"] = status;
                throw toThrow;
              }
              logExceptionOnExit(toThrow);
              process["exit"](status);
            };
            Module2["inspect"] = function() {
              return "[Emscripten Module object]";
            };
          } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
            if (ENVIRONMENT_IS_WORKER) {
              scriptDirectory = self.location.href;
            } else if (typeof document != "undefined" && document.currentScript) {
              scriptDirectory = document.currentScript.src;
            }
            if (_scriptDir) {
              scriptDirectory = _scriptDir;
            }
            if (scriptDirectory.indexOf("blob:") !== 0) {
              scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
            } else {
              scriptDirectory = "";
            }
            {
              read_ = (url) => {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, false);
                xhr.send(null);
                return xhr.responseText;
              };
              if (ENVIRONMENT_IS_WORKER) {
                readBinary = (url) => {
                  var xhr = new XMLHttpRequest();
                  xhr.open("GET", url, false);
                  xhr.responseType = "arraybuffer";
                  xhr.send(null);
                  return new Uint8Array(xhr.response);
                };
              }
              readAsync = (url, onload, onerror) => {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, true);
                xhr.responseType = "arraybuffer";
                xhr.onload = () => {
                  if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                    onload(xhr.response);
                    return;
                  }
                  onerror();
                };
                xhr.onerror = onerror;
                xhr.send(null);
              };
            }
            setWindowTitle = (title) => document.title = title;
          } else {
          }
          var out = Module2["print"] || console.log.bind(console);
          var err = Module2["printErr"] || console.warn.bind(console);
          Object.assign(Module2, moduleOverrides);
          moduleOverrides = null;
          if (Module2["arguments"]) arguments_ = Module2["arguments"];
          if (Module2["thisProgram"]) thisProgram = Module2["thisProgram"];
          if (Module2["quit"]) quit_ = Module2["quit"];
          var wasmBinary;
          if (Module2["wasmBinary"]) wasmBinary = Module2["wasmBinary"];
          var noExitRuntime = Module2["noExitRuntime"] || true;
          if (typeof WebAssembly != "object") {
            abort("no native wasm support detected");
          }
          var wasmMemory;
          var ABORT = false;
          var EXITSTATUS;
          var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAP64, HEAPU64, HEAPF64;
          function updateGlobalBufferAndViews(buf) {
            buffer = buf;
            Module2["HEAP8"] = HEAP8 = new Int8Array(buf);
            Module2["HEAP16"] = HEAP16 = new Int16Array(buf);
            Module2["HEAP32"] = HEAP32 = new Int32Array(buf);
            Module2["HEAPU8"] = HEAPU8 = new Uint8Array(buf);
            Module2["HEAPU16"] = HEAPU16 = new Uint16Array(buf);
            Module2["HEAPU32"] = HEAPU32 = new Uint32Array(buf);
            Module2["HEAPF32"] = HEAPF32 = new Float32Array(buf);
            Module2["HEAPF64"] = HEAPF64 = new Float64Array(buf);
            Module2["HEAP64"] = HEAP64 = new BigInt64Array(buf);
            Module2["HEAPU64"] = HEAPU64 = new BigUint64Array(buf);
          }
          var INITIAL_MEMORY = Module2["INITIAL_MEMORY"] || 1114112;
          var wasmTable;
          var __ATPRERUN__ = [];
          var __ATINIT__ = [];
          var __ATPOSTRUN__ = [];
          var runtimeInitialized = false;
          function keepRuntimeAlive() {
            return noExitRuntime;
          }
          function preRun() {
            if (Module2["preRun"]) {
              if (typeof Module2["preRun"] == "function") Module2["preRun"] = [Module2["preRun"]];
              while (Module2["preRun"].length) {
                addOnPreRun(Module2["preRun"].shift());
              }
            }
            callRuntimeCallbacks(__ATPRERUN__);
          }
          function initRuntime() {
            runtimeInitialized = true;
            callRuntimeCallbacks(__ATINIT__);
          }
          function postRun() {
            if (Module2["postRun"]) {
              if (typeof Module2["postRun"] == "function") Module2["postRun"] = [Module2["postRun"]];
              while (Module2["postRun"].length) {
                addOnPostRun(Module2["postRun"].shift());
              }
            }
            callRuntimeCallbacks(__ATPOSTRUN__);
          }
          function addOnPreRun(cb) {
            __ATPRERUN__.unshift(cb);
          }
          function addOnInit(cb) {
            __ATINIT__.unshift(cb);
          }
          function addOnPostRun(cb) {
            __ATPOSTRUN__.unshift(cb);
          }
          var runDependencies = 0;
          var runDependencyWatcher = null;
          var dependenciesFulfilled = null;
          function addRunDependency(id) {
            runDependencies++;
            if (Module2["monitorRunDependencies"]) {
              Module2["monitorRunDependencies"](runDependencies);
            }
          }
          function removeRunDependency(id) {
            runDependencies--;
            if (Module2["monitorRunDependencies"]) {
              Module2["monitorRunDependencies"](runDependencies);
            }
            if (runDependencies == 0) {
              if (runDependencyWatcher !== null) {
                clearInterval(runDependencyWatcher);
                runDependencyWatcher = null;
              }
              if (dependenciesFulfilled) {
                var callback = dependenciesFulfilled;
                dependenciesFulfilled = null;
                callback();
              }
            }
          }
          function abort(what) {
            if (Module2["onAbort"]) {
              Module2["onAbort"](what);
            }
            what = "Aborted(" + what + ")";
            err(what);
            ABORT = true;
            EXITSTATUS = 1;
            what += ". Build with -sASSERTIONS for more info.";
            var e = new WebAssembly.RuntimeError(what);
            readyPromiseReject(e);
            throw e;
          }
          var dataURIPrefix = "data:application/octet-stream;base64,";
          function isDataURI(filename) {
            return filename.startsWith(dataURIPrefix);
          }
          function isFileURI(filename) {
            return filename.startsWith("file://");
          }
          var wasmBinaryFile;
          wasmBinaryFile = "wasm-zfp.wasm";
          if (!isDataURI(wasmBinaryFile)) {
            wasmBinaryFile = locateFile(wasmBinaryFile);
          }
          function getBinary(file) {
            try {
              if (file == wasmBinaryFile && wasmBinary) {
                return new Uint8Array(wasmBinary);
              }
              if (readBinary) {
                return readBinary(file);
              }
              throw "both async and sync fetching of the wasm failed";
            } catch (err2) {
              abort(err2);
            }
          }
          function getBinaryPromise() {
            if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
              if (typeof fetch == "function" && !isFileURI(wasmBinaryFile)) {
                return fetch(wasmBinaryFile, { credentials: "same-origin" }).then(function(response) {
                  if (!response["ok"]) {
                    throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
                  }
                  return response["arrayBuffer"]();
                }).catch(function() {
                  return getBinary(wasmBinaryFile);
                });
              } else {
                if (readAsync) {
                  return new Promise(function(resolve, reject) {
                    readAsync(wasmBinaryFile, function(response) {
                      resolve(new Uint8Array(response));
                    }, reject);
                  });
                }
              }
            }
            return Promise.resolve().then(function() {
              return getBinary(wasmBinaryFile);
            });
          }
          function createWasm() {
            var info = { "a": asmLibraryArg };
            function receiveInstance(instance, module2) {
              var exports3 = instance.exports;
              Module2["asm"] = exports3;
              wasmMemory = Module2["asm"]["c"];
              updateGlobalBufferAndViews(wasmMemory.buffer);
              wasmTable = Module2["asm"]["k"];
              addOnInit(Module2["asm"]["d"]);
              removeRunDependency("wasm-instantiate");
            }
            addRunDependency("wasm-instantiate");
            function receiveInstantiationResult(result) {
              receiveInstance(result["instance"]);
            }
            function instantiateArrayBuffer(receiver) {
              return getBinaryPromise().then(function(binary) {
                return WebAssembly.instantiate(binary, info);
              }).then(function(instance) {
                return instance;
              }).then(receiver, function(reason) {
                err("failed to asynchronously prepare wasm: " + reason);
                abort(reason);
              });
            }
            function instantiateAsync() {
              if (!wasmBinary && typeof WebAssembly.instantiateStreaming == "function" && !isDataURI(wasmBinaryFile) && !isFileURI(wasmBinaryFile) && !ENVIRONMENT_IS_NODE && typeof fetch == "function") {
                return fetch(wasmBinaryFile, { credentials: "same-origin" }).then(function(response) {
                  var result = WebAssembly.instantiateStreaming(response, info);
                  return result.then(receiveInstantiationResult, function(reason) {
                    err("wasm streaming compile failed: " + reason);
                    err("falling back to ArrayBuffer instantiation");
                    return instantiateArrayBuffer(receiveInstantiationResult);
                  });
                });
              } else {
                return instantiateArrayBuffer(receiveInstantiationResult);
              }
            }
            if (Module2["instantiateWasm"]) {
              try {
                var exports2 = Module2["instantiateWasm"](info, receiveInstance);
                return exports2;
              } catch (e) {
                err("Module.instantiateWasm callback failed with error: " + e);
                readyPromiseReject(e);
              }
            }
            instantiateAsync().catch(readyPromiseReject);
            return {};
          }
          var tempDouble;
          var tempI64;
          function ExitStatus(status) {
            this.name = "ExitStatus";
            this.message = "Program terminated with exit(" + status + ")";
            this.status = status;
          }
          function callRuntimeCallbacks(callbacks) {
            while (callbacks.length > 0) {
              callbacks.shift()(Module2);
            }
          }
          function getValue(ptr, type = "i8") {
            if (type.endsWith("*")) type = "*";
            switch (type) {
              case "i1":
                return HEAP8[ptr >> 0];
              case "i8":
                return HEAP8[ptr >> 0];
              case "i16":
                return HEAP16[ptr >> 1];
              case "i32":
                return HEAP32[ptr >> 2];
              case "i64":
                return HEAP64[ptr >> 3];
              case "float":
                return HEAPF32[ptr >> 2];
              case "double":
                return HEAPF64[ptr >> 3];
              case "*":
                return HEAPU32[ptr >> 2];
              default:
                abort("invalid type for getValue: " + type);
            }
            return null;
          }
          Module2["getValue"] = getValue;
          function setValue(ptr, value, type = "i8") {
            if (type.endsWith("*")) type = "*";
            switch (type) {
              case "i1":
                HEAP8[ptr >> 0] = value;
                break;
              case "i8":
                HEAP8[ptr >> 0] = value;
                break;
              case "i16":
                HEAP16[ptr >> 1] = value;
                break;
              case "i32":
                HEAP32[ptr >> 2] = value;
                break;
              case "i64":
                tempI64 = [value >>> 0, (tempDouble = value, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[ptr >> 2] = tempI64[0], HEAP32[ptr + 4 >> 2] = tempI64[1];
                break;
              case "float":
                HEAPF32[ptr >> 2] = value;
                break;
              case "double":
                HEAPF64[ptr >> 3] = value;
                break;
              case "*":
                HEAPU32[ptr >> 2] = value;
                break;
              default:
                abort("invalid type for setValue: " + type);
            }
          }
          Module2["setValue"] = setValue;
          function _emscripten_memcpy_big(dest, src, num) {
            HEAPU8.copyWithin(dest, src, src + num);
          }
          function getHeapMax() {
            return 2147483648;
          }
          function emscripten_realloc_buffer(size) {
            try {
              wasmMemory.grow(size - buffer.byteLength + 65535 >>> 16);
              updateGlobalBufferAndViews(wasmMemory.buffer);
              return 1;
            } catch (e) {
            }
          }
          function _emscripten_resize_heap(requestedSize) {
            var oldSize = HEAPU8.length;
            requestedSize = requestedSize >>> 0;
            var maxHeapSize = getHeapMax();
            if (requestedSize > maxHeapSize) {
              return false;
            }
            let alignUp = (x, multiple) => x + (multiple - x % multiple) % multiple;
            for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
              var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
              overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
              var newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
              var replacement = emscripten_realloc_buffer(newSize);
              if (replacement) {
                return true;
              }
            }
            return false;
          }
          var asmLibraryArg = { "b": _emscripten_memcpy_big, "a": _emscripten_resize_heap };
          var asm = createWasm();
          var ___wasm_call_ctors = Module2["___wasm_call_ctors"] = function() {
            return (___wasm_call_ctors = Module2["___wasm_call_ctors"] = Module2["asm"]["d"]).apply(null, arguments);
          };
          var _createBuffer = Module2["_createBuffer"] = function() {
            return (_createBuffer = Module2["_createBuffer"] = Module2["asm"]["e"]).apply(null, arguments);
          };
          var _malloc = Module2["_malloc"] = function() {
            return (_malloc = Module2["_malloc"] = Module2["asm"]["f"]).apply(null, arguments);
          };
          var _freeBuffer = Module2["_freeBuffer"] = function() {
            return (_freeBuffer = Module2["_freeBuffer"] = Module2["asm"]["g"]).apply(null, arguments);
          };
          var _free = Module2["_free"] = function() {
            return (_free = Module2["_free"] = Module2["asm"]["h"]).apply(null, arguments);
          };
          var _compress = Module2["_compress"] = function() {
            return (_compress = Module2["_compress"] = Module2["asm"]["i"]).apply(null, arguments);
          };
          var _decompress = Module2["_decompress"] = function() {
            return (_decompress = Module2["_decompress"] = Module2["asm"]["j"]).apply(null, arguments);
          };
          var calledRun;
          dependenciesFulfilled = function runCaller() {
            if (!calledRun) run();
            if (!calledRun) dependenciesFulfilled = runCaller;
          };
          function run(args) {
            args = args || arguments_;
            if (runDependencies > 0) {
              return;
            }
            preRun();
            if (runDependencies > 0) {
              return;
            }
            function doRun() {
              if (calledRun) return;
              calledRun = true;
              Module2["calledRun"] = true;
              if (ABORT) return;
              initRuntime();
              readyPromiseResolve(Module2);
              if (Module2["onRuntimeInitialized"]) Module2["onRuntimeInitialized"]();
              postRun();
            }
            if (Module2["setStatus"]) {
              Module2["setStatus"]("Running...");
              setTimeout(function() {
                setTimeout(function() {
                  Module2["setStatus"]("");
                }, 1);
                doRun();
              }, 1);
            } else {
              doRun();
            }
          }
          if (Module2["preInit"]) {
            if (typeof Module2["preInit"] == "function") Module2["preInit"] = [Module2["preInit"]];
            while (Module2["preInit"].length > 0) {
              Module2["preInit"].pop()();
            }
          }
          run();
          return Module2.ready;
        });
      })();
      if (typeof exports === "object" && typeof module === "object")
        module.exports = Module;
      else if (typeof define === "function" && define["amd"])
        define([], function() {
          return Module;
        });
      else if (typeof exports === "object")
        exports["Module"] = Module;
    }
  });

  // ../../../../../private/tmp/vivi-zfp-check/package/dist/index.js
  var require_dist = __commonJS({
    "../../../../../private/tmp/vivi-zfp-check/package/dist/index.js"(exports, module) {
      var ModuleFactory = require_wasm_zfp2();
      var ModulePromise = ModuleFactory();
      var Module;
      function ensureLoaded() {
        if (!Module) {
          throw new Error(
            `wasm-zfp has not finished loading. Please wait with "await decompress.isLoaded" before calling decompress`
          );
        }
      }
      module.exports.ZfpType = {
        INT32: 1,
        INT64: 2,
        FLOAT: 3,
        DOUBLE: 4
      };
      module.exports.createBuffer = function createBuffer() {
        ensureLoaded();
        return Module._createBuffer();
      };
      module.exports.freeBuffer = function freeBuffer(zfpBuffer) {
        ensureLoaded();
        Module._freeBuffer(zfpBuffer);
      };
      module.exports.compress = function compress(zfpBuffer, zfpInput, opts) {
        ensureLoaded();
        opts = opts ?? {};
        const { data, shape, dimensions } = zfpInput;
        const strides = zfpInput.strides ?? [0, 0, 0, 0];
        const type = zfpType(data);
        if (dimensions < 1 || dimensions > 4) {
          throw new Error(`ZFP compression failed: invalid dimensions. Expected 1-4, got ${dimensions}`);
        }
        if ((type === this.ZfpType.INT32 || type === this.ZfpType.INT64) && opts.tolerance != void 0) {
          throw new Error(`ZFP compression failed: accuracy mode is not supported for int32 or int64`);
        }
        const scalarCount = scalarCountForShape(shape, dimensions);
        const scalarSize = scalarSizeForType(type);
        const size = scalarCount * scalarSize;
        while (shape.length < 4) {
          shape.push(0);
        }
        while (strides.length < 4) {
          strides.push(0);
        }
        if (size === 0 || isNaN(size)) {
          throw new Error(
            `ZFP compression failed: cannot compress an empty array. scalarCount=${scalarCount}, scalarSize=${scalarSize}, size=${size}`
          );
        } else if (size > data.byteLength) {
          throw new Error(
            `ZFP compression failed: data buffer is too small. Expected ${size} bytes, got ${data.byteLength}`
          );
        } else if (size > Module.HEAPU8.byteLength) {
          throw new Error(
            `ZFP compression failed: Cannot allocate ${size} bytes (heap is ${Module.HEAPU8.byteLength})`
          );
        }
        const srcPointer = Module._malloc(size);
        const srcHeap = new Uint8Array(Module.HEAPU8.buffer, srcPointer, size);
        srcHeap.set(new Uint8Array(data.buffer, data.byteOffset, size));
        const inputBuffer = Module._createBuffer();
        Module.setValue(inputBuffer, srcPointer, "i32");
        Module.setValue(inputBuffer + 4, size, "i32");
        Module.setValue(inputBuffer + 8, size, "i32");
        Module.setValue(inputBuffer + 12, scalarSize, "i32");
        Module.setValue(inputBuffer + 16, shape[0], "i32");
        Module.setValue(inputBuffer + 20, shape[1], "i32");
        Module.setValue(inputBuffer + 24, shape[2], "i32");
        Module.setValue(inputBuffer + 28, shape[3], "i32");
        Module.setValue(inputBuffer + 32, strides[0], "i32");
        Module.setValue(inputBuffer + 36, strides[1], "i32");
        Module.setValue(inputBuffer + 40, strides[2], "i32");
        Module.setValue(inputBuffer + 44, strides[3], "i32");
        Module.setValue(inputBuffer + 48, dimensions, "i32");
        Module.setValue(inputBuffer + 52, type, "i32");
        try {
          const tolerance = opts.tolerance ?? -1;
          const rate = opts.rate ?? -1;
          const precision = opts.precision ?? -1;
          const compressedSize = Module._compress(zfpBuffer, inputBuffer, tolerance, rate, precision);
          if (compressedSize <= 0) {
            throw new Error(`Error compressing ZFP data: ${compressedSize}`);
          }
          const outputPointer = Module.getValue(zfpBuffer, "i32");
          const output = new Uint8Array(Module.HEAPU8.buffer, outputPointer, compressedSize);
          const copy = new Uint8Array(output);
          return copy;
        } finally {
          Module._free(srcPointer);
          Module._freeBuffer(inputBuffer);
        }
      };
      module.exports.decompress = function decompress(zfpBuffer, src) {
        ensureLoaded();
        const srcSize = src.byteLength;
        const srcPointer = Module._malloc(srcSize);
        const compressedHeap = new Uint8Array(Module.HEAPU8.buffer, srcPointer, srcSize);
        compressedHeap.set(src);
        const result = Module._decompress(zfpBuffer, srcPointer, srcSize);
        try {
          if (result !== 0) {
            throw new Error(`Error decompressing ZFP data: ${result}`);
          }
          const dataPointer = Module.getValue(zfpBuffer, "i32");
          const bufferSize = Module.getValue(zfpBuffer + 4, "i32");
          const size = Module.getValue(zfpBuffer + 8, "i32");
          const scalarSize = Module.getValue(zfpBuffer + 12, "i32");
          const elements = size / scalarSize;
          const type = Module.getValue(zfpBuffer + 52, "i32");
          const data = typedArray(type, elements);
          const output = {
            data,
            dataPointer,
            bufferSize,
            size,
            scalarSize,
            shape: [
              Module.getValue(zfpBuffer + 16, "i32"),
              Module.getValue(zfpBuffer + 20, "i32"),
              Module.getValue(zfpBuffer + 24, "i32"),
              Module.getValue(zfpBuffer + 28, "i32")
            ],
            stride: [
              Module.getValue(zfpBuffer + 32, "i32"),
              Module.getValue(zfpBuffer + 36, "i32"),
              Module.getValue(zfpBuffer + 40, "i32"),
              Module.getValue(zfpBuffer + 44, "i32")
            ],
            dimensions: Module.getValue(zfpBuffer + 48, "i32"),
            type
          };
          const outputBytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
          outputBytes.set(new Uint8Array(Module.HEAPU8.buffer, dataPointer, size));
          return output;
        } finally {
          Module._free(srcPointer);
        }
      };
      module.exports.isLoaded = ModulePromise.then((mod) => mod["ready"].then(() => {
      }));
      ModulePromise.then((mod) => {
        Module = mod;
        if (typeof process === "object" && false) {
          module.exports.__module = Module;
        }
      });
      function typedArray(type, elements) {
        switch (type) {
          case 1:
            return new Int32Array(elements);
          case 2:
            return new BigInt64Array(elements);
          case 3:
            return new Float32Array(elements);
          case 4:
            return new Float64Array(elements);
          default:
            throw new Error(`Unknown zfp_type: ${type}`);
        }
      }
      function zfpType(data) {
        switch (data.constructor) {
          case Int32Array:
            return 1;
          case BigInt64Array:
            return 2;
          case Float32Array:
            return 3;
          case Float64Array:
            return 4;
          default:
            throw new Error(`Unsupported typed array type: ${data.constructor.name}`);
        }
      }
      function scalarCountForShape(shape, dimensions) {
        let count = 1;
        for (let i = 0; i < dimensions; i++) {
          count *= shape[i];
        }
        return count;
      }
      function scalarSizeForType(type) {
        switch (type) {
          case 1:
            return 4;
          case 2:
            return 8;
          case 3:
            return 4;
          case 4:
            return 8;
          default:
            throw new Error(`Unknown zfp type: ${type}`);
        }
      }
    }
  });
  return require_dist();
})();

if (typeof module !== "undefined") module.exports = ViviZfp;
