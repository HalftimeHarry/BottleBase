export class DomainError extends Error {
	public readonly name = 'DomainError';

	public constructor(message: string) {
		super(message);
	}
}
