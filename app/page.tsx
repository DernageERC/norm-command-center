'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import LiveMap from './components/LiveMap';

type SocialLinks = { instagram: string; x: string; linkedin: string; website: string };
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
  socials: SocialLinks;
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
};
type Connection = {
  id: string;
  fromId: string;
  toId: string;
  fromName: string;
  fromPhone: string;
  fromBuilding: string;
  fromSignal: string;
  fromSocials: Partial<SocialLinks>;
  toName: string;
  toPhone: string;
  message: string;
  createdAt: number;
};
type Chat = { id: string; fromId: string; toId: string; fromName: string; body: string; createdAt: number };
type Contact = { id: string; name: string; phone: string; building: string; signal: string };
type Tab = 'home' | 'chat' | 'profile';

const PROFILE_KEY = 'norm-network-profile';
const LAST_LOCATION_KEY = 'norm-network-last-location';
const emptySocials: SocialLinks = { instagram: '', x: '', linkedin: '', website: '' };
const defaultProfile: Profile = {
  id: '', realName: '', phone: '', bio: '', building: '', locationLabel: '', signal: 'Builder',
  tags: ['AI', 'Startups', 'Hardware'], radius: 5, cuesEnabled: true, socials: emptySocials
};
const tabData: Array<{ id: Tab; label: string; detail: string }> = [
  { id: 'home', label: 'Home', detail: 'Signal + Map' },
  { id: 'chat', label: 'Chat', detail: 'Connect + DM' },
  { id: 'profile', label: 'Profile', detail: 'Edit' }
];

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `norm-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}
function cleanTags(value: string | string[]) { const raw = Array.isArray(value) ? value : value.split(','); return raw.map((tag) => tag.trim()).filter(Boolean).slice(0, 8); }
function normalize(input: Partial<Profile>): Profile {
  return { ...defaultProfile, ...input, id: input.id || createId(), tags: Array.isArray(input.tags) ? cleanTags(input.tags) : defaultProfile.tags, radius: Number(input.radius) || 5, socials: { ...emptySocials, ...(input.socials || {}) } };
}
function complete(profile: Profile) { return Boolean(profile.id && profile.realName.trim() && profile.phone.trim() && profile.bio.trim() && profile.building.trim() && profile.locationLabel.trim()); }
function distanceText(miles?: number | null) { if (miles == null) return 'nearby'; if (miles < 0.1) return 'right here'; if (miles < 1) return `${Math.round(miles * 5280)} ft`; return `${miles.toFixed(1)} mi`; }
function timeText(timestamp?: number) { if (!timestamp) return 'new'; const minutes = Math.floor(Math.max(1, Date.now() - timestamp) / 60000); return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`; }
function getPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('This browser does not support location yet.'));
    navigator.geolocation.getCurrentPosition((position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy }), () => reject(new Error('Location permission was blocked or timed out.')), { enableHighAccuracy: true, timeout: 10000, maximumAge: 45000 });
  });
}
async function live<T>(payload: Record<string, unknown>) {
  const response = await fetch('/api/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), cache: 'no-store' });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Norm action failed.');
  return data;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('home');
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [ready, setReady] = useState(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [liveOn, setLiveOn] = useState(false);
  const [nearby, setNearby] = useState<Person[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Chat[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('Go private by default. Turn ON when you want to network.');
  const [error, setError] = useState('');
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const saved = window.localStorage.getItem(PROFILE_KEY);
    const savedLocation = window.localStorage.getItem(LAST_LOCATION_KEY);
    setProfile(saved ? normalize(JSON.parse(saved) as Partial<Profile>) : { ...defaultProfile, id: createId() });
    if (savedLocation) { try { setLocation(JSON.parse(savedLocation) as Coordinates); } catch {} }
  }, []);
  useEffect(() => { if (profile.id) window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); setReady(complete(profile)); }, [profile]);

  const people = useMemo(() => nearby.filter((person) => person.id !== profile.id).slice(0, 20), [nearby, profile.id]);
  const contacts = useMemo<Contact[]>(() => {
    const map = new Map<string, Contact>();
    connections.forEach((item) => {
      const sender = item.fromId === profile.id;
      const id = sender ? item.toId : item.fromId;
      if (!id || id === profile.id) return;
      map.set(id, { id, name: sender ? item.toName : item.fromName, phone: sender ? item.toPhone : item.fromPhone, building: sender ? 'Connected through Norm' : item.fromBuilding, signal: sender ? 'Connection' : item.fromSignal });
    });
    return Array.from(map.values());
  }, [connections, profile.id]);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) { setProfile((current) => ({ ...current, [key]: value })); }
  function updateSocial(key: keyof SocialLinks, value: string) { setProfile((current) => ({ ...current, socials: { ...current.socials, [key]: value } })); }
  async function publish(nextLocation: Coordinates, nextProfile = profile) { await live({ action: 'publish', ...nextProfile, lat: nextLocation.lat, lng: nextLocation.lng }); }
  async function refresh(nextLocation = location, nextProfile = profile) {
    if (!nextLocation || !nextProfile.id) return;
    const data = await live<{ people?: Person[] }>({ action: 'nearby', lat: nextLocation.lat, lng: nextLocation.lng, radius: nextProfile.radius, exclude: nextProfile.id });
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
      if (!ready) throw new Error('Complete profile first.');
      const nextLocation = await getPosition();
      setLocation(nextLocation); window.localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(nextLocation));
      await publish(nextLocation, profile); await refresh(nextLocation, profile); await refreshInbox(profile.id);
      setLiveOn(true); setNotice('You are ON. Nearby entrepreneurs can find your signal.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not turn on.'); }
    finally { setBusy(false); }
  }
  async function turnOff() { setLiveOn(false); setNearby([]); setError(''); setNotice('You are OFF. Hidden from discovery.'); if (profile.id) await live({ action: 'disconnect', id: profile.id }).catch(() => undefined); }
  async function toggle() { if (!ready) { setTab('profile'); setNotice('Finish Profile first, then turn ON from Home.'); return; } if (liveOn) await turnOff(); else await turnOn(); }
  async function connect(person: Person) {
    setError('');
    try {
      if (!ready) throw new Error('Complete your profile before connecting.');
      const data = await live<{ connection: Connection }>({ action: 'connect', fromId: profile.id, toId: person.id, fromName: profile.realName, fromPhone: profile.phone, fromBuilding: profile.building, fromSignal: profile.signal, fromSocials: profile.socials, toName: person.realName, message: `${profile.realName} connected with you on Norm.` });
      setConnections((current) => [data.connection, ...current.filter((item) => item.id !== data.connection.id)]);
      setSelected({ id: person.id, name: person.realName, phone: data.connection.toPhone, building: person.building, signal: person.signal });
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
    const load = async () => { const data = await live<{ messages?: Chat[] }>({ action: 'chat:get', a: profile.id, b: selected.id }); setMessages(data.messages || []); };
    void load(); const interval = window.setInterval(() => void load(), 6000); return () => window.clearInterval(interval);
  }, [selected, profile.id]);

  return (
    <main className='shell'>
      <header className='appHeader'>
        <div className='brandLockup'><div><span>Norm Network</span><strong>social map for entrepreneurs</strong></div></div>
        <button className={`statusPill ${liveOn ? 'isLive' : ''}`} onClick={() => void toggle()}><span />{liveOn ? 'ON' : 'OFF'}</button>
      </header>
      {error && <section className='errorBanner'><strong>Heads up</strong><span>{error}</span></section>}

      {tab === 'home' && (
        <section className='tabPanel'>
          <div className='signalCard'><div className='signalIntro'><span className='eyebrow'>Home</span><h1>Turn your location ON only when you choose.</h1><p>{notice}</p></div><button className={`powerButton ${liveOn ? 'isOn' : ''}`} onClick={() => void toggle()} disabled={busy}><strong>{busy ? '...' : liveOn ? 'On' : 'Off'}</strong></button></div>
          <div className='mapHero'><div><span className='eyebrow'>Map</span><h1>See who is nearby and connect.</h1></div><button className='ghostButton' onClick={() => void refresh()} disabled={!location || busy}>Refresh</button></div>
          <div className='mapLayout'>
            <section className='panel mapPanel'><LiveMap selfLocation={location} people={people} isDiscoverable={liveOn} onSelectPerson={(person) => void connect(person)} /></section>
            <aside className='panel peoplePanel'><div className='sectionHeader'><div><span className='eyebrow'>Nearby</span><h2>{people.length ? 'People around you' : 'No live signals yet'}</h2></div></div><div className='peopleList'>{people.map((person) => <article className='personCard' key={person.id}><div className='personTop'><h3>{person.realName}</h3><span>{person.signal} • {distanceText(person.distanceMiles)}</span></div><p>{person.bio}</p><strong>{person.building}</strong><div className='personFooter'><span>{timeText(person.updatedAt)}</span><button onClick={() => void connect(person)}>Connect</button></div></article>)}</div></aside>
          </div>
        </section>
      )}

      {tab === 'chat' && (
        <section className='tabPanel'><div className='connectionLayout'><section className='panel contactsPanel'><div className='sectionHeader'><h2>Contacts</h2></div>{contacts.length === 0 ? <p className='emptyText'>Connect from Home first.</p> : <div className='contactList'>{contacts.map((contact) => <button className={`contactCard ${selected?.id === contact.id ? 'selected' : ''}`} key={contact.id} onClick={() => setSelected(contact)}><strong>{contact.name}</strong><span>{contact.signal}</span></button>)}</div>}</section><section className='panel chatPanel'><div className='sectionHeader'><h2>{selected ? selected.name : 'Select a contact'}</h2></div>{selected ? <><div className='chatMessages'>{messages.map((chat) => <div className={`chatBubble ${chat.fromId === profile.id ? 'mine' : ''}`} key={chat.id}><strong>{chat.fromName}</strong><span>{chat.body}</span></div>)}</div><div className='chatComposer'><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder='Message...' onKeyDown={(event) => { if (event.key === 'Enter') void send(); }} /><button onClick={() => void send()}>Send</button></div></> : <p className='emptyText'>Choose a contact to chat.</p>}</section></div></section>
      )}

      {tab === 'profile' && (
        <section className='tabPanel'><section className='panel profilePanel'><div className='sectionHeader'><h2>Edit profile</h2></div><div className='profileForm'><label>Real name<input value={profile.realName} onChange={(event) => update('realName', event.target.value)} /></label><label>Direct contact<input value={profile.phone} onChange={(event) => update('phone', event.target.value)} /></label><label>What are you building?<textarea value={profile.building} onChange={(event) => update('building', event.target.value)} rows={3} /></label><label>Bio<textarea value={profile.bio} onChange={(event) => update('bio', event.target.value)} rows={3} /></label><label>Location label<input value={profile.locationLabel} onChange={(event) => update('locationLabel', event.target.value)} /></label><div className='formSplit'><label>Signal<select value={profile.signal} onChange={(event) => update('signal', event.target.value)}><option>Builder</option><option>Founder</option><option>Developer</option><option>Designer</option><option>Investor</option></select></label><label>Radius<select value={profile.radius} onChange={(event) => update('radius', Number(event.target.value))}><option value={1}>1 mile</option><option value={5}>5 miles</option><option value={10}>10 miles</option><option value={25}>25 miles</option></select></label></div><label>Tags<input value={profile.tags.join(', ')} onChange={(event) => update('tags', cleanTags(event.target.value))} /></label><div className='socialGrid'><label>Instagram<input value={profile.socials.instagram} onChange={(event) => updateSocial('instagram', event.target.value)} /></label><label>X<input value={profile.socials.x} onChange={(event) => updateSocial('x', event.target.value)} /></label><label>LinkedIn<input value={profile.socials.linkedin} onChange={(event) => updateSocial('linkedin', event.target.value)} /></label><label>Website<input value={profile.socials.website} onChange={(event) => updateSocial('website', event.target.value)} /></label></div></div></section></section>
      )}

      <nav className='bottomTabs' aria-label='Primary tabs'>{tabData.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)} aria-current={tab === item.id ? 'page' : undefined}><strong>{item.label}</strong><span>{item.detail}</span></button>)}</nav>
    </main>
  );
}
