const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'ApostadorDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add import for SupabaseService
const oldImport = `import { Match, Participant, AlertNotification, UserPick, Pool } from '../types';`;
const newImport = `import { Match, Participant, AlertNotification, UserPick, Pool } from '../types';\nimport { SupabaseService } from '../lib/supabaseService';`;

if (content.includes(oldImport)) {
  content = content.replace(oldImport, newImport);
  console.log('1. Import added successfully.');
} else {
  console.log('1. Import anchor not found.');
}

// 2. Add useEffect to load picks on user.id change
const oldPicksState = `  const [autosaveToasts, setAutosaveToasts] = useState<Record<string, boolean>>({});\n  const timeoutRefs = useRef<Record<string, any>>({});`;
const newPicksState = `  const [autosaveToasts, setAutosaveToasts] = useState<Record<string, boolean>>({});\n  const timeoutRefs = useRef<Record<string, any>>({});\n\n  // Fetch real picks from Supabase Cloud on mount/load\n  useEffect(() => {\n    const loadPicks = async () => {\n      if (user.id) {\n        const dbPicks = await SupabaseService.fetchUserPicks(user.id);\n        if (dbPicks) {\n          const mappedPicks: Record<string, UserPick> = {};\n          Object.entries(dbPicks).forEach(([matchId, data]) => {\n            mappedPicks[matchId] = {\n              matchId,\n              scoreA: data.scoreA,\n              scoreB: data.scoreB,\n              saved: true\n            };\n          });\n          setUserPicks(prev => ({ ...prev, ...mappedPicks }));\n        }\n      }\n    };\n    loadPicks();\n  }, [user.id]);`;

if (content.includes(oldPicksState)) {
  content = content.replace(oldPicksState, newPicksState);
  console.log('2. useEffect for loading picks added successfully.');
} else {
  console.log('2. Picks state anchor not found.');
}

// 3. Replace handleScoreChange to call savePick
const oldScoreChange = `  // Handle score change under Palpites tab (Simulating the 800ms debounce auto-save)
  const handleScoreChange = (matchId: string, side: 'a' | 'b', value: string) => {
    const val = value === '' ? null : parseInt(value);
    if (val !== null && (val < 0 || isNaN(val))) return;

    setUserPicks(prev => {
      const current = prev[matchId] || { matchId, scoreA: null, scoreB: null, saved: false };
      return {
        ...prev,
        [matchId]: {
          ...current,
          scoreA: side === 'a' ? val : current.scoreA,
          scoreB: side === 'b' ? val : current.scoreB,
          saved: false
        }
      };
    });

    // Clear any previous debounce timeouts for this matchId
    if (timeoutRefs.current[matchId]) {
      clearTimeout(timeoutRefs.current[matchId]);
    }

    // Trigger debounced autosave state (800ms)
    timeoutRefs.current[matchId] = setTimeout(() => {
      setUserPicks(prev => ({
        ...prev,
        [matchId]: { ...prev[matchId], saved: true }
      }));
      setAutosaveToasts(prev => ({ ...prev, [matchId]: true }));

      // Hide toast after 2 seconds
      setTimeout(() => {
        setAutosaveToasts(prev => ({ ...prev, [matchId]: false }));
      }, 2000);
    }, 800);
  };`;

const newScoreChange = `  // Handle score change under Palpites tab (Debounced auto-save writing to database)
  const handleScoreChange = (matchId: string, side: 'a' | 'b', value: string) => {
    const val = value === '' ? null : parseInt(value);
    if (val !== null && (val < 0 || isNaN(val))) return;

    let updatedScoreA: number | null = null;
    let updatedScoreB: number | null = null;

    setUserPicks(prev => {
      const current = prev[matchId] || { matchId, scoreA: null, scoreB: null, saved: false };
      const nextScoreA = side === 'a' ? val : current.scoreA;
      const nextScoreB = side === 'b' ? val : current.scoreB;
      updatedScoreA = nextScoreA;
      updatedScoreB = nextScoreB;
      return {
        ...prev,
        [matchId]: {
          ...current,
          scoreA: nextScoreA,
          scoreB: nextScoreB,
          saved: false
        }
      };
    });

    // Clear any previous debounce timeouts for this matchId
    if (timeoutRefs.current[matchId]) {
      clearTimeout(timeoutRefs.current[matchId]);
    }

    // Trigger debounced autosave state (800ms)
    timeoutRefs.current[matchId] = setTimeout(async () => {
      // Perform database write
      if (user.id && updatedScoreA !== null && updatedScoreB !== null) {
        await SupabaseService.savePick(user.id, matchId, updatedScoreA, updatedScoreB);
      }

      setUserPicks(prev => ({
        ...prev,
        [matchId]: { ...prev[matchId], saved: true }
      }));
      setAutosaveToasts(prev => ({ ...prev, [matchId]: true }));

      // Hide toast after 2 seconds
      setTimeout(() => {
        setAutosaveToasts(prev => ({ ...prev, [matchId]: false }));
      }, 2000);
    }, 800);
  };`;

if (content.includes(oldScoreChange)) {
  content = content.replace(oldScoreChange, newScoreChange);
  console.log('3. handleScoreChange function replaced successfully.');
} else {
  // Check with CRLF
  const oldScoreChangeCRLF = oldScoreChange.replace(/\n/g, '\r\n');
  const newScoreChangeCRLF = newScoreChange.replace(/\n/g, '\r\n');
  if (content.includes(oldScoreChangeCRLF)) {
    content = content.replace(oldScoreChangeCRLF, newScoreChangeCRLF);
    console.log('3. handleScoreChange function replaced successfully (CRLF).');
  } else {
    console.log('3. handleScoreChange function anchor not found.');
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('ApostadorDashboard.tsx patch completed.');
