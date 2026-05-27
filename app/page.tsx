'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import LiveMap from './components/LiveMap';

type Profile = {
  id: string;
  realName: string;
  phone: string;
  bio: string;
  locationLabel: string;
  avatarUrl: string;
};
type Coordinates = { lat: number; lng: number; accuracy?: number };
type Person = {
  id: string;
  realName: string;
  phone?: string;
  signal: string;
  bio: string;
  building: string;
  locationLabel: string;
  tags: string[];
  lat?: number;
  lng?: number;
  distanceMiles?: number | null;
  updatedAt?: number;
  avatarUrl?: string;
};
type Connection = {
  id: string;
  fromId: string;
  toId: string;
  fromName: string;
  fromPhone: string;
  toName: string;
  toPhone: string;
  message: string;
  createdAt: number;
};
type Chat = { id: string; fromId: string; toId: string; fromName: string; body: string; createdAt: number };
type Contact = { id: string; name: string; phone: string };
type Tab = 'home' | 'chat' | 'profile';

const PROFILE_KEY = 'norm-network-profile';
const LAST_LOCATION_KEY = 'norm-network-last-location';
const GLOBAL_RADIUS_MILES = 25000;

const defaultProfile: Profile = { id: '', realName: '', phone: '', bio: '', locationLabel: '', avatarUrl: '' };
const tabData: Array<{ id: Tab; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'chat', label: 'Chat' },
  { id: 'profile', label: 'Profile' }
];

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `norm-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}
function complete(profile: Profile) {
  return Boolean(profile.id && profile.realName.trim() && profile.phone.trim() && profile.bio.trim() && profile.locationLabel.trim());
}
function distanceText(miles?: number | null) {
  if (miles == null) return 'nearby';
  if (miles < 0.1) return 'right here';
  if (miles < 1) return `${Math.round(miles * 5280)} ft`;
  return `${miles.toFixed(1)} mi`;
}
function getPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Location not supported.'));
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy }),
      () => reject(new Error('Location blocked or timed out.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 45000 }
    );
  });
}
async function live<T>(payload: Record<string, unknown>) {
  const response = await fetch('/api/live', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store'
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Action failed');
  return data;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('home');
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [draftProfile, setDraftProfile] = useState<Profile>(defaultProfile);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [phoneGate, setPhoneGate] = useState('');
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [liveOn, setLiveOn] = useState(false);
  const [nearby, setNearby] = useState<Person[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Chat[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('OFF');
  const [error, setError] = useState('');
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const saved = window.localStorage.getItem(PROFILE_KEY);
    const savedLocation = window.localStorage.getItem(LAST_LOCATION_KEY);
    const next = saved ? { ...defaultProfile, ...(JSON.parse(saved) as Partial<Profile>) } : { ...defaultProfile, id: createId() };
    if (!next.id) next.id = createId();
    setProfile(next);
    setDraftProfile(next);
    setReady(complete(next));
    setPhoneGate(next.phone || '');
    if (next.phone) setSignedIn(true);
    if (savedLocation) {
      try { setLocation(JSON.parse(savedLocation) as Coordinates); } catch {}
    }
  }, []);

  useEffect(() => {
    if (!signedIn) return;

    (async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' });
        if (res.status === 401) return;
        const data = await res.json();
        const p = data?.profile;
        if (p) {
          const next = {
            ...defaultProfile,
            ...profile,
            realName: p.display_name || profile.realName,
            bio: p.bio || profile.bio,
            locationLabel: p.city || profile.locationLabel,
            avatarUrl: p.photo_url || profile.avatarUrl,
          };
          setProfile(next);
          setDraftProfile(next);
          setReady(complete(next));
        }

        if (!p?.display_name || !p?.city) {
          window.location.href = '/onboarding';
        }
      } catch {
        // local fallback
      }
    })();
  }, [signedIn]);

  const people = useMemo(() => nearby.filter((person) => person.id !== profile.id).slice(0, 50), [nearby, profile.id]);
  const contacts = useMemo<Contact[]>(() => {
    const map = new Map<string, Contact>();
    connections.forEach((item) => {
      const sender = item.fromId === profile.id;
      const id = sender ? item.toId : item.fromId;
      if (!id || id === profile.id) return;
      map.set(id, { id, name: sender ? item.toName : item.fromName, phone: sender ? item.toPhone : item.fromPhone });
    });
    return Array.from(map.values());
  }, [connections, profile.id]);

  function updateDraft<K extends keyof Profile>(key: K, value: Profile[K]) {
    setDraftProfile((current) => ({ ...current, [key]: value }));
  }
  function onAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') updateDraft('avatarUrl', reader.result);
    };
    reader.readAsDataURL(file);
  }
  async function saveProfile() {
    const next = { ...draftProfile, phone: draftProfile.phone || phoneGate, id: draftProfile.id || createId() };
    setProfile(next);
    setDraftProfile(next);
    setReady(complete(next));
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          realName: next.realName,
          bio: next.bio,
          locationLabel: next.locationLabel,
          avatarUrl: next.avatarUrl
        })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Profile sync failed');
      }
      setNotice('Profile saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile sync failed');
    }
  }
  function enterWithPhone() {
    const clean = phoneGate.trim();
    if (!clean) return;
    const next = { ...draftProfile, phone: clean, id: draftProfile.id || createId() };
    setDraftProfile(next);
    setProfile(next);
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    setSignedIn(true);
  }

  async function publish(nextLocation: Coordinates, _nextProfile = profile) {
    const locationResponse = await fetch('/api/location/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: nextLocation.lat, lng: nextLocation.lng, accuracy: nextLocation.accuracy ?? 0 }),
    });

    const locationData = await locationResponse.json().catch(() => ({}));
    if (!locationResponse.ok) throw new Error(locationData?.error || 'Location update failed');

    await fetch('/api/availability', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'open_connect', is_visible: true, expires_in_minutes: 60 }),
    });
  }
  async function refresh(nextLocation = location, nextProfile = profile) {
    if (!nextLocation || !nextProfile.id) return;
    const response = await fetch(`/api/discover?lat=${nextLocation.lat}&lng=${nextLocation.lng}`, { cache: 'no-store' });
    const data = (await response.json()) as { people?: Person[]; error?: string };
    if (!response.ok) throw new Error(data.error || 'Discover failed');
    setNearby(data.people || []);
  }
  async function refreshInbox(id = profile.id) {
    if (!id) return;
    const data = await live<{ requests?: Connection[] }>({ action: 'inbox', id });
    const rows = data.requests || [];
    rows.forEach((row) => { if (!seen.current.has(row.id)) seen.current.add(row.id); });
    setConnections(rows);
  }
  async function turnOn() {
    setBusy(true); setError('');
    try {
      if (!ready) throw new Error('Save profile first.');
      const nextLocation = await getPosition();
      setLocation(nextLocation); window.localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(nextLocation));
      await publish(nextLocation, profile); await refresh(nextLocation, profile); await refreshInbox(profile.id);
      setLiveOn(true); setNotice('ON');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not turn on.'); }
    finally { setBusy(false); }
  }
  async function turnOff() {
    setLiveOn(false); setNearby([]); setError(''); setNotice('OFF');
    if (profile.id) await live({ action: 'disconnect', id: profile.id }).catch(() => undefined);
  }
  async function toggle() { if (!ready) { setTab('profile'); return; } if (liveOn) await turnOff(); else await turnOn(); }

  async function connect(person: Person) {
    setError('');
    try {
      if (!ready) throw new Error('Save profile first.');
      const data = await live<{ connection: Connection }>({
        action: 'connect', fromId: profile.id, toId: person.id, fromName: profile.realName, fromPhone: profile.phone,
        fromBuilding: profile.bio, fromSignal: 'Builder', toName: person.realName, message: `${profile.realName} connected with you on Norm.`
      });
      setConnections((current) => [data.connection, ...current.filter((item) => item.id !== data.connection.id)]);
      setSelected({ id: person.id, name: person.realName, phone: data.connection.toPhone });
      setTab('chat');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not connect.'); }
  }
  async function send() {
    if (!selected || !draft.trim()) return;
    const body = draft.trim(); setDraft('');
    const data = await live<{ message: Chat }>({ action: 'chat:send', fromId: profile.id, toId: selected.id, fromName: profile.realName, body });
    setMessages((current) => [...current, data.message]);
  }

  useEffect(() => {
    if (!liveOn || !location || !profile.id || !ready) return;
    const interval = window.setInterval(() => { void publish(location, profile); void refresh(location, profile); void refreshInbox(profile.id); }, 7000);
    return () => window.clearInterval(interval);
  }, [liveOn, location, profile, ready]);

  useEffect(() => {
    if (!selected || !profile.id) return;
    const load = async () => {
      const data = await live<{ messages?: Chat[] }>({ action: 'chat:get', a: profile.id, b: selected.id });
      setMessages(data.messages || []);
    };
    void load();
    const interval = window.setInterval(() => void load(), 6000);
    return () => window.clearInterval(interval);
  }, [selected, profile.id]);

  if (!signedIn) {
    return (
      <main className='shell'>
        <section className='panel profilePanel' style={{ maxWidth: 520, margin: '80px auto' }}>
          <div className='sectionHeader'><h2>Sign up</h2></div>
          <div className='profileForm'>
            <label>Phone number
              <input value={phoneGate} onChange={(e) => setPhoneGate(e.target.value)} placeholder='Enter phone number' />
            </label>
            <button className='ghostButton' onClick={enterWithPhone}>Continue</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className='shell'>
      <header className='appHeader'>
        <div className='brandLockup'><div><span>Norm Network</span><strong>live social map</strong></div></div>
        <button className={`statusPill ${liveOn ? 'isLive' : ''}`} onClick={() => void toggle()}><span />{liveOn ? 'ON' : 'OFF'}</button>
      </header>
      {error && <section className='errorBanner'><strong>Heads up</strong><span>{error}</span></section>}

      {tab === 'home' && (
        <section className='tabPanel'>
          <div className='signalCard'><div className='signalIntro'><span className='eyebrow'>Home</span><h1>Go ON when you want to be seen.</h1><p>{notice}</p></div><button className={`powerButton ${liveOn ? 'isOn' : ''}`} onClick={() => void toggle()} disabled={busy}><strong>{busy ? '...' : liveOn ? 'On' : 'Off'}</strong></button></div>
          <div className='mapHero'><div><span className='eyebrow'>Map</span><h1>Anyone. Anywhere.</h1></div><button className='ghostButton' onClick={() => void refresh()} disabled={!location || busy}>Refresh</button></div>
          <div className='mapLayout'>
            <section className='panel mapPanel'><LiveMap selfLocation={location} people={people} isDiscoverable={liveOn} onSelectPerson={(person) => void connect(person)} /></section>
            <aside className='panel peoplePanel'><div className='sectionHeader'><div><span className='eyebrow'>Nearby</span><h2>{people.length ? 'People' : 'No one yet'}</h2></div></div><div className='peopleList'>{people.map((person) => <article className='personCard' key={person.id}><div className='personTop'><div style={{display:'flex',alignItems:'center',gap:10}}>{person.avatarUrl ? <img className='avatarPic' src={person.avatarUrl} alt={person.realName} /> : <div className='avatar'>{person.realName.slice(0,2).toUpperCase()}</div>}<h3>{person.realName}</h3></div><span>{distanceText(person.distanceMiles)}</span></div><p>{person.bio}</p><strong>{person.locationLabel}</strong><div className='personFooter'><button onClick={() => void connect(person)}>Connect</button></div></article>)}</div></aside>
          </div>
        </section>
      )}

      {tab === 'chat' && (
        <section className='tabPanel'><div className='connectionLayout'><section className='panel contactsPanel'><div className='sectionHeader'><h2>Contacts</h2></div>{contacts.length === 0 ? <p className='emptyText'>Connect from Home.</p> : <div className='contactList'>{contacts.map((contact) => <button className={`contactCard ${selected?.id === contact.id ? 'selected' : ''}`} key={contact.id} onClick={() => setSelected(contact)}><strong>{contact.name}</strong><span>{contact.phone}</span></button>)}</div>}</section><section className='panel chatPanel'><div className='sectionHeader'><h2>{selected ? selected.name : 'Select a contact'}</h2></div>{selected ? <><div className='chatMessages'>{messages.map((chat) => <div className={`chatBubble ${chat.fromId === profile.id ? 'mine' : ''}`} key={chat.id}><strong>{chat.fromName}</strong><span>{chat.body}</span></div>)}</div><div className='chatComposer'><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder='Type message...' onKeyDown={(event) => { if (event.key === 'Enter') void send(); }} /><button onClick={() => void send()}>Send</button></div></> : <p className='emptyText'>Pick a contact.</p>}</section></div></section>
      )}

      {tab === 'profile' && (
        <section className='tabPanel'><section className='panel profilePanel'><div className='sectionHeader'><h2>Profile</h2></div><div className='profileForm'>
          <div className='avatarUploader'>
            {draftProfile.avatarUrl ? <img className='avatarPreview' src={draftProfile.avatarUrl} alt='Profile' /> : <div className='avatarPlaceholder'>Photo</div>}
            <label className='ghostButton fileButton'>Upload photo<input type='file' accept='image/*' onChange={onAvatarUpload} style={{display:'none'}} /></label>
          </div>
          <label>Name<input value={draftProfile.realName} onChange={(event) => updateDraft('realName', event.target.value)} /></label>
          <label>Bio<textarea value={draftProfile.bio} onChange={(event) => updateDraft('bio', event.target.value)} rows={3} /></label>
          <label>Location<input value={draftProfile.locationLabel} onChange={(event) => updateDraft('locationLabel', event.target.value)} /></label>
          <button className='ghostButton' onClick={saveProfile}>Save</button>
        </div></section></section>
      )}

      <nav className='bottomTabs' aria-label='Primary tabs'>{tabData.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)} aria-current={tab === item.id ? 'page' : undefined}><strong>{item.label}</strong></button>)}</nav>
    </main>
  );
}
