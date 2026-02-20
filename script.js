// --- GLOBAL VARIABLES ---
const POINTS_SYSTEM = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]; 

let currentRawData = []; 
let activeDataset = null; 
let liveFirebaseData = [];
let currentCalculatedStats = null; // Stored globally for Trainer Card generator

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

    return `<img src="${finalSrc}" 
        class="char-icon" 
        loading="lazy" 
        decoding="async"
        onerror="${fallbackLogic}" 
        alt="">`;
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
            if (this.src.includes('.png')) {
                this.src = this.src.replace('.png', '.jpg');
            } else if (this.src.includes('.jpg')) {
                this.src = this.src.replace('.jpg', '.gif');
            }
        };
        
        img.src = `${folder}/${fileName}.png`;
    });
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
        const playerMap = {};
        if (t.players && Array.isArray(t.players)) {
            t.players.forEach(p => {
                playerMap[p.id] = { name: p.name, uma: p.uma };
            });
        }

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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    <span>Copy Text</span>
                </button>
            </div>
            <div class="live-meta">
                <span><strong>Stage:</strong> ${t.stage || '-'}</span>
                <span><strong>Teams:</strong> ${t.teams ? t.teams.length : 0}</span>
                <span><strong>ID:</strong> <span style="font-family:monospace; opacity:0.7;">${t.id}</span></span>
            </div>
        `;

        // --- 2. LIVE BANS ---
        if (t.bans && t.bans.length > 0) {
            const banHtml = t.bans.map(b => `<span class="variant-tag" style="border: 1px solid var(--border-color); font-size: 0.9em; padding: 4px 10px;">🚫 ${b}</span>`).join('');
            html += `
            <div style="margin-bottom: 25px;">
                <strong style="color: var(--accent-color); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.1em;">Banned Umas</strong>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;">${banHtml}</div>
            </div>`;
        }

        // --- 3. DRAFT ORDER ---
        if (t.draft && t.draft.order && t.draft.order.length > 0) {
            const draftHtml = t.draft.order.map((playerId, idx) => {
                const pInfo = playerMap[playerId] || { name: 'Unknown', uma: null };
                const umaDisplay = pInfo.uma ? `[${pInfo.uma}]` : '[Pending Pick]';
                const umaStyle = pInfo.uma ? `color: var(--text-color);` : `color: var(--accent-color); opacity: 0.7;`;
                
                return `<div class="live-result-row">
                    <span class="lr-rank" style="width: auto; margin-right: 10px; color: var(--accent-color);">P${idx + 1}</span>
                    <span class="lr-name">${pInfo.name}</span>
                    <span class="lr-uma" style="${umaStyle}">${umaDisplay}</span>
                </div>`;
            }).join('');

            html += `
            <div class="table-wrapper" style="margin-bottom: 25px;">
                <table class="live-table">
                    <thead><tr><th>Draft Priority</th></tr></thead>
                    <tbody><tr><td style="padding: 15px;">
                        <div class="live-results-grid">${draftHtml}</div>
                    </td></tr></tbody>
                </table>
            </div>`;
        }

        // --- 4. TEAM STANDINGS ---
        if (t.teams && t.teams.length > 0) {
            const pointKey = t.stage === 'finals' ? 'finalsPoints' : 'points';
            const sortedTeams = [...t.teams].sort((a, b) => (b[pointKey] || 0) - (a[pointKey] || 0));
            
            let teamRows = sortedTeams.map((team, index) => {
                return `
                    <tr>
                        <td style="text-align:center;"><span class="stat-badge">${index + 1}</span></td>
                        <td style="font-weight: 600;">${team.name} <span style="opacity: 0.5; font-size: 0.85em; font-weight: 400; margin-left: 8px;">(Group ${team.group})</span></td>
                        <td style="text-align:center; color: var(--accent-color); font-weight: bold; font-size: 1.1em;">${team[pointKey] || 0}</td>
                    </tr>
                `;
            }).join('');

            html += `
            <div class="table-wrapper" style="margin-bottom: 25px;">
                <table class="live-table">
                    <thead>
                        <tr>
                            <th style="width:60px; text-align:center;">Rank</th>
                            <th>Team Standings</th>
                            <th style="width:80px; text-align:center;">Points</th>
                        </tr>
                    </thead>
                    <tbody>${teamRows}</tbody>
                </table>
            </div>`;
        }

        // --- 5. INDIVIDUAL RACE RESULTS ---
        if (t.races && t.races.length > 0) {
            const groupOrder = { 'A': 1, 'B': 2, 'C': 3, 'Finals': 4 };
            const sortedRaces = [...t.races].sort((a, b) => {
                const rankA = groupOrder[a.group] || 99;
                const rankB = groupOrder[b.group] || 99;
                if (rankA !== rankB) return rankA - rankB;
                return a.raceNumber - b.raceNumber;
            });

            html += `<div class="table-wrapper">
                <table class="live-table">
                    <thead>
                        <tr>
                            <th style="width:50px;">#</th>
                            <th style="width:80px;">Group</th>
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
    
    if (!tournament) {
        console.error("Tournament data not found for ID:", tournamentId);
        return;
    }

    let text = `${tournament.name}\n\n`;
    
    const getPlayer = (id) => {
        const p = tournament.players.find(pl => pl.id === id);
        return p ? { name: p.name, uma: p.uma || "Unknown" } : { name: "Unknown", uma: "Unknown" };
    };

    const groups = ["A", "B", "C", "Finals"];

    groups.forEach(group => {
        const races = tournament.races.filter(r => {
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

    navigator.clipboard.writeText(text.trim()).then(() => {
        alert("Results copied to clipboard!");
    }).catch(err => {
        console.error("Failed to copy: ", err);
        alert("Failed to copy. See console.");
    });
}

// --- SEASON SWITCHER LOGIC ---
function switchSeason() {
    const season = document.getElementById('seasonSelector').value;
    
    if (season === 's1') {
        activeDataset = S1_DATA;
    } else {
        activeDataset = (typeof S2_DATA !== 'undefined') ? S2_DATA : { compactData: [], tournamentRaceResults: {} };
    }

    if (activeDataset.compactData) {
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
    renderStatsTable();
}

// --- UI Logic: Tabs ---
function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    const tabs = document.querySelectorAll('.tab');
    if (tabId === 'tier-lists') tabs[0].classList.add('active');
    if (tabId === 'uma-stats') tabs[1].classList.add('active');
    if (tabId === 'trainer-stats') tabs[2].classList.add('active');
    if (tabId === 'championship') tabs[3].classList.add('active');
    if (tabId === 'live-data') tabs[4].classList.add('active');
    if (tabId === 'trainer-card') {
        if(tabs[5]) tabs[5].classList.add('active'); 
    }
    if (tabId === 'trainer-box') {
        if(tabs[6]) tabs[6].classList.add('active'); // Added the 7th tab
        renderBoxTable(); // Render the Trainer Box table whenever switched to
    }
}

// --- Tier List View Switcher ---
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

// --- Calculate Points & Beat Rate ---
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

                    const opponentsBeaten = (lobbySize - 1) - rankIndex;
                    if (!stats.trainer[player]) {
                        stats.trainer[player] = { points: 0, races: 0, beaten: 0, totalOpp: 0 };
                    }
                    if (rankIndex < POINTS_SYSTEM.length) {
                        stats.trainer[player].points += POINTS_SYSTEM[rankIndex];
                    }
                    stats.trainer[player].races += 1;
                    stats.trainer[player].beaten += opponentsBeaten;
                    stats.trainer[player].totalOpp += possibleOpponents;

                    const key = `${tournamentName}_${player}`;
                    const umaName = lookupMap[key];
                    if (umaName) {
                        if (!stats.uma[umaName]) {
                            stats.uma[umaName] = { points: 0, races: 0, beaten: 0, totalOpp: 0 };
                        }
                        if (rankIndex < POINTS_SYSTEM.length) {
                            stats.uma[umaName].points += POINTS_SYSTEM[rankIndex];
                        }
                        stats.uma[umaName].races += 1;
                        stats.uma[umaName].beaten += opponentsBeaten;
                        stats.uma[umaName].totalOpp += possibleOpponents;
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
    const totalEntries = filteredData.length;

    filteredData.forEach(row => activeTournaments.add(row.RawLength));

    const pointsData = getChampionshipPoints(activeTournaments, filteredData);

    filteredData.forEach(row => {
        // --- Uma Stats ---
        if (!umaMap[row.UniqueName]) { 
            umaMap[row.UniqueName] = { 
                name: row.UniqueName, 
                picks: 0, wins: 0, totalRacesRun: 0, tourneyWins: 0, bans: 0 
            }; 
        }
        umaMap[row.UniqueName].picks++;
        umaMap[row.UniqueName].wins += row.Wins;
        umaMap[row.UniqueName].totalRacesRun += row.RacesRun;

        if (activeDataset.tournamentWinners && activeDataset.tournamentWinners[row.RawLength]) {
            if (activeDataset.tournamentWinners[row.RawLength].includes(row.Trainer)) {
                umaMap[row.UniqueName].tourneyWins++;
            }
        }

        // --- Trainer Stats ---
        if (!trainerMap[row.Trainer]) {
            trainerMap[row.Trainer] = {
                name: row.Trainer,
                entries: 0, wins: 0, totalRacesRun: 0, 
                characterHistory: {}, playedTourneys: new Set(), tournamentWins: 0
            };
        }

        let t = trainerMap[row.Trainer];
        t.entries++;
        t.wins += row.Wins;
        t.totalRacesRun += row.RacesRun;
        t.playedTourneys.add(row.RawLength);

        if (!t.characterHistory[row.UniqueName]) {
            t.characterHistory[row.UniqueName] = { picks: 0, wins: 0 };
        }
        t.characterHistory[row.UniqueName].picks++;
        t.characterHistory[row.UniqueName].wins += row.Wins;
    });

    Object.values(trainerMap).forEach(t => {
        t.playedTourneys.forEach(tourneyID => {
            if (activeDataset.tournamentWinners && activeDataset.tournamentWinners[tourneyID]) {
                if (activeDataset.tournamentWinners[tourneyID].includes(t.name)) {
                    t.tournamentWins++;
                }
            }
        });
    });

    let validBanTourneyCount = 0;
    if (activeDataset.tournamentBans) {
        Object.keys(activeDataset.tournamentBans).forEach(tourneyID => {
            if (activeTournaments.has(tourneyID)) {
                validBanTourneyCount++; 
                const banList = activeDataset.tournamentBans[tourneyID];
                banList.forEach(umaName => {
                    if (!umaMap[umaName]) { 
                        umaMap[umaName] = { 
                            name: umaName, picks: 0, wins: 0, totalRacesRun: 0, tourneyWins: 0, bans: 0 
                        }; 
                    }
                    umaMap[umaName].bans++;
                });
            }
        });
    }

    // 5. Formatting Helper
    const formatItem = (item, type) => {
        const winRateVal = item.totalRacesRun > 0 
            ? (item.wins / item.totalRacesRun * 100).toFixed(1) 
            : "0.0";

        let dominanceVal = "0.0";
        const pStats = type === 'trainer' ? pointsData.trainer[item.name] : pointsData.uma[item.name];
        
        if (pStats && pStats.totalOpp > 0) {
            dominanceVal = ((pStats.beaten / pStats.totalOpp) * 100).toFixed(1);
        }

        let tWinPct = "0.0";
        if (type === 'uma') {
            tWinPct = item.picks > 0 ? (item.tourneyWins / item.picks * 100).toFixed(1) : "0.0";
        } else {
            const tourneyCount = item.playedTourneys.size;
            tWinPct = tourneyCount > 0 ? (item.tournamentWins / tourneyCount * 100).toFixed(1) : "0.0";
        }

        let pickPctVal = "0.0";
        if (totalEntries > 0) {
            const count = type === 'uma' ? item.picks : item.entries;
            pickPctVal = (count / totalEntries * 100).toFixed(1);
        }

        const displayType = type === 'trainer' ? 'trainer' : 'uma';

        const stats = {
            ...item,
            displayName: formatName(item.name, displayType),
            winRate: winRateVal,
            dom: dominanceVal,
            tourneyWinPct: tWinPct,
            pickPct: pickPctVal 
        };

        if (type === 'uma') {
            stats.tourneyStatsDisplay = `${tWinPct}% <span style="font-size:0.8em; color:var(--text-color); opacity:0.7;">(${item.tourneyWins}/${item.picks})</span>`;
            const banRate = validBanTourneyCount > 0 ? (item.bans / validBanTourneyCount * 100).toFixed(1) : "0.0";
            stats.banStatsDisplay = `${banRate}% <span style="font-size:0.8em; color:var(--text-color); opacity:0.7;">(${item.bans}/${validBanTourneyCount})</span>`;
        }

        if (type === 'trainer') {
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
            if (col === 'winRate' || col === 'dom' || col === 'tourneyWinPct' || col === 'pickPct') return `<td>${row[col]}%</td>`;
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

    if (html === '') html = '<div style="padding:20px; color:var(--text-color); opacity:0.6; text-align:center;">No data fits these criteria.</div>';
    container.innerHTML = html;
}

function updateData() {
    const surface = document.getElementById('surfaceFilter').value;
    const length = document.getElementById('lengthFilter').value;
    const minEntries = document.getElementById('minEntries').value;
    const searchQuery = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase() : "";

    if(document.getElementById('minEntriesVal')) 
        document.getElementById('minEntriesVal').textContent = minEntries;

    const filtered = currentRawData.filter(d => {
        if (d.Trainer === "DQ") return false;
        const surfaceMatch = (surface === 'All' || d.Surface.includes(surface));
        const lengthMatch = (length === 'All' || d.DistanceCategory === length);
        
        // CSV Phase 1 Search Check
        const searchMatch = searchQuery === "" || 
                            d.Trainer.toLowerCase().includes(searchQuery) || 
                            d.UniqueName.toLowerCase().includes(searchQuery);

        return surfaceMatch && lengthMatch && searchMatch;
    });

    const stats = calculateStats(filtered);
    
    // Store globally for the Trainer Card
    currentCalculatedStats = stats;

    // Sort Tables
    stats.umaStats.sort((a, b) => b.dom - a.dom);
    renderTable('umaTable', stats.umaStats, 
        ['name', 'picks', 'pickPct', 'wins', 'winRate', 'dom', 'tourneyStatsDisplay', 'banStatsDisplay']
    );

    stats.trainerStats.sort((a, b) => b.dom - a.dom);
    renderTable('trainerTable', stats.trainerStats, 
        ['name', 'entries', 'wins', 'winRate', 'dom', 'tourneyStatsDisplay', 'favorite', 'ace']
    );

    renderTierList('umaTierListWR', stats.umaStats, 'picks', minEntries, 'winRate');
    renderTierList('trainerTierListWR', stats.trainerStats, 'entries', minEntries, 'winRate');
    renderTierList('umaTierListDom', stats.umaStats, 'picks', minEntries, 'dom');
    renderTierList('trainerTierListDom', stats.trainerStats, 'entries', minEntries, 'dom');
    renderTierList('umaTierListChamp', stats.umaStats, 'picks', minEntries, 'tourneyWinPct');
    renderTierList('trainerTierListChamp', stats.trainerStats, 'entries', minEntries, 'tourneyWinPct');
    
    populateTrainerDropdown(); // Hydrate the Trainer Card Generator dropdown
}

// --- Sorting, Theme, Init ---
let sortState = {};
function sortTable(tableId, colIndex, isNumeric = false) {
    const key = tableId + colIndex;
    sortState[key] = !sortState[key];
    const tbody = document.querySelector(`#${tableId} tbody`);
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
    if (theme) {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('siteTheme', theme);
    } else {
        document.body.removeAttribute('data-theme');
        localStorage.removeItem('siteTheme');
    }
}

// Calculate total unfiltered stats for the Championship Tab
function calculateIndividualStats() {
    let stats = {};
    const searchQuery = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase() : "";
    
    if (activeDataset.tournamentRaceResults) {
        for (const [tournamentName, stages] of Object.entries(activeDataset.tournamentRaceResults)) {
            for (const [stageName, races] of Object.entries(stages)) {
                races.forEach((raceResult) => {
                    raceResult.forEach((player, rankIndex) => {
                        if (player.includes("Player") || player === "DQ") return;

                        if (!stats[player]) { stats[player] = { name: player, totalPoints: 0, racesRun: 0 }; }
                        if (rankIndex < POINTS_SYSTEM.length) { stats[player].totalPoints += POINTS_SYSTEM[rankIndex]; }
                        stats[player].racesRun += 1;
                    });
                });
            }
        }
    }
    const leaderboard = Object.values(stats)
        .filter(player => searchQuery === "" || player.name.toLowerCase().includes(searchQuery)) // Phase 1 Search inclusion
        .map(player => {
            return {
                name: player.name,
                totalPoints: player.totalPoints,
                racesRun: player.racesRun,
                avgPoints: player.racesRun > 0 ? (player.totalPoints / player.racesRun).toFixed(2) : "0.00"
            };
        });
    return leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
}

function renderStatsTable() {
    const data = calculateIndividualStats(); 
    const tbody = document.getElementById('points-table-body');
    if (!tbody) return;
    tbody.innerHTML = data.map((player, index) => {
        
        // CHANGED: Use 'trainer' type
        const playerIcon = getIconHtml(player.name, 'trainer');

        return `
            <tr>
                <td><span class="stat-badge">${index + 1}</span></td>
                <td>
                    <div class="name-cell">
                        ${playerIcon}${player.name}
                    </div>
                </td>
                <td>${player.racesRun}</td>
                <td>${player.totalPoints}</td>
                <td>${player.avgPoints}</td>
            </tr>
        `;
    }).join('');
}

// --- CSV EXPORT LOGIC ---
function exportCurrentTableToCSV() {
    // Determine which tab is active
    const activeTab = document.querySelector('.view-section.active').id;
    let tableId = '';
    
    if (activeTab === 'uma-stats') tableId = 'umaTable';
    else if (activeTab === 'trainer-stats') tableId = 'trainerTable';
    else if (activeTab === 'championship') tableId = 'champTable';
    else {
        alert("Please navigate to Uma Stats, Trainer Stats, or Championship to export a table.");
        return;
    }

    const table = document.getElementById(tableId);
    let csvContent = "";

    // Parse headers
    const headers = Array.from(table.querySelectorAll("thead th")).map(th => `"${th.innerText.trim()}"`);
    csvContent += headers.join(",") + "\n";

    // Parse rows
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    rows.forEach(row => {
        const rowData = Array.from(row.querySelectorAll("td")).map(td => {
            // Clean up inner text (remove newlines, quotes)
            let text = td.innerText.replace(/(\r\n|\n|\r)/gm, " ").replace(/"/g, '""');
            return `"${text.trim()}"`;
        });
        csvContent += rowData.join(",") + "\n";
    });

    // Create download link
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

    // Grab all trainers currently in the filtered stats
    const trainers = currentCalculatedStats.trainerStats.map(t => t.name).sort();
    
    const currentSelection = selector.value;
    selector.innerHTML = trainers.map(t => `<option value="${t}">${t}</option>`).join('');
    
    if (trainers.includes(currentSelection)) {
        selector.value = currentSelection;
    } else if (trainers.includes("Kenesu")) {
        selector.value = "Kenesu";
    } else if (trainers.length > 0) {
        selector.value = trainers[0];
    }
    
    updateTrainerCard();
}

function updateTrainerCard() {
    const selectedName = document.getElementById('cardTrainerSelector').value;
    if (!selectedName || !currentCalculatedStats) return;

    const tData = currentCalculatedStats.trainerStats.find(t => t.name === selectedName);
    if (!tData) return;

    document.getElementById('tc-name').innerText = tData.name;
    document.getElementById('tc-avatar').innerHTML = getIconHtml(tData.name, 'trainer');
    
    document.getElementById('tc-wr').innerText = `${tData.winRate}%`;
    document.getElementById('tc-dom').innerText = `${tData.dom}%`;
    document.getElementById('tc-twins').innerText = tData.tournamentWins;
    document.getElementById('tc-races').innerText = tData.totalRacesRun;

    document.getElementById('tc-ace').innerHTML = tData.ace;
    document.getElementById('tc-fav').innerHTML = tData.favorite;
}

function downloadTrainerCard() {
    const cardElement = document.getElementById('captureCard');
    const trainerName = document.getElementById('cardTrainerSelector').value;
    
    // Grab the button to show a loading state
    const btn = document.querySelector('button[onclick="downloadTrainerCard()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ Generating...";
    btn.style.opacity = "0.7";
    btn.disabled = true;
    
    // We use useCORS to allow the CDN images (wsrv.nl) to be drawn
    html2canvas(cardElement, {
        useCORS: true,
        backgroundColor: null, 
        scale: 2, // Higher resolution for a crisp image
        logging: false // Turn off background logging to speed things up
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `${trainerName}_Racc_Open_Stats.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        // Restore the button
        btn.innerHTML = originalText;
        btn.style.opacity = "1";
        btn.disabled = false;
    }).catch(err => {
        console.error("Card generation failed:", err);
        alert("Failed to generate the Trainer Card. See console for details.");
        
        // Restore the button even if it fails
        btn.innerHTML = originalText;
        btn.style.opacity = "1";
        btn.disabled = false;
    });
}

// --- TRAINER BOX LOGIC ---
function renderBoxTable() {
    const tbody = document.getElementById('box-table-body');
    if (!tbody) return;

    // 1. Find out who is currently selected in the dropdown
    const selectedTrainerElement = document.getElementById('boxTrainerSelector');
    const selectedTrainer = selectedTrainerElement ? selectedTrainerElement.value : 'Kenesu';
    
    // 2. Grab their specific data from the master object we made in box_data.js
    const currentBoxData = (typeof ALL_TRAINER_BOXES !== 'undefined' && ALL_TRAINER_BOXES[selectedTrainer]) ? ALL_TRAINER_BOXES[selectedTrainer] : [];

    const categoryFilterElement = document.getElementById('boxCategoryFilter');
    const categoryFilter = categoryFilterElement ? categoryFilterElement.value : 'All';
    
    const searchElement = document.getElementById('boxSearch');
    const searchQuery = searchElement ? searchElement.value.toLowerCase() : '';

    // 3. Filter the currently selected trainer's data
    const filteredData = currentBoxData.filter(item => {
        const matchesCategory = categoryFilter === 'All' || item.cat === categoryFilter;
        const matchesSearch = item.name.toLowerCase().includes(searchQuery) || item.stat.toLowerCase().includes(searchQuery);
        return matchesCategory && matchesSearch;
    });

    // Helper classes for styling
    const getRarityClass = (rarity) => {
        if (rarity === 'SSR' || rarity === '4★') return 'rarity-ssr';
        if (rarity === 'SR' || rarity === '3★') return 'rarity-sr';
        return 'rarity-r';
    };

    const getStatClass = (stat) => {
        const s = stat.toLowerCase();
        if (s === 'speed') return 'stat-speed';
        if (s === 'stamina') return 'stat-stamina';
        if (s === 'power') return 'stat-power';
        if (s === 'guts') return 'stat-guts';
        if (s === 'wisdom') return 'stat-wisdom';
        if (s === 'friend') return 'stat-friend';
        return 'stat-uma'; // Default Uma color
    };

    tbody.innerHTML = filteredData.map(item => {
        const iconHtml = item.cat === 'Uma' ? getIconHtml(item.name.split('(')[0].trim(), 'uma') : '';

        return `
            <tr>
                <td style="text-align: center; color: var(--accent-color); font-weight: bold;">${item.cat}</td>
                <td style="text-align: center;"><span class="box-badge ${getRarityClass(item.rarity)}">${item.rarity}</span></td>
                <td style="text-align: center;"><span class="box-badge ${getStatClass(item.stat)}">${item.stat}</span></td>
                <td>
                    <div class="name-cell">
                        ${iconHtml}
                        <span style="font-weight: 500;">${item.name}</span>
                    </div>
                </td>
                <td>${item.details}</td>
            </tr>
        `;
    }).join('');
}


window.onload = function() {
    const savedTheme = localStorage.getItem('siteTheme');
    if (savedTheme) {
        document.getElementById('themeSelector').value = savedTheme;
        document.body.setAttribute('data-theme', savedTheme);
    }
    // Initialize with whatever is selected in the HTML dropdown
    switchSeason();
    renderBoxTable();
};
