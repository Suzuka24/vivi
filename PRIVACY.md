# Privacy and data handling

vivi does not operate a project-owned cloud service, require an account, or contain telemetry code. It does not send your images to a vivi server.

## Image and path processing

The extension host reads directory entries and starts a local Python worker. With Remote SSH, both run on the remote host; source-dtype pixel bytes, metadata, and analysis results cross the editor's existing SSH connection to the client. Pixel bytes are sent directly or reversibly compressed according to `vivi.losslessCompression`. Opening a PNG/JPEG or some video files may decode the complete frame on the host; TIFF/FITS can use region reads where supported. Copying a displayed image to the clipboard or exporting a result is an action you control.

## Local state and temporary files

The editor stores vivi settings in its normal configuration and remembers the Explorer path, history, sorting, and hidden-file preference in workspace state. Stack slices are preloaded into client memory without a configured cache budget and may use substantial memory. Operations that produce image data can create temporary TIFF or preview files in the extension host's operating-system temporary directory. The extension removes session-managed generated files when that viewing session closes where possible; a crash or abrupt termination can leave temporary files that must be cleaned up separately. Source images are not modified by display adjustments or in-Frame transforms; Explorer Rename and Delete explicitly change files on the host when you invoke them.

## Network and dependencies

vivi itself has no independent network endpoint. The editor and its extension marketplace may use their own network services, and Remote SSH sends previews over the connection you already established. Installing Python dependencies contacts the package index configured for `pip`. Read your editor's and organization's policies for those services.
