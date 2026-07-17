export class ImageFilenameMatcher {
	private static readonly blockedKeywords = ['food', 'dessert', 'desert'];
	private static readonly supportedExtensions = ['png', 'jpg', 'jpeg', 'webp'];

	public filterBottleImages(imageFilenames: readonly string[]): string[] {
		return imageFilenames.filter((filename) => this.isBottleImage(filename));
	}

	public findImageForSlug(slug: string, imageFilenames: readonly string[]): string | null {
		const normalizedSlug = this.normalize(slug);
		for (const filename of this.filterBottleImages(imageFilenames)) {
			const stem = this.normalize(filename.replace(/\.[^.]+$/, ''));
			if (stem === normalizedSlug) {
				return filename;
			}
		}
		return null;
	}

	private isBottleImage(filename: string): boolean {
		const extension = filename.split('.').pop()?.toLowerCase() ?? '';
		if (!ImageFilenameMatcher.supportedExtensions.includes(extension)) {
			return false;
		}

		const normalizedName = filename.toLowerCase();
		return !ImageFilenameMatcher.blockedKeywords.some((keyword) => normalizedName.includes(keyword));
	}

	private normalize(value: string): string {
		return value.toLowerCase().replace(/[^a-z0-9]/g, '');
	}
}
