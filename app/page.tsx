'use client';

import { useEffect, useMemo, useState } from 'react';

type Profile = {
  id: string;
  name: string;
  signal: string;
  bio: string;
  tags: string[];
  status: string;
  radius: number;
  cuesEnabled: boolean;
};

type Coordinates = { lat: number; lng: number; accuracy?: number };

type NetworkPerson = {
  id: string;
  name: string;
  signal: string;
  bio: string;
  tags: string[];
  status: string;
  distanceMiles?: number | null;
  updatedAt?: number;
  isSeed?: boolean;
};

type ConnectionRequest = {
  id: string;
  fromId: string;
  toId: string;
  fromName: string;
  fromSignal: string;
  message: string;
  createdAt: number;
};

const PROFILE_KEY = 'norm-network-profile';
const LAST_LOCATION_KEY = 'norm-network-last-location';

const defaultProfile: Profile = {
  id: '',
  name: 'New Builder',
  signal: 'Builder',
  bio: 'Building something real.',
  tags: ['AI', 'Hardware', 'Startups'],
  status: 'Open to connect',
  radius: 5,
  cuesEnabled: true
};

const seedPeople: NetworkPerson[] = [
  {
    id: 'seed-mia',
    name: 'Mia',
    signal: 'Founder',
    bio: 'Working on community tools and brand systems.',
    tags: ['Startups', 'Design', 'Miami'],
    status: 'Open to builders',
    distanceMiles: 0.4,
    isSeed: true
  },
  {
    id: 'seed-jay',
    name: 'Jay',
    signal: 'Hardware',
    bio: 'Prototyping wearables, sensors, and physical interfaces.',
    tags: ['Hardware', 'BLE', 'Product'],
    status: 'Looking for collaborators',
    distanceMiles: 0.9,
    isSeed: true
  },
  {
    id: 'seed-nova',
    name: 'Nova',
    signal: 'AI Creative',
    bio: 'Making immersive visuals and AI-assisted experiences.',
    tags: ['AI', 'Creative', 'Video'],
    status: 'Down to talk',
    distanceMiles: 1.3,
    isSeed: true
  },
  {
    id: 'seed-cam',
    name: 'Cam',
    signal: 'Operator',
    bio: 'Connects builders, investors, and local event people.',
    tags: ['Events', 'Ops', 'Network'],
    status: 'Connector mode',
    distanceMiles: 2.1,
    isSeed: true
  }
];

