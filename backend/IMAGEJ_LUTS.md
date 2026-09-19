# ImageJ LUT tables

`imagej_luts.npz` contains the 68 lookup tables from the [ImageJ LUT archive](https://imagej.net/ij/download/luts/luts.zip), downloaded on 2026-09-19. Each table is stored as an exact 256 × 3 RGB byte array. `imagej_luts_manifest.json` records their menu names. The ImageJ 1.x [license and disclaimer](https://github.com/imagej/ImageJ/blob/master/LICENSE.txt) describes ImageJ as public domain; attribution is retained here for the LUT archive.

The original `.lut` files use planar RGB bytes (768 bytes), an ImageJ ICOL header plus 768 bytes (800 bytes), or 256 lines of RGB text. The array conversion preserves the byte values and file names. vivi also offers ImageJ's programmatic built-in LUT choices and its earlier custom color maps.
