import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { getVinyls, createVinyl, updateVinyl, deleteVinyl, getToken, clearToken, likeVinyl, unlikeVinyl, uploadCover, uploadMusic, uploadPlaylistCover, searchSpotify, getPlaylists, createPlaylist, updatePlaylist, deletePlaylist, addSongToPlaylist, removeSongFromPlaylist, reorderPlaylist, getPlaylist } from '../utils/api';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function Modal({ children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--g-surface)', color: 'var(--c-text)', border: '1px solid var(--c-border)', padding: 32, minWidth: 320, borderRadius: 12, maxWidth: 520, width: '90%', boxShadow: '0 20px 60px rgb(0 0 0 / 0.45)' }}>
        {children}
      </div>
    </div>
  );
}

// Sortable item for drag and drop
function SortableItem({ id, song, onRemove, playlistId }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="playlist-song-item">
      <div className="playlist-song-drag-handle" {...attributes} {...listeners}>
        ⋮⋮
      </div>
      {song.coverUrl ? (
        <img src={song.coverUrl} alt={song.title} className="playlist-song-cover" />
      ) : (
        <div className="playlist-song-cover" style={{ background: 'var(--c-accent2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--c-ink)', fontWeight: 900 }}>♪</div>
      )}
      <div className="playlist-song-info">
        <p className="playlist-song-title">{song.title}</p>
        <p className="playlist-song-artist">{song.artist} • {song.year}</p>
      </div>
      <button
        className="playlist-song-remove"
        onClick={() => onRemove(playlistId, song.id)}
      >
        Remove
      </button>
    </li>
  );
}

