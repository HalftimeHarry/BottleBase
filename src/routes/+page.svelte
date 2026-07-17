<script lang="ts">
	import { goto } from '$app/navigation';

	type ModalType = 'none' | 'register' | 'login';

		let activeModal = $state<ModalType>('none');
		let modalMessage = $state('');
		let modalError = $state('');
		let loading = $state(false);

		let registerName = $state('');
		let registerEmail = $state('');
		let registerPassword = $state('');

		let loginEmail = $state('');
		let loginPassword = $state('');

	function openModal(type: Exclude<ModalType, 'none'>): void {
		activeModal = type;
		modalMessage = '';
		modalError = '';
	}

	function closeModal(): void {
		activeModal = 'none';
		modalMessage = '';
		modalError = '';
	}

	async function submitRegister(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		loading = true;
		modalError = '';
		modalMessage = '';

		try {
			const response = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name: registerName,
					email: registerEmail,
					password: registerPassword
				})
			});

			const payload = (await response.json().catch(() => ({}))) as { message?: string };

			if (!response.ok) {
				modalError = payload.message ?? 'Unable to create account.';
				return;
			}

			registerName = '';
			registerEmail = '';
			registerPassword = '';
			await goto('/dashboard');
		} catch {
			modalError = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function submitLogin(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		loading = true;
		modalError = '';
		modalMessage = '';

		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					email: loginEmail,
					password: loginPassword
				})
			});

			const payload = (await response.json().catch(() => ({}))) as { message?: string };

			if (!response.ok) {
				modalError = payload.message ?? 'Unable to sign in.';
				return;
			}

			loginEmail = '';
			loginPassword = '';
			await goto('/dashboard');
		} catch {
			modalError = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<main class="landing-shell">
	<section class="landing-card">
		<img class="primary-logo" src="/logos/bb_logo_primary.png" alt="BottleBase logo" />

		<h1>Know Every Bottle. Serve With Confidence.</h1>
		<p class="subtitle">
			A visual bottle reference platform for bartenders with fast search, beautiful imagery, and
			optional inventory by bar.
		</p>

		<div class="action-row">
			<button class="button gold" type="button" onclick={() => openModal('register')}>
				Create Account
			</button>
			<button class="button ink" type="button" onclick={() => openModal('login')}>
				Sign In
			</button>
		</div>

		<div class="feature-row" aria-label="Key features">
			<span>Fast Bottle Search</span>
			<span>Multi-Bar Ready</span>
			<span>Par-Level Tracking</span>
		</div>
	</section>

	{#if activeModal !== 'none'}
		<div class="modal-backdrop" role="presentation" onclick={closeModal}></div>
		<section class="modal" role="dialog" aria-modal="true">
			<button class="close" type="button" aria-label="Close" onclick={closeModal}>×</button>

			{#if activeModal === 'register'}
				<h2>Create Your Account</h2>
				<form onsubmit={submitRegister}>
					<label>
						Name
						<input bind:value={registerName} required minlength="2" />
					</label>
					<label>
						Email
						<input bind:value={registerEmail} type="email" required />
					</label>
					<label>
						Password
						<input bind:value={registerPassword} type="password" required minlength="8" />
					</label>
					<button class="button gold" type="submit" disabled={loading}>
						{loading ? 'Creating...' : 'Create Account'}
					</button>
				</form>
			{/if}

			{#if activeModal === 'login'}
				<h2>Welcome Back</h2>
				<form onsubmit={submitLogin}>
					<label>
						Email
						<input bind:value={loginEmail} type="email" required />
					</label>
					<label>
						Password
						<input bind:value={loginPassword} type="password" required />
					</label>
					<button class="button gold" type="submit" disabled={loading}>
						{loading ? 'Signing in...' : 'Sign In'}
					</button>
				</form>
			{/if}

			{#if modalError}
				<p class="feedback error">{modalError}</p>
			{/if}
			{#if modalMessage}
				<p class="feedback success">{modalMessage}</p>
			{/if}
		</section>
	{/if}
</main>

<style>
	.landing-shell {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 1rem;
	}

	.landing-card {
		width: min(56rem, 100%);
		background: color-mix(in srgb, var(--bb-card) 90%, white 10%);
		padding: clamp(1rem, 4vw, 2.4rem);
		border-radius: 1.25rem;
		box-shadow: 0 24px 52px rgba(20, 15, 10, 0.28);
		text-align: center;
		animation: rise 420ms ease-out both;
	}

	.primary-logo {
		width: min(35rem, 100%);
		height: auto;
		margin: 0 auto 1rem;
		display: block;
		border-radius: 1rem;
	}

	h1 {
		font-size: clamp(1.4rem, 4vw, 2.2rem);
		line-height: 1.12;
		font-weight: 800;
		margin: 0;
	}

	.subtitle {
		margin: 0.85rem auto 0;
		max-width: 48ch;
		line-height: 1.5;
	}

	.action-row {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: 1.2rem;
	}

	.feature-row {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 1rem;
	}

	.feature-row span {
		border: 1px solid color-mix(in srgb, var(--bb-accent) 40%, transparent 60%);
		padding: 0.36rem 0.62rem;
		border-radius: 999px;
		font-size: 0.84rem;
		font-weight: 700;
	}

	.button {
		border: 0;
		border-radius: 0.68rem;
		padding: 0.62rem 1rem;
		font-weight: 700;
		cursor: pointer;
	}

	.button:disabled {
		opacity: 0.7;
		cursor: wait;
	}

	.button.gold {
		background: linear-gradient(135deg, #d08a22, #f2bc4a);
		color: #17130f;
	}

	.button.ink {
		background: #111522;
		color: #f8f3e8;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(8, 10, 18, 0.66);
	}

	.modal {
		position: fixed;
		inset: 50% auto auto 50%;
		transform: translate(-50%, -50%);
		width: min(28rem, calc(100vw - 2rem));
		background: #fdf8ee;
		border-radius: 1rem;
		padding: 1rem;
		box-shadow: 0 22px 50px rgba(0, 0, 0, 0.32);
	}

	.modal h2 {
		margin: 0 0 0.65rem;
		font-size: 1.35rem;
	}

	form {
		display: grid;
		gap: 0.65rem;
	}

	label {
		display: grid;
		gap: 0.3rem;
		text-align: left;
		font-size: 0.92rem;
		font-weight: 600;
	}

	input {
		width: 100%;
		border: 1px solid #d1c1a4;
		border-radius: 0.58rem;
		padding: 0.55rem 0.6rem;
		font: inherit;
		background: white;
	}

	.feedback {
		margin-top: 0.65rem;
		font-size: 0.9rem;
	}

	.feedback.error {
		color: #9f271f;
	}

	.feedback.success {
		color: #12613a;
	}

	.close {
		position: absolute;
		top: 0.5rem;
		right: 0.55rem;
		border: 0;
		background: transparent;
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