const radarPositions = [
  { x: 58, y: 31 },
  { x: 69, y: 57 },
  { x: 36, y: 62 },
  { x: 48, y: 19 },
  { x: 28, y: 41 },
  { x: 76, y: 37 },
  { x: 44, y: 74 }
];

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `norm-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function cleanTags(value: string | string[]) {
  const raw = Array.isArray(value) ? value : value.split(',');
  return raw.map((tag) => tag.trim()).filter(Boolean).slice(0, 6);
}

function formatDistance(miles?: number | null) {
  if (miles === null || miles === undefined) return 'nearby';
  if (miles < 0.1) return 'right here';
  if (miles < 1) return `${Math.round(miles * 5280)} ft`;
  return `${miles.toFixed(1)} mi`;
}

function timeAgo(timestamp?: number) {
  if (!timestamp) return 'demo';
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function getBrowserPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('This browser does not support location yet.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      () => reject(new Error('Location permission was blocked or timed out.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

function buildIntro(profile: Profile, person: NetworkPerson) {
  return `Hey ${person.name}, I am ${profile.name} from Norm Network. I saw your ${person.signal} signal nearby. I am ${profile.status.toLowerCase()} — want to connect?`;
}

export default function Home() {
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [nearby, setNearby] = useState<NetworkPerson[]>([]);
  const [incoming, setIncoming] = useState<ConnectionRequest[]>([]);
  const [connectionLog, setConnectionLog] = useState<string[]>([]);
  const [showSeeds, setShowSeeds] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('You are private. Flip the switch when you want to be found.');
  const [error, setError] = useState('');

  useEffect(() => {
    const savedProfile = window.localStorage.getItem(PROFILE_KEY);
    const savedLocation = window.localStorage.getItem(LAST_LOCATION_KEY);

    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile) as Partial<Profile>;
        setProfile({
          ...defaultProfile,
          ...parsed,
          id: parsed.id || createId(),
          tags: Array.isArray(parsed.tags) ? cleanTags(parsed.tags) : defaultProfile.tags,
          radius: Number(parsed.radius) || defaultProfile.radius
        });
      } catch {
        setProfile({ ...defaultProfile, id: createId() });
      }
    } else {
      setProfile({ ...defaultProfile, id: createId() });
    }

    if (savedLocation) {
      try {
        setLocation(JSON.parse(savedLocation));
      } catch {
        window.localStorage.removeItem(LAST_LOCATION_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (profile.id) window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }, [profile]);

  const peopleForDisplay = useMemo(() => {
    const live = nearby.filter((person) => person.id !== profile.id);
    const seeds = showSeeds ? seedPeople : [];
    return [...live, ...seeds].slice(0, 8);
  }, [nearby, profile.id, showSeeds]);

  const liveCount = nearby.filter((person) => !person.isSeed).length;

  async function publishPresence(nextLocation: Coordinates, nextProfile = profile) {
    const response = await fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: nextProfile.id,
        name: nextProfile.name,
        signal: nextProfile.signal,
        bio: nextProfile.bio,
        tags: nextProfile.tags,
        status: nextProfile.status,
        radius: nextProfile.radius,
        lat: nextLocation.lat,
        lng: nextLocation.lng
      })
    });

    if (!response.ok) throw new Error('Norm presence could not be published.');
  }

  async function refreshNearby(nextLocation = location, nextProfile = profile) {
    if (!nextLocation || !nextProfile.id) return;

    const params = new URLSearchParams({
      lat: String(nextLocation.lat),
      lng: String(nextLocation.lng),
      radius: String(nextProfile.radius),
      exclude: nextProfile.id
    });

    const response = await fetch(`/api/presence?${params.toString()}`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = (await response.json()) as { people?: NetworkPerson[] };
    setNearby(data.people || []);
  }

  async function refreshIncoming(id = profile.id) {
    if (!id) return;
    const response = await fetch(`/api/connections?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = (await response.json()) as { requests?: ConnectionRequest[] };
    setIncoming(data.requests || []);
  }

  useEffect(() => {
    if (!isDiscoverable || !location || !profile.id) return;
    let cancelled = false;

    async function heartbeat() {
      try {
        await publishPresence(location, profile);
        if (!cancelled) {
          await refreshNearby(location, profile);
          await refreshIncoming(profile.id);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Norm could not refresh presence.');
      }
    }

    void heartbeat();
    const interval = window.setInterval(() => void heartbeat(), 8000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isDiscoverable, location, profile]);

  async function enableCues() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    setProfile((current) => ({ ...current, cuesEnabled: true }));
    cue('Norm cues enabled', 'Your device can now nudge you when something happens.');
  }

  function cue(title: string, body?: string) {
    if (profile.cuesEnabled && 'vibrate' in navigator) navigator.vibrate([55, 45, 55]);

    if (profile.cuesEnabled && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body: body || 'Norm Network' });
      } catch {
        // Browser notifications are best-effort only.
      }
    }
  }

  async function turnOn(useDemoLocation = false) {
    setBusy(true);
    setError('');

    try {
      const nextProfile = profile.id ? profile : { ...profile, id: createId() };
      setProfile(nextProfile);

      const nextLocation = useDemoLocation ? { lat: 25.7617, lng: -80.1918, accuracy: 100 } : await getBrowserPosition();
      setLocation(nextLocation);
      window.localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(nextLocation));

      await publishPresence(nextLocation, nextProfile);
      await refreshNearby(nextLocation, nextProfile);
      await refreshIncoming(nextProfile.id);

      setIsDiscoverable(true);
      setMessage('You are discoverable. Norm will look for nearby signals.');
      cue('Norm is on', 'You are now discoverable to nearby builders.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not turn Norm on.');
      setMessage('Norm stayed private. Location is required for proximity.');
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setIsDiscoverable(false);
    setNearby([]);
    setIncoming([]);
    setMessage('You are private. Nobody can discover your Norm signal.');
    setError('');

    if (profile.id) {
      await fetch(`/api/presence?id=${encodeURIComponent(profile.id)}`, { method: 'DELETE' });
    }
  }

  async function connectTo(person: NetworkPerson) {
    const intro = buildIntro(profile, person);

    if (person.isSeed) {
      setConnectionLog((current) => [`Demo intro prepared for ${person.name}`, ...current].slice(0, 4));
      if ('clipboard' in navigator) await navigator.clipboard.writeText(intro);
      cue('Intro copied', `You copied a Norm intro for ${person.name}.`);
      return;
    }

    const response = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromId: profile.id,
        toId: person.id,
        fromName: profile.name,
        fromSignal: profile.signal,
        message: intro
      })
    });

    if (response.ok) {
      setConnectionLog((current) => [`Signal sent to ${person.name}`, ...current].slice(0, 4));
      cue('Connection signal sent', `${person.name} will see your request while they are online.`);
    } else {
      setConnectionLog((current) => [`Could not signal ${person.name}`, ...current].slice(0, 4));
    }
  }

  const profileTags = profile.tags.join(', ');

  return (
    <main className='shell'>
      <section className='hero'>
        <div className='heroCopy'>
          <div className='eyebrow'>Norm Network / v0.1</div>
          <h1>Real-world connection, only when you choose.</h1>
          <p>
            Turn your signal on when you are open to meeting builders nearby. Turn it off and disappear.
            No feed. No clout. Just intentional proximity.
          </p>

          <div className='heroActions'>
            <button className='primaryButton' onClick={() => void turnOn(false)} disabled={busy || isDiscoverable}>
              {busy ? 'Finding location...' : 'Turn Norm on'}
            </button>
            <button className='ghostButton' onClick={() => void turnOff()} disabled={!isDiscoverable}>
              Go private
            </button>
          </div>
        </div>

        <div className='deviceCard'>
          <div className='deviceTop'>
            <span>NORM BAND</span>
            <span className={isDiscoverable ? 'greenText' : 'muted'}>{isDiscoverable ? 'LIVE' : 'OFF'}</span>
          </div>

          <button
            className={`switchButton ${isDiscoverable ? 'on' : ''}`}
            onClick={() => (isDiscoverable ? void turnOff() : void turnOn(false))}
            disabled={busy}
            aria-pressed={isDiscoverable}
          >
            <span className='switchTrack'><span className='switchKnob' /></span>
            <span>{isDiscoverable ? 'Discoverable ON' : 'Private OFF'}</span>
          </button>

          <p className='deviceMessage'>{message}</p>

          {error && (
            <div className='errorBox'>
              <strong>Heads up:</strong> {error}
              <button onClick={() => void turnOn(true)}>Use demo Miami location</button>
            </div>
          )}

          <div className='deviceStats'>
            <div><strong>{liveCount}</strong><span>live signals</span></div>
            <div><strong>{profile.radius}mi</strong><span>radius</span></div>
            <div><strong>{incoming.length}</strong><span>requests</span></div>
          </div>
        </div>
      </section>

      <section className='grid'>
        <div className='panel profilePanel'>
          <div className='sectionHeader'>
            <div>
              <span className='eyebrow'>Your signal</span>
              <h2>What people see</h2>
            </div>
            <button className='tinyButton' onClick={() => void enableCues()}>Enable cues</button>
          </div>

          <label>Display name<input value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} /></label>
          <label>Signal type<select value={profile.signal} onChange={(event) => setProfile((current) => ({ ...current, signal: event.target.value }))}>
            <option>Builder</option><option>Founder</option><option>Developer</option><option>Designer</option><option>Hardware</option><option>AI Creative</option><option>Investor</option><option>Operator</option><option>Local Explorer</option>
          </select></label>
          <label>One-line bio<textarea value={profile.bio} onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))} rows={3} /></label>
          <label>Tags<input value={profileTags} onChange={(event) => setProfile((current) => ({ ...current, tags: cleanTags(event.target.value) }))} /></label>
          <label>Availability<input value={profile.status} onChange={(event) => setProfile((current) => ({ ...current, status: event.target.value }))} /></label>
          <label>Discovery radius<select value={profile.radius} onChange={(event) => setProfile((current) => ({ ...current, radius: Number(event.target.value) }))}>
            <option value={1}>1 mile</option><option value={5}>5 miles</option><option value={10}>10 miles</option><option value={25}>25 miles</option>
          </select></label>
        </div>

        <div className='panel radarPanel'>
          <div className='sectionHeader'>
            <div>
              <span className='eyebrow'>Nearby field</span>
              <h2>Builder radar</h2>
            </div>
            <label className='seedToggle'><input type='checkbox' checked={showSeeds} onChange={(event) => setShowSeeds(event.target.checked)} /> demo signals</label>
          </div>

          <div className={`radar ${isDiscoverable ? 'active' : ''}`}>
            <div className='radarRing ringOne' /><div className='radarRing ringTwo' /><div className='radarRing ringThree' />
            <div className='radarCore'>YOU</div>
            {peopleForDisplay.slice(0, 7).map((person, index) => {
              const position = radarPositions[index % radarPositions.length];
              return <span key={`${person.id}-dot`} className={`radarDot ${person.isSeed ? 'seed' : 'live'}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} title={person.name} />;
            })}
          </div>

          <div className='privacyNote'><strong>Privacy rule:</strong> Norm only publishes you while the switch is on. Presence expires automatically if your device stops checking in.</div>
        </div>
      </section>

      {incoming.length > 0 && (
        <section className='panel incomingPanel'>
          <div className='sectionHeader'><div><span className='eyebrow'>Incoming</span><h2>Connection requests</h2></div></div>
          <div className='requestList'>
            {incoming.map((request) => (
              <div className='requestCard' key={request.id}>
                <div><strong>{request.fromName}</strong><span>{request.fromSignal} • {timeAgo(request.createdAt)}</span></div>
                <p>{request.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className='panel networkPanel'>
        <div className='sectionHeader'>
          <div><span className='eyebrow'>Discover</span><h2>{peopleForDisplay.length ? 'Nearby signals' : 'No signals yet'}</h2></div>
          <button className='tinyButton' onClick={() => void refreshNearby()}>Refresh</button>
        </div>

        <div className='peopleGrid'>
          {peopleForDisplay.map((person) => (
            <article className='personCard' key={person.id}>
              <div className='personTop'>
                <div className='avatar'>{person.name.slice(0, 2).toUpperCase()}</div>
                <div><h3>{person.name}</h3><span>{person.signal} • {formatDistance(person.distanceMiles)}</span></div>
              </div>
              <p>{person.bio}</p>
              <div className='tagRow'>{person.tags.map((tag) => <span key={`${person.id}-${tag}`}>{tag}</span>)}</div>
              <div className='personFooter'>
                <span className={person.isSeed ? 'demoBadge' : 'liveBadge'}>{person.isSeed ? 'demo' : `live • ${timeAgo(person.updatedAt)}`}</span>
                <button onClick={() => void connectTo(person)}>{person.isSeed ? 'Copy intro' : 'Connect'}</button>
              </div>
            </article>
          ))}
        </div>

        {peopleForDisplay.length === 0 && (
          <div className='emptyState'>
            <h3>Flip Norm on with a second phone or browser.</h3>
            <p>Open this app on another device, use a different name, allow location, and both devices should see each other while the temporary live engine is warm.</p>
          </div>
        )}
      </section>

      {connectionLog.length > 0 && (
        <section className='panel logPanel'>
          <span className='eyebrow'>Activity</span>
          {connectionLog.map((item) => <p key={item}>{item}</p>)}
        </section>
      )}

      <footer><strong>Norm Network</strong><span>Not social media. A physical-world signal layer.</span></footer>
    </main>
  );
}
