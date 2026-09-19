"""Rebuild the small, deterministic read-only image regression corpus."""
from pathlib import Path
import numpy as np
from PIL import Image
from astropy.io import fits
import tifffile

out = Path(__file__).with_name('fixtures')
out.mkdir(exist_ok=True)
y, x = np.mgrid[:24, :32]
base = (x + 32 * y).astype(np.uint16)
Image.fromarray((base % 256).astype(np.uint8)).save(out / 'gray.png')
rgb = np.stack(((x * 8).astype('uint8'), (y * 10).astype('uint8'), np.full_like(x, 64, dtype='uint8')), axis=-1)
Image.fromarray(rgb, 'RGB').save(out / 'color.jpg', quality=95)
tifffile.imwrite(out / 'plain.tif', base)
tifffile.imwrite(out / 'stack.tiff', np.stack([base + 1000 * i for i in range(3)]), metadata={'axes': 'TYX'})
hyper = np.stack([base + 1000 * t + 100 * z for t in range(2) for z in range(3)]).reshape(2, 3, 24, 32)
tifffile.imwrite(out / 'hyperstack.tif', hyper, metadata={'axes': 'TZYX'}, compression='deflate', tile=(16, 16))
# Large enough to exercise the overview plus detailed-region panning path.
large_y, large_x = np.ogrid[:1800, :2400]
large = ((large_x // 40 + large_y // 40) % 2 * 160 + large_x // 200 + large_y // 150).astype('uint8')
tifffile.imwrite(out / 'pan-large.tif', large, compression='deflate', tile=(256, 256))
fits.HDUList([fits.PrimaryHDU(base.astype('int16')), fits.ImageHDU((base + 100).astype('int16'), name='SECOND')]).writeto(out / 'multi-hdu.fits', overwrite=True)
fits.PrimaryHDU(np.stack([base.astype('float32') + i * 100 for i in range(4)])).writeto(out / 'cube.fits', overwrite=True)

# Four-dimensional FITS: flattening must preserve the other non-spatial axis.
fits.PrimaryHDU(np.stack([np.stack([base.astype("float32") + 1000*t + 100*z for z in range(3)]) for t in range(2)])).writeto(out / "four-axis.fits", overwrite=True)
