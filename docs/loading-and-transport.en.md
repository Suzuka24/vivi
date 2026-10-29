# Large-file loading, compression, transport, and cache

[中文](loading-and-transport.md) · [Back to usage](usage.en.md)

## Where data is processed

The vivi Node extension and Python worker run on the **extension host**:

- in a local window, that host is the local machine;
- in Remote SSH, that host is the server and the source file is not downloaded to the laptop first;
- Python reads TIFF/FITS/image sequences and produces preview pixels;
- preview payloads cross the editor connection to the Webview, where the browser side performs decompression, byte unshuffle, dtype reconstruction, initial B&C/LUT coloring, and image-object construction.

Transport preserves source dtype byte layout by default. A `uint8` image is not promoted to `float64` for transfer. Only explicitly enabled lossy preview encoding approximates floating-point previews; source files and host-side analysis stay unchanged.

## Current loading pipeline

### Single image

1. Python opens the source and reads the required pixels.
2. Eligible data passes through optional lossy preview encoding.
3. If enabled, Byte Shuffle and the selected lossless compressor run next; data with no compression benefit can remain on the raw-byte path.
4. Default HTTP mode sends one continuous payload with `Content-Length`.
5. A Web Worker decompresses, restores dtype, colors, and constructs the image off the viewer main thread.
6. The completed image appears and the source file handle is released immediately.

For a fixed HTTP payload, the progress bar means **received bytes / total bytes**. Local decoding and first paint may still take a short additional interval and are not presented as network percentage.

### Stack and image folder

1. Python reads and encodes slices in source order.
2. Every slice travels through one HTTP response. Each record carries frame index, total frame count, metadata, and payload length; a new HTTP exchange is not created per frame.
3. Node applies backpressure: if the browser receives slowly, further writes pause instead of accumulating an unlimited remote buffer.
4. The browser double-buffers the stream, receiving the next record while decoding the current slice so transfer and local decode overlap.
5. Each decoded and initially colored slice enters a temporary cache; progress is completed slices / total slices.
6. The stack becomes visible atomically after every slice is ready. The first frame is not shown early, and distant slices are not deferred until first navigation.

A continuous stack response has no known final compressed byte count in advance, so its percentage means **completed slices / total slices**, not exact received-network bytes. Layout also shows a spinner that disappears with the progress panel at completion.

## HTTP and postMessage

`vivi.transportMode` offers two modes:

| Mode | Behavior | Cancellation | Progress |
| --- | --- | --- | --- |
| `http` (default) | One payload or one continuous stack response, forwarded through Remote SSH | Closing a loading Frame aborts fetch, closes the response, and stops its Python worker | Single images by bytes; streamed stacks by completed slices |
| `postMessage` | Existing payload/stream events through Webview messaging, retained for compatibility | One large message already submitted to the editor cannot be interrupted immediately | Observable frame events only; no partial receipt for a single message |

vivi falls back to `postMessage` if its HTTP endpoint cannot start. HTTP tokens are single-use and expire immediately after completion or cancellation.

## Web Workers and responsiveness

Each Frame uses a Web Worker for decompression, Byte Unshuffle, dtype reconstruction, calibration, initial B&C/LUT, and image construction. Closing the Frame terminates that worker and rejects pending jobs, keeping these CPU tasks from occupying the viewer main thread for long periods.

This cannot remove every source of stalls. Remote SSH bandwidth, browser memory allocation, very large final canvas/image objects, and resource contention inside the editor process can still affect responsiveness. The current implementation does not pace transfers and does not add fixed-size application chunks only to report progress; continuous throughput is prioritized.

## Compression order and settings

Lossy and lossless processing are independent stages:

```text
source-dtype pixels
  → optional lossy preview encoding
  → optional Byte Shuffle + lossless compression
  → HTTP/postMessage
  → lossless decompression + Byte Unshuffle
  → lossy-format decoding
  → display pixels
```

### Lossless compression

- `vivi.losslessCompression` defaults on;
- `vivi.losslessMethod` defaults to `zstd1-shuffle`;
- alternatives are `zstd3-shuffle` and legacy `zlib1-shuffle`;
- every lossless method reconstructs its input byte-for-byte. Byte Shuffle only groups equal byte positions from multi-byte values, making floating-point and multi-byte integer arrays easier to compress.

### Lossy preview

- `vivi.lossyCompression` defaults off;
- it applies only to floating-point previews whose source file is strictly larger than `vivi.lossyMinFileMiB`, 128 MiB by default;
- ZFP is the default and uses `vivi.lossyTolerance`;
- alternatives are float16, bfloat16, and 64×64 blockwise 8/12/16-bit quantization;
- integer images, folders, and planes unsuitable for a codec retain the original path;
- when lossy preview is enabled, on-screen pixel readouts reflect approximate preview values. Disable it when exact readouts are required.

## Short-lived memory cache

`vivi.recentCacheSeconds` defaults to 20 seconds:

- it retains transport payloads for only the three most recent **single images**;
- the cache lives in the current Webview's client memory, never on disk and never across a window restart;
- expiry starts at initial opening; repeated reopening does not extend the lifetime indefinitely;
- entries disappear after the limit, expiry, viewer disposal, or a setting of `0`;
- identity includes path, size, modification time, status-change time, and inode. An overwritten file is decoded again instead of receiving stale cached pixels.

Stacks do not use this short-lived transport-payload cache. An open stack keeps its slice images in that Frame's memory cache for immediate navigation and display-setting repaint.

## File handles and source changes

Python closes TIFF, FITS, raster, video, and image-sequence handles as soon as the complete preview payload is delivered. Later Histogram, Measure, Header, processing, or rerender operations reopen the source only when needed. An opened file therefore does not remain locked against external overwrite.

A Frame represents the working copy loaded at open time. vivi does not continuously watch the source. Reopen a file to see disk changes. Recent payload reuse checks source identity first and reloads changed files.

## Memory and performance notes

- There is no stack preview-size or total-cache MiB ceiling. A complete stack constructs every slice and may simultaneously occupy compressed payload, raw TypedArray, colored canvas/image, and auxiliary-cache memory.
- `vivi.maxDecodedPixels` guards full-frame PNG/JPEG/BMP/GIF/video decoding; it is not a stack memory budget. TIFF/FITS usually use page or region access.
- Lossless compression often helps low-entropy data and may not help noise. Zstd level 1 favors speed; level 3 favors size.
- Compression often pays off when Remote SSH bandwidth is the bottleneck. On a fast local disk, compression CPU time can exceed transfer savings.
- Several files can load independently, but every complete stack still consumes its own worker, memory, and connection resources.

For diagnostics, run **vivi: Check Python Backend** and inspect **Output → vivi** for backend/transfer, local decode, and first-paint timings.
