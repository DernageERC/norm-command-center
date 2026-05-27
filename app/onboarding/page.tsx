'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ display_name: name, bio, city }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Save failed');
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className='shell'>
      <section className='panel'>
        <h1>Set your profile</h1>
        <p>Quick setup. Keep it simple.</p>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Bio<input value={bio} onChange={(e) => setBio(e.target.value)} /></label>
        <label>Location<input value={city} onChange={(e) => setCity(e.target.value)} /></label>
        {error ? <p>{error}</p> : null}
        <button className='ghostButton' disabled={loading || !name || !city} onClick={save}>{loading ? 'Saving...' : 'Save'}</button>
      </section>
    </main>
  );
}
