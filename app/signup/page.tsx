'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

const PROFILE_KEY = 'norm-network-profile';

type Profile = {
  id: string;
  realName: string;
  phone: string;
  bio: string;
  building: string;
  locationLabel: string;
  signal: string;
  tags: string[];
  radius: number;
  cuesEnabled: boolean;
  socials: {
    instagram: string;
    x: string;
    linkedin: string;
    website: string;
  };
};

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `norm-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function cleanTags(value: string) {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 8);
}

const emptyProfile: Profile = {
  id: '',
  realName: '',
  phone: '',
  bio: '',
  building: '',
  locationLabel: '',
  signal: 'Builder',
  tags: ['AI', 'Startups', 'Hardware'],
  radius: 5,
  cuesEnabled: true,
  socials: {
    instagram: '',
    x: '',
    linkedin: '',
    website: ''
  }
};

export default function SignupPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [tags, setTags] = useState('AI, Startups, Hardware');
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem(PROFILE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Partial<Profile>;
      const next = {
        ...emptyProfile,
        ...parsed,
        id: parsed.id || createId(),
        socials: { ...emptyProfile.socials, ...(parsed.socials || {}) }
      };
      setProfile(next);
      setTags((next.tags || []).join(', '));
    } catch {
      window.localStorage.removeItem(PROFILE_KEY);
    }
  }, []);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function updateSocial(key: keyof Profile['socials'], value: string) {
    setProfile((current) => ({ ...current, socials: { ...current.socials, [key]: value } }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!profile.realName.trim() || !profile.phone.trim() || !profile.bio.trim() || !profile.building.trim() || !profile.locationLabel.trim()) {
      setError('Real name, phone, bio, what you are building, and location are required.');
      return;
    }

    const next: Profile = {
      ...profile,
      id: profile.id || createId(),
      tags: cleanTags(tags)
    };

    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    router.push('/');
  }

  return (
    <main className='signupShell'>
      <section className='signupCard'>
        <Link className='backLink' href='/'>← Back to Norm</Link>
        <div className='eyebrow'>Create signal</div>
        <h1>Join Norm Network</h1>
        <p className='signupIntro'>This is your real-world signal. When you turn location on, nearby builders can request to connect. Connecting shares phone numbers.</p>

        <form onSubmit={submit} className='signupForm'>
          <label>Real name<input value={profile.realName} onChange={(event) => update('realName', event.target.value)} placeholder='Darren Luntsford' /></label>
          <label>Phone number<input value={profile.phone} onChange={(event) => update('phone', event.target.value)} placeholder='+1 555 123 4567' /></label>
          <label>What are you building?<textarea value={profile.building} onChange={(event) => update('building', event.target.value)} rows={3} placeholder='Norm Network, a real-world proximity layer for builders.' /></label>
          <label>Bio<textarea value={profile.bio} onChange={(event) => update('bio', event.target.value)} rows={3} placeholder='Founder, creator, hardware/AI explorer...' /></label>
          <label>Location label<input value={profile.locationLabel} onChange={(event) => update('locationLabel', event.target.value)} placeholder='Miami, hotel lobby, coffee shop, Tech Week...' /></label>
          <label>Signal type<select value={profile.signal} onChange={(event) => update('signal', event.target.value)}>
            <option>Builder</option><option>Founder</option><option>Developer</option><option>Designer</option><option>Hardware</option><option>AI Creative</option><option>Investor</option><option>Operator</option><option>Local Explorer</option>
          </select></label>
          <label>Tags<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder='AI, hardware, startups' /></label>

          <div className='signupSocialGrid'>
            <label>Instagram<input value={profile.socials.instagram} onChange={(event) => updateSocial('instagram', event.target.value)} placeholder='@username' /></label>
            <label>X / Twitter<input value={profile.socials.x} onChange={(event) => updateSocial('x', event.target.value)} placeholder='@username' /></label>
            <label>LinkedIn<input value={profile.socials.linkedin} onChange={(event) => updateSocial('linkedin', event.target.value)} placeholder='linkedin.com/in/...' /></label>
            <label>Website<input value={profile.socials.website} onChange={(event) => updateSocial('website', event.target.value)} placeholder='https://...' /></label>
          </div>

          <label>Discovery radius<select value={profile.radius} onChange={(event) => update('radius', Number(event.target.value))}>
            <option value={1}>1 mile</option><option value={5}>5 miles</option><option value={10}>10 miles</option><option value={25}>25 miles</option>
          </select></label>

          {error && <p className='formError'>{error}</p>}

          <button className='primaryButton' type='submit'>Save profile</button>
          <p className='consentNote'>By saving, you understand that tapping connect is designed to share phone numbers with the other person.</p>
        </form>
      </section>
    </main>
  );
}
