// --- GLOBAL VARIABLES ---
const POINTS_SYSTEM = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]; 

let currentRawData = []; 
let activeDataset = null; 
let liveFirebaseData = [];
let currentCalculatedStats = null; 

// --- Helper: Generate Icon HTML ---
function getIconHtml(name, type) {
    if (!name || name === "Unknown") return "";

    const fileName = name.toLowerCase()
        .replace(/['.]/g, '')       
        .replace(/\s+/g, '_');      

    const folder = type === 'uma' ? 'uma' : 'trainer';
    const repoBaseUrl = 'darkred1145.github.io/racc-open-stats'; 
    const localPath = `${folder}/${fileName}.png`;
    const cdnPath = `https://wsrv.nl/?url=${repoBaseUrl}/${localPath}&w=96&output=webp`;
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const finalSrc = isLocal ? localPath : cdnPath;
    const fallbackLogic = "if (this.src.includes('.png')) { this.src = this.src.replace('.png', '.jpg'); } else if (this.src.includes('.jpg')) { this.src = this.src.replace('.jpg', '.gif'); } else { this.style.display='none'; }";

    return `<img src="${finalSrc}" class="char-icon" loading="lazy" decoding="async" onerror="${fallbackLogic}" alt="">`;
}

// --- Helper: Preload Images ---
function preloadImages(nameList, type) {
    const folder = type === 'uma' ? 'uma' : 'trainer';
    const uniqueNames = [...new Set(nameList)]; 

    uniqueNames.forEach(name => {
        if (!name || name === "Unknown") return;
        const fileName = name.toLowerCase().replace(/['.]/g, '').replace(/\s+/g, '_');
        const img = new Image();
        img.onerror = function() {
            if (this.src.includes('.png')) { this.src = this.src.replace('.png', '.jpg'); } 
            else if (this.src.includes('.jpg')) { this.src = this.src.replace('.jpg', '.gif'); }
        };
        img.src = `${folder}/${fileName}.png`;
    });
}

function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

// --- Helper: Distance Category ---
function getDistanceCategory(surfaceString) {
    const match = surfaceString.match(/(\d+)m/);
    if (!match) return "Unknown";
    const dist = parseInt(match[1]);

    if (dist <= 1400) return "Short";
    if (dist <= 1800) return "Mile";
    if (dist <= 2400) return "Medium";
    return "Long";
}

// --- Formatting Helper ---
function formatName(fullName, type = 'uma') {
    if (!fullName) return "Unknown";
    
    let mainName = fullName;
    let variantHtml = "";

    if (fullName.includes('(')) {
        const parts = fullName.split('(');
        mainName = parts[0].trim();
        const variant = parts[1].replace(')', '').trim();
        variantHtml = ` <span class="variant-tag">${variant}</span>`;
    }

    const icon = getIconHtml(mainName, type); 

    return `<div class="name-cell">${icon}${mainName}${variantHtml}</div>`;
}

// --- FIREBASE LIVE DATA LISTENER ---
window.addEventListener('liveDataReady', (e) => {
    liveFirebaseData = e.detail; 
    renderLiveTournaments();
});

function renderLiveTournaments() {
    const container = document.getElementById('liveDataOutput');
    if (!container) return;
    
    if (liveFirebaseData.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:20px;">No live tournaments found.</div>`;
        return;
    }

    let html = '';

    liveFirebaseData.forEach(t => {
        // Ensure all iterable fields are strictly arrays to prevent Firebase coercion errors
        const tPlayers = Array.isArray(t.players) ? t.players : (t.players ? Object.values(t.players) : []);
        const tRaces = Array.isArray(t.races) ? t.races : (t.races ? Object.values(t.races) : []);
        const tBans = Array.isArray(t.bans) ? t.bans : (t.bans ? Object.values(t.bans) : []);
        const tTeams = Array.isArray(t.teams) ? t.teams : (t.teams ? Object.values(t.teams) : []);

        const playerMap = {};
        tPlayers.forEach(p => {
            playerMap[p.id] = { name: p.name, uma: p.uma };
        });

        html += `<div class="live-tourney-card">`;
        
        // --- 1. HEADER ---
        let statusClass = t.status === 'active' ? 'status-active' : 'status-completed';
        html += `
            <div class="live-header">
                <div style="display:flex; align-items:center; gap:10px;">
                    <h2>${t.name}</h2>
                    <span class="live-badge ${statusClass}">${t.status.toUpperCase()}</span>
                </div>
                
                <button onclick="copyTournamentResults('${t.id}')" class="copy-btn" title="Copy Results to Clipboard">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    <span>Copy Text</span>
                </button>
            </div>
            <div class="live-meta">
                <span><strong>Stage:</strong> ${t.stage || '-'}</span>
                <span><strong>Teams:</strong> ${tTeams.length}</span>
                <span><strong>ID:</strong> <span style="font-family:monospace; opacity:0.7;">${t.id}</span></span>
            </div>
        `;

        // --- 2. LIVE BANS ---
        if (tBans.length > 0) {
            const banHtml = tBans.map(b => `<span class="variant-tag" style="border: 1px solid var(--border-color); font-size: 0.85em; padding: 4px 8px;">🚫 ${b}</span>`).join('');
            html += `
            <div style="margin-bottom: 20px;">
                <strong style="color: var(--accent-color); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em;">Banned Umas</strong>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">${banHtml}</div>
            </div>`;
        }

        // --- 3. INDIVIDUAL RACE RESULTS ---
        if (tRaces.length > 0) {
            const groupOrder = { 'A': 1, 'B': 2, 'C': 3, 'Finals': 4 };
            const sortedRaces = [...tRaces].sort((a, b) => {
                const rankA = groupOrder[a.group] || 99;
                const rankB = groupOrder[b.group] || 99;
                if (rankA !== rankB) return rankA - rankB;
                return a.raceNumber - b.raceNumber;
            });

            html += `<div class="table-wrapper">
                <table class="live-table">
                    <thead>
                        <tr>
                            <th style="width:40px;">#</th>
                            <th style="width:65px;">Group</th>
                            <th>Race Results</th>
                        </tr>
                    </thead>
                    <tbody>`;

            sortedRaces.forEach(race => {
                const resultsArray = Object.entries(race.placements || {});
                resultsArray.sort((a, b) => a[1] - b[1]);

                const resultItems = resultsArray.map(([pid, rank]) => {
                    const pInfo = playerMap[pid] || { name: "Unknown", uma: "?" };
                    let rankColor = '';
                    if(rank === 1) rankColor = '#ffd700';
                    if(rank === 2) rankColor = '#c0c0c0';
                    if(rank === 3) rankColor = '#cd7f32';
                    
                    const style = rankColor ? `style="color:${rankColor}; font-weight:bold;"` : '';
                    
                    return `<div class="live-result-row">
                        <span class="lr-rank" ${style}>${rank}.</span>
                        <span class="lr-name">${pInfo.name}</span>
                        <span class="lr-uma">[${pInfo.uma}]</span>
                    </div>`;
                }).join('');

                html += `<tr>
                    <td style="text-align:center; font-weight:bold; color:var(--accent-color);">${race.raceNumber}</td>
                    <td style="text-align:center;">${race.group}</td>
                    <td><div class="live-results-grid">${resultItems}</div></td>
                </tr>`;
            });

            html += `</tbody></table></div>`;
        } else {
            html += `<div style="padding:15px; opacity:0.6; font-style:italic; border: 1px dashed var(--border-color); border-radius: 8px; text-align: center;">No individual race results uploaded yet.</div>`;
        }

        html += `</div>`; 
    });

    container.innerHTML = html;
}

// --- Copy to Clipboard Logic ---
function copyTournamentResults(tournamentId) {
    const tournament = liveFirebaseData.find(t => t.id === tournamentId);
    if (!tournament) return;
    let text = `${tournament.name}\n\n`;
    
    const tPlayers = Array.isArray(tournament.players) ? tournament.players : (tournament.players ? Object.values(tournament.players) : []);
    const tRaces = Array.isArray(tournament.races) ? tournament.races : (tournament.races ? Object.values(tournament.races) : []);

    const getPlayer = (id) => {
        const p = tPlayers.find(pl => pl.id === id);
        return p ? { name: p.name, uma: p.uma || "Unknown" } : { name: "Unknown", uma: "Unknown" };
    };

    const groups = ["A", "B", "C", "Finals"];
    groups.forEach(group => {
        const races = tRaces.filter(r => {
            if (group === "Finals") return r.stage === "finals";
            return r.group === group && r.stage === "groups";
        });
        races.sort((a, b) => a.raceNumber - b.raceNumber);

        if (races.length > 0) {
            races.forEach(race => {
                const groupName = group === "Finals" ? "Finals" : `Group ${group}`;
                text += `${groupName} Round ${race.raceNumber}\n`;

                const placements = Object.entries(race.placements || {})
                    .map(([id, rank]) => ({ id, rank: Number(rank) }))
                    .sort((a, b) => a.rank - b.rank);

                placements.forEach(p => {
                    const player = getPlayer(p.id);
                    text += `${p.rank}. ${player.name} [${player.uma}]\n`;
                });
                text += "\n"; 
            });
        }
    });

    navigator.clipboard.writeText(text.trim()).then(() => alert("Results copied to clipboard!")).catch(err => alert("Failed to copy. See console."));
}

// --- SEASON SWITCHER LOGIC ---
function switchSeason() {
    const seasonEl = document.getElementById('seasonSelector');
    if (!seasonEl) return;
    const season = seasonEl.value;
    
    const s1 = typeof S1_DATA !== 'undefined' ? S1_DATA : { compactData: [], tournamentRaceResults: {}, tournamentWinners: {}, tournamentBans: {} };
    const s2 = typeof S2_DATA !== 'undefined' ? S2_DATA : { compactData: [], tournamentRaceResults: {}, tournamentWinners: {}, tournamentBans: {} };

    if (season === 's1') {
        activeDataset = s1;
    } else if (season === 's2') {
        activeDataset = s2;
    } else if (season === 'all') {
        activeDataset = {
            compactData: [...(s1.compactData || []), ...(s2.compactData || [])],
            tournamentRaceResults: { ...(s1.tournamentRaceResults || {}), ...(s2.tournamentRaceResults || {}) },
            tournamentWinners: { ...(s1.tournamentWinners || {}), ...(s2.tournamentWinners || {}) },
            tournamentBans: { ...(s1.tournamentBans || {}), ...(s2.tournamentBans || {}) }
        };
    }

    if (activeDataset && activeDataset.compactData) {
        const umaToPreload = [];
        const trainerToPreload = [];

        currentRawData = activeDataset.compactData.map(r => {
            let umaBase = r[1];
            if(umaBase.includes('(')) umaBase = umaBase.split('(')[0].trim();
            umaToPreload.push(umaBase);
            trainerToPreload.push(r[0]);

            const distCat = getDistanceCategory(r[3]);
            return {
                Trainer: r[0],
                UniqueName: r[1],
                Wins: r[2],
                Surface: r[3],
                RawLength: r[4], 
                DistanceCategory: distCat,
                UmaPick: r[5],
                Variant: r[6],
                RacesRun: r[7] 
            };
        });
        preloadImages(umaToPreload, 'uma'); 
        preloadImages(trainerToPreload, 'trainer'); 
    } else {
        currentRawData = [];
    }

    updateData();
    if (document.getElementById('points-table-body')) renderStatsTable();
}

// --- UI Logic: Tabs ---
function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    
    const targetSection = document.getElementById(tabId);
    if (targetSection) targetSection.classList.add('active');

    const tabBtn = document.querySelector(`.tab[onclick="switchTab('${tabId}')"]`);
    if (tabBtn) tabBtn.classList.add('active');
    
    if (tabId === 'theorycrafter' && typeof generateTheorycraft === 'function') generateTheorycraft(); 
}

function setTierView(index) {
    const buttons = document.querySelectorAll('.switch-option');
    buttons.forEach((btn, i) => {
        if (i === index) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    const glider = document.getElementById('tierGlider');
    if(glider) glider.style.transform = `translateX(${index * 100}%)`;

    const views = ['view-wr', 'view-dom', 'view-champ'];
    views.forEach((viewId, i) => {
        const el = document.getElementById(viewId);
        if(el) {
            if (i === index) el.classList.add('active');
            else el.classList.remove('active');
        }
    });
}

// --- Calculate Points & Beat Rate & Placements ---
function getChampionshipPoints(activeTournaments, filteredData) {
    let stats = { trainer: {}, uma: {} };
    if (!activeDataset.tournamentRaceResults) return stats;

    const lookupMap = {};
    filteredData.forEach(row => {
        const key = `${row.RawLength}_${row.Trainer}`;
        lookupMap[key] = row.UniqueName;
    });

    for (const [tournamentName, stages] of Object.entries(activeDataset.tournamentRaceResults)) {
        if (!activeTournaments.has(tournamentName)) continue;

        for (const [stageName, races] of Object.entries(stages)) {
            races.forEach((raceResult) => {
                const lobbySize = raceResult.length; 
                const possibleOpponents = lobbySize - 1;

                raceResult.forEach((player, rankIndex) => {
                    if (player.includes("Player") || player === "DQ" || player === "NPC-chan") return;

                    const rank = rankIndex + 1;
                    const opponentsBeaten = (lobbySize - 1) - rankIndex;
                    const key = `${tournamentName}_${player}`;
                    const umaName = lookupMap[key] || "Unknown";
                    
                    let ptsEarned = 0;
                    if (rankIndex < POINTS_SYSTEM.length) { ptsEarned = POINTS_SYSTEM[rankIndex]; }

                    // Trainer stats accumulation
                    if (!stats.trainer[player]) {
                        stats.trainer[player] = { 
                            points: 0, races: 0, beaten: 0, totalOpp: 0, positions: [], 
                            history: [], tourneyPoints: {},
                            umaStats: {}, tourneyStats: {}
                        };
                    }
                    stats.trainer[player].points += ptsEarned;
                    stats.trainer[player].tourneyPoints[tournamentName] = (stats.trainer[player].tourneyPoints[tournamentName] || 0) + ptsEarned;
                    stats.trainer[player].races += 1;
                    stats.trainer[player].beaten += opponentsBeaten;
                    stats.trainer[player].totalOpp += possibleOpponents;
                    stats.trainer[player].positions.push(rank);
                    stats.trainer[player].history.push({ tournament: tournamentName, group: stageName, rank: rank, uma: umaName });

                    // Detailed Uma Stats Per Trainer
                    if (!stats.trainer[player].umaStats[umaName]) {
                        stats.trainer[player].umaStats[umaName] = { points: 0, races: 0, beaten: 0, totalOpp: 0, positions: [] };
                    }
                    stats.trainer[player].umaStats[umaName].points += ptsEarned;
                    stats.trainer[player].umaStats[umaName].races += 1;
                    stats.trainer[player].umaStats[umaName].beaten += opponentsBeaten;
                    stats.trainer[player].umaStats[umaName].totalOpp += possibleOpponents;
                    stats.trainer[player].umaStats[umaName].positions.push(rank);

                    // Detailed Tourney Stats Per Trainer
                    if (!stats.trainer[player].tourneyStats[tournamentName]) {
                        stats.trainer[player].tourneyStats[tournamentName] = { points: 0, beaten: 0, totalOpp: 0, umas: new Set() };
                    }
                    stats.trainer[player].tourneyStats[tournamentName].points += ptsEarned;
                    stats.trainer[player].tourneyStats[tournamentName].beaten += opponentsBeaten;
                    stats.trainer[player].tourneyStats[tournamentName].totalOpp += possibleOpponents;
                    stats.trainer[player].tourneyStats[tournamentName].umas.add(umaName);

                    // Uma global stats accumulation
                    if (umaName !== "Unknown") {
                        if (!stats.uma[umaName]) {
                            stats.uma[umaName] = { points: 0, races: 0, beaten: 0, totalOpp: 0, positions: [], history: [], tourneyPoints: {} };
                        }
                        stats.uma[umaName].points += ptsEarned;
                        stats.uma[umaName].tourneyPoints[tournamentName] = (stats.uma[umaName].tourneyPoints[tournamentName] || 0) + ptsEarned;
                        stats.uma[umaName].races += 1;
                        stats.uma[umaName].beaten += opponentsBeaten;
                        stats.uma[umaName].totalOpp += possibleOpponents;
                        stats.uma[umaName].positions.push(rank);
                    }
                });
            });
        }
    }
    return stats;
}

// --- Core Logic: Statistics Calculation ---
function calculateStats(filteredData) {
    const umaMap = {};
    const trainerMap = {};
    const activeTournaments = new Set();
    const tourneyEntryCount = {}; 
    const totalEntries = filteredData.length;

    filteredData.forEach(row => {
        activeTournaments.add(row.RawLength);
        tourneyEntryCount[row.RawLength] = (tourneyEntryCount[row.RawLength] || 0) + 1;
    });

    const pointsData = getChampionshipPoints(activeTournaments, filteredData);

    filteredData.forEach(row => {
        if (!umaMap[row.UniqueName]) { 
            umaMap[row.UniqueName] = { name: row.UniqueName, picks: 0, wins: 0, totalRacesRun: 0, tourneyWins: 0, bans: 0, pickedInTourneys: new Set(), bannedInTourneys: new Set() }; 
        }
        umaMap[row.UniqueName].picks++;
        umaMap[row.UniqueName].wins += row.Wins;
        umaMap[row.UniqueName].totalRacesRun += row.RacesRun;
        umaMap[row.UniqueName].pickedInTourneys.add(row.RawLength);

        if (activeDataset.tournamentWinners && activeDataset.tournamentWinners[row.RawLength] && activeDataset.tournamentWinners[row.RawLength].includes(row.Trainer)) {
            umaMap[row.UniqueName].tourneyWins++;
        }

        if (!trainerMap[row.Trainer]) {
            trainerMap[row.Trainer] = { name: row.Trainer, entries: 0, wins: 0, totalRacesRun: 0, characterHistory: {}, playedTourneys: new Set(), tournamentWins: 0 };
        }
        let t = trainerMap[row.Trainer];
        t.entries++;
        t.wins += row.Wins;
        t.totalRacesRun += row.RacesRun;
        t.playedTourneys.add(row.RawLength);

        if (!t.characterHistory[row.UniqueName]) t.characterHistory[row.UniqueName] = { picks: 0, wins: 0, racesRun: 0 };
        t.characterHistory[row.UniqueName].picks++;
        t.characterHistory[row.UniqueName].wins += row.Wins;
        t.characterHistory[row.UniqueName].racesRun += row.RacesRun;
    });

    Object.values(trainerMap).forEach(t => {
        t.playedTourneys.forEach(tourneyID => {
            if (activeDataset.tournamentWinners && activeDataset.tournamentWinners[tourneyID] && activeDataset.tournamentWinners[tourneyID].includes(t.name)) {
                t.tournamentWins++;
            }
        });
    });

    if (activeDataset.tournamentBans) {
        Object.keys(activeDataset.tournamentBans).forEach(tourneyID => {
            if (activeTournaments.has(tourneyID)) {
                activeDataset.tournamentBans[tourneyID].forEach(umaName => {
                    if (!umaMap[umaName]) { umaMap[umaName] = { name: umaName, picks: 0, wins: 0, totalRacesRun: 0, tourneyWins: 0, bans: 0, pickedInTourneys: new Set(), bannedInTourneys: new Set() }; }
                    umaMap[umaName].bans++;
                    umaMap[umaName].bannedInTourneys.add(tourneyID);
                });
            }
        });
    }

const formatItem = (item, type) => {
        const winRateVal = item.totalRacesRun > 0 ? (item.wins / item.totalRacesRun * 100).toFixed(1) : "0.0";
        let dominanceVal = "0.0";
        
        const pStats = type === 'trainer' ? pointsData.trainer[item.name] : pointsData.uma[item.name];
        let avgPos = "-";
        let volatility = "-";
        let bestTourney = "-";

        if (pStats) {
            if (pStats.totalOpp > 0) dominanceVal = ((pStats.beaten / pStats.totalOpp) * 100).toFixed(1);
            if (pStats.positions && pStats.positions.length > 0) {
                // Calculate Average Position (Mean)
                const sum = pStats.positions.reduce((a, b) => a + b, 0);
                const mean = sum / pStats.positions.length;
                avgPos = mean.toFixed(2);

                // Calculate Typical Finish Range (Mean ± Standard Deviation)
                if (pStats.positions.length > 1) {
                    const variance = pStats.positions.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / pStats.positions.length;
                    const stdDev = Math.sqrt(variance);
                    
                    let lowerBound = Math.max(1, Math.round(mean - stdDev));
                    let upperBound = Math.round(mean + stdDev);
                    
                    if (lowerBound === upperBound) {
                        volatility = `${lowerBound}${getOrdinal(lowerBound)}`;
                    } else {
                        volatility = `${lowerBound}${getOrdinal(lowerBound)} - ${upperBound}${getOrdinal(upperBound)}`;
                    }
                } else if (pStats.positions.length === 1) {
                    // Only 1 race run, so the range is just their exact finish
                    let pos = pStats.positions[0];
                    volatility = `${pos}${getOrdinal(pos)}`;
                }
            }
            if (pStats.tourneyPoints) {
                let maxPts = -1;
                for (const [tName, tPts] of Object.entries(pStats.tourneyPoints)) {
                    if (tPts > maxPts) { maxPts = tPts; bestTourney = tName; }
                }
            }
        }

        let tWinPct = "0.0";
        if (type === 'uma') tWinPct = item.picks > 0 ? (item.tourneyWins / item.picks * 100).toFixed(1) : "0.0";
        else { const tourneyCount = item.playedTourneys.size; tWinPct = tourneyCount > 0 ? (item.tournamentWins / tourneyCount * 100).toFixed(1) : "0.0"; }

        const stats = {
            ...item,
            displayName: formatName(item.name, type === 'trainer' ? 'trainer' : 'uma'),
            winRate: winRateVal,
            dom: dominanceVal,
            avgPos: avgPos,
            volatility: volatility,
            bestTourney: bestTourney,
            tourneyWinPct: tWinPct,
            detailedUmaStats: pStats ? pStats.umaStats : {},
            detailedTourneyStats: pStats ? pStats.tourneyStats : {}
        };

        if (type === 'uma') {
            stats.tourneyStatsDisplay = `${tWinPct}% <span style="font-size:0.8em; color:var(--text-color); opacity:0.7;">(${item.tourneyWins}/${item.picks})</span>`;
            let releaseIndex = 0;
            if (typeof UMA_RELEASE_MAP !== 'undefined' && UMA_RELEASE_MAP[item.name]) {
                releaseIndex = typeof TOURNAMENT_ORDER !== 'undefined' ? TOURNAMENT_ORDER.indexOf(UMA_RELEASE_MAP[item.name]) : -1;
                if (releaseIndex === -1) releaseIndex = 0; 
            }

            let validTournamentsForUma = 0, validEntriesForUma = 0;
            activeTournaments.forEach(tId => {
                let tIndex = typeof TOURNAMENT_ORDER !== 'undefined' ? TOURNAMENT_ORDER.indexOf(tId) : -1;
                if (tIndex === -1 || tIndex >= releaseIndex) { validTournamentsForUma++; validEntriesForUma += (tourneyEntryCount[tId] || 0); }
            });

            stats.pickPct = validEntriesForUma > 0 ? ((item.picks / validEntriesForUma) * 100).toFixed(1) : "0.0";

            let validBanTourneysAfterRelease = 0;
            if (activeDataset.tournamentBans) {
                Object.keys(activeDataset.tournamentBans).forEach(tId => {
                    if (activeTournaments.has(tId)) {
                        let tIndex = typeof TOURNAMENT_ORDER !== 'undefined' ? TOURNAMENT_ORDER.indexOf(tId) : -1;
                        if (tIndex === -1 || tIndex >= releaseIndex) validBanTourneysAfterRelease++;
                    }
                });
            }
            const banRate = validBanTourneysAfterRelease > 0 ? (item.bans / validBanTourneysAfterRelease * 100).toFixed(1) : "0.0";
            stats.banStatsDisplay = `${banRate}% <span style="font-size:0.8em; color:var(--text-color); opacity:0.7;">(${item.bans}/${validBanTourneysAfterRelease})</span>`;
            
            const validPresenceSet = new Set();
            [...item.pickedInTourneys, ...item.bannedInTourneys].forEach(tId => {
                let tIndex = typeof TOURNAMENT_ORDER !== 'undefined' ? TOURNAMENT_ORDER.indexOf(tId) : -1;
                if (tIndex === -1 || tIndex >= releaseIndex) validPresenceSet.add(tId);
            });
            const presenceRate = validTournamentsForUma > 0 ? (validPresenceSet.size / validTournamentsForUma * 100).toFixed(1) : "0.0";
            stats.presenceDisplay = `${presenceRate}% <span style="font-size:0.8em; color:var(--text-color); opacity:0.7;">(${validPresenceSet.size}/${validTournamentsForUma})</span>`;

            let bannedEntriesAfterRelease = 0;
            item.bannedInTourneys.forEach(tId => {
                let tIndex = typeof TOURNAMENT_ORDER !== 'undefined' ? TOURNAMENT_ORDER.indexOf(tId) : -1;
                if (tIndex === -1 || tIndex >= releaseIndex) bannedEntriesAfterRelease += (tourneyEntryCount[tId] || 0);
            });
            const availableEntries = validEntriesForUma - bannedEntriesAfterRelease;
            stats.truePickPct = availableEntries > 0 ? ((item.picks / availableEntries) * 100).toFixed(1) : "0.0"; 
        }

        if (type === 'trainer') {
            stats.pickPct = totalEntries > 0 ? ((item.entries / totalEntries) * 100).toFixed(1) : "0.0";
            stats.tourneyStatsDisplay = `${tWinPct}% <span style="font-size:0.8em; color:var(--text-color); opacity:0.7;">(${item.tournamentWins}/${item.playedTourneys.size})</span>`;
            const historyArr = Object.entries(item.characterHistory).map(([key, val]) => ({ name: key, ...val }));
            historyArr.sort((a, b) => b.picks - a.picks);
            const fav = historyArr[0];
            stats.favorite = fav ? `${formatName(fav.name, 'uma')} <span class="stat-badge">x${fav.picks}</span>` : '-';
            
            historyArr.sort((a, b) => b.wins - a.wins || a.picks - b.picks);
            const best = historyArr[0];
            stats.ace = (best && best.wins > 0) ? `${formatName(best.name, 'uma')} <span class="stat-badge win-badge">★${best.wins}</span>` : '<span style="color:var(--text-color); opacity:0.5;">-</span>';
        }

        return stats;
    };

    return {
        umaStats: Object.values(umaMap).map(i => formatItem(i, 'uma')),
        trainerStats: Object.values(trainerMap).map(i => formatItem(i, 'trainer'))
    };
}

// --- Render Functions ---
function renderTable(tableId, data, columns) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    tbody.innerHTML = data.map(row => {
        const cells = columns.map(col => {
            if (col === 'name') return `<td>${row.displayName}</td>`;
            if (col === 'winRate' || col === 'dom' || col === 'tourneyWinPct' || col === 'pickPct' || col === 'truePickPct') return `<td>${row[col]}%</td>`;
            return `<td>${row[col]}</td>`;
        });
        return `<tr>${cells.join('')}</tr>`;
    }).join('');
}

function renderTierList(containerId, data, countKey, minReq, sortKey) {
    const tiers = { S: [], A: [], B: [], C: [], D: [], F: [] };

    data.forEach(item => {
        if (item[countKey] < minReq) return;
        const val = parseFloat(item[sortKey]); 
        let tier = 'D';
        
        if (sortKey === 'winRate') {
             if (val <= 1.0) tier = 'F';
             else if (val >= 20.0) tier = 'S'; 
             else if (val >= 15.0) tier = 'A';
             else if (val >= 10.0) tier = 'B';
             else if (val >= 5.0) tier = 'C';
        } else if (sortKey === 'tourneyWinPct') {
             if (val <= 0.0) tier = 'F';
             else if (val >= 40.0) tier = 'S';
             else if (val >= 30.0) tier = 'A';
             else if (val >= 20.0) tier = 'B';
             else if (val >= 10.0) tier = 'C';
        } else {
            if (val <= 15.0) tier = 'F';
            else if (val >= 65.0) tier = 'S'; 
            else if (val >= 50.0) tier = 'A';
            else if (val >= 35.0) tier = 'B';
            else if (val >= 20.0) tier = 'C';
        }
        tiers[tier].push(item);
    });

    const container = document.getElementById(containerId);
    if (!container) return;
    let html = '';

    ['S', 'A', 'B', 'C', 'D', 'F'].forEach(tier => {
        if (tiers[tier].length === 0 && tier !== 'S') return;
        tiers[tier].sort((a, b) => b[sortKey] - a[sortKey]);
        html += `
            <div class="tier-row">
                <div class="tier-label tier-${tier}">${tier}</div>
                <div class="tier-content">
                    ${tiers[tier].map(i => `<span class="tier-item">${i.displayName} <b>${i[sortKey]}%</b></span>`).join('')}
                </div>
            </div>`;
    });

    if (html === '') html = '<div style="padding:15px; color:var(--text-color); opacity:0.6; text-align:center;">No data fits these criteria.</div>';
    container.innerHTML = html;
}

function updateData() {
    const surfaceEl = document.getElementById('surfaceFilter');
    const lengthEl = document.getElementById('lengthFilter');
    const minEl = document.getElementById('minEntries');
    const searchEl = document.getElementById('searchInput');

    const surface = surfaceEl ? surfaceEl.value : 'All';
    const length = lengthEl ? lengthEl.value : 'All';
    const minEntries = minEl ? minEl.value : 5;
    const searchQuery = searchEl ? searchEl.value.toLowerCase() : "";

    if(document.getElementById('minEntriesVal')) 
        document.getElementById('minEntriesVal').textContent = minEntries;

    const filtered = currentRawData.filter(d => {
        if (d.Trainer === "DQ") return false;
        const surfaceMatch = (surface === 'All' || d.Surface.includes(surface));
        const lengthMatch = (length === 'All' || d.DistanceCategory === length);
        const searchMatch = searchQuery === "" || d.Trainer.toLowerCase().includes(searchQuery) || d.UniqueName.toLowerCase().includes(searchQuery);

        return surfaceMatch && lengthMatch && searchMatch;
    });

    const stats = calculateStats(filtered);
    currentCalculatedStats = stats;

   if (document.getElementById('umaTable')) {
        stats.umaStats.sort((a, b) => b.dom - a.dom);
        renderTable('umaTable', stats.umaStats, 
            ['name', 'picks', 'pickPct', 'truePickPct', 'wins', 'winRate', 'dom', 'avgPos', 'volatility', 'bestTourney', 'tourneyStatsDisplay', 'banStatsDisplay', 'presenceDisplay']
        );
    }

    if (document.getElementById('trainerTable')) {
        stats.trainerStats.sort((a, b) => b.dom - a.dom);
        renderTable('trainerTable', stats.trainerStats, 
            ['name', 'entries', 'wins', 'winRate', 'dom', 'avgPos', 'volatility', 'bestTourney', 'tourneyStatsDisplay', 'favorite', 'ace']
        );
    }

    if (document.getElementById('umaTierListWR')) {
        renderTierList('umaTierListWR', stats.umaStats, 'picks', minEntries, 'winRate');
        renderTierList('trainerTierListWR', stats.trainerStats, 'entries', minEntries, 'winRate');
        renderTierList('umaTierListDom', stats.umaStats, 'picks', minEntries, 'dom');
        renderTierList('trainerTierListDom', stats.trainerStats, 'entries', minEntries, 'dom');
        renderTierList('umaTierListChamp', stats.umaStats, 'picks', minEntries, 'tourneyWinPct');
        renderTierList('trainerTierListChamp', stats.trainerStats, 'entries', minEntries, 'tourneyWinPct');
    }
    
    if (typeof populateTrainerDropdown === 'function') populateTrainerDropdown(); 
    if (typeof populateTheorycrafterDropdown === 'function' && document.getElementById('tcrafTrainerSelector')) { populateTheorycrafterDropdown(); }
    if (typeof populateSimDropdowns === 'function' && document.getElementById('simTypeSelector')) { populateSimDropdowns(); }
}

let sortState = {};
function sortTable(tableId, colIndex, isNumeric = false) {
    const key = tableId + colIndex;
    sortState[key] = !sortState[key];
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    const rows = Array.from(tbody.rows);

    rows.sort((a, b) => {
        let x = a.cells[colIndex].innerText;
        let y = b.cells[colIndex].innerText;

        if (isNumeric) {
            x = parseFloat(x.split(' ')[0].replace(/[^\d.-]/g, ''));
            y = parseFloat(y.split(' ')[0].replace(/[^\d.-]/g, ''));
        }
        if (isNaN(x)) x = 0; if (isNaN(y)) y = 0;
        return sortState[key] ? (x < y ? -1 : 1) : (x > y ? -1 : 1);
    });
    tbody.append(...rows);
}

function switchTheme() {
    const theme = document.getElementById('themeSelector').value;
    if (theme) { document.body.setAttribute('data-theme', theme); localStorage.setItem('siteTheme', theme); } 
    else { document.body.removeAttribute('data-theme'); localStorage.removeItem('siteTheme'); }
}

function calculateIndividualStats() {
    let stats = {};
    const searchEl = document.getElementById('searchInput');
    const searchQuery = searchEl ? searchEl.value.toLowerCase() : "";
    
    if (activeDataset && activeDataset.tournamentRaceResults) {
        for (const [tournamentName, stages] of Object.entries(activeDataset.tournamentRaceResults)) {
            for (const [stageName, races] of Object.entries(stages)) {
                races.forEach((raceResult) => {
                    raceResult.forEach((player, rankIndex) => {
                        if (player.includes("Player") || player === "DQ" || player === "NPC-chan") return;

                        if (!stats[player]) { stats[player] = { name: player, totalPoints: 0, racesRun: 0 }; }
                        if (rankIndex < POINTS_SYSTEM.length) { stats[player].totalPoints += POINTS_SYSTEM[rankIndex]; }
                        stats[player].racesRun += 1;
                    });
                });
            }
        }
    }
    const leaderboard = Object.values(stats)
        .filter(player => searchQuery === "" || player.name.toLowerCase().includes(searchQuery)) 
        .map(player => ({
            name: player.name,
            totalPoints: player.totalPoints,
            racesRun: player.racesRun,
            avgPoints: player.racesRun > 0 ? (player.totalPoints / player.racesRun).toFixed(2) : "0.00"
        }));
    return leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
}

function renderStatsTable() {
    const data = calculateIndividualStats(); 
    const tbody = document.getElementById('points-table-body');
    if (!tbody) return;
    tbody.innerHTML = data.map((player, index) => {
        const playerIcon = getIconHtml(player.name, 'trainer');
        return `
            <tr>
                <td><span class="stat-badge">${index + 1}</span></td>
                <td><div class="name-cell">${playerIcon}${player.name}</div></td>
                <td>${player.racesRun}</td>
                <td>${player.totalPoints}</td>
                <td>${player.avgPoints}</td>
            </tr>`;
    }).join('');
}

function exportCurrentTableToCSV() {
    const activeTabObj = document.querySelector('.view-section.active');
    if (!activeTabObj) return;
    
    const activeTab = activeTabObj.id;
    let tableId = '';
    
    if (activeTab === 'uma-stats') tableId = 'umaTable';
    else if (activeTab === 'trainer-stats') tableId = 'trainerTable';
    else if (activeTab === 'championship') tableId = 'champTable';
    else { alert("Please navigate to Uma Stats, Trainer Stats, or Championship to export a table."); return; }

    const table = document.getElementById(tableId);
    if (!table) return;
    
    let csvContent = "";
    const headers = Array.from(table.querySelectorAll("thead th")).map(th => `"${th.innerText.trim()}"`);
    csvContent += headers.join(",") + "\n";

    const rows = Array.from(table.querySelectorAll("tbody tr"));
    rows.forEach(row => {
        const rowData = Array.from(row.querySelectorAll("td")).map(td => {
            let text = td.innerText.replace(/(\r\n|\n|\r)/gm, " ").replace(/"/g, '""');
            return `"${text.trim()}"`;
        });
        csvContent += rowData.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `racc_open_${tableId}_export.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- TRAINER CARD LOGIC ---
function populateTrainerDropdown() {
    const selector = document.getElementById('cardTrainerSelector');
    if (!selector || !currentCalculatedStats) return;

    const trainers = currentCalculatedStats.trainerStats.map(t => t.name).sort();
    const currentSelection = selector.value;
    selector.innerHTML = trainers.map(t => `<option value="${t}">${t}</option>`).join('');
    
    if (trainers.includes(currentSelection)) selector.value = currentSelection;
    else if (trainers.includes("Kenesu")) selector.value = "Kenesu";
    else if (trainers.length > 0) selector.value = trainers[0];
    
    updateTrainerCard();
}

function updateTrainerCard() {
    const selector = document.getElementById('cardTrainerSelector');
    if (!selector || !currentCalculatedStats) return;

    const selectedName = selector.value;
    const tData = currentCalculatedStats.trainerStats.find(t => t.name === selectedName);
    if (!tData) return;

    // Head Data
    document.getElementById('tc-name').innerText = tData.name;
    document.getElementById('tc-avatar').innerHTML = getIconHtml(tData.name, 'trainer');
    
    // Grid Data
    document.getElementById('tc-wr').innerText = `${tData.winRate}%`;
    document.getElementById('tc-avg-pos').innerText = tData.avgPos;
    document.getElementById('tc-volatility').innerText = tData.volatility;
    document.getElementById('tc-dom').innerText = `${tData.dom}%`;
    document.getElementById('tc-twins').innerText = tData.tournamentWins;

    // Favorites
    document.getElementById('tc-ace').innerHTML = tData.ace;
    document.getElementById('tc-fav').innerHTML = tData.favorite;

    // --- UMAS LIST (Best to Worst Avg Score & Dom%) ---
    const umasObj = tData.detailedUmaStats || {};
    const umasList = Object.entries(umasObj).map(([name, data]) => {
        const avgPos = data.positions.length > 0 ? (data.positions.reduce((a,b)=>a+b,0) / data.positions.length) : 0;
        const avgPts = data.races > 0 ? (data.points / data.races) : 0;
        const dom = data.totalOpp > 0 ? (data.beaten / data.totalOpp * 100) : 0;
        return { name, avgPos, avgPts, dom };
    });
    
    // Sort highest avg pts, then dom%
    umasList.sort((a, b) => b.avgPts - a.avgPts || b.dom - a.dom);
    const topUmas = umasList.slice(0, 5);
    
    const umasContainer = document.getElementById('tc-umas-list');
    if (topUmas.length > 0) {
        umasContainer.innerHTML = topUmas.map(u => `
            <div class="tc-list-item">
                <span style="flex: 2; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 5px;" title="${u.name}">${u.name}</span>
                <span style="flex: 1; text-align: center;">${u.avgPos.toFixed(1)}</span>
                <span style="flex: 1; text-align: center; color: var(--accent-color); font-weight: bold;">${u.avgPts.toFixed(1)}</span>
                <span style="flex: 1; text-align: right; opacity: 0.8;">${u.dom.toFixed(1)}%</span>
            </div>
        `).join('');
    } else {
        umasContainer.innerHTML = `<div style="opacity:0.5; font-style:italic; padding-top:10px;">No data available.</div>`;
    }

    // --- TOURNEYS LIST (Best to Worst Total Score & Dom%) ---
    const tourneyObj = tData.detailedTourneyStats || {};
    const tourneyList = Object.entries(tourneyObj).map(([name, data]) => {
        const dom = data.totalOpp > 0 ? (data.beaten / data.totalOpp * 100) : 0;
        const umaStr = Array.from(data.umas).join(', ');
        return { name, umaStr, pts: data.points, dom };
    });
    
    // Sort highest total pts, then dom%
    tourneyList.sort((a, b) => b.pts - a.pts || b.dom - a.dom);
    const topTourneys = tourneyList.slice(0, 5);

    const tourneysContainer = document.getElementById('tc-tourneys-list');
    if (topTourneys.length > 0) {
        tourneysContainer.innerHTML = topTourneys.map(t => `
            <div class="tc-list-item">
                <span style="flex: 1.5; font-weight: 600;">${t.name}</span>
                <span style="flex: 1.5; opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 5px;" title="${t.umaStr}">${t.umaStr}</span>
                <span style="flex: 1; text-align: center; color: var(--accent-color); font-weight: bold;">${t.pts}</span>
                <span style="flex: 1; text-align: right; opacity: 0.8;">${t.dom.toFixed(1)}%</span>
            </div>
        `).join('');
    } else {
        tourneysContainer.innerHTML = `<div style="opacity:0.5; font-style:italic; padding-top:10px;">No data available.</div>`;
    }
}

function downloadTrainerCard() {
    const cardElement = document.getElementById('captureCard');
    const selector = document.getElementById('cardTrainerSelector');
    if (!cardElement || !selector) return;
    
    const trainerName = selector.value;
    const btn = document.querySelector('button[onclick="downloadTrainerCard()"]');
    const originalText = btn.innerHTML;
    
    btn.innerHTML = "⏳ Generating..."; btn.style.opacity = "0.7"; btn.disabled = true;
    
    html2canvas(cardElement, { useCORS: true, backgroundColor: null, scale: 2, logging: false }).then(canvas => {
        const link = document.createElement('a');
        link.download = `${trainerName}_Racc_Open_Stats.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        btn.innerHTML = originalText; btn.style.opacity = "1"; btn.disabled = false;
    }).catch(err => {
        console.error("Card generation failed:", err);
        alert("Failed to generate the Trainer Card. See console for details.");
        btn.innerHTML = originalText; btn.style.opacity = "1"; btn.disabled = false;
    });
}

function downloadTierList() {
    const cardElement = document.getElementById('tierListCard');
    if (!cardElement) return;
    
    const btn = document.querySelector('button[onclick="downloadTierList()"]');
    const originalText = btn.innerHTML;
    
    btn.innerHTML = "⏳ Generating..."; btn.style.opacity = "0.7"; btn.disabled = true;
    
    html2canvas(cardElement, { useCORS: true, backgroundColor: null, scale: 2, logging: false }).then(canvas => {
        const link = document.createElement('a');
        
        let viewName = "WinRate";
        if (document.getElementById('view-dom') && document.getElementById('view-dom').classList.contains('active')) viewName = "Dominance";
        if (document.getElementById('view-champ') && document.getElementById('view-champ').classList.contains('active')) viewName = "TourneyWins";
        
        link.download = `Racc_Open_TierList_${viewName}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        btn.innerHTML = originalText; btn.style.opacity = "1"; btn.disabled = false;
    }).catch(err => {
        console.error("Tier list generation failed:", err);
        alert("Failed to generate the Tier List. See console for details.");
        btn.innerHTML = originalText; btn.style.opacity = "1"; btn.disabled = false;
    });
}

// --- TEAM THEORYCRAFTER LOGIC ---
function populateTheorycrafterDropdown() {
    const selector = document.getElementById('tcrafTrainerSelector');
    if (!selector || !currentCalculatedStats) return;

    const trainers = currentCalculatedStats.trainerStats.map(t => t.name).sort();
    const currentSelection = selector.value;
    selector.innerHTML = trainers.map(t => `<option value="${t}">${t}</option>`).join('');
    
    if (trainers.includes(currentSelection)) selector.value = currentSelection;
    else if (trainers.includes("Kenesu")) selector.value = "Kenesu";
    else if (trainers.length > 0) selector.value = trainers[0];
    
    generateTheorycraft();
}

function generateTheorycraft() {
    const selector = document.getElementById('tcrafTrainerSelector');
    const container = document.getElementById('tcraf-results');
    if (!selector || !currentCalculatedStats || !container) return;

    const selectedName = selector.value;
    const tData = currentCalculatedStats.trainerStats.find(t => t.name === selectedName);
    
    if (!tData) { container.innerHTML = `<div style="text-align:center; padding:15px; opacity:0.7;">No data found for this trainer.</div>`; return; }

    const historyArr = Object.entries(tData.characterHistory).map(([key, val]) => ({ name: key, ...val }));
    const comfortTeam = [...historyArr].sort((a, b) => b.picks - a.picks).slice(0, 3);
    const sweatTeam = [...historyArr].filter(a => a.picks >= 1).sort((a, b) => {
        const wrA = a.racesRun > 0 ? a.wins / a.racesRun : 0;
        const wrB = b.racesRun > 0 ? b.wins / b.racesRun : 0;
        if (wrB !== wrA) return wrB - wrA;
        return b.picks - a.picks; 
    }).slice(0, 3);
    const metaTeam = [...currentCalculatedStats.umaStats].sort((a, b) => b.dom - a.dom).slice(0, 3);

    const renderTeam = (title, description, umas, typeDesc) => {
        let html = `
        <div style="background: rgba(0,0,0,0.1); border: 1px solid var(--border-color); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
            <h3 style="margin: 0 0 5px 0; color: var(--accent-color); font-size: 1.05em;">${title}</h3>
            <div style="font-size: 0.8rem; opacity: 0.7; margin-bottom: 12px;">${description}</div>
            <div style="display: flex; gap: 15px; flex-wrap: wrap; justify-content: space-evenly;">`;
        
        umas.forEach(u => {
            const icon = getIconHtml(u.name.split('(')[0].trim(), 'uma');
            html += `<div style="display: flex; flex-direction: column; align-items: center; width: 90px; text-align: center;">
                ${icon}<span style="font-size: 0.8rem; font-weight: 600; margin-top: 6px; line-height: 1.2;">${u.name}</span>
                <span style="font-size: 0.7rem; color: var(--accent-color); margin-top: 4px; font-weight: bold;">${typeDesc(u)}</span>
            </div>`;
        });
        
        for(let i = umas.length; i < 3; i++) {
             html += `<div style="display: flex; flex-direction: column; align-items: center; width: 90px; text-align: center; opacity: 0.3;">
                <div style="width: 50px; height: 50px; border-radius: 50%; background: var(--border-color); margin-bottom: 6px;"></div>
                <span style="font-size: 0.8rem; font-weight: 500;">Empty Slot</span>
            </div>`;
        }
        return html + `</div></div>`;
    };

    let html = '';
    html += renderTeam("Comfort Zone", "This trainer's most frequently picked setup.", comfortTeam, (u) => `${u.picks} Picks`);
    html += renderTeam("Maximum Efficiency", "This trainer's statistically highest win-rate setup.", sweatTeam, (u) => `${u.racesRun > 0 ? ((u.wins / u.racesRun) * 100).toFixed(1) : "0.0"}% WR`);
    html += renderTeam("Global Meta Setup", "The mathematical top 3 most dominant Umas across the entire playerbase.", metaTeam, (u) => `${u.dom}% Dominance`);
    container.innerHTML = html;
}

// --- NEW: CUSTOM TEAM SIMULATOR ---
function populateSimDropdowns() {
    const typeEl = document.getElementById('simTypeSelector');
    const s1 = document.getElementById('simSlot1'), s2 = document.getElementById('simSlot2'), s3 = document.getElementById('simSlot3');
    if (!typeEl || !s1 || !s2 || !s3 || !currentCalculatedStats) return;

    const type = typeEl.value;
    let options = type === 'trainer' ? currentCalculatedStats.trainerStats.map(t => t.name).sort() : currentCalculatedStats.umaStats.map(u => u.name).sort();
    const html = `<option value="">-- Select --</option>` + options.map(o => `<option value="${o}">${o}</option>`).join('');
    
    const v1 = s1.value, v2 = s2.value, v3 = s3.value;
    s1.innerHTML = html; s2.innerHTML = html; s3.innerHTML = html;

    if (options.includes(v1)) s1.value = v1; else if(options.length > 0) s1.value = options[0];
    if (options.includes(v2)) s2.value = v2; else if(options.length > 1) s2.value = options[1];
    if (options.includes(v3)) s3.value = v3; else if(options.length > 2) s3.value = options[2];
    runSimulation();
}

function runSimulation() {
    const typeEl = document.getElementById('simTypeSelector');
    const container = document.getElementById('sim-results');
    const s1 = document.getElementById('simSlot1'), s2 = document.getElementById('simSlot2'), s3 = document.getElementById('simSlot3');

    if (!typeEl || !container || !currentCalculatedStats || !s1) return;
    
    const type = typeEl.value;
    const list = type === 'trainer' ? currentCalculatedStats.trainerStats : currentCalculatedStats.umaStats;
    const members = [list.find(x => x.name === s1.value), list.find(x => x.name === s2.value), list.find(x => x.name === s3.value)].filter(Boolean);

    if (members.length === 0) { container.innerHTML = `<div style="text-align:center; opacity:0.6;">Select members to simulate.</div>`; return; }

    let totalWins = 0, totalRaces = 0, totalDom = 0, domCount = 0;
    let cardsHtml = '';
    
    members.forEach(m => {
        totalWins += m.wins || 0; totalRaces += m.totalRacesRun || 0; totalDom += parseFloat(m.dom) || 0; domCount++;
        const icon = getIconHtml(m.name.split('(')[0].trim(), type);
        cardsHtml += `<div style="display: flex; flex-direction: column; align-items: center; width: 95px; text-align: center; background: rgba(0,0,0,0.2); padding: 12px 8px; border-radius: 8px; border: 1px solid var(--border-color);">
            ${icon}<span style="font-size: 0.8rem; font-weight: 600; margin-top: 6px; line-height: 1.2;">${m.name}</span>
            <span style="font-size: 0.7rem; color: var(--accent-color); margin-top: 4px;">${m.winRate}% WR</span>
            <span style="font-size: 0.7rem; opacity: 0.8;">${m.dom}% Dom</span>
        </div>`;
    });

    const combinedWr = totalRaces > 0 ? ((totalWins / totalRaces) * 100).toFixed(1) : "0.0";
    const avgDom = domCount > 0 ? (totalDom / domCount).toFixed(1) : "0.0";

    container.innerHTML = `
    <div style="background: rgba(0,0,0,0.1); border: 1px solid var(--border-color); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
        <h3 style="margin: 0 0 12px 0; color: var(--accent-color); text-align: center;">Team Aggregate Performance</h3>
        <div style="display: flex; gap: 12px; justify-content: space-evenly; margin-bottom: 15px; flex-wrap: wrap;">${cardsHtml}</div>
        <div style="display: flex; gap: 15px; justify-content: space-around; background: var(--bg-color); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
            <div style="text-align: center;">
                <div style="font-size: 0.75em; opacity: 0.7; text-transform: uppercase;">Combined Win Rate</div>
                <div style="font-size: 1.2em; font-weight: bold; color: var(--accent-color);">${combinedWr}%</div>
                <div style="font-size: 0.7em; opacity: 0.5;">(${totalWins} / ${totalRaces} Races)</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 0.75em; opacity: 0.7; text-transform: uppercase;">Average Dominance</div>
                <div style="font-size: 1.2em; font-weight: bold; color: var(--accent-color);">${avgDom}%</div>
            </div>
        </div>
    </div>`;
}

let secretClickCount = 0;
let secretClickTimer;
window.raccAiMode = "toxic";

function secretAiUnlock() {
    secretClickCount++;
    clearTimeout(secretClickTimer);
    
    secretClickTimer = setTimeout(() => { 
        secretClickCount = 0; 
    }, 2000); 

    const aiBtn = document.getElementById('aiScoutBtn');
    const reportDiv = document.getElementById('tc-ai-report');

    if (!aiBtn) return;

    if (secretClickCount === 5) {
        window.raccAiMode = "toxic";
        aiBtn.style.display = 'inline-block';
        aiBtn.style.background = '#ef4444';
        aiBtn.innerHTML = "🔥 Toxic Scout";
    } else if (secretClickCount === 10) {
        window.raccAiMode = "succubus";
        aiBtn.style.display = 'inline-block';
        aiBtn.style.background = '#d946ef';
        aiBtn.innerHTML = "🦇 Succubus Scout";
        secretClickCount = 0;
    }
}

async function generateAiScoutReport() {
    const selector = document.getElementById('cardTrainerSelector');
    const reportDiv = document.getElementById('tc-ai-report');
    const btn = document.getElementById('aiScoutBtn');
    
    if (!selector || !currentCalculatedStats) return;

    const selectedName = selector.value;
    const tData = currentCalculatedStats.trainerStats.find(t => t.name === selectedName);
    if (!tData) return;

    // Save original button text to reset it later
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = "⏳ Summoning...";
    btn.disabled = true;
    reportDiv.style.display = "block";
    reportDiv.innerHTML = "<span style='opacity:0.7;'>Gazing into the abyss...</span>";

    const trainerRaces = currentRawData.filter(r => r.Trainer === selectedName);
    const uniqueUmas = new Set(trainerRaces.map(r => r.UniqueName)).size;

    const surfaceStats = { 'Turf': { beaten: 0, opp: 0 }, 'Dirt': { beaten: 0, opp: 0 } };
    const distStats = { 'Short': { beaten: 0, opp: 0 }, 'Mile': { beaten: 0, opp: 0 }, 'Medium': { beaten: 0, opp: 0 }, 'Long': { beaten: 0, opp: 0 } };
    const detailedStats = tData.detailedTourneyStats || {};

    trainerRaces.forEach(r => {
        const tStats = detailedStats[r.RawLength]; 
        if (tStats) {
            let surf = r.Surface.includes('Dirt') ? 'Dirt' : 'Turf';
            surfaceStats[surf].beaten += tStats.beaten;
            surfaceStats[surf].opp += tStats.totalOpp;

            let dist = r.DistanceCategory; 
            if(distStats[dist]) {
                distStats[dist].beaten += tStats.beaten;
                distStats[dist].opp += tStats.totalOpp;
            }
        }
    });

    const getBestDom = (statsObj) => {
        let best = { name: 'None', dom: -1, opp: 0 };
        for (const [key, val] of Object.entries(statsObj)) {
            if (val.opp > 0) {
                let dom = val.beaten / val.opp;
                if ((dom > best.dom && val.opp >= 16) || best.dom === -1) {
                    best = { name: key, dom: dom, opp: val.opp };
                }
            }
        }
        return best.name !== 'None' ? `${best.name} (${(best.dom*100).toFixed(1)}% Dominance)` : 'N/A';
    };

    const cleanAce = tData.ace ? tData.ace.replace(/<[^>]*>?/gm, '').trim() : "None";
    const cleanFav = tData.favorite ? tData.favorite.replace(/<[^>]*>?/gm, '').trim() : "None";

    const cleanData = {
        name: tData.name,
        totalRaces: trainerRaces.reduce((sum, r) => sum + r.RacesRun, 0),
        rosterDepth: uniqueUmas,
        winRate: tData.winRate,
        dom: tData.dom,
        avgPos: tData.avgPos,
        tournamentWins: tData.tournamentWins,
        favorite: cleanFav,
        ace: cleanAce,
        bestSurface: getBestDom(surfaceStats),
        bestDistance: getBestDom(distStats),
        persona: window.raccAiMode 
    };

    try {
        const WORKER_URL = "https://racc-open-stats.vercel.app/api/scout"; 
        
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cleanData)
        });

        const data = await response.json();
        
        if (data.insight) {
            const formattedText = data.insight.split('\n').map(p => `<p style="margin-top:0; margin-bottom:8px;">${p}</p>`).join('');
            
            // Change the header color based on the persona
            const headerColor = window.raccAiMode === "succubus" ? "#d946ef" : "#ef4444";
            const icon = window.raccAiMode === "succubus" ? "🦇" : "🔥";
            const title = window.raccAiMode === "succubus" ? "Succubus Insight" : "Toxic Scout Report";

            reportDiv.innerHTML = `<strong style="color: ${headerColor};">${icon} ${title}:</strong><br>${formattedText}`;
            reportDiv.style.borderLeft = `4px solid ${headerColor}`;
        } else {
            reportDiv.innerHTML = "<em>The summoning failed. Try again.</em>";
        }
    } catch (error) {
        console.error("AI Error:", error);
        reportDiv.innerHTML = "<em>Connection to the underworld lost.</em>";
    } finally {
        btn.innerHTML = originalBtnText;
        btn.disabled = false;
    }
}

async function generateAutoDraft() {
    const typeEl = document.getElementById('simTypeSelector');
    const btn = document.getElementById('autoDraftBtn');
    const s1 = document.getElementById('simSlot1');
    const s2 = document.getElementById('simSlot2');
    const s3 = document.getElementById('simSlot3');

    if (!typeEl || !currentCalculatedStats || !s1) return;

    const type = typeEl.value; // Checks if we are drafting 'trainer' or 'uma'
    const list = type === 'trainer' ? currentCalculatedStats.trainerStats : currentCalculatedStats.umaStats;

    // Loading State
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = "⏳ Calculating...";
    btn.disabled = true;

    // Give the AI the top 15 win-rates and top 15 dominances to build a team from
    const topWr = [...list].sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate)).slice(0, 15).map(x => `${x.name} (${x.winRate}% WR)`);
    const topDom = [...list].sort((a, b) => parseFloat(b.dom) - parseFloat(a.dom)).slice(0, 15).map(x => `${x.name} (${x.dom}% Dom)`);

    const payload = {
        type: type,
        topWr: topWr,
        topDom: topDom
    };

    try {
        const WORKER_URL = "https://racc-open-stats.vercel.app/api/teambuilder"; 
        
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        // The AI will return a strict JSON array: ["Name1", "Name2", "Name3"]
        if (data.team && data.team.length === 3) {
            
            // Helper to cleanly select an option in the dropdown
            const setSlot = (slot, value) => {
                for (let i = 0; i < slot.options.length; i++) {
                    if (slot.options[i].value === value) {
                        slot.selectedIndex = i;
                        break;
                    }
                }
            };

            setSlot(s1, data.team[0]);
            setSlot(s2, data.team[1]);
            setSlot(s3, data.team[2]);

            // Force the simulator UI to calculate the new team
            runSimulation(); 
        }

    } catch (error) {
        console.error("Draft Error:", error);
        alert("Calculation failed. Please try again.");
    } finally {
        btn.innerHTML = originalBtnText;
        btn.disabled = false;
    }
}

window.onload = function() {
    const savedTheme = localStorage.getItem('siteTheme');
    if (savedTheme) {
        const themeSelector = document.getElementById('themeSelector');
        if(themeSelector) themeSelector.value = savedTheme;
        document.body.setAttribute('data-theme', savedTheme);
    }
    switchSeason();
};







