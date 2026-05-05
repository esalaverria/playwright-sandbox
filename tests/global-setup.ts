async function waitForReady(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${url}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

export default async function globalSetup() {
  const base = process.env.BASE_URL ?? 'http://localhost:3000';
  await waitForReady(`${base.replace(/\/$/, '')}/api/health`, 120_000);
}
