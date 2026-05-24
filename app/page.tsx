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
type Chat = { id: string; conversationId: string; fromId: string; toId: string; fromName: string; body: string; createdAt: number };
type Contact = { id: string; name: string; phone: string; building: string; signal: string };
type Tab = 'home' | 'map' | 'connections';

const PROFILE_KEY = 'norm-network-profile';
const LAST_LOCATION_KEY = 'norm-network-last-location';
const emptySocials: SocialLinks = { instagram: '', x: '', linkedin: '', website: '' };
const defaultProfile: Profile = {
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
  socials: emptySocials
};
const tabData: Array<{ id: Tab; label: string; detail: string }> = [
  { id: 'home', label: 'Home', detail: 'Signal' },
  { id: 'map', label: 'Map', detail: 'Connect' },
  { id: 'connections', label: 'Connections', detail: 'Chat / Profile' }
];

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `norm-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}
function cleanTags(value: string | string[]) {
  const raw = Array.isArray(value) ? value : value.split(',');
  return raw.map((tag) => tag.trim()).filter(Boolean).slice(0, 8);
}
function normalize(input: Partial<Profile> & { name?: string; status?: string }): Profile {
  return {
    ...defaultProfile,
    ...input,
    id: input.id || createId(),
    realName: input.realName || input.name || '',
    building: input.building || input.status || '',
    tags: Array.isArray(input.tags) ? cleanTags(input.tags) : defaultProfile.tags,
    radius: Number(input.radius) || 5,
    socials: { ...emptySocials, ...(input.socials || {}) }
  };
}
function complete(profile: Profile) {
  return Boolean(profile.id && profile.realName.trim() && profile.phone.trim() && profile.bio.trim() && profile.building.trim() && profile.locationLabel.trim());
}
function distanceText(miles?: number | null) {
  if (miles === null || miles === undefined) return 'nearby';
  if (miles < 0.1) return 'right here';
  if (miles < 1) return `${Math.round(miles * 5280)} ft`;
  return `${miles.toFixed(1)} mi`;
}
function timeText(timestamp?: number) {
  if (!timestamp) return 'new';
  const minutes = Math.floor(Math.max(1, Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}
function getPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('This browser does not support location yet.'));
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy }),
      () => reject(new Error('Location permission was blocked or timed out.')),
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
  if (!response.ok) throw new Error(data.error || 'Norm action failed.');
  return data;
}
function PenroseLogo() {
  return (
    <svg className='penroseLogo' viewBox='0 0 100 88' aria-hidden='true'>
      <path className='penroseWhite' d='M50 4 96 82H75L50 39 25 82H4L50 4Z' />
      <path className='penroseBlack' d='M50 29 73 68H62L50 49 38 68H27L50 29Z' />
      <path className='penroseCut' d='M50 4 63 25 29 82H4L50 4Z' />
      <path className='penroseStroke' d='M50 4 96 82H75L50 39 25 82H4L50 4Z' />
    </svg>
  );
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
  const [notice, setNotice] = useState('Private by default. Turn on when you are ready to be found.');
  const [error, setError] = useState('');
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const saved = window.localStorage.getItem(PROFILE_KEY);
    const savedLocation = window.localStorage.getItem(LAST_LOCATION_KEY);
    if (saved) {
      try {
        const next = normalize(JSON.parse(saved) as Partial<Profile>);
        setProfile(next);
        setReady(complete(next));
      } catch {
        window.localStorage.removeItem(PROFILE_KEY);
        setProfile({ ...defaultProfile, id: createId() });
      }
    } else {
      setProfile({ ...defaultProfile, id: createId() });
    }
    if (savedLocation) {
      try { setLocation(JSON.parse(savedLocation) as Coordinates); } catch { window.localStorage.removeItem(LAST_LOCATION_KEY); }
    }
  }, []);

  useEffect(() => {
    if (profile.id) window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setReady(complete(profile));
  }, [profile]);

  const people = useMemo(() => nearby.filter((person) => person.id !== profile.id).slice(0, 20), [nearby, profile.id]);
  const contacts = useMemo<Contact[]>(() => {
    const map = new Map<string, Contact>();
    connections.forEach((item) => {
      const sender = item.fromId === profile.id;
      const id = sender ? item.toId : item.fromId;
      if (!id || id === profile.id) return;
      map.set(id, {
        id,
        name: sender ? item.toName : item.fromName,
        phone: sender ? item.toPhone : item.fromPhone,
        building: sender ? 'Connected through Norm' : item.fromBuilding,
        signal: sender ? 'Connection' : item.fromSignal
      });
    });
    return Array.from(map.values());
  }, [connections, profile.id]);
  const missing = [
    profile.realName.trim() ? '' : 'name',
    profile.phone.trim() ? '' : 'contact',
    profile.bio.trim() ? '' : 'bio',
    profile.building.trim() ? '' : 'build',
    profile.locationLabel.trim() ? '' : 'location'
  ].filter(Boolean);
  const completion = Math.round(((5 - missing.length) / 5) * 100);
  const socials = Object.entries(profile.socials).filter(([, value]) => value);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }
  function updateSocial(key: keyof SocialLinks, value: string) {
    setProfile((current) => ({ ...current, socials: { ...current.socials, [key]: value } }));
  }
  function cue(title: string, body?: string) {
    if (profile.cuesEnabled && 'vibrate' in navigator) navigator.vibrate([55, 45, 55]);
    if (profile.cuesEnabled && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body: body || 'Norm Network' }); } catch {}
    }
  }
  async function enableCues() {
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    setProfile((current) => ({ ...current, cuesEnabled: true }));
    cue('Norm cues enabled');
  }
  async function publish(nextLocation: Coordinates, nextProfile = profile) {
    await live<{ ok: boolean }>({
      action: 'publish',
      id: nextProfile.id,
      realName: nextProfile.realName,
      phone: nextProfile.phone,
      bio: nextProfile.bio,
      building: nextProfile.building,
      locationLabel: nextProfile.locationLabel,
      signal: nextProfile.signal,
      tags: nextProfile.tags,
      socials: nextProfile.socials,
      radius: nextProfile.radius,
      lat: nextLocation.lat,
      lng: nextLocation.lng
    });
  }
  async function refresh(nextLocation = location, nextProfile = profile) {
    if (!nextLocation || !nextProfile.id) return;
    const data = await live<{ people?: Person[] }>({
      action: 'nearby',
      lat: nextLocation.lat,
      lng: nextLocation.lng,
      radius: nextProfile.radius,
      exclude: nextProfile.id
    });
    setNearby(data.people || []);
  }
  async function refreshInbox(id = profile.id) {
    if (!id) return;
    const data = await live<{ requests?: Connection[] }>({ action: 'inbox', id });
    const rows = data.requests || [];
    rows.forEach((row) => {
      if (!seen.current.has(row.id)) {
        seen.current.add(row.id);
        if (row.toId === id && row.fromId !== id) cue('New Norm connection', `${row.fromName} connected with you.`);
      }
    });
    setConnections(rows);
  }
  async function turnOn() {
    setBusy(true);
    setError('');
    try {
      if (!ready) throw new Error('Complete your profile before going live.');
      const nextLocation = await getPosition();
      setLocation(nextLocation);
      window.localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(nextLocation));
      await publish(nextLocation, profile);
      await refresh(nextLocation, profile);
      await refreshInbox(profile.id);
      setLiveOn(true);
      setNotice('You are live. Nearby people can find your signal and connect.');
      cue('Norm is on');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not turn Norm on.');
      setNotice('Norm stayed private. Complete your profile and allow location when ready.');
    } finally {
      setBusy(false);
    }
  }
  async function turnOff() {
    setLiveOn(false);
    setNearby([]);
    setNotice('You are private. Nobody can discover your Norm signal.');
    setError('');
    if (profile.id) await live<{ ok: boolean }>({ action: 'disconnect', id: profile.id }).catch(() => undefined);
  }
  async function toggle() {
    if (!ready) {
      setTab('connections');
      setNotice('Finish your profile first, then turn on from Home.');
      return;
    }
    if (liveOn) await turnOff();
    else await turnOn();
  }
  async function connect(person: Person) {
    setError('');
    try {
      if (!ready) throw new Error('Complete your profile before connecting.');
      const data = await live<{ connection: Connection }>({
        action: 'connect',
        fromId: profile.id,
        toId: person.id,
        fromName: profile.realName,
        fromPhone: profile.phone,
        fromBuilding: profile.building,
        fromSignal: profile.signal,
        fromSocials: profile.socials,
        toName: person.realName,
        message: `${profile.realName} connected with you on Norm.`
      });
      setConnections((current) => [data.connection, ...current.filter((item) => item.id !== data.connection.id)]);
      setSelected({ id: person.id, name: person.realName, phone: data.connection.toPhone, building: person.building, signal: person.signal });
      setTab('connections');
      cue('Connection sent', `${person.realName} received your ping.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect.');
    }
  }
  async function send() {
    if (!selected || !draft.trim()) return;
    const body = draft.trim();
    setDraft('');
    try {
      const data = await live<{ message: Chat }>({ action: 'chat:send', fromId: profile.id, toId: selected.id, fromName: profile.realName, body });
      setMessages((current) => [...current, data.message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Message failed.');
    }
  }

  useEffect(() => {
    if (!liveOn || !location || !profile.id || !ready) return;
    const activeLocation = location;
    const activeProfile = profile;
    let cancelled = false;
    async function heartbeat() {
      try {
        await publish(activeLocation, activeProfile);
        if (!cancelled) {
          await refresh(activeLocation, activeProfile);
          await refreshInbox(activeProfile.id);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Norm could not refresh presence.');
      }
    }
    void heartbeat();
    const interval = window.setInterval(() => void heartbeat(), 7000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [liveOn, location, profile, ready]);

  useEffect(() => {
    if (!selected || !profile.id) return;
    let cancelled = false;
    async function loadChat() {
      try {
        const data = await live<{ messages?: Chat[] }>({ action: 'chat:get', a: profile.id, b: selected.id });
        if (!cancelled) setMessages(data.messages || []);
      } catch {
        if (!cancelled) setMessages([]);
      }
    }
    void loadChat();
    const interval = window.setInterval(() => void loadChat(), 6000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [selected, profile.id]);

  return (
    <main className='shell'>
      <header className='appHeader'>
        <div className='brandLockup'><PenroseLogo /><div><span>Norm Network</span><strong>real-world signal layer</strong></div></div>
        <button className={`statusPill ${liveOn ? 'isLive' : ''}`} onClick={() => void toggle()}><span />{liveOn ? 'ON' : 'OFF'}</button>
      </header>

      {error && <section className='errorBanner'><strong>Heads up</strong><span>{error}</span></section>}

      {tab === 'home' && (
        <section className='tabPanel'>
          <div className='signalCard'>
            <div className='signalIntro'><span className='eyebrow'>Home</span><h1>Turn the world on only when you mean it.</h1><p>{notice}</p></div>
            <button className={`powerButton ${liveOn ? 'isOn' : ''}`} onClick={() => void toggle()} disabled={busy} aria-pressed={liveOn}>
              <span className='powerRing'><span className='powerCore' /></span>
              <strong>{busy ? '...' : liveOn ? 'On' : 'Off'}</strong>
              <em>{ready ? (liveOn ? 'tap to go private' : 'tap to be discoverable') : 'complete profile first'}</em>
            </button>
          </div>
          <div className='homeGrid'>
            <article className='metricCard'><span>Live nearby</span><strong>{nearby.length}</strong><p>{liveOn ? 'signals inside your radius' : 'hidden until you turn on'}</p></article>
            <article className='metricCard'><span>Radius</span><strong>{profile.radius} mi</strong><p>controlled from profile customization</p></article>
            <article className='metricCard'><span>Connections</span><strong>{contacts.length}</strong><p>chat and direct contact exchange</p></article>
          </div>
          <div className='profileNudge'><div><span className='eyebrow'>Ready check</span><h2>{ready ? 'Your signal is ready.' : `${completion}% profile complete`}</h2><p>{ready ? 'Your profile is saved locally on this device.' : `Missing: ${missing.join(', ') || 'profile details'}.`}</p></div><button className='ghostButton' onClick={() => setTab('connections')}>Customize profile</button></div>
        </section>
      )}

      {tab === 'map' && (
        <section className='tabPanel'>
          <div className='mapHero'><div><span className='eyebrow'>Map</span><h1>Find nearby signals.</h1><p>Open the map, tap a person, and connect once.</p></div><button className='ghostButton' onClick={() => void refresh()} disabled={!location || busy}>Refresh</button></div>
          <div className='mapLayout'>
            <section className='panel mapPanel'><LiveMap selfLocation={location} people={people} isDiscoverable={liveOn} onSelectPerson={(person) => void connect(person)} /></section>
            <aside className='panel peoplePanel'>
              <div className='sectionHeader'><div><span className='eyebrow'>Connect</span><h2>{people.length ? 'People around you' : 'No live signals yet'}</h2></div></div>
              {!liveOn && <div className='emptyText'>Turn on from Home to publish your signal and scan for real nearby people.</div>}
              <div className='peopleList'>
                {people.map((person) => (
                  <article className='personCard' key={person.id}>
                    <div className='personTop'><div className='avatar'>{person.realName.slice(0, 2).toUpperCase()}</div><div><h3>{person.realName}</h3><span>{person.signal} • {distanceText(person.distanceMiles)}</span></div></div>
                    <p>{person.bio}</p><strong>{person.building}</strong>
                    <div className='tagRow'>{person.tags.map((tag) => <span key={`${person.id}-${tag}`}>{tag}</span>)}</div>
                    <div className='personFooter'><span>live • {timeText(person.updatedAt)}</span><button onClick={() => void connect(person)}>Connect</button></div>
                  </article>
                ))}
              </div>
            </aside>
          </div>
        </section>
      )}

      {tab === 'connections' && (
        <section className='tabPanel'>
          <div className='connectionHero'><div><span className='eyebrow'>Connections</span><h1>Chat, contacts, and profile.</h1><p>Contacts on the left, chat in the center, profile controls on the right.</p></div><button className='ghostButton' onClick={() => void enableCues()}>Enable pings</button></div>
          <div className='connectionLayout'>
            <section className='panel contactsPanel'>
              <div className='sectionHeader'><div><span className='eyebrow'>Contacts</span><h2>{contacts.length ? 'Connected' : 'No connections yet'}</h2></div></div>
              {contacts.length === 0 ? <p className='emptyText'>Connect with someone on the map. Their direct contact appears here after the ping.</p> : <div className='contactList'>{contacts.map((contact) => <button className={`contactCard ${selected?.id === contact.id ? 'selected' : ''}`} key={contact.id} onClick={() => setSelected(contact)}><strong>{contact.name}</strong><span>{contact.signal}</span><em>{contact.phone || 'Waiting for contact'}</em></button>)}</div>}
            </section>
            <section className='panel chatPanel'>
              <div className='sectionHeader'><div><span className='eyebrow'>Chat</span><h2>{selected ? selected.name : 'Select a contact'}</h2></div></div>
              {selected ? <><div className='phoneShareBox'><strong>Direct contact</strong><span>{selected.phone || 'Waiting'}</span><em>{selected.building}</em></div><div className='chatMessages'>{messages.length === 0 ? <p>No messages yet.</p> : messages.map((chat) => <div className={`chatBubble ${chat.fromId === profile.id ? 'mine' : ''}`} key={chat.id}><strong>{chat.fromName}</strong><span>{chat.body}</span></div>)}</div><div className='chatComposer'><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder='Send a quick message...' onKeyDown={(event) => { if (event.key === 'Enter') void send(); }} /><button onClick={() => void send()}>Send</button></div></> : <p className='emptyText'>Once you connect, lightweight messages appear here.</p>}
            </section>
            <section className='panel profilePanel'>
              <div className='sectionHeader'><div><span className='eyebrow'>Profile</span><h2>Customize signal</h2></div><span className='completionBadge'>{completion}%</span></div>
              <div className='profileForm'>
                <label>Real name<input value={profile.realName} onChange={(event) => update('realName', event.target.value)} placeholder='Your real name' /></label>
                <label>Direct contact<input value={profile.phone} onChange={(event) => update('phone', event.target.value)} placeholder='Best contact' /></label>
                <label>What are you building?<textarea value={profile.building} onChange={(event) => update('building', event.target.value)} rows={3} placeholder='What people should know about your work' /></label>
                <label>Bio<textarea value={profile.bio} onChange={(event) => update('bio', event.target.value)} rows={3} placeholder='Short, direct, real' /></label>
                <label>Location label<input value={profile.locationLabel} onChange={(event) => update('locationLabel', event.target.value)} placeholder='City, event, lobby, campus...' /></label>
                <div className='formSplit'><label>Signal<select value={profile.signal} onChange={(event) => update('signal', event.target.value)}><option>Builder</option><option>Founder</option><option>Developer</option><option>Designer</option><option>Hardware</option><option>AI Creative</option><option>Investor</option><option>Operator</option><option>Local Explorer</option></select></label><label>Radius<select value={profile.radius} onChange={(event) => update('radius', Number(event.target.value))}><option value={1}>1 mile</option><option value={5}>5 miles</option><option value={10}>10 miles</option><option value={25}>25 miles</option></select></label></div>
                <label>Tags<input value={profile.tags.join(', ')} onChange={(event) => update('tags', cleanTags(event.target.value))} placeholder='AI, hardware, startups' /></label>
                <div className='socialGrid'><label>Instagram<input value={profile.socials.instagram} onChange={(event) => updateSocial('instagram', event.target.value)} placeholder='@username' /></label><label>X<input value={profile.socials.x} onChange={(event) => updateSocial('x', event.target.value)} placeholder='@username' /></label><label>LinkedIn<input value={profile.socials.linkedin} onChange={(event) => updateSocial('linkedin', event.target.value)} placeholder='linkedin.com/in/...' /></label><label>Website<input value={profile.socials.website} onChange={(event) => updateSocial('website', event.target.value)} placeholder='https://...' /></label></div>
                <div className='profilePreview'><strong>{profile.realName || 'Your name'}</strong><span>{profile.signal} • {profile.locationLabel || 'Location label'}</span><p>{profile.bio || 'Your bio preview appears here.'}</p><div className='tagRow'>{profile.tags.map((tag) => <span key={`profile-${tag}`}>{tag}</span>)}</div>{socials.length > 0 && <em>{socials.length} social link{socials.length > 1 ? 's' : ''} saved</em>}</div>
              </div>
            </section>
          </div>
        </section>
      )}

      <nav className='bottomTabs' aria-label='Primary tabs'>
        {tabData.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)} aria-current={tab === item.id ? 'page' : undefined}><strong>{item.label}</strong><span>{item.detail}</span></button>)}
      </nav>
    </main>
  );
}
