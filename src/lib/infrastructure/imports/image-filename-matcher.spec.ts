import { describe, expect, it } from 'vitest';
import { ImageFilenameMatcher } from './image-filename-matcher';

describe('ImageFilenameMatcher', () => {
	it('filters out food and dessert images', () => {
		const matcher = new ImageFilenameMatcher();
		const result = matcher.filterBottleImages([
			'Campari.png',
			'food-special.png',
			'dessert-menu.jpg',
			'desert-item.webp',
			'not-image.txt'
		]);

		expect(result).toEqual(['Campari.png']);
	});

	it('matches bottle slug using normalized filename', () => {
		const matcher = new ImageFilenameMatcher();
		const image = matcher.findImageForSlug('remy-martin-vsop', [
			'Remy Martin VSOP.png',
			'Dessert Pairing Guide.png'
		]);

		expect(image).toBe('Remy Martin VSOP.png');
	});
});
