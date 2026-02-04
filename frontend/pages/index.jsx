import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { getVinyls, createVinyl, updateVinyl, deleteVinyl, getToken, clearToken, likeVinyl, unlikeVinyl, uploadCover, uploadMusic, uploadPlaylistCover, searchSpotify, getPlaylists, createPlaylist, updatePlaylist, deletePlaylist, addSongToPlaylist, removeSongFromPlaylist, reorderPlaylist, getPlaylist } from '../utils/api';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function Modal({ children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', padding: 32, minWidth: 320, borderRadius: 8, maxWidth: 500, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
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
        <div className="playlist-song-cover" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }} />
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
  const [form, setForm] = useState({ title: '', artist: '', year: new Date().getFullYear(), coverUrl: '', musicUrl: '', note: '' });
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
  const [volume, setVolume] = useState(0.7);
  const [currentTime, setCurrentTime] = useState({});
  const [duration, setDuration] = useState({});
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState('songs');
  const [actionMenuId, setActionMenuId] = useState(null);
  const [fullscreenPlayer, setFullscreenPlayer] = useState(false);
  const itemsPerPage = 12;
  const [coverGradient, setCoverGradient] = useState('linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)');
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
      setCoverGradient('linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)');
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

  const handleAudioRef = useCallback((el, vinylId) => {
    if (el) {
      audioRefsRef.current[vinylId] = el;
      el.volume = volume;
    }
  }, [volume]);

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

  function openCreate() {
    setEditing(null);
    setForm({ title: '', artist: '', year: new Date().getFullYear(), coverUrl: '', musicUrl: '', note: '' });
    setSpotifySearch('');
    setSpotifyResults([]);
    setSpotifyUploads({});
    setPlayingPreview(null);
    if (previewAudioRef.current) previewAudioRef.current.pause();
    setShowForm(true);
  }

  function openEdit(v) {
    setEditing(v);
    setForm({ title: v.title, artist: v.artist, year: v.year, coverUrl: v.coverUrl, musicUrl: v.musicUrl || '', note: v.note });
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
      const formData = new FormData();
      formData.append('cover', file);
      
      const response = await fetch('http://localhost:4001/upload-cover', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        },
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      setForm(prev => ({ ...prev, coverUrl: data.url }));
    } catch (err) {
      alert('Failed to upload cover: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleMusicUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingMusic(true);
    try {
      const formData = new FormData();
      formData.append('music', file);
      
      const response = await fetch('http://localhost:4001/upload-music', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        },
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      console.log('Music uploaded, URL:', data.url);
      setForm(prev => {
        const updated = { ...prev, musicUrl: data.url };
        console.log('Form updated with musicUrl:', updated);
        return updated;
      });
    } catch (err) {
      alert('Failed to upload music: ' + err.message);
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
      audio.volume = 0.7;
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
      if (vinyl?.musicUrl && audioRefsRef.current[id]) {
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
    <div style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'linear-gradient(135deg, #0a0a0a, #1a1a1a)', borderBottom: '2px solid #FFD700' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="burger-button"
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                border: 'none',
                background: menuOpen ? 'linear-gradient(135deg, #FFD54A, #F0C000)' : 'linear-gradient(135deg, #1a1a1a, #0f0f0f)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: menuOpen ? '0 6px 20px rgba(255,213,74,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' : '0 6px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,213,74,0.1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                if (!menuOpen) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #2a2a2a, #1a1a1a)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(255,213,74,0.3), inset 0 1px 0 rgba(255,213,74,0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (!menuOpen) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #1a1a1a, #0f0f0f)';
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,213,74,0.1)';
                }
              }}
              aria-label="Toggle menu"
            >
              <div style={{ width: 22, height: 22, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {!menuOpen ? (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4.5 }}>
                    <div style={{ width: '100%', height: 2.5, background: 'linear-gradient(90deg, #FFD54A, #F0C000)', borderRadius: 3, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 1px 2px rgba(255,213,74,0.4)' }} />
                    <div style={{ width: '75%', height: 2.5, background: 'linear-gradient(90deg, #FFD54A, #F0C000)', borderRadius: 3, marginLeft: 'auto', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 1px 2px rgba(255,213,74,0.4)' }} />
                    <div style={{ width: '100%', height: 2.5, background: 'linear-gradient(90deg, #FFD54A, #F0C000)', borderRadius: 3, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 1px 2px rgba(255,213,74,0.4)' }} />
                  </div>
                ) : (
                  <div style={{ position: 'relative', width: 22, height: 22 }}>
                    <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: 2.5, background: '#0b0b0b', borderRadius: 3, transform: 'rotate(45deg)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
                    <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: 2.5, background: '#0b0b0b', borderRadius: 3, transform: 'rotate(-45deg)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
                  </div>
                )}
              </div>
            </button>
            <h1 className="logo-animated" style={{ margin: 0, fontSize: 32, fontWeight: 900, letterSpacing: '0.08em', color: '#ffffff', textShadow: '0 2px 16px rgba(255,255,255,0.5), 0 0 20px rgba(255,215,74,0.3)', filter: 'drop-shadow(0 2px 8px rgba(255,255,255,0.2))', transition: 'all 0.3s ease' }}>
              MEDIOTEKA
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {user && <span style={{ fontSize: 12, color: '#999' }}>Welcome, <strong style={{ color: '#FFD700', fontWeight: 700 }}>{user.username}</strong> ({user.role})</span>}
            <button
              onClick={handleLogout}
              style={{ background: '#DC0000', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(220,0,0,0.3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(220,0,0,0.5)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(220,0,0,0.3)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              Logout
            </button>
          </div>
        </div>
        {menuOpen && (
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px 16px 24px' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => { setViewMode('songs'); setMenuOpen(false); }}
                style={{ background: viewMode === 'songs' ? '#FFD700' : 'transparent', color: viewMode === 'songs' ? '#000' : '#FFD700', border: '2px solid #FFD700', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}
              >
                ♫ Songs
              </button>
              <button
                onClick={() => { setViewMode('playlists'); setMenuOpen(false); }}
                style={{ background: viewMode === 'playlists' ? '#FFD700' : 'transparent', color: viewMode === 'playlists' ? '#000' : '#FFD700', border: '2px solid #FFD700', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}
              >
                📂 Playlists
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '40px 24px' }}>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>Loading...</div>
        ) : (
          <>
            {viewMode === 'songs' && (
            <>
              <div style={{ marginBottom: 32, background: 'linear-gradient(135deg, #0b0b0b, #151515)', color: '#FFD54A', border: '2px solid #2a2a2a', borderRadius: 12, padding: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(90deg, rgba(255,213,74,0.03) 1px, transparent 1px), linear-gradient(0deg, rgba(255,213,74,0.03) 1px, transparent 1px)', backgroundSize: '14px 14px', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ fontFamily: 'monospace', letterSpacing: '0.05em', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ padding: '4px 8px', background: '#0b0b0b', border: '1px solid #FFD54A', borderRadius: 6, color: '#FFD54A', fontWeight: 700 }}>8-bit</span>
                  <span style={{ color: '#e6e6e6' }}>Arcade</span>
                </div>
                
                {/* Simple game tabs */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setCurrentGame('blackjack')}
                    style={{ 
                      background: currentGame === 'blackjack' ? '#FFD54A' : '#1a1a1a', 
                      color: currentGame === 'blackjack' ? '#0b0b0b' : '#9a9a9a', 
                      border: '1px solid ' + (currentGame === 'blackjack' ? '#FFD54A' : '#2a2a2a'), 
                      padding: '8px 14px', 
                      borderRadius: 8, 
                      cursor: 'pointer', 
                      fontSize: 13, 
                      fontWeight: 700, 
                      textTransform: 'uppercase',
                      transition: 'all 0.2s',
                      boxShadow: currentGame === 'blackjack' ? '0 4px 0 rgba(255,213,74,0.3)' : 'none'
                    }}
                  >
                    🃏 21
                  </button>
                  <button
                    onClick={() => setCurrentGame('poker')}
                    style={{ 
                      background: currentGame === 'poker' ? '#FFD54A' : '#1a1a1a', 
                      color: currentGame === 'poker' ? '#0b0b0b' : '#9a9a9a', 
                      border: '1px solid ' + (currentGame === 'poker' ? '#FFD54A' : '#2a2a2a'), 
                      padding: '8px 14px', 
                      borderRadius: 8, 
                      cursor: 'pointer', 
                      fontSize: 13, 
                      fontWeight: 700, 
                      textTransform: 'uppercase',
                      transition: 'all 0.2s',
                      boxShadow: currentGame === 'poker' ? '0 4px 0 rgba(255,213,74,0.3)' : 'none'
                    }}
                  >
                    ♣️ Poker
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setShowArcade(true)}
                    style={{ background: '#FFD54A', color: '#0b0b0b', border: '1px solid #FFD54A', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 0 rgba(255,213,74,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    Play
                  </button>
                  {showArcade && (
                    <button
                      onClick={() => setShowArcade(false)}
                      style={{ background: '#E00000', color: '#fff', border: '1px solid #DC0000', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 0 rgba(224,0,0,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>

              {showArcade && currentGame === 'blackjack' && (
                <div style={{ position: 'relative', marginTop: 12, border: '2px solid #2a2a2a', borderRadius: 10, background: '#0b0b0b', padding: 14, fontFamily: 'monospace' }}>
                  {/* Mode selector */}
                  <div style={{ marginBottom: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
                    {['easy', 'normal', 'hard'].map(mode => (
                      <button
                        key={mode}
                        onClick={() => { if (blackjack.status === 'idle' || blackjack.status === 'finished') setGameMode(mode); }}
                        style={{ background: gameMode === mode ? '#FFD54A' : '#1a1a1a', color: gameMode === mode ? '#0b0b0b' : '#9a9a9a', border: '1px solid ' + (gameMode === mode ? '#FFD54A' : '#2a2a2a'), padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'all 0.2s' }}
                      >
                        {mode === 'easy' ? '🎮 Easy' : mode === 'normal' ? '⚖️ Normal' : '💪 Hard'}
                      </button>
                    ))}
                  </div>

                  {/* Balance & Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12, fontSize: 12 }}>
                    <div style={{ background: '#0f0f0f', padding: '8px', borderRadius: 6, border: '1px solid #2a2a2a', color: '#e6e6e6' }}>
                      💰 Balance: <span style={{ color: '#FFD54A', fontWeight: 700 }}>{blackjack.balance}</span>
                    </div>
                    <div style={{ background: '#0f0f0f', padding: '8px', borderRadius: 6, border: '1px solid #2a2a2a', color: '#e6e6e6' }}>
                      💵 Bet: <span style={{ color: '#E00000', fontWeight: 700 }}>{blackjack.bet}</span>
                    </div>
                    <div style={{ background: '#0f0f0f', padding: '8px', borderRadius: 6, border: '1px solid #2a2a2a', color: '#e6e6e6' }}>
                      🏆 Wins: <span style={{ color: '#FFD54A', fontWeight: 700 }}>{blackjack.stats.wins}</span>
                    </div>
                    <div style={{ background: '#0f0f0f', padding: '8px', borderRadius: 6, border: '1px solid #2a2a2a', color: '#e6e6e6' }}>
                      📊 +{blackjack.stats.totalEarnings}
                    </div>
                  </div>

                  {/* Bet slider */}
                  {(blackjack.status === 'idle' || blackjack.status === 'finished') && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <label style={{ color: '#9a9a9a', fontSize: 12, fontWeight: 700 }}>Bet amount:</label>
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
                          style={{ width: 70, padding: '4px 8px', background: '#0f0f0f', color: '#e6e6e6', border: '1px solid #2a2a2a', borderRadius: 4, fontSize: 12 }}
                        />
                      </div>

                      {/* Quick bet buttons */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        {[25, 50, 100, 500, 1000].map(amount => (
                          <button
                            key={amount}
                            onClick={() => setBlackjack(prev => ({ ...prev, bet: Math.min(amount, prev.balance) }))}
                            style={{ 
                              background: blackjack.bet === amount ? '#FFD54A' : '#1a1a1a', 
                              color: blackjack.bet === amount ? '#0b0b0b' : '#9a9a9a', 
                              border: '1px solid ' + (blackjack.bet === amount ? '#FFD54A' : '#2a2a2a'), 
                              padding: '6px 10px', 
                              borderRadius: 6, 
                              cursor: 'pointer', 
                              fontSize: 11, 
                              fontWeight: 700, 
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
                            background: blackjack.bet === blackjack.balance ? '#E00000' : '#2a0000', 
                            color: blackjack.bet === blackjack.balance ? '#fff' : '#9a5a5a', 
                            border: '1px solid ' + (blackjack.bet === blackjack.balance ? '#DC0000' : '#4a1a1a'), 
                            padding: '6px 10px', 
                            borderRadius: 6, 
                            cursor: 'pointer', 
                            fontSize: 11, 
                            fontWeight: 700, 
                            textTransform: 'uppercase', 
                            letterSpacing: '0.05em',
                            transition: 'all 0.2s',
                            boxShadow: blackjack.bet === blackjack.balance ? '0 0 12px rgba(224,0,0,0.5)' : 'none'
                          }}
                        >
                          🔥 ALL IN
                        </button>
                      </div>

                      {/* Bet info */}
                      <div style={{ fontSize: 11, color: '#e6e6e6', padding: '6px 8px', background: '#0f0f0f', borderRadius: 6, border: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Win: <strong style={{ color: '#FFD54A' }}>+{blackjack.bet}</strong></span>
                        <span>Blackjack: <strong style={{ color: '#FFD700' }}>+{blackjack.bet * 2}</strong></span>
                        <span>Lose: <strong style={{ color: '#E00000' }}>-{blackjack.bet}</strong></span>
                      </div>
                    </div>
                  )}

                  {/* Game cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#9a9a9a', marginBottom: 6 }}>Dealer</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {blackjack.dealer.map((card, idx) => {
                          const hidden = blackjack.status === 'player' && idx === 1;
                          return (
                            <div key={`dealer-${idx}`} style={{ width: 52, height: 72, background: hidden ? '#0f0f0f' : '#fff', color: '#0b0b0b', border: '2px solid #2a2a2a', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, boxShadow: '0 4px 0 rgba(0,0,0,0.3)', transition: 'all 0.3s' }}>
                              {hidden ? '??' : cardLabel(card)}
                            </div>
                          );
                        })}
                      </div>
                      {blackjack.status !== 'player' && blackjack.dealer.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 12, color: dealerScore > 21 ? '#E00000' : '#e6e6e6' }}>Total: <strong>{dealerScore}</strong></div>
                      )}
                    </div>

                    <div>
                      <div style={{ fontSize: 12, color: '#9a9a9a', marginBottom: 6 }}>You</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {blackjack.player.map((card, idx) => (
                          <div key={`player-${idx}`} style={{ width: 52, height: 72, background: '#fff', color: '#0b0b0b', border: '2px solid #2a2a2a', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, boxShadow: '0 4px 0 rgba(0,0,0,0.3)', transition: 'all 0.3s' }}>
                            {cardLabel(card)}
                          </div>
                        ))}
                      </div>
                      {blackjack.player.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 12, color: playerScore > 21 ? '#E00000' : '#e6e6e6' }}>Total: <strong>{playerScore}</strong></div>
                      )}
                    </div>
                  </div>

                  {/* Message & actions */}
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <span style={{ color: blackjack.status === 'finished' ? (blackjack.message.includes('win') ? '#FFD54A' : blackjack.message.includes('Push') ? '#9a9a9a' : '#E00000') : '#FFD54A', fontSize: 12, fontWeight: 700 }}>{blackjack.message}</span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {blackjack.status === 'idle' ? (
                        <button
                          onClick={startBlackjack}
                          disabled={blackjack.balance < blackjack.bet}
                          style={{ background: '#FFD54A', color: '#0b0b0b', border: '1px solid #FFD54A', padding: '8px 12px', borderRadius: 8, cursor: blackjack.balance >= blackjack.bet ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 0 rgba(255,213,74,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: blackjack.balance >= blackjack.bet ? 1 : 0.5 }}
                        >
                          Deal
                        </button>
                      ) : blackjack.status === 'player' ? (
                        <>
                          <button
                            onClick={hitBlackjack}
                            style={{ background: '#FFD54A', color: '#0b0b0b', border: '1px solid #FFD54A', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 0 rgba(255,213,74,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                          >
                            Hit
                          </button>
                          <button
                            onClick={standBlackjack}
                            style={{ background: '#1a1a1a', color: '#FFD54A', border: '1px solid #FFD54A', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 0 rgba(0,0,0,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                          >
                            Stand
                          </button>
                          {blackjack.canDoubleDown && (
                            <button
                              onClick={doubleDownBlackjack}
                              style={{ background: '#E00000', color: '#fff', border: '1px solid #DC0000', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 0 rgba(224,0,0,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                            >
                              Double
                            </button>
                          )}
                          {blackjack.canSplit && (
                            <button
                              onClick={splitBlackjack}
                              style={{ background: '#FFD700', color: '#0b0b0b', border: '1px solid #FFD700', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 0 rgba(255,215,0,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
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
                            style={{ background: '#FFD54A', color: '#0b0b0b', border: '1px solid #FFD54A', padding: '8px 12px', borderRadius: 8, cursor: blackjack.balance >= blackjack.bet ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 0 rgba(255,213,74,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: blackjack.balance >= blackjack.bet ? 1 : 0.5 }}
                          >
                            Deal Again
                          </button>
                          <button
                            onClick={resetBlackjack}
                            style={{ background: '#E00000', color: '#fff', border: '1px solid #DC0000', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 0 rgba(224,0,0,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                          >
                            Reset Stats
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Stats breakdown */}
                  <div style={{ marginTop: 12, padding: 8, background: '#0f0f0f', borderRadius: 6, border: '1px solid #2a2a2a', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 11, color: '#e6e6e6' }}>
                    <div>Wins: <span style={{ color: '#FFD54A', fontWeight: 700 }}>{blackjack.stats.wins}</span> | Losses: <span style={{ color: '#E00000', fontWeight: 700 }}>{blackjack.stats.losses}</span> | Pushes: <span style={{ color: '#9a9a9a', fontWeight: 700 }}>{blackjack.stats.pushes}</span></div>
                    <div>Win rate: <span style={{ color: '#FFD54A', fontWeight: 700 }}>{blackjack.stats.wins + blackjack.stats.losses > 0 ? Math.round(blackjack.stats.wins * 100 / (blackjack.stats.wins + blackjack.stats.losses)) : 0}%</span></div>
                    <div>Balance: <span style={{ color: blackjack.balance > 1000 ? '#FFD54A' : blackjack.balance < 100 ? '#E00000' : '#e6e6e6', fontWeight: 700 }}>{blackjack.balance}</span></div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 60, background: 'linear-gradient(135deg, #0f0f0f, #151515)', border: '1px solid #222', borderRadius: 16, padding: '24px 24px 16px 24px', boxShadow: '0 10px 30px rgba(0,0,0,0.35)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#FFD54A', letterSpacing: '0.02em' }}>🔥 Top Vinyls</h2>
                <div style={{ fontSize: 12, color: '#8b8b8b' }}>Sorted by likes</div>
              </div>

              <div style={{ position: 'relative' }}>
                {topVinyls.length > 4 && (
                  <>
                    <button 
                      onClick={() => setCarouselIndex(Math.max(0, carouselIndex - 4))}
                      disabled={carouselIndex === 0}
                      style={{ position: 'absolute', left: -24, top: '50%', transform: 'translateY(-50%)', width: 38, height: 38, borderRadius: '50%', background: carouselIndex === 0 ? '#1a1a1a' : '#0b0b0b', border: '1px solid #333', color: '#FFD54A', fontSize: 20, cursor: carouselIndex === 0 ? 'default' : 'pointer', transition: 'all 0.2s', zIndex: 10, opacity: carouselIndex === 0 ? 0.4 : 1 }}
                      onMouseEnter={(e) => { if (carouselIndex !== 0) { e.currentTarget.style.borderColor = '#FFD54A'; e.currentTarget.style.boxShadow = '0 0 12px rgba(255,213,74,0.35)'; } }}
                      onMouseLeave={(e) => { if (carouselIndex !== 0) { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.boxShadow = 'none'; } }}
                    >
                      ‹
                    </button>
                    <button 
                      onClick={() => setCarouselIndex(Math.min(topVinyls.length - 4, carouselIndex + 4))}
                      disabled={carouselIndex >= topVinyls.length - 4}
                      style={{ position: 'absolute', right: -24, top: '50%', transform: 'translateY(-50%)', width: 38, height: 38, borderRadius: '50%', background: carouselIndex >= topVinyls.length - 4 ? '#1a1a1a' : '#0b0b0b', border: '1px solid #333', color: '#FFD54A', fontSize: 20, cursor: carouselIndex >= topVinyls.length - 4 ? 'default' : 'pointer', transition: 'all 0.2s', zIndex: 10, opacity: carouselIndex >= topVinyls.length - 4 ? 0.4 : 1 }}
                      onMouseEnter={(e) => { if (carouselIndex < topVinyls.length - 4) { e.currentTarget.style.borderColor = '#FFD54A'; e.currentTarget.style.boxShadow = '0 0 12px rgba(255,213,74,0.35)'; } }}
                      onMouseLeave={(e) => { if (carouselIndex < topVinyls.length - 4) { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.boxShadow = 'none'; } }}
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
                        <div style={{ position: 'absolute', top: -6, right: -6, width: 38, height: 38, background: '#0b0b0b', color: '#FFD54A', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, border: '1px solid #333', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', zIndex: 5 }}>
                          {actualIndex + 1}.
                        </div>

                        <div style={{ width: '100%', aspectRatio: '1', background: 'radial-gradient(circle at 35% 35%, #2a2a2a, #0b0b0b)', borderRadius: '50%', overflow: 'hidden', position: 'relative', boxShadow: '0 14px 28px rgba(0,0,0,0.45), inset 0 2px 6px rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'all 0.3s', marginBottom: 14 }}
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
                            style={{ position: 'absolute', inset: '35%', background: 'radial-gradient(circle, #222 0%, #000 100%)', borderRadius: '50%', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'radial-gradient(circle, #333 0%, #111 100%)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'radial-gradient(circle, #222 0%, #000 100%)'}
                          >
                            {spinningVinyls[v.id] ? (
                              <div style={{ width: '40%', height: '40%', background: '#fff', borderRadius: 2 }}></div>
                            ) : (
                              <div style={{ width: 0, height: 0, borderLeft: '15px solid #fff', borderTop: '10px solid transparent', borderBottom: '10px solid transparent', marginLeft: 4 }}></div>
                            )}
                          </div>
                        </div>

                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, lineHeight: 1.3, color: '#e6e6e6', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {v.title}
                        </div>
                        <div style={{ fontSize: 12, color: '#9a9a9a', marginBottom: 12 }}>
                          {v.artist}
                        </div>

                        {!spinningVinyls[v.id] && (v.previewUrl || v.musicUrl) && (
                          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: '#0b0b0b', border: '1px solid #FFD54A', padding: '6px 12px', borderRadius: 20, color: '#FFD54A', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                              <span>♫</span>
                              <span>Audio Available</span>
                            </div>
                          </div>
                        )}

                        {v.musicUrl && spinningVinyls[v.id] && (
                          <div style={{ background: '#0f0f0f', border: '1px solid #1f1f1f', borderRadius: 8, padding: 12, marginTop: 8 }}>
                            {spinningVinyls[v.id] && (
                              <div style={{ marginBottom: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#bdbdbd', marginBottom: 4 }}>
                                  <span>{formatTime(currentTime[v.id] || 0)}</span>
                                  <span>{formatTime(duration[v.id] || 0)}</span>
                                </div>
                                <div 
                                  style={{ height: 12, background: '#1a1a1a', borderRadius: 6, overflow: 'hidden', cursor: 'pointer', position: 'relative', border: '1px solid #2a2a2a' }}
                                  onClick={(e) => {
                                    if (!audioRefsRef.current[v.id] || !duration[v.id]) return;
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const percent = (e.clientX - rect.left) / rect.width;
                                    const newTime = percent * duration[v.id];
                                    audioRefsRef.current[v.id].currentTime = newTime;
                                  }}
                                >
                                  <div style={{ 
                                    height: '100%', 
                                    background: 'linear-gradient(90deg, #E00000, #FFD54A)', 
                                    width: `${((currentTime[v.id] || 0) / (duration[v.id] || 1)) * 100}%`,
                                    transition: 'width 0.1s linear',
                                    position: 'relative'
                                  }}>
                                    <div style={{
                                      position: 'absolute',
                                      right: -6,
                                      top: '50%',
                                      transform: 'translateY(-50%)',
                                      width: 12,
                                      height: 12,
                                      background: '#FFD54A',
                                      borderRadius: '50%',
                                      boxShadow: '0 2px 4px rgba(255,213,74,0.4)',
                                      cursor: 'grab'
                                    }}></div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {spinningVinyls[v.id] && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 14 }}>🔊</span>
                                <input 
                                  type="range" 
                                  min="0" 
                                  max="100" 
                                  value={volume * 100}
                                  onChange={(e) => {
                                    const newVolume = e.target.value / 100;
                                    setVolume(newVolume);
                                    Object.values(audioRefsRef.current).forEach(audio => {
                                      if (audio) audio.volume = newVolume;
                                    });
                                  }}
                                  style={{ 
                                    flex: 1, 
                                    height: 4,
                                    borderRadius: 2,
                                    outline: 'none',
                                    background: `linear-gradient(to right, #E00000 0%, #E00000 ${volume * 100}%, #2a2a2a ${volume * 100}%, #2a2a2a 100%)`
                                  }}
                                />
                                <span style={{ fontSize: 10, color: '#bdbdbd', minWidth: 30 }}>{Math.round(volume * 100)}%</span>
                              </div>
                            )}
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
                        style={{ width: Math.floor(carouselIndex / 4) === i ? 30 : 10, height: 10, borderRadius: 5, background: Math.floor(carouselIndex / 4) === i ? '#000' : '#ddd', border: 'none', cursor: 'pointer', transition: 'all 0.3s' }}
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
            <div className="playlists-section" style={{ background: 'linear-gradient(135deg, #0f0f0f, #151515)', border: '1px solid #222', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px rgba(0,0,0,0.35)' }}>
              <div className="playlists-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#FFD54A', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: 12, textTransform: 'uppercase' }}>
                  <span style={{ fontSize: 32, filter: 'drop-shadow(0 2px 4px rgba(255,213,74,0.4))' }}>♫</span>
                  My Playlists
                </h2>
                <button
                  onClick={openPlaylistForm}
                  className="create-playlist-btn"
                  style={{ background: 'linear-gradient(135deg, #FFD54A, #F0C000)', color: '#0b0b0b', border: 'none', padding: '10px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', boxShadow: '0 6px 18px rgba(255,213,74,0.35)' }}
                >
                  <span>+ Create Playlist</span>
                </button>
              </div>

              {playlists.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8b8b8b' }}>
                  <div style={{ fontSize: 56, marginBottom: 16, color: '#FFD54A', filter: 'drop-shadow(0 2px 4px rgba(255,213,74,0.4))' }}>♫</div>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#e6e6e6' }}>No playlists yet</p>
                  <p style={{ margin: '8px 0 0 0', fontSize: 13 }}>Create your first playlist to organize your music!</p>
                </div>
              ) : (
                <div className="playlists-grid">
                  {playlists.map(playlist => (
                    <div
                      key={playlist.id}
                      className="playlist-card"
                      onClick={() => openPlaylistDetail(playlist)}
                      style={{ background: 'linear-gradient(135deg, #0b0b0b, #121212)', border: '2px solid #2a2a2a', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FFD54A'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(255,213,74,0.25)'; e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)'; e.currentTarget.style.transform = 'translateY(0) scale(1)'; }}
                    >
                      {playlist.cover_url ? (
                        <img src={playlist.cover_url} alt={playlist.name} className="playlist-cover" />
                      ) : (
                        <div className="playlist-cover-placeholder">
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                      )}
                      <div className="playlist-info" style={{ padding: 16 }}>
                        <h3 className="playlist-name" style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 800, color: '#eaeaea' }}>{playlist.name}</h3>
                        <div className="playlist-meta" style={{ fontSize: 12, color: '#9a9a9a' }}>
                          <span>{playlist.song_count || 0} songs</span>
                        </div>
                      </div>
                      <div className="playlist-actions" onClick={(e) => e.stopPropagation()}>
                        <button 
                          className="playlist-action-btn playlist-edit-btn"
                          onClick={() => openEditPlaylist(playlist)}
                          style={{ background: 'transparent', color: '#FFD54A', border: '1px solid #FFD54A', padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                        <button 
                          className="playlist-action-btn playlist-delete-btn"
                          onClick={() => handleDeletePlaylist(playlist.id)}
                          style={{ background: 'transparent', color: '#E00000', border: '1px solid #E00000', padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {viewMode === 'songs' && (
            <div style={{ marginTop: 60, borderTop: '1px solid #222', paddingTop: 40 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#FFD54A', letterSpacing: '0.02em' }}>Complete Collection</h2>
              </div>
              
              <div style={{ marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search by title, artist, or year..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  style={{ flex: 1, minWidth: 250, padding: '12px 16px', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 14, transition: 'border 0.2s', background: '#0f0f0f', color: '#e6e6e6' }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#FFD54A'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#2a2a2a'}
                />
                <select 
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                  style={{ padding: '12px 16px', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 14, background: '#0f0f0f', color: '#FFD54A', cursor: 'pointer', transition: 'border 0.2s' }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#FFD54A'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#2a2a2a'}
                >
                  <option value="title">Sort by Title (A-Z)</option>
                  <option value="artist">Sort by Artist (A-Z)</option>
                  <option value="year-desc">Sort by Year (Newest)</option>
                  <option value="year-asc">Sort by Year (Oldest)</option>
                  <option value="likes">Sort by Likes (Most)</option>
                </select>
                {user?.role !== 'reader' && (
                  <button 
                    onClick={openCreate} 
                    style={{ background: 'linear-gradient(135deg, #FFD54A, #F0C000)', color: '#0b0b0b', border: 'none', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 800, transition: 'all 0.2s', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    Add Vinyl
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {filtered.map((v, index) => (
                  <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: '#121212', borderRadius: 12, border: '1px solid #2a2a2a', boxShadow: '0 8px 18px rgba(0,0,0,0.35)', transition: 'all 0.2s' }}
                       onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FFD54A'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(255,213,74,0.15)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                       onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.boxShadow = '0 8px 18px rgba(0,0,0,0.35)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                    <div style={{ width: '100%', paddingTop: '100%', borderRadius: 10, overflow: 'hidden', position: 'relative', background: '#0b0b0b' }}>
                      {v.coverUrl && <img src={v.coverUrl} alt={v.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#eaeaea', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.title}
                      </div>
                      <div style={{ fontSize: 13, color: '#9a9a9a', marginTop: 4 }}>
                        {v.artist} • {v.year}
                      </div>
                      <div style={{ fontSize: 11, color: '#6f6f6f', marginTop: 6 }}>
                        {v.ownerName || 'Unknown'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', position: 'relative', zIndex: 10 }}>
                      {(v.previewUrl || v.musicUrl) && (
                        <button
                          onClick={() => toggleSpin(v.id)}
                          style={{ background: spinningVinyls[v.id] ? '#FFD54A' : '#0b0b0b', color: spinningVinyls[v.id] ? '#0b0b0b' : '#FFD54A', border: '1px solid #FFD54A', padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'all 0.2s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 12px rgba(255,213,74,0.4)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                          {spinningVinyls[v.id] ? '⏸ Pause' : '▶ Play'}
                        </button>
                      )}
                      <button 
                        onClick={() => handleLike(v.id)} 
                        style={{ background: '#0b0b0b', border: '1px solid #2a2a2a', cursor: 'pointer', fontSize: 12, padding: '6px 10px', borderRadius: 20, color: '#FFD54A', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        {v.likes?.includes(user?.id) ? '💛' : '♡'}
                        <span style={{ fontSize: 11, color: '#FFD54A' }}>{v.likes?.length || 0}</span>
                      </button>
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={() => setActionMenuId(actionMenuId === v.id ? null : v.id)}
                          style={{ background: '#0b0b0b', border: '1px solid #2a2a2a', color: '#FFD54A', padding: '6px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800, cursor: 'pointer', letterSpacing: '0.5px' }}
                          aria-label="Open actions"
                        >
                          ⋯
                        </button>

                        {actionMenuId === v.id && (
                          <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: '#0b0b0b', border: '1px solid #2a2a2a', borderRadius: 10, padding: 8, minWidth: 170, zIndex: 50, boxShadow: '0 12px 24px rgba(0,0,0,0.5)' }}>
                            <button
                              onClick={() => { setShowAddToPlaylist(v); setActionMenuId(null); }}
                              style={{ width: '100%', background: 'transparent', color: '#FFD54A', border: '1px solid #2a2a2a', padding: '8px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
                            >
                              + Add to Playlist
                            </button>
                            {(user?.role === 'admin' || (user?.role === 'user' && v.ownerId === user?.id)) && (
                              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <button
                                  onClick={() => { openEdit(v); setActionMenuId(null); }}
                                  style={{ flex: 1, background: 'transparent', color: '#FFD54A', border: '1px solid #FFD54A', padding: '8px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => { onDelete(v.id); setActionMenuId(null); }}
                                  style={{ flex: 1, background: 'transparent', color: '#E00000', border: '1px solid #E00000', padding: '8px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
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
            <h3 style={{ margin: '0 0 24px 0', fontSize: 24, fontWeight: 700 }}>{editing ? 'Edit Vinyl' : 'Add Vinyl'}</h3>
            
            {!editing && (
              <div style={{ marginBottom: 24, padding: 16, background: '#f8f8f8', borderRadius: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20, color: '#1DB954' }}>♫</span>
                  Search Spotify
                </div>
                <form onSubmit={handleSpotifySearch} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input 
                    value={spotifySearch} 
                    onChange={e => setSpotifySearch(e.target.value)}
                    placeholder="e.g., Daft Punk Random Access"
                    style={{ flex: 1, padding: 10, border: '1px solid #ddd', borderRadius: 4, fontSize: 14 }}
                  />
                  <button 
                    type="submit" 
                    disabled={searchingSpotify}
                    style={{ padding: '10px 20px', background: '#1DB954', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    {searchingSpotify ? 'Searching...' : 'Search'}
                  </button>
                </form>
                
                {spotifyResults.length > 0 && (
                  <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 4, background: 'white' }}>
                    {spotifyResults.map(track => (
                      <div 
                        key={track.id}
                        style={{ 
                          display: 'flex', 
                          gap: 12, 
                          padding: 12, 
                          borderBottom: '1px solid #f0f0f0',
                          transition: 'background 0.2s',
                          alignItems: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8f8f8'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                      >
                        {track.coverUrl && (
                          <img src={track.coverUrl} alt={track.title} style={{ width: 50, height: 50, borderRadius: 4, objectFit: 'cover' }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {track.title}
                          </div>
                          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                            {track.artist} • {track.year}
                          </div>
                          {track.previewUrl && (
                            <div style={{ fontSize: 11, color: '#1DB954', marginTop: 2 }}>
                              ✓ 30s preview available
                            </div>
                          )}
                          {!track.previewUrl && (
                            <div style={{ fontSize: 11, color: '#d17c00', marginTop: 2 }}>
                              No Spotify preview. Upload your own audio to enable play/add.
                            </div>
                          )}
                          {spotifyUploads[track.id]?.musicUrl && (
                            <div style={{ fontSize: 11, color: '#1DB954', marginTop: 2 }}>
                              ✓ Custom audio uploaded
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {!track.previewUrl && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#555', cursor: 'pointer' }}>
                              <input
                                type="file"
                                accept="audio/mpeg,audio/wav,audio/ogg,audio/flac"
                                style={{ display: 'none' }}
                                onChange={(e) => handleSpotifyUpload(track.id, e.target.files?.[0])}
                              />
                              <span style={{ background: '#eee', padding: '6px 10px', borderRadius: 4, border: '1px solid #ddd' }}>
                                {spotifyUploads[track.id]?.uploading ? 'Uploading...' : 'Upload audio'}
                              </span>
                            </label>
                          )}
                          {track.previewUrl && (
                            <button
                              type="button"
                              onClick={() => togglePreview(track)}
                              style={{ background: playingPreview === track.id ? '#ff006e' : '#1DB954', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.2s' }}
                              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                            >
                              {playingPreview === track.id ? '⏸ Stop' : '▶ Play'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => fillFromSpotify(track)}
                            style={{ background: '#000', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => quickAddFromSpotify(track)}
                            disabled={!track.previewUrl && !spotifyUploads[track.id]?.musicUrl}
                            style={{ background: (track.previewUrl || spotifyUploads[track.id]?.musicUrl) ? '#1DB954' : '#ccc', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: (track.previewUrl || spotifyUploads[track.id]?.musicUrl) ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}
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
                  <div style={{ padding: 12, textAlign: 'center', color: '#999', fontSize: 12 }}>
                    No results found
                  </div>
                )}
              </div>
            )}
            
            <form onSubmit={onSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Title<br />
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required style={{ width: '100%', padding: 10, marginTop: 4, border: '1px solid #ddd', borderRadius: 4, fontSize: 14, transition: 'border 0.2s' }} onFocus={(e) => e.currentTarget.style.borderColor = '#000'} onBlur={(e) => e.currentTarget.style.borderColor = '#ddd'} />
                </label>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Artist<br />
                  <input value={form.artist} onChange={e => setForm({ ...form, artist: e.target.value })} required style={{ width: '100%', padding: 10, marginTop: 4, border: '1px solid #ddd', borderRadius: 4, fontSize: 14, transition: 'border 0.2s' }} onFocus={(e) => e.currentTarget.style.borderColor = '#000'} onBlur={(e) => e.currentTarget.style.borderColor = '#ddd'} />
                </label>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Year<br />
                  <input type="number" value={form.year} onChange={e => setForm({ ...form, year: parseInt(e.target.value) })} style={{ width: '100%', padding: 10, marginTop: 4, border: '1px solid #ddd', borderRadius: 4, fontSize: 14, transition: 'border 0.2s' }} onFocus={(e) => e.currentTarget.style.borderColor = '#000'} onBlur={(e) => e.currentTarget.style.borderColor = '#ddd'} />
                </label>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Cover Image<br />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                    <input 
                      type="file" 
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleCoverUpload}
                      disabled={uploading}
                      style={{ flex: 1 }}
                    />
                    {uploading && <span style={{ fontSize: 12, color: '#666' }}>Uploading...</span>}
                  </div>
                  {form.coverUrl && (
                    <div style={{ marginTop: 8, textAlign: 'center' }}>
                      <img src={form.coverUrl} alt="Preview" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 4 }} />
                    </div>
                  )}
                </label>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Music (optional)<br />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                    <input 
                      type="file" 
                      accept="audio/mpeg,audio/wav,audio/ogg,audio/flac"
                      onChange={handleMusicUpload}
                      disabled={uploadingMusic}
                      style={{ flex: 1 }}
                    />
                    {uploadingMusic && <span style={{ fontSize: 12, color: '#666' }}>Uploading...</span>}
                  </div>
                  {form.musicUrl && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                      ✓ Music uploaded
                    </div>
                  )}
                </label>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Note<br />
                  <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="e.g. Where I bought it, favorite track..." style={{ width: '100%', padding: 10, marginTop: 4, border: '1px solid #ddd', borderRadius: 4, fontSize: 14, transition: 'border 0.2s' }} onFocus={(e) => e.currentTarget.style.borderColor = '#000'} onBlur={(e) => e.currentTarget.style.borderColor = '#ddd'} />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="submit" style={{ flex: 1, padding: '10px 16px', background: '#ff006e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>Save</button>
                <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px 16px', background: '#f0f0f0', color: '#222', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = '#e0e0e0'} onMouseLeave={(e) => e.currentTarget.style.background = '#f0f0f0'}>Cancel</button>
              </div>
            </form>
          </Modal>
        )}

        {currentlyPlaying && (
          <div style={{ position: 'fixed', bottom: 20, left: 20, width: 340, background: 'linear-gradient(135deg, #0f0f0f, #151515)', borderRadius: 14, border: '1px solid #2a2a2a', boxShadow: '0 12px 32px rgba(0,0,0,0.45)', padding: 16, zIndex: 1000 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                onClick={() => {
                  if (audioRefsRef.current[currentlyPlaying.id]) {
                    audioRefsRef.current[currentlyPlaying.id].pause();
                  }
                  setSpinningVinyls(prev => ({ ...prev, [currentlyPlaying.id]: false }));
                  setCurrentlyPlaying(null);
                }}
                style={{ background: '#0b0b0b', border: '1px solid #2a2a2a', fontSize: 18, color: '#FFD54A', cursor: 'pointer', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FFD54A'; e.currentTarget.style.boxShadow = '0 0 10px rgba(255,213,74,0.35)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 64, height: 64, background: 'radial-gradient(circle at 35% 35%, #2a2a2a, #0b0b0b)', borderRadius: 10, overflow: 'hidden', flexShrink: 0, border: '1px solid #2a2a2a' }}>
                {currentlyPlaying.coverUrl && <img src={currentlyPlaying.coverUrl} alt={currentlyPlaying.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#eaeaea', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentlyPlaying.title}
                </div>
                <div style={{ fontSize: 12, color: '#9a9a9a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentlyPlaying.artist}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => toggleSpin(currentlyPlaying.id)}
                  style={{ background: '#FFD54A', color: '#0b0b0b', border: 'none', width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', boxShadow: '0 6px 16px rgba(255,213,74,0.35)' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {spinningVinyls[currentlyPlaying.id] ? '⏸' : '▶'}
                </button>
                <button
                  onClick={() => setFullscreenPlayer(true)}
                  style={{ background: '#0b0b0b', color: '#FFD54A', border: '1px solid #2a2a2a', width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FFD54A'; e.currentTarget.style.boxShadow = '0 0 10px rgba(255,213,74,0.35)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.boxShadow = 'none'; }}
                  title="Fullscreen player"
                >
                  ⛶
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9a9a9a', marginBottom: 6 }}>
                <span>{formatTime(currentTime[currentlyPlaying.id] || 0)}</span>
                <span>{formatTime(duration[currentlyPlaying.id] || 0)}</span>
              </div>
              <div
                style={{ height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden', cursor: 'pointer', position: 'relative', border: '1px solid #2a2a2a' }}
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
                  background: 'linear-gradient(90deg, #FFD54A, #E00000)',
                  width: `${((currentTime[currentlyPlaying.id] || 0) / (duration[currentlyPlaying.id] || 1)) * 100}%`,
                  transition: 'width 0.1s linear'
                }}></div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9a9a9a' }}>
              <span style={{ fontSize: 14 }}>🔊</span>
              <input
                type="range"
                min="0"
                max="100"
                value={volume * 100}
                onChange={(e) => {
                  const newVolume = e.target.value / 100;
                  setVolume(newVolume);
                  Object.values(audioRefsRef.current).forEach(audio => {
                    if (audio) audio.volume = newVolume;
                  });
                }}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  outline: 'none',
                  background: `linear-gradient(to right, #FFD54A 0%, #FFD54A ${volume * 100}%, #2a2a2a ${volume * 100}%, #2a2a2a 100%)`
                }}
              />
              <span style={{ fontSize: 10, color: '#9a9a9a', minWidth: 30 }}>{Math.round(volume * 100)}%</span>
            </div>
          </div>
        )}

        {fullscreenPlayer && currentlyPlaying && (
          <div style={{ position: 'fixed', inset: 0, background: coverGradient, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
            <button
              onClick={() => setFullscreenPlayer(false)}
              style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', fontSize: 28, width: 50, height: 50, borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
            >
              ✕
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 50, width: '100%', maxWidth: 550 }}>
              <div className={spinningVinyls[currentlyPlaying.id] ? 'vinyl-fullscreen-playing' : ''} style={{ width: 500, height: 500, background: 'radial-gradient(circle at 35% 35%, #444, #111)', borderRadius: '50%', overflow: 'hidden', position: 'relative', boxShadow: '0 30px 80px rgba(0,0,0,0.7), inset 0 2px 4px rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'all 0.3s', marginBottom: 16 }}>
                <div 
                  id={`vinyl-fullscreen-${currentlyPlaying.id}`}
                  className={spinningVinyls[currentlyPlaying.id] ? 'vinyl-spinning' : 'vinyl-paused'}
                  style={{ 
                    width: '100%', 
                    height: '100%',
                    '--start-angle': `${vinylRotations[currentlyPlaying.id] || 0}deg`
                  }}>
                  {currentlyPlaying.coverUrl && <img src={currentlyPlaying.coverUrl} alt={currentlyPlaying.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ position: 'absolute', inset: '12%', border: '4px solid rgba(0,0,0,0.8)', borderRadius: '50%', pointerEvents: 'none' }}></div>
                
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 20, height: 20, background: '#000', borderRadius: '50%', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), 0 2px 4px rgba(255,255,255,0.1)' }}></div>
              </div>

              <div style={{ textAlign: 'center', width: '100%' }}>
                <h2 style={{ margin: 0, color: 'white', fontSize: 32, fontWeight: 800, marginBottom: 12, textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{currentlyPlaying.title}</h2>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.9)', fontSize: 18, marginBottom: 6, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{currentlyPlaying.artist}</p>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: 14, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{currentlyPlaying.year}</p>
              </div>

              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 16, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                  <span>{formatTime(currentTime[currentlyPlaying.id] || 0)}</span>
                  <span>{formatTime(duration[currentlyPlaying.id] || 0)}</span>
                </div>
                <div
                  style={{ height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 3, overflow: 'hidden', cursor: 'pointer', position: 'relative', marginBottom: 40 }}
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
                    background: 'linear-gradient(90deg, #ff006e, #ff4081)',
                    width: `${((currentTime[currentlyPlaying.id] || 0) / (duration[currentlyPlaying.id] || 1)) * 100}%`,
                    transition: 'width 0.1s linear',
                    boxShadow: '0 0 10px rgba(255,0,110,0.5)'
                  }}></div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 32, alignItems: 'center', width: '100%', justifyContent: 'center' }}>
                <button
                  onClick={() => toggleSpin(currentlyPlaying.id)}
                  style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '2px solid rgba(255,255,255,0.6)', width: 70, height: 70, borderRadius: 16, cursor: 'pointer', fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', boxShadow: '0 10px 35px rgba(255,255,255,0.2)', fontWeight: 700, backdropFilter: 'blur(5px)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 15px 45px rgba(255,255,255,0.3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 10px 35px rgba(255,255,255,0.2)'; }}
                >
                  {spinningVinyls[currentlyPlaying.id] ? '⏸' : '▶'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'transparent', padding: '16px 32px', borderRadius: 14, border: 'none' }}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume * 100}
                    onChange={(e) => {
                      const newVolume = e.target.value / 100;
                      setVolume(newVolume);
                      Object.values(audioRefsRef.current).forEach(audio => {
                        if (audio) audio.volume = newVolume;
                      });
                    }}
                    style={{
                      width: 240,
                      height: 8,
                      borderRadius: 4,
                      outline: 'none',
                      cursor: 'pointer',
                      WebkitAppearance: 'none',
                      background: `linear-gradient(to right, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.5) ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%, rgba(255,255,255,0.2) 100%)`
                    }}
                  />
                  <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.9)', minWidth: 40, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>{Math.round(volume * 100)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Playlist Form Modal */}
        {showPlaylistForm && (
          <div className="modal-overlay" onClick={() => setShowPlaylistForm(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{editingPlaylist ? 'Edit Playlist' : 'Create Playlist'}</h3>
                <button className="modal-close" onClick={() => setShowPlaylistForm(false)}>×</button>
              </div>
              <form onSubmit={handlePlaylistSubmit}>
                <div className="form-group">
                  <label>Playlist Name*</label>
                  <input
                    type="text"
                    value={playlistForm.name}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, name: e.target.value })}
                    placeholder="My Awesome Playlist"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={playlistForm.description}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, description: e.target.value })}
                    placeholder="Tell us about this playlist..."
                  />
                </div>
                <div className="form-group">
                  <label>Cover Image</label>
                  <div 
                    className="cover-upload-zone"
                    onDrop={handlePlaylistCoverDrop}
                    onDragOver={(e) => e.preventDefault()}
                    style={{
                      border: '2px dashed #ccc',
                      borderRadius: '8px',
                      padding: '20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      marginBottom: '10px',
                      background: playlistForm.coverUrl ? `url(${playlistForm.coverUrl}) center/cover` : '#f9f9f9'
                    }}
                    onClick={() => document.getElementById('playlist-cover-file-input').click()}
                  >
                    {uploadingPlaylistCover ? (
                      <p>Uploading...</p>
                    ) : playlistForm.coverUrl ? (
                      <div style={{ background: 'rgba(0,0,0,0.7)', color: 'white', padding: '10px', borderRadius: '4px' }}>
                        <p>✓ Cover uploaded</p>
                        <small>Click or drag to replace</small>
                      </div>
                    ) : (
                      <>
                        <p>📁 Drop image here or click to browse</p>
                        <small style={{ color: '#666' }}>PNG, JPG, WEBP up to 5MB</small>
                      </>
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
                    placeholder="Or paste URL..."
                    style={{ marginTop: '10px' }}
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="modal-btn modal-btn-secondary" onClick={() => setShowPlaylistForm(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="modal-btn modal-btn-primary">
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
              <p style={{ margin: '0 0 20px 0', color: '#666' }}>
                Add <strong>{showAddToPlaylist.title}</strong> to:
              </p>
              {playlists.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
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
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 20 }}>
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

        {/* Playlist Detail Modal with Drag & Drop */}
        {selectedPlaylist && (
          <div className="modal-overlay" onClick={() => setSelectedPlaylist(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: 600, maxWidth: '90vw' }}>
              <div className="modal-header">
                <h3>{selectedPlaylist.name}</h3>
                <button className="modal-close" onClick={() => setSelectedPlaylist(null)}>×</button>
              </div>
              
              {selectedPlaylist.description && (
                <p style={{ margin: '0 0 20px 0', color: '#666', lineHeight: 1.6 }}>
                  {selectedPlaylist.description}
                </p>
              )}

              <div style={{ marginBottom: 16, padding: 12, background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 28, color: '#FFD54A' }}>♫</div>
                <div>
                  <div style={{ fontWeight: 600, color: '#e6e6e6' }}>
                    {selectedPlaylist.songs?.length || 0} songs in this playlist
                  </div>
                  <div style={{ fontSize: 13, color: '#9a9a9a' }}>
                    Drag songs to reorder them
                  </div>
                </div>
              </div>

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
                    <ul className="playlist-songs-list">
                      {selectedPlaylist.songs.map(song => (
                        <SortableItem
                          key={song.id}
                          id={song.id}
                          song={song}
                          onRemove={handleRemoveFromPlaylist}
                          playlistId={selectedPlaylist.id}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                  <DragOverlay>
                    {(() => {
                      const song = selectedPlaylist.songs.find((s) => s.id === activeId);
                      if (!song) return null;
                      return (
                        <div className="drag-overlay" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'white', borderRadius: 10, boxShadow: '0 15px 40px rgba(0,0,0,0.18)' }}>
                          {song.coverUrl ? (
                            <img src={song.coverUrl} alt={song.title} style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 8 }} />
                          ) : (
                            <div style={{ width: 50, height: 50, borderRadius: 8, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }} />
                          )}
                          <div>
                            <div style={{ fontWeight: 700 }}>{song.title}</div>
                            <div style={{ fontSize: 12, color: '#666' }}>{song.artist} • {song.year}</div>
                          </div>
                        </div>
                      );
                    })()}
                  </DragOverlay>
                </DndContext>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9a9a9a' }}>
                  <div style={{ fontSize: 56, marginBottom: 16, color: '#FFD54A', filter: 'drop-shadow(0 2px 4px rgba(255,213,74,0.4))' }}>♪</div>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#e6e6e6' }}>No songs in this playlist yet</p>
                  <p style={{ margin: '8px 0 0 0', fontSize: 14 }}>Click "Add to Playlist" on any song to add it here!</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