export default function Home() {
  const router = useRouter();
  const [vinyls, setVinyls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', artist: '', year: new Date().getFullYear(), coverUrl: '', musicUrl: '', lyricsLrc: '', note: '' });
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [sortBy, setSortBy] = useState('title');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [spinningVinyls, setSpinningVinyls] = useState({});
  const [vinylRotations, setVinylRotations] = useState({});
  const [playingAudio, setPlayingAudio] = useState(null);
  const audioRefsRef = useRef({});
  const [currentTime, setCurrentTime] = useState({});
  const [duration, setDuration] = useState({});
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState('ferrari-black');
  const [viewMode, setViewMode] = useState('songs');
  const [actionMenuId, setActionMenuId] = useState(null);
  const [fullscreenPlayer, setFullscreenPlayer] = useState(false);
  const [lyrics, setLyrics] = useState(null);
  const [lyricsLines, setLyricsLines] = useState([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
  const lyricsContainerRef = useRef(null);
  const activeLyricRef = useRef(null);

  // Draggable mini player
  const miniPlayerRef = useRef(null);
  const miniDragRef = useRef({ active: false, pointerId: null, startX: 0, startY: 0, originX: 20, originY: 20 });
  const [miniPlayerPos, setMiniPlayerPos] = useState({ x: 20, y: 20 });

  const itemsPerPage = 12;
  const [coverGradient, setCoverGradient] = useState('var(--g-surface-2)');
  const [spotifySearch, setSpotifySearch] = useState('');
  const [spotifyResults, setSpotifyResults] = useState([]);
  const [searchingSpotify, setSearchingSpotify] = useState(false);
  const [spotifyUploads, setSpotifyUploads] = useState({}); // trackId -> { musicUrl, uploading }
  const [playingPreview, setPlayingPreview] = useState(null); // track id being previewed
  const previewAudioRef = useRef(null);
  const [showArcade, setShowArcade] = useState(false);
  const [gameMode, setGameMode] = useState('normal'); // easy, normal, hard
  const [currentGame, setCurrentGame] = useState('blackjack'); // blackjack, poker, roulette, slots
  const [blackjack, setBlackjack] = useState({ 
    deck: [], 
    player: [], 
    dealer: [], 
    status: 'idle', 
    message: 'Hit play to deal!',
    bet: 100,
    balance: 1000,
    stats: { wins: 0, losses: 0, pushes: 0, totalEarnings: 0 },
    canDoubleDown: false,
    canSplit: false,
    splits: { active: false, hand1: [], hand2: [], currentHand: 1 }
  });
  const [poker, setPoker] = useState({
    deck: [],
    playerHand: [],
    dealerHand: [],
    communityCards: [],
    balance: 1000,
    bet: 100,
    status: 'idle', // idle, betting, flop, turn, river, finished
    message: 'Start a new game!',
    round: 'preflop',
    pot: 0,
    dealerBet: 0,
    playerBet: 0,
    stats: { wins: 0, losses: 0, pushes: 0, totalEarnings: 0 }
  });
  
  // Playlist states
  const [playlists, setPlaylists] = useState([]);
  const [showPlaylistForm, setShowPlaylistForm] = useState(false);
  const [playlistForm, setPlaylistForm] = useState({ name: '', description: '', coverUrl: '' });
  const [editingPlaylist, setEditingPlaylist] = useState(null);
  const [uploadingPlaylistCover, setUploadingPlaylistCover] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(null); // vinyl to add
  const [activeId, setActiveId] = useState(null); // for drag and drop

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('theme') || 'ferrari-black';
      setTheme(savedTheme);
      document.documentElement.dataset.theme = savedTheme;
    } catch {
      // no-op
    }
  }, []);

  const handleThemeChange = (e) => {
    const nextTheme = e.target.value;
    setTheme(nextTheme);
    try {
      localStorage.setItem('theme', nextTheme);
    } catch {
      // no-op
    }
    document.documentElement.dataset.theme = nextTheme;
  };

  const extractColorsFromImage = useCallback(async (imageUrl) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 100, 100);
        
        let topR = 0, topG = 0, topB = 0;
        let bottomR = 0, bottomG = 0, bottomB = 0;
        const imageData = ctx.getImageData(0, 0, 100, 100).data;
        
        for (let i = 0; i < 2500; i += 4) {
          topR += imageData[i];
          topG += imageData[i + 1];
          topB += imageData[i + 2];
        }
        topR = Math.floor(topR / 2500);
        topG = Math.floor(topG / 2500);
        topB = Math.floor(topB / 2500);
        
        for (let i = 20000; i < imageData.length; i += 4) {
          bottomR += imageData[i];
          bottomG += imageData[i + 1];
          bottomB += imageData[i + 2];
        }
        bottomR = Math.floor(bottomR / 2500);
        bottomG = Math.floor(bottomG / 2500);
        bottomB = Math.floor(bottomB / 2500);
        
        const brightColor = `rgb(${Math.min(255, topR + 30)}, ${Math.min(255, topG + 30)}, ${Math.min(255, topB + 30)})`;
        const darkColor = `rgb(${Math.max(0, bottomR - 20)}, ${Math.max(0, bottomG - 20)}, ${Math.max(0, bottomB - 20)})`;
        setCoverGradient(`linear-gradient(45deg, ${brightColor} 0%, ${darkColor} 100%)`);
      };
      img.src = imageUrl;
    } catch (e) {
      console.error('Error extracting colors:', e);
      setCoverGradient('var(--g-surface-2)');
    }
  }, []);

  useEffect(() => {
    if (currentlyPlaying?.coverUrl) {
      extractColorsFromImage(currentlyPlaying.coverUrl);
    }
  }, [currentlyPlaying?.id, extractColorsFromImage]);

  useEffect(() => {
    if (fullscreenPlayer) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [fullscreenPlayer]);

  // Handle tab visibility and browser audio pause - resume audio when needed
  useEffect(() => {
    // Handle visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab became visible - resume all currently spinning audio
        Object.keys(spinningVinyls).forEach(vinylId => {
          if (spinningVinyls[vinylId] && audioRefsRef.current[vinylId]) {
            const audio = audioRefsRef.current[vinylId];
            if (audio.paused) {
              audio.play().catch(err => console.log('Auto-resume error:', err));
            }
          }
        });
      }
    };

    // Also check periodically if audio got paused unexpectedly
    const checkInterval = setInterval(() => {
      Object.keys(spinningVinyls).forEach(vinylId => {
        if (spinningVinyls[vinylId] && audioRefsRef.current[vinylId]) {
          const audio = audioRefsRef.current[vinylId];
          // If vinyl should be spinning but audio is paused, resume it
          if (audio.paused) {
            audio.play().catch(err => console.log('Auto-resume on interval:', err));
          }
        }
      });
    }, 1000); // Check every second

    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Also resume on any user interaction
    const handleUserInteraction = () => {
      Object.keys(spinningVinyls).forEach(vinylId => {
        if (spinningVinyls[vinylId] && audioRefsRef.current[vinylId]) {
          const audio = audioRefsRef.current[vinylId];
          if (audio.paused) {
            audio.play().catch(err => console.log('Auto-resume on interaction:', err));
          }
        }
      });
    };
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      clearInterval(checkInterval);
    };
  }, [spinningVinyls]);

  const handleAudioRef = useCallback((el, vinylId) => {
    if (el) {
      audioRefsRef.current[vinylId] = el;
      el.volume = 1;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Start near bottom-left by default
    const initialY = Math.max(20, window.innerHeight - 20 - 260);
    setMiniPlayerPos({ x: 20, y: initialY });
  }, []);

  function clampMiniPos(nextX, nextY) {
    if (typeof window === 'undefined') return { x: nextX, y: nextY };
    const rect = miniPlayerRef.current?.getBoundingClientRect();
    const w = rect?.width || 340;
    const h = rect?.height || 240;
    const maxX = Math.max(0, window.innerWidth - w);
    const maxY = Math.max(0, window.innerHeight - h);
    return {
      x: Math.min(Math.max(0, nextX), maxX),
      y: Math.min(Math.max(0, nextY), maxY),
    };
  }

  function startMiniDrag(e) {
    // Only primary button / primary touch
    if (typeof e.button === 'number' && e.button !== 0) return;
    // Don't start drag if clicking on interactive elements
    const target = e.target;
    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'A' || target.closest('button')) {
      return;
    }
    miniDragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: miniPlayerPos.x,
      originY: miniPlayerPos.y,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  }

  function moveMiniDrag(e) {
    const drag = miniDragRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const next = clampMiniPos(drag.originX + dx, drag.originY + dy);
    setMiniPlayerPos(next);
  }

  function endMiniDrag(e) {
    const drag = miniDragRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;
    miniDragRef.current = { ...drag, active: false, pointerId: null };
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }

  async function load() {
    setLoading(true);
    try {
      const token = getToken();
      if (!token) {
        router.push('/login');
        return;
      }
      if (token) {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        setUser(decoded);
      }
      const data = await getVinyls();
      setVinyls(data);
      const playlistsData = await getPlaylists();
      setPlaylists(playlistsData);
    } catch (err) {
      console.error('Load error:', err);
      if (err.response?.status === 401) {
        clearToken();
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (router.isReady) {
      load();
    }
  }, [router.isReady]);

  // If the vinyl list refreshes (e.g. after saving uploaded LRC), keep currentlyPlaying updated
  // so fullscreen lyrics reflect the latest `lyricsLrc` without requiring a page refresh.
  useEffect(() => {
    if (!currentlyPlaying?.id) return;
    const refreshed = vinyls.find(v => v.id === currentlyPlaying.id);
    if (refreshed) {
      setCurrentlyPlaying(refreshed);
    }
  }, [vinyls]);

  function isPreviewTrack(vinyl) {
    const musicUrl = (vinyl?.musicUrl || '').toLowerCase();
    const previewUrl = (vinyl?.previewUrl || '').toLowerCase();
    const url = musicUrl || previewUrl;
    return url.includes('audio-ssl.itunes.apple.com') || url.includes('itunes.apple.com');
  }

  function DemoBadge({ size = 56, label = 'DEMO' }) {
    return (
      <div
        title="Demo / preview track"
        aria-label="Demo / preview track"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'var(--c-badge-bg)',
          border: '2px solid var(--c-accent2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 18px rgb(var(--rgb-accent2) / 0.35), inset 0 1px 0 rgb(var(--rgb-accent2) / 0.12)',
        }}
      >
        <span
          style={{
            color: 'var(--c-accent2)',
            fontWeight: 900,
            letterSpacing: '0.14em',
            fontSize: Math.max(10, Math.round(size * 0.22)),
            fontFamily: "'Archivo Black', 'Poppins', sans-serif",
            transform: 'translateX(1px)',
            textShadow: '0 1px 0 rgb(0 0 0 / 0.45)'
          }}
        >
          {label}
        </span>
      </div>
    );
  }

  function parseLrc(lrcText) {
    const lines = String(lrcText || '').replace(/\r/g, '').split('\n');

    let globalOffsetMs = 0;
    for (const line of lines) {
      const offsetMatch = line.match(/\[offset:([+-]?\d+)\]/i);
      if (offsetMatch) {
        globalOffsetMs = parseInt(offsetMatch[1], 10) || 0;
        break;
      }
    }

    const timed = [];
    const tsRe = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    const metaRe = /^\[(ar|ti|al|by|length|re|ve|offset):/i;

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (!line) continue;
      if (metaRe.test(line)) continue;

      const timestamps = [];
      let match;
      while ((match = tsRe.exec(line)) !== null) {
        const mm = parseInt(match[1], 10);
        const ss = parseInt(match[2], 10);
        const frac = match[3];
        if (Number.isNaN(mm) || Number.isNaN(ss)) continue;

        let ms = 0;
        if (typeof frac === 'string' && frac.length) {
          if (frac.length === 1) ms = parseInt(frac, 10) * 100;
          else if (frac.length === 2) ms = parseInt(frac, 10) * 10;
          else ms = parseInt(frac.slice(0, 3), 10);
        }

        const startTime = Math.max(0, (mm * 60 + ss) * 1000 + ms + globalOffsetMs);
        timestamps.push(startTime);
      }

      if (!timestamps.length) continue;

      const text = line.replace(tsRe, '').trim();
      if (!text) continue;

      for (const startTime of timestamps) {
        timed.push({ text, startTime });
      }
    }

    timed.sort((a, b) => a.startTime - b.startTime);
    return timed;
  }

  // Load lyrics when fullscreen player opens
  useEffect(() => {
    if (fullscreenPlayer && currentlyPlaying) {
      if (isPreviewTrack(currentlyPlaying)) {
        setLyrics(null);
        setLyricsLines([]);
        setCurrentLyricIndex(-1);
        return;
      }

      const lrcText = currentlyPlaying.lyricsLrc;
      if (typeof lrcText === 'string' && lrcText.trim().length > 0) {
        setLyrics(lrcText);
        setLyricsLines(parseLrc(lrcText));
      } else {
        setLyrics(null);
        setLyricsLines([]);
        setCurrentLyricIndex(-1);
      }
    } else {
      setLyrics(null);
      setLyricsLines([]);
      setCurrentLyricIndex(-1);
    }
  }, [fullscreenPlayer, currentlyPlaying?.id]);

  // Update current lyric index and auto-scroll
  useEffect(() => {
    if (!currentlyPlaying?.id || !lyricsLines.length) return;

    const now = currentTime[currentlyPlaying.id] || 0;
    const nowMs = now * 1000;

    // Find current line (last line that has started)
    let activeIdx = -1;
    for (let i = lyricsLines.length - 1; i >= 0; i--) {
      if (nowMs >= lyricsLines[i].startTime) {
        activeIdx = i;
        break;
      }
    }

    if (activeIdx !== currentLyricIndex) {
      console.log('[Lyrics] Active line changed:', { activeIdx, now, nowMs, line: lyricsLines[activeIdx]?.text });
      setCurrentLyricIndex(activeIdx);
      
      // Auto-scroll to active line after a short delay
      setTimeout(() => {
        if (activeIdx >= 0 && activeLyricRef.current && lyricsContainerRef.current) {
          activeLyricRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }, 100);
    }
  }, [currentTime, currentlyPlaying?.id, lyricsLines, currentLyricIndex]);

  // Scroll to top when lyrics load
  useEffect(() => {
    if (lyricsContainerRef.current && lyricsLines.length > 0) {
      setTimeout(() => {
        lyricsContainerRef.current.scrollTop = 0;
      }, 50);
    }
  }, [lyricsLines]);

  async function handleLyricsUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setForm(prev => ({ ...prev, lyricsLrc: text }));
    } catch (err) {
      alert('Failed to read lyrics file: ' + (err.message || String(err)));
    } finally {
      e.target.value = '';
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ title: '', artist: '', year: new Date().getFullYear(), coverUrl: '', musicUrl: '', lyricsLrc: '', note: '' });
    setSpotifySearch('');
    setSpotifyResults([]);
    setSpotifyUploads({});
    setPlayingPreview(null);
    if (previewAudioRef.current) previewAudioRef.current.pause();
    setShowForm(true);
  }

  function openEdit(v) {
    setEditing(v);
    setForm({ title: v.title, artist: v.artist, year: v.year, coverUrl: v.coverUrl, musicUrl: v.musicUrl || '', lyricsLrc: v.lyricsLrc || '', note: v.note });
    setSpotifySearch('');
    setSpotifyResults([]);
    setSpotifyUploads({});
    setShowForm(true);
  }

  async function handleSpotifySearch(e) {
    e.preventDefault();
    if (!spotifySearch.trim()) return;
    
    setSearchingSpotify(true);
    try {
      const results = await searchSpotify(spotifySearch);
      console.log('Spotify search results:', results);
      console.log('First track preview:', results[0]?.previewUrl);
      setSpotifyResults(results);
      setSpotifyUploads({});
    } catch (err) {
      alert('Spotify search failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSearchingSpotify(false);
    }
  }

  function fillFromSpotify(track) {
    const uploaded = spotifyUploads[track.id]?.musicUrl;
    setForm({
      title: track.title,
      artist: track.artist,
      year: track.year,
      coverUrl: track.coverUrl,
      musicUrl: uploaded || track.previewUrl || '',
      lyricsLrc: '',
      note: form.note
    });
    setSpotifyResults([]);
    setSpotifySearch('');
  }

  async function quickAddFromSpotify(track) {
    const uploaded = spotifyUploads[track.id]?.musicUrl;
    const musicUrl = uploaded || track.previewUrl;
    if (!musicUrl) {
      alert('Нет ни превью, ни загруженного файла. Залей файл или выбери трек с превью.');
      return;
    }
    try {
      const newVinyl = await createVinyl({
        title: track.title,
        artist: track.artist,
        year: track.year,
        coverUrl: track.coverUrl,
        musicUrl,
        lyricsLrc: '',
        note: `Added from Spotify`
      });
      setSpotifyResults([]);
      setSpotifySearch('');
      setShowForm(false);
      const updatedVinyls = await getVinyls();
      setVinyls(updatedVinyls);
      alert(`Added "${track.title}" to your collection!`);
    } catch (err) {
      alert('Failed to add: ' + (err.response?.data?.message || err.message));
    }
  }

  function buildDeck() {
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const suits = ['S', 'H', 'D', 'C'];
    const deck = [];
    ranks.forEach(rank => {
      suits.forEach(suit => {
        deck.push({ rank, suit });
      });
    });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function handValue(hand) {
    let total = 0;
    let aces = 0;
    hand.forEach(card => {
      if (card.rank === 'A') {
        total += 11;
        aces += 1;
      } else if (['K', 'Q', 'J'].includes(card.rank)) {
        total += 10;
      } else {
        total += Number(card.rank);
      }
    });
    while (total > 21 && aces > 0) {
      total -= 10;
      aces -= 1;
    }
    return total;
  }

  function getDealerThreshold() {
    if (gameMode === 'easy') return 16;
    if (gameMode === 'hard') return 17;
    return 17;
  }

  function shouldDealerHitBasicStrategy(dealer, upCard) {
    // Hard strategy uses basic strategy
    if (gameMode !== 'hard') return false;
    const dealerScore = handValue(dealer);
    if (dealerScore >= 12 && dealerScore <= 16) {
      const upCardValue = ['K', 'Q', 'J'].includes(upCard.rank) ? 10 : (upCard.rank === 'A' ? 11 : Number(upCard.rank));
      return upCardValue >= 7; // Hit on weak dealer hand
    }
    return dealerScore < 17;
  }

  function startBlackjack() {
    if (blackjack.balance < blackjack.bet) {
      alert('Insufficient balance! Reset to play again.');
      return;
    }

    const deck = buildDeck();
    const player = [deck.pop(), deck.pop()];
    const dealer = [deck.pop(), deck.pop()];
    const playerScore = handValue(player);
    const dealerScore = handValue(dealer);

    let status = 'player';
    let message = 'Your turn: hit or stand';
    let canDoubleDown = player.length === 2 && playerScore >= 9 && playerScore <= 11;
    let canSplit = player[0].rank === player[1].rank;

    let finalStatus = 'player';
    let finalMessage = message;
    let newBalance = blackjack.balance; // НЕ вычитаем ставку, она будет учтена в dealerTurn

    if (playerScore === 21 && dealerScore === 21) {
      finalStatus = 'finished';
      finalMessage = '🤝 Push. Double blackjack! You get your bet back.';
      newBalance = blackjack.balance; // нет изменений баланса
    } else if (playerScore === 21) {
      finalStatus = 'finished';
      const payout = Math.round(blackjack.bet * (3 - 1)); // блэкджек платит 3x, но только выигрыш (без ставки)
      finalMessage = `💰 BLACKJACK! +${payout} coins! (3x payout)`;
      newBalance = blackjack.balance + payout; // сразу добавляем выигрыш
      blackjack.stats.wins++;
      blackjack.stats.totalEarnings += payout;
    } else if (dealerScore === 21) {
      finalStatus = 'finished';
      finalMessage = `😞 Dealer blackjack. You lose -${blackjack.bet}`;
      newBalance = blackjack.balance - blackjack.bet; // вычитаем ставку только при проигрыше
      blackjack.stats.losses++;
      blackjack.stats.totalEarnings -= blackjack.bet;
    }

    setShowArcade(true);
    setBlackjack(prev => ({ 
      ...prev, 
      deck, 
      player, 
      dealer, 
      status: finalStatus, 
      message: finalMessage,
      balance: newBalance,
      canDoubleDown: finalStatus === 'player' ? canDoubleDown : false,
      canSplit: finalStatus === 'player' ? canSplit : false
    }));
  }

  function hitBlackjack() {
    setBlackjack(prev => {
      if (prev.status !== 'player') return prev;
      const deck = [...prev.deck];
      const card = deck.pop();
      const player = [...prev.player, card];
      const score = handValue(player);
      
      let canDoubleDown = false;
      let canSplit = false;

      if (score > 21) {
        return { 
          ...prev, 
          deck, 
          player, 
          status: 'finished', 
          message: 'Bust. Dealer wins.',
          balance: prev.balance - prev.bet, // при бусте теряем ставку
          canDoubleDown: false,
          canSplit: false,
          stats: { ...prev.stats, losses: prev.stats.losses + 1, totalEarnings: prev.stats.totalEarnings - prev.bet }
        };
      }

      return { ...prev, deck, player, message: 'Hit or stand', canDoubleDown, canSplit };
    });
  }

  function doubleDownBlackjack() {
    setBlackjack(prev => {
      if (!prev.canDoubleDown || prev.status !== 'player') return prev;
      const deck = [...prev.deck];
      const card = deck.pop();
      const player = [...prev.player, card];
      const score = handValue(player);
      const newBet = prev.bet * 2;
      const balanceAfterDouble = prev.balance - prev.bet; // вычитаем доп ставку для double down

      if (score > 21) {
        return { 
          ...prev, 
          deck, 
          player, 
          status: 'finished', 
          message: 'Bust after double down. Dealer wins.',
          bet: newBet,
          balance: balanceAfterDouble,
          canDoubleDown: false,
          canSplit: false,
          stats: { ...prev.stats, losses: prev.stats.losses + 1, totalEarnings: prev.stats.totalEarnings - prev.bet }
        };
      }

      // After double down, move to dealer
      return dealerTurn({ ...prev, deck, player, status: 'dealer', bet: newBet, balance: balanceAfterDouble, canDoubleDown: false, canSplit: false });
    });
  }

  function splitBlackjack() {
    setBlackjack(prev => {
      if (!prev.canSplit || prev.status !== 'player') return prev;
      const deck = [...prev.deck];
      const hand1 = [prev.player[0], deck.pop()];
      const hand2 = [prev.player[1], deck.pop()];

      return { 
        ...prev, 
        deck, 
        player: hand1,
        splits: { active: true, hand1, hand2, currentHand: 1 },
        message: 'Playing hand 1. Hit or stand',
        canDoubleDown: false,
        canSplit: false,
        bet: prev.bet * 2
      };
    });
  }

  function dealerTurn(state) {
    const deck = [...state.deck];
    const dealer = [...state.dealer];
    const threshold = getDealerThreshold();
    
    while (true) {
      const dealerScore = handValue(dealer);
      if (dealerScore >= threshold && dealerScore <= 21) break;
      if (dealerScore > 21) break;
      if (gameMode === 'hard' && shouldDealerHitBasicStrategy(dealer, state.dealer[0])) {
        dealer.push(deck.pop());
      } else if (dealerScore < threshold) {
        dealer.push(deck.pop());
      } else {
        break;
      }
    }

    const playerScore = handValue(state.player);
    const dealerScore = handValue(dealer);
    const isBlackjack = state.player.length === 2 && playerScore === 21;
    const isAllIn = state.bet === state.balance + state.bet; // было all in до ставки
    
    let message = 'Dealer stands.';
    let earnings = 0;
    let resultType = 'loss';
    let multiplier = 1; // коэффициент выплаты

    if (dealerScore > 21 || playerScore > dealerScore) {
      resultType = 'win';
      multiplier = isBlackjack ? 3 : 2; // блэкджек 3x, обычная победа 2x
      earnings = Math.round(state.bet * (multiplier - 1)); // только выигрыш, без ставки
      message = isBlackjack ? '💰 BLACKJACK! +' + earnings + ' coins (3x)!' : '🎉 You win! +' + earnings + ' coins (2x)!';
      if (isAllIn) message += ' 🔥 ALL IN WIN!';
    } else if (dealerScore === playerScore) {
      message = 'Push. Nobody wins.';
      earnings = 0;
      resultType = 'push';
    } else {
      message = 'Dealer wins.';
      earnings = -state.bet; // вычитаем ставку только при проигрыше
      resultType = 'loss';
      if (isAllIn) message += ' 😅 ALL IN LOSS!';
    }

    const newStats = { ...state.stats };
    if (resultType === 'win') newStats.wins++;
    else if (resultType === 'loss') newStats.losses++;
    else newStats.pushes++;
    newStats.totalEarnings += earnings;

    return { 
      ...state, 
      deck, 
      dealer, 
      status: 'finished', 
      message,
      balance: state.balance + earnings, // правильный расчет: текущий баланс + earnings (может быть положительным или отрицательным)
      stats: newStats,
      canDoubleDown: false,
      canSplit: false
    };
  }

  function standBlackjack() {
    setBlackjack(prev => {
      if (prev.status !== 'player') return prev;
      return dealerTurn(prev);
    });
  }

  function resetBlackjack() {
    setBlackjack({ 
      deck: [], 
      player: [], 
      dealer: [], 
      status: 'idle', 
      message: 'Hit play to deal!',
      bet: 100,
      balance: 1000,
      stats: { wins: 0, losses: 0, pushes: 0, totalEarnings: 0 },
      canDoubleDown: false,
      canSplit: false,
      splits: { active: false, hand1: [], hand2: [], currentHand: 1 }
    });
  }

  // ============ POKER FUNCTIONS ============
  function evaluatePokerHand(cards) {
    // cards = 5 или 7 карт, возвращает { rank, value, name }
    const suits = {};
    const ranks = {};
    cards.forEach(card => {
      suits[card.suit] = (suits[card.suit] || 0) + 1;
      ranks[card.rank] = (ranks[card.rank] || 0) + 1;
    });

    const rankValues = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    const sortedRanks = Object.entries(ranks).sort((a, b) => rankValues[b[0]] - rankValues[a[0]]);
    const suitCounts = Object.values(suits).sort((a, b) => b - a);
    const rankCounts = sortedRanks.map(r => r[1]).sort((a, b) => b - a);

    let isFlush = suitCounts[0] >= 5;
    let isStraight = false;
    if (cards.length === 5) {
      const vals = cards.map(c => rankValues[c.rank]).sort((a, b) => b - a);
      isStraight = (vals[0] - vals[4] === 4 && new Set(vals).size === 5) || JSON.stringify(vals) === JSON.stringify([14, 5, 4, 3, 2]);
    }

    if (rankCounts[0] === 4) return { rank: 7, value: 100, name: 'Four of a Kind' };
    if (rankCounts[0] === 3 && rankCounts[1] === 2) return { rank: 6, value: 90, name: 'Full House' };
    if (isFlush) return { rank: 5, value: 80, name: 'Flush' };
    if (isStraight) return { rank: 4, value: 70, name: 'Straight' };
    if (rankCounts[0] === 3) return { rank: 3, value: 60, name: 'Three of a Kind' };
    if (rankCounts[0] === 2 && rankCounts[1] === 2) return { rank: 2, value: 50, name: 'Two Pair' };
    if (rankCounts[0] === 2) return { rank: 1, value: 40, name: 'One Pair' };
    return { rank: 0, value: 0, name: 'High Card' };
  }

  function startPokerGame() {
    if (poker.balance < poker.bet) {
      alert('Insufficient balance!');
      return;
    }

    const deck = buildDeck();
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    setPoker(prev => ({
      ...prev,
      deck,
      playerHand,
      dealerHand,
      communityCards: [],
      status: 'betting',
      round: 'preflop',
      message: 'Pre-flop: Check, Bet, or Fold?',
      pot: poker.bet * 2,
      balance: poker.balance - poker.bet,
      playerBet: poker.bet,
      dealerBet: poker.bet
    }));
  }

  function pokerFold() {
    setPoker(prev => ({
      ...prev,
      status: 'finished',
      message: '😞 You folded. Dealer wins the pot!',
      balance: prev.balance,
      stats: { ...prev.stats, losses: prev.stats.losses + 1, totalEarnings: prev.stats.totalEarnings - prev.playerBet }
    }));
  }

  function pokerCall() {
    if (poker.round === 'preflop') {
      const deck = [...poker.deck];
      const communityCards = [deck.pop(), deck.pop(), deck.pop()];
      setPoker(prev => ({
        ...prev,
        deck,
        communityCards,
        round: 'flop',
        message: 'Flop: Check or Bet?',
        status: 'betting'
      }));
    } else if (poker.round === 'flop') {
      const deck = [...poker.deck];
      const community = [...poker.communityCards, deck.pop()];
      setPoker(prev => ({
        ...prev,
        deck,
        communityCards: community,
        round: 'turn',
        message: 'Turn: Check or Bet?',
        status: 'betting'
      }));
    } else if (poker.round === 'turn') {
      const deck = [...poker.deck];
      const community = [...poker.communityCards, deck.pop()];
      setPoker(prev => ({
        ...prev,
        deck,
        communityCards: community,
        round: 'river',
        message: 'River: Check or Bet?',
        status: 'betting'
      }));
    } else if (poker.round === 'river') {
      endPokerGame();
    }
  }

  function endPokerGame() {
    const allCards = [...poker.playerHand, ...poker.communityCards];
    const dealerAllCards = [...poker.dealerHand, ...poker.communityCards];
    
    const playerHandRank = evaluatePokerHand(allCards);
    const dealerHandRank = evaluatePokerHand(dealerAllCards);

    let message = '';
    let earnings = 0;
    
    if (playerHandRank.rank > dealerHandRank.rank) {
      message = `🎉 You win! ${playerHandRank.name} beats ${dealerHandRank.name}! +${poker.pot}`;
      earnings = poker.pot;
    } else if (playerHandRank.rank < dealerHandRank.rank) {
      message = `😞 Dealer wins with ${dealerHandRank.name}. You lose -${poker.playerBet}`;
      earnings = -poker.playerBet;
    } else {
      message = 'Push! Split the pot.';
      earnings = 0;
    }

    const newStats = { ...poker.stats };
    if (earnings > 0) newStats.wins++;
    else if (earnings < 0) newStats.losses++;
    else newStats.pushes++;
    newStats.totalEarnings += earnings;

    setPoker(prev => ({
      ...prev,
      status: 'finished',
      message,
      balance: prev.balance + earnings,
      stats: newStats
    }));
  }

  const playerScore = handValue(blackjack.player);
  const dealerScore = handValue(blackjack.dealer);
  const cardLabel = (card) => `${card.rank}${card.suit}`;

  async function onSubmit(e) {
    e.preventDefault();
    try {
      console.log('Submitting form:', form);
      if (editing) {
        await updateVinyl(editing.id, form);
      } else {
        await createVinyl(form);
      }
      setShowForm(false);
      const updatedVinyls = await getVinyls();
      setVinyls(updatedVinyls);
    } catch (err) {
      alert(err.response?.data?.message || 'Error');
    }
  }

  async function onDelete(id) {
    if (!confirm('Delete this vinyl?')) return;
    try {
      await deleteVinyl(id);
      const updatedVinyls = await getVinyls();
      setVinyls(updatedVinyls);
    } catch (err) {
      alert(err.response?.data?.message || 'Error');
    }
  }

  async function handleLike(vinylId) {
    if (!user) {
      alert('Please log in to like tracks.');
      return;
    }
    try {
      const vinyl = vinyls.find(v => v.id === vinylId);
      const isLiked = vinyl.likes?.includes(user.id);
      
      if (isLiked) {
        await unlikeVinyl(vinylId);
      } else {
        await likeVinyl(vinylId);
      }
      
      const updatedVinyls = await getVinyls();
      setVinyls(updatedVinyls);
    } catch (err) {
      alert(err.response?.data?.message || 'Error');
    }
  }

  async function handleCoverUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const data = await uploadCover(file);
      setForm(prev => ({ ...prev, coverUrl: data.url }));
    } catch (err) {
      alert('Failed to upload cover: ' + (err.response?.data?.message || err.message || String(err)));
    } finally {
      setUploading(false);
    }
  }

  async function handleMusicUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingMusic(true);
    try {
      const data = await uploadMusic(file);
      console.log('Music uploaded, URL:', data.url);
      setForm(prev => {
        const updated = { ...prev, musicUrl: data.url };
        console.log('Form updated with musicUrl:', updated);
        return updated;
      });
    } catch (err) {
      alert('Failed to upload music: ' + (err.response?.data?.message || err.message || String(err)));
    } finally {
      setUploadingMusic(false);
    }
  }

  async function handleSpotifyUpload(trackId, file) {
    if (!file) return;
    setSpotifyUploads(prev => ({ ...prev, [trackId]: { ...(prev[trackId] || {}), uploading: true } }));
    try {
      const data = await uploadMusic(file);
      setSpotifyUploads(prev => ({ ...prev, [trackId]: { musicUrl: data.url, uploading: false } }));
    } catch (err) {
      alert('Failed to upload: ' + (err.response?.data?.message || err.message));
      setSpotifyUploads(prev => ({ ...prev, [trackId]: { ...(prev[trackId] || {}), uploading: false } }));
    }
  }

  function togglePreview(track) {
    if (playingPreview === track.id) {
      // Stop playing
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setPlayingPreview(null);
    } else {
      // Start playing
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(track.previewUrl);
      audio.volume = 1;
      audio.onended = () => setPlayingPreview(null);
      audio.play();
      previewAudioRef.current = audio;
      setPlayingPreview(track.id);
    }
  }

  function handleLogout() {
    clearToken();
    router.push('/login');
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  let filtered = vinyls.filter(v =>
    v.title.toLowerCase().includes(search.toLowerCase()) ||
    v.artist.toLowerCase().includes(search.toLowerCase()) ||
    String(v.year).includes(search)
  );

  filtered = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.title.localeCompare(b.title);
      case 'artist':
        return a.artist.localeCompare(b.artist);
      case 'year-asc':
        return a.year - b.year;
      case 'year-desc':
        return b.year - a.year;
      case 'likes':
        return (b.likes?.length || 0) - (a.likes?.length || 0);
      default:
        return 0;
    }
  });
  
  const topVinyls = [...vinyls].sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0)).slice(0, 10);
  
  // ===== PLAYLIST FUNCTIONS =====
  
  function openPlaylistForm() {
    setEditingPlaylist(null);
    setPlaylistForm({ name: '', description: '', coverUrl: '' });
    setShowPlaylistForm(true);
  }

  function openEditPlaylist(playlist) {
    setEditingPlaylist(playlist);
    setPlaylistForm({ 
      name: playlist.name, 
      description: playlist.description || '', 
      coverUrl: playlist.cover_url || '' 
    });
    setShowPlaylistForm(true);
  }

  async function handlePlaylistSubmit(e) {
    e.preventDefault();
    try {
      if (editingPlaylist) {
        await updatePlaylist(editingPlaylist.id, playlistForm);
      } else {
        await createPlaylist(playlistForm);
      }
      const playlistsData = await getPlaylists();
      setPlaylists(playlistsData);
      setShowPlaylistForm(false);
      setPlaylistForm({ name: '', description: '', coverUrl: '' });
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  }

  async function handlePlaylistCoverUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setUploadingPlaylistCover(true);
      const data = await uploadPlaylistCover(file);
      setPlaylistForm({ ...playlistForm, coverUrl: data.url });
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingPlaylistCover(false);
    }
  }

  function handlePlaylistCoverDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handlePlaylistCoverUpload({ target: { files: [file] } });
    }
  }

  async function handleDeletePlaylist(id) {
    if (!confirm('Delete this playlist?')) return;
    try {
      await deletePlaylist(id);
      const playlistsData = await getPlaylists();
      setPlaylists(playlistsData);
      if (selectedPlaylist?.id === id) {
        setSelectedPlaylist(null);
      }
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  }

  async function handleAddToPlaylist(playlistId) {
    if (!showAddToPlaylist) return;
    try {
      await addSongToPlaylist(playlistId, showAddToPlaylist.id);
      alert('Added to playlist!');
      setShowAddToPlaylist(null);
      // Refresh selected playlist if it's open
      if (selectedPlaylist?.id === playlistId) {
        const updated = await getPlaylist(playlistId);
        setSelectedPlaylist(updated);
      }
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  }

  async function handleRemoveFromPlaylist(playlistId, vinylId) {
    try {
      await removeSongFromPlaylist(playlistId, vinylId);
      const updated = await getPlaylist(playlistId);
      setSelectedPlaylist(updated);
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      setActiveId(null);
      return;
    }

    if (selectedPlaylist) {
      const oldIndex = selectedPlaylist.songs.findIndex(s => s.id === active.id);
      const newIndex = selectedPlaylist.songs.findIndex(s => s.id === over.id);
      
      const reordered = arrayMove(selectedPlaylist.songs, oldIndex, newIndex);
      setSelectedPlaylist({ ...selectedPlaylist, songs: reordered });
      
      try {
        await reorderPlaylist(selectedPlaylist.id, reordered.map(s => s.id));
      } catch (err) {
        console.error('Reorder error:', err);
        // Revert on error
        const updated = await getPlaylist(selectedPlaylist.id);
        setSelectedPlaylist(updated);
      }
    }
    
    setActiveId(null);
  }

  async function openPlaylistDetail(playlist) {
    try {
      const detailed = await getPlaylist(playlist.id);
      setSelectedPlaylist(detailed);
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  }
  
  const toggleSpin = (vinylId) => {
    const id = String(vinylId);
    const currentlySpinning = Object.keys(spinningVinyls).find(key => spinningVinyls[key]);
    if (currentlySpinning && currentlySpinning !== id) {
      if (audioRefsRef.current[currentlySpinning]) {
        audioRefsRef.current[currentlySpinning].pause();
      }
      const element = document.getElementById(`vinyl-${currentlySpinning}`);
      if (element) {
        const computedStyle = window.getComputedStyle(element);
        const transform = computedStyle.transform;
        if (transform && transform !== 'none') {
          const match = transform.match(/rotate\(([^)]+)deg\)/);
          if (match) {
            const angle = parseFloat(match[1]);
            setVinylRotations(prev => ({ ...prev, [currentlySpinning]: angle % 360 }));
          }
        }
      }
      setSpinningVinyls(prev => ({
        ...prev,
        [currentlySpinning]: false
      }));
    }

    if (spinningVinyls[id]) {
      if (audioRefsRef.current[id]) {
        audioRefsRef.current[id].pause();
      }
      const element = document.getElementById(`vinyl-${id}`);
      if (element) {
        const computedStyle = window.getComputedStyle(element);
        const transform = computedStyle.transform;
        if (transform && transform !== 'none') {
          const match = transform.match(/rotate\(([^)]+)deg\)/);
          if (match) {
            const angle = parseFloat(match[1]);
            setVinylRotations(prev => ({ ...prev, [id]: angle % 360 }));
          }
        }
      }
    } else {
      const vinyl = vinyls.find(v => String(v.id) === id);
      // Don't play preview tracks
      if (vinyl && isPreviewTrack(vinyl)) {
        alert('⚠️ This is a demo/preview track and cannot be played. Full tracks require audio files.');
        return;
      }
      // Check if audio file exists
      if (!vinyl?.musicUrl) {
        alert('⚠️ No audio file available for this track.');
        return;
      }
      if (vinyl?.musicUrl && audioRefsRef.current[id]) {
        audioRefsRef.current[id].volume = 1;
        audioRefsRef.current[id].play().catch(err => console.log('Audio play error:', err));
        setCurrentlyPlaying(vinyl);
      }
    }

    setSpinningVinyls(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedVinyls = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--c-header-bg)', borderBottom: '2px solid var(--c-header-border)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="burger-button"
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                border: 'none',
                background: menuOpen ? 'var(--c-accent2)' : 'var(--c-badge-bg)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: menuOpen ? '0 6px 20px rgb(var(--rgb-accent) / 0.4), inset 0 1px 0 rgb(255 255 255 / 0.2)' : '0 6px 20px rgb(0 0 0 / 0.5), inset 0 1px 0 rgb(var(--rgb-accent) / 0.1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                if (!menuOpen) {
                  e.currentTarget.style.background = 'var(--c-badge-bg)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgb(var(--rgb-accent) / 0.3), inset 0 1px 0 rgb(var(--rgb-accent) / 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (!menuOpen) {
                  e.currentTarget.style.background = 'var(--c-badge-bg)';
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgb(0 0 0 / 0.5), inset 0 1px 0 rgb(var(--rgb-accent) / 0.1)';
                }
              }}
              aria-label="Toggle menu"
            >
              <div style={{ width: 22, height: 22, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {!menuOpen ? (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4.5 }}>
                    <div style={{ width: '100%', height: 2.5, background: 'var(--c-accent2)', borderRadius: 3, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 1px 2px rgb(var(--rgb-accent2) / 0.4)' }} />
                    <div style={{ width: '75%', height: 2.5, background: 'var(--c-accent2)', borderRadius: 3, marginLeft: 'auto', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 1px 2px rgb(var(--rgb-accent2) / 0.4)' }} />
                    <div style={{ width: '100%', height: 2.5, background: 'var(--c-accent2)', borderRadius: 3, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 1px 2px rgb(var(--rgb-accent2) / 0.4)' }} />
                  </div>
                ) : (
                  <div style={{ position: 'relative', width: 22, height: 22 }}>
                    <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: 2.5, background: 'var(--c-ink)', borderRadius: 3, transform: 'rotate(45deg)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
                    <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: 2.5, background: 'var(--c-ink)', borderRadius: 3, transform: 'rotate(-45deg)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
                  </div>
                )}
              </div>
            </button>
            <h1 className="logo-animated" style={{
              margin: 0,
              fontSize: 44,
              fontWeight: 400,
              letterSpacing: '0.065em',
              paddingLeft: 2,
              color: 'var(--c-logo-fill)',
              WebkitTextStroke: '1.5px var(--c-logo-stroke)',
              textTransform: 'uppercase',
              filter: 'drop-shadow(0 10px 26px rgba(0,0,0,0.55))',
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              position: 'relative',
              cursor: 'default',
              fontFamily: "'Plaster', 'Poppins', system-ui, -apple-system, sans-serif",
              lineHeight: 0.9
            }}>
              MT
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <select
              className="theme-selector"
              value={theme}
              onChange={handleThemeChange}
              aria-label="Theme"
              style={{
                height: 40,
                borderRadius: 999,
                border: '2px solid var(--c-accent2)',
                padding: '0 18px',
                background: 'var(--c-accent2)',
                color: 'var(--c-ink)',
                fontWeight: 900,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                outline: 'none',
                boxShadow: '0 6px 0 rgb(var(--rgb-accent2) / 0.45), inset 0 1px 0 rgb(255 255 255 / 0.15)'
              }}
            >
              <option value="ferrari-black">Ferrari Black</option>
              <option value="barcelona-home">Barcelona Home</option>
              <option value="vodafone-mclaren">Vodafone McLaren</option>
              <option value="arsenal-classic">Arsenal Classic</option>
            </select>

            {user && <span className="welcome-msg" style={{ fontSize: 12, color: 'var(--c-text)', fontWeight: 700 }}>Welcome, <strong className="username-display" style={{ color: 'var(--c-accent2)', fontWeight: 900, textShadow: '0 1px 0 rgb(0 0 0 / 0.35)' }}>{user.username}</strong> ({user.role})</span>}
            <button
              className="logout-btn"
              onClick={handleLogout}
              style={{ background: 'var(--c-danger)', color: 'var(--c-ink)', border: '1px solid var(--c-danger)', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', transition: 'all 0.2s', boxShadow: '0 4px 12px rgb(var(--rgb-danger) / 0.40)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 20px rgb(var(--rgb-danger) / 0.50)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgb(var(--rgb-danger) / 0.30)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              Logout
            </button>
          </div>
        </div>
        {menuOpen && (
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px 16px 24px' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                className="view-mode-btn"
                onClick={() => { setViewMode('songs'); setMenuOpen(false); }}
                style={{ background: viewMode === 'songs' ? 'var(--c-accent2)' : 'var(--c-badge-bg)', color: viewMode === 'songs' ? 'var(--c-ink)' : 'var(--c-accent2)', border: '2px solid var(--c-accent2)', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', boxShadow: viewMode === 'songs' ? '0 4px 0 rgb(var(--rgb-accent2) / 0.30)' : 'none' }}
              >
                ♫ Songs
              </button>
              <button
                className="view-mode-btn"
                onClick={() => { setViewMode('playlists'); setMenuOpen(false); }}
                style={{ background: viewMode === 'playlists' ? 'var(--c-accent2)' : 'var(--c-badge-bg)', color: viewMode === 'playlists' ? 'var(--c-ink)' : 'var(--c-accent2)', border: '2px solid var(--c-accent2)', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', boxShadow: viewMode === 'playlists' ? '0 4px 0 rgb(var(--rgb-accent2) / 0.30)' : 'none' }}
              >
                📂 Playlists
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '40px 24px' }}>
        <div className="progress-bar-accent" style={{ height: 6, width: '100%', background: 'var(--g-accent-h)', borderRadius: 999, marginBottom: 28, boxShadow: '0 2px 12px rgb(var(--rgb-accent2) / 0.5), 0 0 24px rgb(var(--rgb-accent) / 0.3)' }} />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>Loading...</div>
        ) : (
          <>
            {viewMode === 'songs' && (
            <>
              <div style={{ marginBottom: 32, background: 'var(--g-surface-2)', color: 'var(--c-text)', border: '2px solid var(--c-border)', borderRadius: 12, padding: 16, boxShadow: '0 8px 24px rgb(0 0 0 / 0.35)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(90deg, rgba(0,0,0,0.15) 1px, transparent 1px), linear-gradient(0deg, rgba(0,0,0,0.15) 1px, transparent 1px)', backgroundSize: '16px 16px', pointerEvents: 'none', opacity: 0.8 }} />
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ fontFamily: 'monospace', letterSpacing: '0.05em', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="arcade-8bit-badge" style={{ padding: '6px 12px', background: '#000', border: '2px solid var(--c-accent2)', borderRadius: 6, color: 'var(--c-accent2)', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 0 var(--c-accent2)' }}>8-bit</span>
                  <span className="arcade-title" style={{ color: '#000', fontWeight: 900, textShadow: '0 1px 0 rgb(var(--rgb-accent2) / 0.35)', fontSize: 16 }}>Arcade</span>
                </div>
                
                {/* Simple game tabs */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className={`game-tab-btn game-tab-btn-21 ${currentGame === 'blackjack' ? 'active' : ''}`}
                    onClick={() => setCurrentGame('blackjack')}
                    style={{ 
                      background: currentGame === 'blackjack' ? 'var(--c-accent2)' : 'var(--c-badge-bg)', 
                      color: currentGame === 'blackjack' ? 'var(--c-ink)' : 'var(--c-accent2)', 
                      border: '1px solid var(--c-accent2)', 
                      padding: '8px 14px', 
                      borderRadius: 8, 
                      cursor: 'pointer', 
                      fontSize: 13, 
                      fontWeight: 700, 
                      textTransform: 'uppercase',
                      transition: 'all 0.2s',
                      boxShadow: currentGame === 'blackjack' ? '0 4px 0 rgb(var(--rgb-accent2) / 0.30)' : 'none'
                    }}
                  >
                    🃏 21
                  </button>
                  <button
                    className={`game-tab-btn game-tab-btn-poker ${currentGame === 'poker' ? 'active' : ''}`}
                    onClick={() => setCurrentGame('poker')}
                    style={{ 
                      background: currentGame === 'poker' ? 'var(--c-accent)' : 'var(--c-badge-bg)', 
                      color: currentGame === 'poker' ? '#ffffff' : 'var(--c-accent2)', 
                      border: currentGame === 'poker' ? '1px solid #FDCB00' : '1px solid var(--c-accent2)', 
                      padding: '8px 14px', 
                      borderRadius: 8, 
                      cursor: 'pointer', 
                      fontSize: 13, 
                      fontWeight: 700, 
                      textTransform: 'uppercase',
                      transition: 'all 0.2s',
                      boxShadow: currentGame === 'poker' ? '0 4px 0 rgba(253, 203, 0, 0.50), 0 0 20px rgba(165, 0, 68, 0.6)' : 'none'
                    }}
                  >
                    ♣️ Poker
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="arcade-play-btn"
                    onClick={() => setShowArcade(true)}
                    style={{ background: 'var(--c-accent)', color: 'var(--c-ink)', border: '1px solid var(--c-accent2)', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 900, boxShadow: '0 4px 0 rgb(var(--rgb-accent2) / 0.30)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    Play
                  </button>
                  {showArcade && (
                    <button
                      onClick={() => setShowArcade(false)}
                      style={{ background: 'var(--c-danger)', color: 'var(--c-ink)', border: '1px solid var(--c-danger)', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 900, boxShadow: '0 4px 0 rgb(var(--rgb-danger) / 0.30)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>

              {showArcade && currentGame === 'blackjack' && (
                <div style={{ position: 'relative', marginTop: 12, border: '2px solid var(--c-border)', borderRadius: 10, background: 'var(--c-input-bg)', padding: 14, fontFamily: 'monospace' }}>
                  {/* Mode selector */}
                  <div style={{ marginBottom: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
                    {['easy', 'normal', 'hard'].map(mode => (
                      <button
                        key={mode}
                        onClick={() => { if (blackjack.status === 'idle' || blackjack.status === 'finished') setGameMode(mode); }}
                        style={{ background: gameMode === mode ? 'var(--c-accent)' : 'var(--c-button-secondary)', color: gameMode === mode ? 'var(--c-ink)' : 'var(--c-muted)', border: '1px solid ' + (gameMode === mode ? 'var(--c-accent)' : 'var(--c-border)'), padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'all 0.2s' }}
                      >
                        {mode === 'easy' ? '🎮 Easy' : mode === 'normal' ? '⚖️ Normal' : '💪 Hard'}
                      </button>
                    ))}
                  </div>

                  {/* Balance & Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12, fontSize: 12 }}>
                    <div style={{ background: 'var(--c-surface2)', padding: '8px', borderRadius: 6, border: '1px solid var(--c-border)', color: 'var(--c-text)' }}>
                      💰 Balance: <span style={{ color: 'var(--c-accent)', fontWeight: 800 }}>{blackjack.balance}</span>
                    </div>
                    <div style={{ background: 'var(--c-surface2)', padding: '8px', borderRadius: 6, border: '1px solid var(--c-border)', color: 'var(--c-text)' }}>
                      💵 Bet: <span style={{ color: 'var(--c-danger)', fontWeight: 800 }}>{blackjack.bet}</span>
                    </div>
                    <div style={{ background: 'var(--c-surface2)', padding: '8px', borderRadius: 6, border: '1px solid var(--c-border)', color: 'var(--c-text)' }}>
                      🏆 Wins: <span style={{ color: 'var(--c-accent)', fontWeight: 800 }}>{blackjack.stats.wins}</span>
                    </div>
                    <div style={{ background: 'var(--c-surface2)', padding: '8px', borderRadius: 6, border: '1px solid var(--c-border)', color: 'var(--c-text)' }}>
                      📊 +{blackjack.stats.totalEarnings}
                    </div>
                  </div>

                  {/* Bet slider */}
                  {(blackjack.status === 'idle' || blackjack.status === 'finished') && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <label style={{ color: 'var(--c-muted)', fontSize: 12, fontWeight: 800 }}>Bet amount:</label>
                        <input 
                          type="range" 
                          min="10" 
                          max={Math.min(blackjack.balance, 5000)} 
                          value={blackjack.bet}
                          onChange={(e) => setBlackjack(prev => ({ ...prev, bet: Number(e.target.value) }))}
                          style={{ flex: 1, cursor: 'pointer' }}
                        />
                        <input 
                          type="number" 
                          value={blackjack.bet}
                          onChange={(e) => setBlackjack(prev => ({ ...prev, bet: Math.max(10, Math.min(prev.balance, Number(e.target.value))) }))}
                          style={{ width: 70, padding: '4px 8px', background: 'var(--c-input-bg)', color: 'var(--c-text)', border: '1px solid var(--c-border)', borderRadius: 6, fontSize: 12, fontWeight: 800 }}
                        />
                      </div>

                      {/* Quick bet buttons */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        {[25, 50, 100, 500, 1000].map(amount => (
                          <button
                            key={amount}
                            onClick={() => setBlackjack(prev => ({ ...prev, bet: Math.min(amount, prev.balance) }))}
                            style={{ 
                              background: blackjack.bet === amount ? 'var(--c-accent)' : 'var(--c-button-secondary)', 
                              color: blackjack.bet === amount ? 'var(--c-ink)' : 'var(--c-muted)', 
                              border: '1px solid ' + (blackjack.bet === amount ? 'var(--c-accent)' : 'var(--c-border)'), 
                              padding: '6px 10px', 
                              borderRadius: 6, 
                              cursor: 'pointer', 
                              fontSize: 11, 
                              fontWeight: 800, 
                              textTransform: 'uppercase', 
                              letterSpacing: '0.05em',
                              opacity: amount > blackjack.balance ? 0.5 : 1,
                              transition: 'all 0.2s'
                            }}
                            disabled={amount > blackjack.balance}
                          >
                            {amount}
                          </button>
                        ))}
                        <button
                          onClick={() => setBlackjack(prev => ({ ...prev, bet: prev.balance }))}
                          style={{ 
                            background: blackjack.bet === blackjack.balance ? 'var(--c-danger)' : 'rgb(var(--rgb-danger) / 0.18)', 
                            color: blackjack.bet === blackjack.balance ? 'var(--c-text)' : 'rgb(var(--rgb-danger) / 0.70)', 
                            border: '1px solid ' + (blackjack.bet === blackjack.balance ? 'var(--c-danger)' : 'rgb(var(--rgb-danger) / 0.35)'), 
                            padding: '6px 10px', 
                            borderRadius: 6, 
                            cursor: 'pointer', 
                            fontSize: 11, 
                            fontWeight: 800, 
                            textTransform: 'uppercase', 
                            letterSpacing: '0.05em',
                            transition: 'all 0.2s',
                            boxShadow: blackjack.bet === blackjack.balance ? '0 0 12px rgb(var(--rgb-danger) / 0.50)' : 'none'
                          }}
                        >
                          🔥 ALL IN
                        </button>
                      </div>

                      {/* Bet info */}
                      <div style={{ fontSize: 11, color: 'var(--c-text)', padding: '6px 8px', background: 'var(--c-input-bg)', borderRadius: 6, border: '1px solid var(--c-border)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Win: <strong style={{ color: 'var(--c-accent)' }}>+{blackjack.bet}</strong></span>
                        <span>Blackjack: <strong style={{ color: 'var(--c-accent2)' }}>+{blackjack.bet * 2}</strong></span>
                        <span>Lose: <strong style={{ color: 'var(--c-danger)' }}>-{blackjack.bet}</strong></span>
                      </div>
                    </div>
                  )}

                  {/* Game cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--c-muted)', marginBottom: 6 }}>Dealer</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {blackjack.dealer.map((card, idx) => {
                          const hidden = blackjack.status === 'player' && idx === 1;
                          return (
                            <div key={`dealer-${idx}`} style={{ width: 52, height: 72, background: hidden ? 'var(--c-badge-bg)' : 'rgba(255,255,255,0.92)', color: 'var(--c-ink)', border: '2px solid var(--c-border)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, boxShadow: '0 4px 0 rgb(0 0 0 / 0.30)', transition: 'all 0.3s' }}>
                              {hidden ? '??' : cardLabel(card)}
                            </div>
                          );
                        })}
                      </div>
                      {blackjack.status !== 'player' && blackjack.dealer.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 12, color: dealerScore > 21 ? 'var(--c-danger)' : 'var(--c-text)' }}>Total: <strong>{dealerScore}</strong></div>
                      )}
                    </div>

                    <div>
                      <div style={{ fontSize: 12, color: 'var(--c-muted)', marginBottom: 6 }}>You</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {blackjack.player.map((card, idx) => (
                          <div key={`player-${idx}`} style={{ width: 52, height: 72, background: 'rgba(255,255,255,0.92)', color: 'var(--c-ink)', border: '2px solid var(--c-border)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, boxShadow: '0 4px 0 rgb(0 0 0 / 0.30)', transition: 'all 0.3s' }}>
                            {cardLabel(card)}
                          </div>
                        ))}
                      </div>
                      {blackjack.player.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 12, color: playerScore > 21 ? 'var(--c-danger)' : 'var(--c-text)' }}>Total: <strong>{playerScore}</strong></div>
                      )}
                    </div>
                  </div>

                  {/* Message & actions */}
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <span style={{ color: blackjack.status === 'finished' ? (blackjack.message.includes('win') ? 'var(--c-accent)' : blackjack.message.includes('Push') ? 'var(--c-muted)' : 'var(--c-danger)') : 'var(--c-accent)', fontSize: 12, fontWeight: 800 }}>{blackjack.message}</span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {blackjack.status === 'idle' ? (
                        <button
                          onClick={startBlackjack}
                          disabled={blackjack.balance < blackjack.bet}
                          style={{ background: 'var(--c-accent)', color: 'var(--c-ink)', border: '1px solid var(--c-accent)', padding: '8px 12px', borderRadius: 8, cursor: blackjack.balance >= blackjack.bet ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 800, boxShadow: '0 4px 0 rgb(var(--rgb-accent) / 0.30)', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: blackjack.balance >= blackjack.bet ? 1 : 0.5 }}
                        >
                          Deal
                        </button>
                      ) : blackjack.status === 'player' ? (
                        <>
                          <button
                            onClick={hitBlackjack}
                            style={{ background: 'var(--c-accent)', color: 'var(--c-ink)', border: '1px solid var(--c-accent)', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 800, boxShadow: '0 4px 0 rgb(var(--rgb-accent) / 0.30)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                          >
                            Hit
                          </button>
                          <button
                            onClick={standBlackjack}
                            style={{ background: 'var(--c-button-secondary)', color: 'var(--c-accent)', border: '1px solid var(--c-accent)', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 800, boxShadow: '0 4px 0 rgb(0 0 0 / 0.30)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                          >
                            Stand
                          </button>
                          {blackjack.canDoubleDown && (
                            <button
                              onClick={doubleDownBlackjack}
                              style={{ background: 'var(--c-danger)', color: 'var(--c-text)', border: '1px solid var(--c-danger)', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 800, boxShadow: '0 4px 0 rgb(var(--rgb-danger) / 0.30)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                            >
                              Double
                            </button>
                          )}
                          {blackjack.canSplit && (
                            <button
                              onClick={splitBlackjack}
                              style={{ background: 'var(--c-accent2)', color: 'var(--c-ink)', border: '1px solid var(--c-accent2)', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 800, boxShadow: '0 4px 0 rgb(var(--rgb-accent2) / 0.30)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                            >
                              Split
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <button
                            onClick={startBlackjack}
                            disabled={blackjack.balance < blackjack.bet}
                            style={{ background: 'var(--c-accent)', color: 'var(--c-ink)', border: '1px solid var(--c-accent)', padding: '8px 12px', borderRadius: 8, cursor: blackjack.balance >= blackjack.bet ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 800, boxShadow: '0 4px 0 rgb(var(--rgb-accent) / 0.30)', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: blackjack.balance >= blackjack.bet ? 1 : 0.5 }}
                          >
                            Deal Again
                          </button>
                          <button
                            onClick={resetBlackjack}
                            style={{ background: 'var(--c-danger)', color: 'var(--c-text)', border: '1px solid var(--c-danger)', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 800, boxShadow: '0 4px 0 rgb(var(--rgb-danger) / 0.30)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                          >
                            Reset Stats
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Stats breakdown */}
                  <div style={{ marginTop: 12, padding: 8, background: 'var(--c-surface2)', borderRadius: 6, border: '1px solid var(--c-border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 11, color: 'var(--c-text)' }}>
                    <div>Wins: <span style={{ color: 'var(--c-accent)', fontWeight: 800 }}>{blackjack.stats.wins}</span> | Losses: <span style={{ color: 'var(--c-danger)', fontWeight: 800 }}>{blackjack.stats.losses}</span> | Pushes: <span style={{ color: 'var(--c-muted)', fontWeight: 800 }}>{blackjack.stats.pushes}</span></div>
                    <div>Win rate: <span style={{ color: 'var(--c-accent)', fontWeight: 800 }}>{blackjack.stats.wins + blackjack.stats.losses > 0 ? Math.round(blackjack.stats.wins * 100 / (blackjack.stats.wins + blackjack.stats.losses)) : 0}%</span></div>
                    <div>Balance: <span style={{ color: blackjack.balance > 1000 ? 'var(--c-accent)' : blackjack.balance < 100 ? 'var(--c-danger)' : 'var(--c-text)', fontWeight: 800 }}>{blackjack.balance}</span></div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 60, background: 'var(--g-surface-2)', border: '1px solid var(--c-border)', borderRadius: 16, padding: '24px 24px 16px 24px', boxShadow: '0 10px 30px rgb(0 0 0 / 0.35)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: 'var(--c-text)', letterSpacing: '0.02em', textShadow: '0 2px 0 rgb(var(--rgb-accent2) / 0.25)' }}>🔥 Top Vinyls</h2>
                <div className="sorted-badge" style={{ fontSize: 12, color: 'var(--c-accent2)', background: 'var(--c-badge-bg)', border: '1px solid var(--c-accent2)', padding: '6px 10px', borderRadius: 999, fontWeight: 800, letterSpacing: '0.02em' }}>Sorted by likes</div>
              </div>

              <div style={{ position: 'relative' }}>
                {topVinyls.length > 4 && (
                  <>
                    <button 
                      onClick={() => setCarouselIndex(Math.max(0, carouselIndex - 4))}
                      disabled={carouselIndex === 0}
                      style={{ position: 'absolute', left: -24, top: '50%', transform: 'translateY(-50%)', width: 38, height: 38, borderRadius: '50%', background: 'var(--c-badge-bg)', border: '1px solid var(--c-accent2)', color: 'var(--c-accent2)', fontSize: 20, cursor: carouselIndex === 0 ? 'default' : 'pointer', transition: 'all 0.2s', zIndex: 10, opacity: carouselIndex === 0 ? 0.4 : 1 }}
                      onMouseEnter={(e) => { if (carouselIndex !== 0) { e.currentTarget.style.borderColor = 'var(--c-accent)'; e.currentTarget.style.boxShadow = '0 0 12px rgb(var(--rgb-accent) / 0.35)'; } }}
                      onMouseLeave={(e) => { if (carouselIndex !== 0) { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.boxShadow = 'none'; } }}
                    >
                      ‹
                    </button>
                    <button 
                      onClick={() => setCarouselIndex(Math.min(topVinyls.length - 4, carouselIndex + 4))}
                      disabled={carouselIndex >= topVinyls.length - 4}
                      style={{ position: 'absolute', right: -24, top: '50%', transform: 'translateY(-50%)', width: 38, height: 38, borderRadius: '50%', background: 'var(--c-badge-bg)', border: '1px solid var(--c-accent2)', color: 'var(--c-accent2)', fontSize: 20, cursor: carouselIndex >= topVinyls.length - 4 ? 'default' : 'pointer', transition: 'all 0.2s', zIndex: 10, opacity: carouselIndex >= topVinyls.length - 4 ? 0.4 : 1 }}
                      onMouseEnter={(e) => { if (carouselIndex < topVinyls.length - 4) { e.currentTarget.style.borderColor = 'var(--c-accent)'; e.currentTarget.style.boxShadow = '0 0 12px rgb(var(--rgb-accent) / 0.35)'; } }}
                      onMouseLeave={(e) => { if (carouselIndex < topVinyls.length - 4) { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.boxShadow = 'none'; } }}
                    >
                      ›
                    </button>
                  </>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32, overflow: 'hidden' }}>
                  {topVinyls.slice(carouselIndex, carouselIndex + 4).map((v, idx) => {
                    const actualIndex = carouselIndex + idx;
                    return (
                      <div key={v.id} style={{ textAlign: 'center', position: 'relative', padding: '10px 10px 0 10px' }}>
                        <div style={{ position: 'absolute', top: 6, right: 6, width: 38, height: 38, background: 'var(--c-badge-bg)', color: 'var(--c-accent2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, lineHeight: 1, border: '1px solid var(--c-accent2)', boxShadow: '0 4px 12px rgb(var(--rgb-accent2) / 0.35)', zIndex: 5 }}>
                          {actualIndex + 1}.
                        </div>

                        <div className="top-vinyl-cover" style={{ width: '100%', aspectRatio: '1', background: 'var(--g-vinyl)', borderRadius: '50%', overflow: 'hidden', position: 'relative', boxShadow: '0 14px 28px rgb(0 0 0 / 0.45), inset 0 2px 6px rgb(255 255 255 / 0.06)', cursor: 'pointer', transition: 'all 0.3s', marginBottom: 14 }}
                             onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                             onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                          <div 
                            id={`vinyl-${v.id}`}
                            className={spinningVinyls[v.id] ? 'vinyl-spinning' : 'vinyl-paused'}
                            style={{ 
                              width: '100%', 
                              height: '100%',
                              '--start-angle': `${vinylRotations[v.id] || 0}deg`
                            }}>
                            {v.coverUrl && <img src={v.coverUrl} alt={v.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          </div>
                          <div style={{ position: 'absolute', inset: '15%', border: '3px solid rgba(0,0,0,0.8)', borderRadius: '50%', pointerEvents: 'none' }}></div>
                          
                          <div 
                            onClick={(e) => { e.stopPropagation(); toggleSpin(v.id); }}
                            style={{ position: 'absolute', inset: '35%', background: 'radial-gradient(circle, rgb(var(--rgb-accent) / 0.12) 0%, rgb(0 0 0 / 0.75) 100%)', borderRadius: '50%', boxShadow: 'inset 0 2px 4px rgb(0 0 0 / 0.80)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'radial-gradient(circle, rgb(var(--rgb-accent) / 0.18) 0%, rgb(0 0 0 / 0.65) 100%)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'radial-gradient(circle, rgb(var(--rgb-accent) / 0.12) 0%, rgb(0 0 0 / 0.75) 100%)'}
                          >
                            {spinningVinyls[v.id] ? (
                              <div style={{ width: '40%', height: '40%', background: 'var(--c-text)', borderRadius: 2 }}></div>
                            ) : (
                              <div style={{ width: 0, height: 0, borderLeft: '15px solid var(--c-text)', borderTop: '10px solid transparent', borderBottom: '10px solid transparent', marginLeft: 4 }}></div>
                            )}
                          </div>
                        </div>

                        <div className="vinyl-title" style={{ fontSize: 14, fontWeight: 800, marginBottom: 4, lineHeight: 1.3, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {v.title}
                        </div>
                        <div className="vinyl-artist" style={{ fontSize: 12, color: 'var(--c-muted)', marginBottom: 12 }}>
                          {v.artist}
                        </div>

                        {(v.previewUrl || v.musicUrl) && (
                          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                            <div className="audio-available-badge" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: 'var(--c-badge-bg)', border: '1px solid var(--c-accent2)', padding: '6px 12px', borderRadius: 20, color: 'var(--c-accent2)', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                              <span>♫</span>
                              <span>Audio Available</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {topVinyls.length > 4 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 30 }}>
                    {Array.from({ length: Math.ceil(topVinyls.length / 4) }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCarouselIndex(i * 4)}
                        style={{ width: Math.floor(carouselIndex / 4) === i ? 30 : 10, height: 10, borderRadius: 5, background: Math.floor(carouselIndex / 4) === i ? 'var(--c-accent)' : 'rgb(255 255 255 / 0.18)', border: 'none', cursor: 'pointer', transition: 'all 0.3s' }}
                      />
                    ))}
                  </div>
                )}

                <div style={{ display: 'none' }}>
                  {vinyls.map(v => (
                    v.musicUrl && (
                      <audio
                        key={v.id}
                        ref={(el) => handleAudioRef(el, v.id)}
                        src={v.musicUrl}
                        onTimeUpdate={(e) => {
                          setCurrentTime(prev => ({ ...prev, [v.id]: e.target.currentTime }));
                        }}
                        onLoadedMetadata={(e) => {
                          setDuration(prev => ({ ...prev, [v.id]: e.target.duration }));
                        }}
                        onEnded={() => {
                          setSpinningVinyls(prev => ({ ...prev, [v.id]: false }));
                          setCurrentlyPlaying(null);
                        }}
                      />
                    )
                  ))}
                </div>
              </div>
            </div>

            </>
            )}

            {/* ==== PLAYLISTS SECTION ==== */}
            {viewMode === 'playlists' && (
            <div style={{ background: 'var(--g-surface-2)', border: '1px solid var(--c-border)', borderRadius: 16, padding: 32, boxShadow: '0 12px 40px rgb(var(--rgb-accent) / 0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <h2 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: 'var(--c-text)', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: 14, textTransform: 'uppercase', textShadow: '0 2px 10px rgb(var(--rgb-accent2) / 0.25)' }}>
                  <span style={{ fontSize: 36 }}>♫</span>
                  My Playlists
                </h2>
                <button
                  onClick={openPlaylistForm}
                  style={{ background: 'var(--c-accent2)', color: 'var(--c-ink)', border: '1px solid var(--c-accent2)', padding: '12px 24px', borderRadius: 10, fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.8px', cursor: 'pointer', boxShadow: '0 8px 20px rgb(var(--rgb-accent2) / 0.40)', transition: 'all 0.3s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)'; e.currentTarget.style.boxShadow = '0 12px 28px rgb(var(--rgb-accent2) / 0.50)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 8px 20px rgb(var(--rgb-accent2) / 0.40)'; }}
                >
                  + Create Playlist
                </button>
              </div>

              {playlists.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--g-surface)', borderRadius: 12, border: '1px solid var(--c-border)' }}>
                  <div style={{ fontSize: 64, marginBottom: 20, color: 'var(--c-accent2)', filter: 'drop-shadow(0 4px 12px rgb(var(--rgb-accent2) / 0.40))' }}>♫</div>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--c-text)' }}>No playlists yet</p>
                  <p style={{ margin: '12px 0 0 0', fontSize: 14, color: 'var(--c-muted)' }}>Create your first playlist to organize your music collection!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {playlists.map(playlist => (
                    <div key={playlist.id} style={{ background: 'var(--g-surface)', border: '2px solid var(--c-border)', borderRadius: 12, overflow: 'hidden', transition: 'all 0.3s' }}>
                      {/* Playlist Header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: 20, background: 'var(--g-surface-2)', cursor: 'pointer', transition: 'all 0.3s' }}
                        onClick={() => setSelectedPlaylist(selectedPlaylist?.id === playlist.id ? null : playlist)}
                        onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.05)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
                      >
                        {playlist.cover_url ? (
                          <img src={playlist.cover_url} alt={playlist.name} style={{ width: 100, height: 100, borderRadius: 10, objectFit: 'cover', boxShadow: '0 4px 16px rgb(0 0 0 / 0.50)', border: '2px solid var(--c-accent)' }} />
                        ) : (
                          <div style={{ width: 100, height: 100, borderRadius: 10, background: 'var(--c-accent2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: 'var(--c-ink)', boxShadow: '0 4px 16px rgb(var(--rgb-accent2) / 0.40)' }}>♫</div>
                        )}
                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: '0 0 8px 0', fontSize: 22, fontWeight: 900, color: 'var(--c-text)', letterSpacing: '0.5px', textShadow: '0 1px 0 rgb(var(--rgb-accent2) / 0.35)' }}>{playlist.name}</h3>
                          {playlist.description && (
                            <p style={{ margin: '0 0 8px 0', fontSize: 13, color: 'var(--c-muted)', lineHeight: 1.5 }}>{playlist.description}</p>
                          )}
                          <div style={{ fontSize: 13, color: 'var(--c-accent2)', fontWeight: 800 }}>
                            <span style={{ background: 'var(--c-badge-bg)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--c-accent2)' }}>{playlist.song_count || 0} songs</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => openEditPlaylist(playlist)}
                            style={{ background: 'var(--c-badge-bg)', color: 'var(--c-accent2)', border: '1.5px solid var(--c-accent2)', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 900, cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-accent2)'; e.currentTarget.style.color = 'var(--c-ink)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--c-badge-bg)'; e.currentTarget.style.color = 'var(--c-accent2)'; }}
                          >
                            ✎ Edit
                          </button>
                          <button 
                            onClick={() => handleDeletePlaylist(playlist.id)}
                            style={{ background: 'var(--c-accent2)', color: 'var(--c-ink)', border: '1.5px solid var(--c-accent2)', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 900, cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#a80f27'; e.currentTarget.style.color = 'var(--c-ink)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--c-accent2)'; e.currentTarget.style.color = 'var(--c-ink)'; }}
                          >
                            🗑 Delete
                          </button>
                        </div>
                        <div style={{ fontSize: 20, color: 'var(--c-accent2)', transition: 'all 0.3s', transform: selectedPlaylist?.id === playlist.id ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</div>
                      </div>

                      {/* Expanded Songs List */}
                      {selectedPlaylist?.id === playlist.id && (
                        <div style={{ padding: 20, background: 'var(--g-surface-2)', borderTop: '1px solid var(--c-border)', maxHeight: 600, overflowY: 'auto' }}>
                          {selectedPlaylist.songs && selectedPlaylist.songs.length > 0 ? (
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragStart={(event) => setActiveId(event.active.id)}
                              onDragEnd={handleDragEnd}
                            >
                              <SortableContext
                                items={selectedPlaylist.songs.map(s => s.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  {selectedPlaylist.songs.map((song, idx) => (
                                    <SortableItem
                                      key={song.id}
                                      id={song.id}
                                      song={song}
                                      onRemove={handleRemoveFromPlaylist}
                                      playlistId={selectedPlaylist.id}
                                    />
                                  ))}
                                </div>
                              </SortableContext>
                              <DragOverlay>
                                {(() => {
                                  const song = selectedPlaylist.songs.find((s) => s.id === activeId);
                                  if (!song) return null;
                                  return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'var(--c-accent2)', borderRadius: 10, boxShadow: '0 15px 40px rgb(var(--rgb-accent2) / 0.50)' }}>
                                      {song.coverUrl ? (
                                        <img src={song.coverUrl} alt={song.title} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '2px solid rgb(0 0 0 / 0.55)' }} />
                                      ) : (
                                        <div style={{ width: 60, height: 60, borderRadius: 8, background: 'rgb(0 0 0 / 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--c-text)' }}>♫</div>
                                      )}
                                      <div>
                                        <div style={{ fontWeight: 900, color: 'var(--c-ink)', fontSize: 15 }}>{song.title}</div>
                                        <div style={{ fontSize: 13, color: 'rgb(0 0 0 / 0.75)' }}>{song.artist} • {song.year}</div>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </DragOverlay>
                            </DndContext>
                          ) : (
                            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--c-muted)' }}>
                              <div style={{ fontSize: 48, marginBottom: 16, color: 'var(--c-accent2)', opacity: 0.6 }}>♪</div>
                              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--c-text)' }}>No songs in this playlist yet</p>
                              <p style={{ margin: '8px 0 0 0', fontSize: 13 }}>Click "Add to Playlist" on any song to add it here!</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {viewMode === 'songs' && (
            <div style={{ marginTop: 60, borderTop: '1px solid var(--c-border)', paddingTop: 40 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--c-text)', letterSpacing: '0.02em', textShadow: '0 2px 0 rgb(var(--rgb-accent2) / 0.25)' }}>Complete Collection</h2>
              </div>
              
              <div style={{ marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search by title, artist, or year..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  style={{ flex: 1, minWidth: 250, padding: '12px 16px', border: '1px solid var(--c-border)', borderRadius: 10, fontSize: 14, transition: 'border 0.2s, box-shadow 0.2s', background: 'var(--c-input-bg)', color: 'var(--c-text)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--c-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgb(var(--rgb-accent) / 0.12)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
                <select 
                  className="sort-dropdown"
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                  style={{ padding: '12px 16px', border: '1px solid var(--c-border)', borderRadius: 10, fontSize: 14, background: 'var(--c-input-bg)', color: 'var(--c-accent)', cursor: 'pointer', transition: 'border 0.2s, box-shadow 0.2s' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--c-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgb(var(--rgb-accent) / 0.12)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <option value="title">Sort by Title (A-Z)</option>
                  <option value="artist">Sort by Artist (A-Z)</option>
                  <option value="year-desc">Sort by Year (Newest)</option>
                  <option value="year-asc">Sort by Year (Oldest)</option>
                  <option value="likes">Sort by Likes (Most)</option>
                </select>
                {user?.role !== 'reader' && (
                  <button 
                    className="add-vinyl-btn"
                    onClick={openCreate} 
                    style={{ background: 'var(--c-accent2)', color: 'var(--c-ink)', border: '1px solid var(--c-accent2)', padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 900, transition: 'all 0.2s', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.5px', boxShadow: '0 10px 22px rgb(var(--rgb-accent2) / 0.25)' }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    Add Vinyl
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {filtered.map((v, index) => (
                  <div key={v.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: 'var(--g-surface)', borderRadius: 12, border: '1px solid var(--c-border)', boxShadow: '0 8px 18px rgb(0 0 0 / 0.35)', transition: 'all 0.2s', overflow: 'hidden' }}
                       onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--c-accent)'; e.currentTarget.style.boxShadow = '0 10px 24px rgb(var(--rgb-accent) / 0.15)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                       onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.boxShadow = '0 8px 18px rgb(0 0 0 / 0.35)'; e.currentTarget.style.transform = 'translateY(0)'; }}>

                    {isPreviewTrack(v) && (
                      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 20 }}>
                        <DemoBadge size={56} />
                      </div>
                    )}
                    
                    {/* Action Menu Button - Top Right */}
                    <button
                      className="vinyl-action-menu-btn"
                      onClick={() => setActionMenuId(actionMenuId === v.id ? null : v.id)}
                      style={{ position: 'absolute', top: 12, right: 12, background: 'var(--c-badge-bg)', border: '1px solid var(--c-accent2)', color: 'var(--c-accent2)', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, transition: 'all 0.3s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-accent)'; e.currentTarget.style.color = 'var(--c-ink)'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--c-badge-bg)'; e.currentTarget.style.color = 'var(--c-accent2)'; e.currentTarget.style.transform = 'scale(1)'; }}
                      aria-label="Open actions"
                    >
                      ⋯
                    </button>

                    {/* Sliding Action Menu */}
                    <div style={{ position: 'absolute', top: 0, right: actionMenuId === v.id ? 0 : '-120px', width: 50, height: '100%', background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.78))', backdropFilter: 'blur(10px)', borderLeft: actionMenuId === v.id ? '1px solid rgb(var(--rgb-accent) / 0.22)' : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '16px 0', zIndex: 15, transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                      <button
                        onClick={() => { setShowAddToPlaylist(v); setActionMenuId(null); }}
                        style={{ background: 'var(--c-badge-bg)', color: 'var(--c-accent2)', border: '1.5px solid var(--c-accent2)', width: 38, height: 38, borderRadius: 8, cursor: 'pointer', fontSize: 18, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', boxShadow: '0 2px 8px rgb(var(--rgb-accent2) / 0.20)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-accent2)'; e.currentTarget.style.color = 'var(--c-ink)'; e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgb(var(--rgb-accent2) / 0.40)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--c-badge-bg)'; e.currentTarget.style.color = 'var(--c-accent2)'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgb(var(--rgb-accent2) / 0.20)'; }}
                        title="Add to Playlist"
                      >
                        +
                      </button>
                      {(user?.role === 'admin' || (user?.role === 'user' && v.ownerId === user?.id)) && (
                        <>
                          <button
                            onClick={() => { openEdit(v); setActionMenuId(null); }}
                            style={{ background: 'var(--c-badge-bg)', color: 'var(--c-accent2)', border: '1.5px solid var(--c-accent2)', width: 38, height: 38, borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', boxShadow: '0 2px 8px rgb(var(--rgb-accent2) / 0.20)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-accent2)'; e.currentTarget.style.color = 'var(--c-ink)'; e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgb(var(--rgb-accent2) / 0.40)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--c-badge-bg)'; e.currentTarget.style.color = 'var(--c-accent2)'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgb(var(--rgb-accent2) / 0.20)'; }}
                            title="Edit"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => { onDelete(v.id); setActionMenuId(null); }}
                            style={{ background: 'var(--c-badge-bg)', color: 'var(--c-accent2)', border: '1.5px solid var(--c-accent2)', width: 38, height: 38, borderRadius: 8, cursor: 'pointer', fontSize: 18, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', boxShadow: '0 2px 8px rgb(var(--rgb-accent2) / 0.20)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-accent2)'; e.currentTarget.style.color = 'var(--c-ink)'; e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgb(var(--rgb-accent2) / 0.40)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--c-badge-bg)'; e.currentTarget.style.color = 'var(--c-accent2)'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgb(var(--rgb-accent2) / 0.20)'; }}
                            title="Delete"
                          >
                            🗑
                          </button>
                        </>
                      )}
                    </div>

                    <div className="vinyl-cover-container" style={{ width: '100%', paddingTop: '100%', borderRadius: 10, overflow: 'hidden', position: 'relative', background: 'var(--c-badge-bg)' }}>
                      {v.coverUrl && <img src={v.coverUrl} alt={v.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="vinyl-title" style={{ fontSize: 16, fontWeight: 900, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.title}
                      </div>
                      <div className="vinyl-artist" style={{ fontSize: 13, color: 'var(--c-muted)', marginTop: 4 }}>
                        {v.artist} • {v.year}
                      </div>
                      <div className="vinyl-genre" style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 6 }}>
                        {v.ownerName || 'Unknown'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {(v.previewUrl || v.musicUrl) && (
                        <button
                          className="vinyl-play-btn"
                          onClick={() => toggleSpin(v.id)}
                          style={{ background: spinningVinyls[v.id] ? 'var(--c-accent2)' : 'var(--c-badge-bg)', color: spinningVinyls[v.id] ? 'var(--c-ink)' : 'var(--c-accent2)', border: '1px solid var(--c-accent2)', padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'all 0.2s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 12px rgb(var(--rgb-accent) / 0.40)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                          {spinningVinyls[v.id] ? '⏸ Pause' : '▶ Play'}
                        </button>
                      )}
                      <button 
                        className="vinyl-like-btn"
                        onClick={() => handleLike(v.id)} 
                        style={{ background: 'var(--c-badge-bg)', border: '1px solid var(--c-accent2)', cursor: 'pointer', fontSize: 12, padding: '6px 10px', borderRadius: 20, color: 'var(--c-accent2)', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        {v.likes?.includes(user?.id) ? '💛' : '♡'}
                        <span className="vinyl-like-count" style={{ fontSize: 11, color: 'var(--c-accent2)' }}>{v.likes?.length || 0}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}
          </>
        )}

        {showForm && (
          <Modal onClose={() => setShowForm(false)}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: 28, fontWeight: 900, color: '#000', textTransform: 'uppercase', letterSpacing: '0.06em', textShadow: '0 2px 0 rgb(var(--rgb-accent2) / 0.25)' }}>{editing ? 'Edit Vinyl' : 'Add Vinyl'}</h3>
            
            {!editing && (
              <div style={{ marginBottom: 24, padding: 16, background: 'rgba(0,0,0,0.18)', borderRadius: 12, border: '1px solid var(--c-border)' }}>
                <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#000', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <span style={{ fontSize: 22, color: 'var(--c-accent2)' }}>♫</span>
                  Search Spotify
                </div>
                <form onSubmit={handleSpotifySearch} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input 
                    value={spotifySearch} 
                    onChange={e => setSpotifySearch(e.target.value)}
                    placeholder="e.g., Daft Punk Random Access"
                    style={{ flex: 1, padding: 12, border: '2px solid var(--c-border)', borderRadius: 10, fontSize: 15, background: 'rgba(0,0,0,0.85)', color: '#fff', fontWeight: 600 }}
                  />
                  <button 
                    type="submit" 
                    disabled={searchingSpotify}
                    style={{ padding: '10px 20px', background: 'var(--c-accent2)', color: 'var(--c-ink)', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 900, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.06em', boxShadow: '0 10px 22px rgb(var(--rgb-accent2) / 0.22)' }}
                  >
                    {searchingSpotify ? 'Searching...' : 'Search'}
                  </button>
                </form>
                
                {spotifyResults.length > 0 && (
                  <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--c-border)', borderRadius: 10, background: 'var(--c-input-bg)' }}>
                    {spotifyResults.map(track => (
                      <div 
                        key={track.id}
                        style={{ 
                          display: 'flex', 
                          gap: 12, 
                          padding: 12, 
                          borderBottom: '1px solid rgb(255 255 255 / 0.06)',
                          transition: 'background 0.2s',
                          alignItems: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        {track.coverUrl && (
                          <img src={track.coverUrl} alt={track.title} style={{ width: 50, height: 50, borderRadius: 4, objectFit: 'cover' }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--c-text)' }}>
                            {track.title}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 2 }}>
                            {track.artist} • {track.year}
                          </div>
                          {track.previewUrl && (
                            <div style={{ fontSize: 11, color: 'var(--c-accent2)', marginTop: 2, fontWeight: 800 }}>
                              ✓ 30s preview available
                            </div>
                          )}
                          {!track.previewUrl && (
                            <div style={{ fontSize: 11, color: 'var(--c-accent3)', marginTop: 2, fontWeight: 800 }}>
                              No Spotify preview. Upload your own audio to enable play/add.
                            </div>
                          )}
                          {spotifyUploads[track.id]?.musicUrl && (
                            <div style={{ fontSize: 11, color: 'var(--c-accent2)', marginTop: 2, fontWeight: 800 }}>
                              ✓ Custom audio uploaded
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {!track.previewUrl && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--c-muted)', cursor: 'pointer' }}>
                              <input
                                type="file"
                                accept="audio/mpeg,audio/wav,audio/ogg,audio/flac"
                                style={{ display: 'none' }}
                                onChange={(e) => handleSpotifyUpload(track.id, e.target.files?.[0])}
                              />
                              <span style={{ background: 'rgba(255,255,255,0.06)', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--c-border)', color: 'var(--c-text)', fontWeight: 800 }}>
                                {spotifyUploads[track.id]?.uploading ? 'Uploading...' : 'Upload audio'}
                              </span>
                            </label>
                          )}
                          {track.previewUrl && (
                            <button
                              type="button"
                              onClick={() => togglePreview(track)}
                              style={{ background: playingPreview === track.id ? 'var(--c-danger)' : 'var(--c-accent2)', color: 'var(--c-ink)', border: 'none', padding: '6px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap', transition: 'all 0.2s', boxShadow: playingPreview === track.id ? '0 10px 22px rgb(var(--rgb-danger) / 0.20)' : '0 10px 22px rgb(var(--rgb-accent2) / 0.20)' }}
                              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                            >
                              {playingPreview === track.id ? '⏸ Stop' : '▶ Play'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => fillFromSpotify(track)}
                            style={{ background: 'rgba(0,0,0,0.35)', color: 'var(--c-text)', border: '1px solid var(--c-border)', padding: '6px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap' }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => quickAddFromSpotify(track)}
                            disabled={!track.previewUrl && !spotifyUploads[track.id]?.musicUrl}
                            style={{ background: (track.previewUrl || spotifyUploads[track.id]?.musicUrl) ? 'var(--c-accent2)' : 'rgba(255,255,255,0.12)', color: (track.previewUrl || spotifyUploads[track.id]?.musicUrl) ? 'var(--c-ink)' : 'var(--c-muted)', border: '1px solid var(--c-border)', padding: '6px 12px', borderRadius: 10, cursor: (track.previewUrl || spotifyUploads[track.id]?.musicUrl) ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap', boxShadow: (track.previewUrl || spotifyUploads[track.id]?.musicUrl) ? '0 10px 22px rgb(var(--rgb-accent2) / 0.20)' : 'none' }}
                            onMouseEnter={(e) => { if (track.previewUrl || spotifyUploads[track.id]?.musicUrl) e.currentTarget.style.opacity = '0.9'; }}
                            onMouseLeave={(e) => { if (track.previewUrl || spotifyUploads[track.id]?.musicUrl) e.currentTarget.style.opacity = '1'; }}
                          >
                            {(track.previewUrl || spotifyUploads[track.id]?.musicUrl) ? '✓ Add' : 'No audio'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {spotifyResults.length === 0 && spotifySearch && !searchingSpotify && (
                  <div style={{ padding: 12, textAlign: 'center', color: 'var(--c-muted)', fontSize: 12 }}>
                    No results found
                  </div>
                )}
              </div>
            )}
            
            <form onSubmit={onSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 900, marginBottom: 8, color: '#000', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Title<br />
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required style={{ width: '100%', padding: 12, marginTop: 6, border: '2px solid var(--c-border)', borderRadius: 10, fontSize: 15, transition: 'border 0.2s, box-shadow 0.2s', background: 'rgba(0,0,0,0.85)', color: '#fff', fontWeight: 600 }} onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--c-accent2)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgb(var(--rgb-accent2) / 0.15)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.boxShadow = 'none'; }} />
                </label>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 900, marginBottom: 8, color: '#000', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Artist<br />
                  <input value={form.artist} onChange={e => setForm({ ...form, artist: e.target.value })} required style={{ width: '100%', padding: 12, marginTop: 6, border: '2px solid var(--c-border)', borderRadius: 10, fontSize: 15, transition: 'border 0.2s, box-shadow 0.2s', background: 'rgba(0,0,0,0.85)', color: '#fff', fontWeight: 600 }} onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--c-accent2)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgb(var(--rgb-accent2) / 0.15)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.boxShadow = 'none'; }} />
                </label>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 900, marginBottom: 8, color: '#000', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Year<br />
                  <input type="number" value={form.year} onChange={e => setForm({ ...form, year: parseInt(e.target.value) })} style={{ width: '100%', padding: 12, marginTop: 6, border: '2px solid var(--c-border)', borderRadius: 10, fontSize: 15, transition: 'border 0.2s, box-shadow 0.2s', background: 'rgba(0,0,0,0.85)', color: '#fff', fontWeight: 600 }} onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--c-accent2)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgb(var(--rgb-accent2) / 0.15)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.boxShadow = 'none'; }} />
                </label>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 900, marginBottom: 8, color: '#000', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cover Image<br />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                    <input 
                      type="file" 
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleCoverUpload}
                      disabled={uploading}
                      style={{ flex: 1 }}
                    />
                    {uploading && <span style={{ fontSize: 12, color: 'var(--c-muted)' }}>Uploading...</span>}
                  </div>
                  {form.coverUrl && (
                    <div style={{ marginTop: 8, textAlign: 'center' }}>
                      <img src={form.coverUrl} alt="Preview" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 4 }} />
                    </div>
                  )}
                </label>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 900, marginBottom: 8, color: '#000', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Music (optional)<br />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                    <input 
                      type="file" 
                      accept="audio/mpeg,audio/wav,audio/ogg,audio/flac"
                      onChange={handleMusicUpload}
                      disabled={uploadingMusic}
                      style={{ flex: 1 }}
                    />
                    {uploadingMusic && <span style={{ fontSize: 12, color: 'var(--c-muted)' }}>Uploading...</span>}
                  </div>
                  {form.musicUrl && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--c-muted)' }}>
                      ✓ Music uploaded
                    </div>
                  )}
                </label>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 900, marginBottom: 8, color: '#000', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Timed Lyrics (.lrc) (optional)<br />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                    <input
                      type="file"
                      accept=".lrc,text/plain"
                      onChange={handleLyricsUpload}
                      style={{ flex: 1 }}
                    />
                    {form.lyricsLrc ? (
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, lyricsLrc: '' }))}
                        style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.25)', color: 'var(--c-text)', border: '1px solid var(--c-border)', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  {form.lyricsLrc && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--c-muted)' }}>
                      ✓ Lyrics loaded
                    </div>
                  )}
                </label>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 900, marginBottom: 8, color: '#000', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Note<br />
                  <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="e.g. Where I bought it, favorite track..." style={{ width: '100%', padding: 12, marginTop: 6, border: '2px solid var(--c-border)', borderRadius: 10, fontSize: 15, transition: 'border 0.2s, box-shadow 0.2s', background: 'rgba(0,0,0,0.85)', color: '#fff', fontWeight: 600 }} onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--c-accent2)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgb(var(--rgb-accent2) / 0.15)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.boxShadow = 'none'; }} />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="submit" style={{ flex: 1, padding: '10px 16px', background: 'var(--c-accent2)', color: 'var(--c-ink)', border: '1px solid var(--c-accent2)', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 900, transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.08em', boxShadow: '0 10px 22px rgb(var(--rgb-accent2) / 0.22)' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>Save</button>
                <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px 16px', background: 'rgba(0,0,0,0.25)', color: 'var(--c-text)', border: '1px solid var(--c-border)', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 900, transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.08em' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.25)'; }}>Cancel</button>
              </div>
            </form>
          </Modal>
        )}

        {currentlyPlaying && (
          <div
            className="mini-player"
            ref={miniPlayerRef}
            onPointerDown={startMiniDrag}
            onPointerMove={moveMiniDrag}
            onPointerUp={endMiniDrag}
            onPointerCancel={endMiniDrag}
            style={{ 
              position: 'fixed', 
              left: miniPlayerPos.x, 
              top: miniPlayerPos.y, 
              width: 360, 
              background: 'var(--c-surface)', 
              borderRadius: 20, 
              border: '2px solid var(--c-accent2)', 
              boxShadow: '0 20px 50px rgb(var(--rgb-accent2) / 0.5), 0 0 80px rgb(var(--rgb-accent2) / 0.25)', 
              padding: 20, 
              zIndex: 1000,
              cursor: 'grab',
              touchAction: 'none',
              userSelect: 'none'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--c-accent2)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>♪</span> NOW PLAYING
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (audioRefsRef.current[currentlyPlaying.id]) {
                    audioRefsRef.current[currentlyPlaying.id].pause();
                  }
                  setSpinningVinyls(prev => ({ ...prev, [currentlyPlaying.id]: false }));
                  setCurrentlyPlaying(null);
                }}
                style={{ background: 'var(--c-badge-bg)', border: '2px solid var(--c-accent2)', fontSize: 16, color: 'var(--c-accent2)', cursor: 'pointer', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, transition: 'all 0.2s', fontWeight: 900 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-accent2)'; e.currentTarget.style.color = 'var(--c-ink)'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--c-badge-bg)'; e.currentTarget.style.color = 'var(--c-accent2)'; e.currentTarget.style.transform = 'rotate(0deg)'; }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div style={{ width: 80, height: 80, background: 'var(--c-badge-bg)', borderRadius: 16, overflow: 'hidden', flexShrink: 0, border: '2px solid var(--c-accent2)', boxShadow: '0 8px 20px rgb(var(--rgb-accent2) / 0.35)' }}>
                {currentlyPlaying.coverUrl ? (
                  <img src={currentlyPlaying.coverUrl} alt={currentlyPlaying.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: 'var(--c-accent2)', fontWeight: 900 }}>♪</div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, marginBottom: 6 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1, textShadow: '0 1px 0 rgb(var(--rgb-accent2) / 0.25)' }}>
                    {currentlyPlaying.title}
                  </div>
                  {isPreviewTrack(currentlyPlaying) && (
                    <DemoBadge size={34} />
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--c-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>
                  {currentlyPlaying.artist}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSpin(currentlyPlaying.id); }}
                    style={{ background: 'var(--c-accent2)', color: 'var(--c-ink)', border: '2px solid var(--c-accent2)', width: 44, height: 44, borderRadius: 14, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', boxShadow: '0 6px 0 rgb(var(--rgb-accent2) / 0.4)', fontWeight: 900 }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    {spinningVinyls[currentlyPlaying.id] ? '⏸' : '▶'}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFullscreenPlayer(true); }}
                    style={{ background: 'var(--c-badge-bg)', color: 'var(--c-accent2)', border: '2px solid var(--c-accent2)', width: 44, height: 44, borderRadius: 14, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', fontWeight: 900 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-accent2)'; e.currentTarget.style.color = 'var(--c-ink)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--c-badge-bg)'; e.currentTarget.style.color = 'var(--c-accent2)'; }}
                    title="Fullscreen player"
                  >
                    ⛶
                  </button>
                </div>
              </div>
            </div>

            <div>
              <div
                style={{ height: 8, background: 'var(--c-badge-bg)', borderRadius: 999, overflow: 'hidden', cursor: 'pointer', position: 'relative', border: '2px solid var(--c-accent2)', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.3)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!audioRefsRef.current[currentlyPlaying.id] || !duration[currentlyPlaying.id]) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  const newTime = percent * duration[currentlyPlaying.id];
                  audioRefsRef.current[currentlyPlaying.id].currentTime = newTime;
                }}
              >
                <div style={{
                  height: '100%',
                  background: 'var(--c-accent2)',
                  width: `${((currentTime[currentlyPlaying.id] || 0) / (duration[currentlyPlaying.id] || 1)) * 100}%`,
                  transition: 'width 0.1s linear',
                  boxShadow: '0 0 12px rgb(var(--rgb-accent2) / 0.6)',
                  position: 'relative'
                }}>
                  <div style={{ position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, background: 'var(--c-ink)', borderRadius: '50%', border: '2px solid var(--c-accent2)', boxShadow: '0 0 10px rgb(var(--rgb-accent2) / 0.8)' }}></div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--c-text)', marginTop: 8, fontWeight: 800 }}>
                <span>{formatTime(currentTime[currentlyPlaying.id] || 0)}</span>
                <span>{formatTime(duration[currentlyPlaying.id] || 0)}</span>
              </div>
            </div>
          </div>
        )}

        {fullscreenPlayer && currentlyPlaying && (
          <div className="fullscreen-player" style={{ position: 'fixed', inset: 0, background: 'var(--c-surface)', display: 'flex', flexDirection: 'column', zIndex: 2000, overflow: 'hidden' }}>

            {/* Close Button */}
            <button
              onClick={() => setFullscreenPlayer(false)}
              style={{ position: 'absolute', top: 32, right: 32, background: 'var(--c-badge-bg)', border: '2px solid var(--c-accent2)', color: 'var(--c-accent2)', fontSize: 28, width: 56, height: 56, borderRadius: 14, cursor: 'pointer', transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, zIndex: 100, boxShadow: '0 8px 24px rgb(var(--rgb-accent2) / 0.35)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-accent2)'; e.currentTarget.style.color = 'var(--c-ink)'; e.currentTarget.style.transform = 'rotate(90deg) scale(1.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--c-badge-bg)'; e.currentTarget.style.color = 'var(--c-accent2)'; e.currentTarget.style.transform = 'rotate(0deg) scale(1)'; }}
            >
              ✕
            </button>

            {/* Header - Track Info */}
            <div style={{ position: 'relative', zIndex: 10, padding: '40px 60px', textAlign: 'center', borderBottom: '2px solid var(--c-accent2)', background: 'var(--c-surface)', boxShadow: '0 6px 20px rgb(var(--rgb-accent2) / 0.25)' }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--c-accent2)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>♪</span> NOW PLAYING
              </div>
              <h1 style={{ margin: 0, color: 'var(--c-text)', fontSize: 52, fontWeight: 900, marginBottom: 16, letterSpacing: '0.02em', textShadow: '0 2px 0 rgb(var(--rgb-accent2) / 0.35)' }}>
                {currentlyPlaying.title}
              </h1>

              {isPreviewTrack(currentlyPlaying) && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                  <DemoBadge size={58} />
                </div>
              )}

              <p style={{ margin: 0, color: 'var(--c-text)', fontSize: 26, fontWeight: 800, letterSpacing: '0.5px' }}>
                {currentlyPlaying.artist}
              </p>
              {currentlyPlaying.year && (
                <p style={{ margin: '10px 0 0 0', color: 'var(--c-muted)', fontSize: 15, letterSpacing: '1px', fontWeight: 800 }}>
                  {currentlyPlaying.year}
                </p>
              )}
            </div>

            {/* Main Content - Lyrics */}
            <div 
              ref={lyricsContainerRef}
              style={{ flex: 1, position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', padding: '40px 20px', overflowY: 'auto', overflowX: 'hidden' }}>
              <div style={{ width: '100%', maxWidth: 900, padding: '0 40px' }}>
                {lyrics ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {lyricsLines.map((line, idx) => {
                      const highlight = idx === currentLyricIndex;
                      const isPast = idx < currentLyricIndex;
                      
                      return (
                        <p
                          key={idx}
                          ref={highlight ? activeLyricRef : null}
                          onClick={() => {
                            const audio = audioRefsRef.current[currentlyPlaying.id];
                            if (!audio) return;
                            audio.volume = 1;
                            audio.currentTime = (line.startTime || 0) / 1000;
                          }}
                          style={{
                            margin: 0,
                            padding: '16px 24px',
                            color: highlight ? 'var(--c-accent2)' : isPast ? 'var(--c-text)' : 'var(--c-muted)',
                            fontSize: highlight ? 32 : isPast ? 24 : 20,
                            fontWeight: highlight ? 900 : isPast ? 600 : 500,
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            borderLeft: highlight ? '5px solid var(--c-accent2)' : 'none',
                            paddingLeft: highlight ? 24 : 24,
                            lineHeight: 1.7,
                            textAlign: 'center',
                            textShadow: highlight ? '0 0 24px rgb(var(--rgb-accent2) / 0.6), 0 2px 0 rgb(0 0 0 / 0.5)' : 'none',
                            transform: highlight ? 'translateX(8px) scale(1.02)' : 'translateX(0) scale(1)',
                            borderRadius: 12,
                            background: highlight ? 'rgba(0,0,0,0.15)' : 'transparent',
                            cursor: 'pointer'
                          }}
                        >
                          {line.text}
                        </p>
                      );
                    })}
                    {/* Spacer for scroll */}
                    <div style={{ height: 200 }}></div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 }}>
                    <span style={{ fontSize: 48 }}>🎵</span>
                    <span style={{ color: 'var(--c-muted)', fontSize: 18, fontWeight: 800 }}>
                      {isPreviewTrack(currentlyPlaying) ? 'Lyrics disabled for preview tracks' : 'Lyrics not available for this track'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer - Controls */}
            <div style={{ position: 'relative', zIndex: 10, padding: '28px 60px 36px', borderTop: '2px solid var(--c-accent2)', background: 'var(--c-surface)', boxShadow: '0 -6px 20px rgb(var(--rgb-accent2) / 0.15)' }}>
              {/* Progress Bar */}
              <div style={{ marginBottom: 28 }}>
                <div
                  style={{ 
                    height: 10, 
                    background: 'var(--c-badge-bg)', 
                    borderRadius: 999, 
                    overflow: 'hidden', 
                    cursor: 'pointer', 
                    position: 'relative', 
                    border: '2px solid var(--c-accent2)',
                    boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3)'
                  }}
                  onClick={(e) => {
                    if (!audioRefsRef.current[currentlyPlaying.id] || !duration[currentlyPlaying.id]) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const percent = (e.clientX - rect.left) / rect.width;
                    const newTime = percent * duration[currentlyPlaying.id];
                    audioRefsRef.current[currentlyPlaying.id].currentTime = newTime;
                  }}
                >
                  <div style={{
                    height: '100%',
                    background: 'var(--c-accent2)',
                    width: `${((currentTime[currentlyPlaying.id] || 0) / (duration[currentlyPlaying.id] || 1)) * 100}%`,
                    transition: 'width 0.1s linear',
                    boxShadow: '0 0 24px rgb(var(--rgb-accent2) / 0.7)',
                    position: 'relative'
                  }}>
                    <div style={{ position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, background: 'var(--c-ink)', borderRadius: '50%', border: '3px solid var(--c-accent2)', boxShadow: '0 0 16px rgb(var(--rgb-accent2) / 0.9)' }}></div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--c-text)', fontSize: 14, marginTop: 14, fontWeight: 900, letterSpacing: '0.5px' }}>
                  <span>{formatTime(currentTime[currentlyPlaying.id] || 0)}</span>
                  <span>{formatTime(duration[currentlyPlaying.id] || 0)}</span>
                </div>
              </div>

              {/* Play/Pause */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <button
                  onClick={() => toggleSpin(currentlyPlaying.id)}
                  style={{ 
                    background: 'var(--c-accent2)', 
                    color: 'var(--c-ink)', 
                    border: '3px solid var(--c-accent2)', 
                    width: 90, 
                    height: 90, 
                    borderRadius: 24, 
                    cursor: 'pointer', 
                    fontSize: 40, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
                    boxShadow: '0 16px 0 rgb(var(--rgb-accent2) / 0.5), 0 20px 50px rgb(var(--rgb-accent2) / 0.45)',
                    fontWeight: 900,
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => { 
                    e.currentTarget.style.transform = 'translateY(-6px)'; 
                    e.currentTarget.style.boxShadow = '0 22px 0 rgb(var(--rgb-accent2) / 0.5), 0 26px 60px rgb(var(--rgb-accent2) / 0.60)'; 
                  }}
                  onMouseLeave={(e) => { 
                    e.currentTarget.style.transform = 'translateY(0)'; 
                    e.currentTarget.style.boxShadow = '0 16px 0 rgb(var(--rgb-accent2) / 0.5), 0 20px 50px rgb(var(--rgb-accent2) / 0.45)'; 
                  }}
                >
                  {spinningVinyls[currentlyPlaying.id] ? '⏸' : '▶'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Playlist Form Modal */}
        {showPlaylistForm && (
          <div className="modal-overlay" onClick={() => setShowPlaylistForm(false)} style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--g-surface-2)', border: '1px solid rgb(var(--rgb-accent) / 0.32)', borderRadius: 16, maxWidth: 550, boxShadow: '0 20px 60px rgb(var(--rgb-accent) / 0.20)' }}>
              <div style={{ borderBottom: '1px solid var(--c-border)', padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--c-accent2)', textShadow: '0 1px 0 rgb(var(--rgb-accent2) / 0.35)' }}>
                  {editingPlaylist ? '✎ Edit Playlist' : '+ Create Playlist'}
                </h3>
                <button onClick={() => setShowPlaylistForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--c-accent)', fontSize: 32, cursor: 'pointer', padding: 0, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgb(var(--rgb-accent) / 0.12)'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'rotate(0deg)'; }}
                >×</button>
              </div>
              <form onSubmit={handlePlaylistSubmit} style={{ padding: 24 }}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 900, color: 'var(--c-accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Playlist Name*</label>
                  <input
                    type="text"
                    value={playlistForm.name}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, name: e.target.value })}
                    placeholder="My Awesome Playlist"
                    required
                    style={{ width: '100%', padding: '12px 16px', background: 'var(--c-input-bg)', border: '1.5px solid var(--c-border)', borderRadius: 10, fontSize: 15, color: 'var(--c-text)', transition: 'all 0.2s', boxSizing: 'border-box' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--c-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgb(var(--rgb-accent) / 0.12)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 900, color: 'var(--c-accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</label>
                  <textarea
                    value={playlistForm.description}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, description: e.target.value })}
                    placeholder="Tell us about this playlist..."
                    rows={3}
                    style={{ width: '100%', padding: '12px 16px', background: 'var(--c-input-bg)', border: '1.5px solid var(--c-border)', borderRadius: 10, fontSize: 14, color: 'var(--c-text)', resize: 'vertical', transition: 'all 0.2s', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--c-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgb(var(--rgb-accent) / 0.12)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 900, color: 'var(--c-accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cover Image</label>
                  <div 
                    onDrop={handlePlaylistCoverDrop}
                    onDragOver={(e) => e.preventDefault()}
                    style={{
                      border: '2px dashed var(--c-accent)',
                      borderRadius: 12,
                      padding: 32,
                      textAlign: 'center',
                      cursor: 'pointer',
                      marginBottom: 12,
                      background: playlistForm.coverUrl ? `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${playlistForm.coverUrl}) center/cover` : 'linear-gradient(135deg, rgb(var(--rgb-accent) / 0.06), rgb(var(--rgb-accent3) / 0.06))',
                      transition: 'all 0.3s',
                      minHeight: 120,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onClick={() => document.getElementById('playlist-cover-file-input').click()}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--c-accent)'; e.currentTarget.style.background = playlistForm.coverUrl ? `linear-gradient(rgba(0,0,0,0.38), rgba(0,0,0,0.38)), url(${playlistForm.coverUrl}) center/cover` : 'linear-gradient(135deg, rgb(var(--rgb-accent) / 0.12), rgb(var(--rgb-accent3) / 0.12))'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--c-accent)'; e.currentTarget.style.background = playlistForm.coverUrl ? `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${playlistForm.coverUrl}) center/cover` : 'linear-gradient(135deg, rgb(var(--rgb-accent) / 0.06), rgb(var(--rgb-accent3) / 0.06))'; }}
                  >
                    {uploadingPlaylistCover ? (
                      <div style={{ color: 'var(--c-accent)', fontWeight: 900 }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>⟳</div>
                        <div>Uploading...</div>
                      </div>
                    ) : playlistForm.coverUrl ? (
                      <div style={{ background: 'rgba(0,0,0,0.55)', color: 'var(--c-accent)', padding: 16, borderRadius: 10, backdropFilter: 'blur(10px)' }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>Cover uploaded</div>
                        <small style={{ color: 'var(--c-muted)' }}>Click or drag to replace</small>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 40, marginBottom: 12, color: 'var(--c-accent)' }}>📁</div>
                        <div style={{ fontWeight: 900, color: 'var(--c-accent)', marginBottom: 6 }}>Drop image here or click to browse</div>
                        <small style={{ color: 'var(--c-muted)' }}>PNG, JPG, WEBP up to 5MB</small>
                      </div>
                    )}
                  </div>
                  <input
                    id="playlist-cover-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handlePlaylistCoverUpload}
                    style={{ display: 'none' }}
                  />
                  <input
                    type="url"
                    value={playlistForm.coverUrl}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, coverUrl: e.target.value })}
                    placeholder="Or paste image URL..."
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.22)', border: '1.5px solid var(--c-border)', borderRadius: 10, fontSize: 13, color: 'var(--c-text)', transition: 'all 0.2s', boxSizing: 'border-box' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--c-accent)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--c-border)'; }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12, paddingTop: 20, borderTop: '1px solid var(--c-border)' }}>
                  <button type="button" onClick={() => setShowPlaylistForm(false)} style={{ flex: 1, background: 'transparent', border: '1.5px solid var(--c-border)', color: 'var(--c-muted)', padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--c-danger)'; e.currentTarget.style.color = 'var(--c-danger)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.color = 'var(--c-muted)'; }}
                  >
                    Cancel
                  </button>
                  <button type="submit" style={{ flex: 1, background: 'var(--c-accent2)', border: '1px solid var(--c-accent2)', color: 'var(--c-ink)', padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', boxShadow: '0 10px 22px rgb(var(--rgb-accent2) / 0.22)', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgb(var(--rgb-accent) / 0.28)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 22px rgb(var(--rgb-accent) / 0.22)'; }}
                  >
                    {editingPlaylist ? 'Save Changes' : 'Create Playlist'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add to Playlist Modal */}
        {showAddToPlaylist && (
          <div className="modal-overlay" onClick={() => setShowAddToPlaylist(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Add to Playlist</h3>
                <button className="modal-close" onClick={() => setShowAddToPlaylist(null)}>×</button>
              </div>
              <p style={{ margin: '0 0 20px 0', color: 'var(--c-muted)' }}>
                Add <strong>{showAddToPlaylist.title}</strong> to:
              </p>
              {playlists.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--c-muted)' }}>
                  <p>No playlists yet. Create one first!</p>
                  <button 
                    className="modal-btn modal-btn-primary"
                    onClick={() => {
                      setShowAddToPlaylist(null);
                      openPlaylistForm();
                    }}
                    style={{ marginTop: 12 }}
                  >
                    Create Playlist
                  </button>
                </div>
              ) : (
                <div className="playlist-selector">
                  {playlists.map(playlist => (
                    <div
                      key={playlist.id}
                      className="playlist-selector-item"
                      onClick={() => handleAddToPlaylist(playlist.id)}
                    >
                      {playlist.cover_url ? (
                        <img src={playlist.cover_url} alt={playlist.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--c-accent2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-ink)', fontSize: 20, fontWeight: 900 }}>
                          🎵
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{playlist.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{playlist.song_count || 0} songs</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}


      </div>
    </div>
  );
}
