import { path } from './deps.ts';

export const SidecarExts = ['.exif', '.exv', '.mie', '.xmp'];

export function isSidecarExt(filename: string) {
	const p = path.parse(filename);
	return SidecarExts.includes(String(p.ext).toLowerCase());
}
