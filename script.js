// --- GLOBAL VARIABLES ---
const POINTS_SYSTEM = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]; 

let currentRawData = []; 
let activeDataset = null; 
// Store the raw firebase data separately
let liveFirebaseData = [];

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
function formatName(fullName) {
    if (!fullName) return "Unknown";
    if (!fullName.includes('(')) return fullName;
    const parts = fullName.split('(');
    const mainName = parts[0].trim();
    const variant = parts[1].replace(')', '').trim();
    return `${mainName} <span class="variant-tag">${variant}</span>`;
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
        // Build Player Map for Quick Lookup
        const playerMap = {};
        if (t.players && Array.isArray(t.players)) {
            t.players.forEach(p => {
                playerMap[p.id] = { name: p.name, uma: p.uma };
            });
        }

        html += `<div class="live-tourney-card">`;
        
        // Header
        let statusClass = t.status === 'active' ? 'status-active' : 'status-completed';
        html += `
            <div class="live-header">
                <h2>${t.name}</h2>
                <span class="live-badge ${statusClass}">${t.status.toUpperCase()}</span>
            </div>
            <div class="live-meta">
                <span><strong>Stage:</strong> ${t.stage || '-'}</span>
                <span><strong>Teams:</strong> ${t.teams ? t.teams.length : 0}</span>
                <span><strong>ID:</strong> <span style="font-family:monospace; opacity:0.7;">${t.id}</span></span>
            </div>
        `;

        // Races Table
        if (t.races && t.races.length > 0) {
            
            // Custom Sort Logic (Groups A/B/C then Finals)
            const groupOrder = { 'A': 1, 'B': 2, 'C': 3, 'Finals': 4 };
            const sortedRaces = [...t.races].sort((a, b) => {
                const rankA = groupOrder[a.group] || 99;
                const rankB = groupOrder[b.group] || 99;
                if (rankA !== rankB) return rankA - rankB;
                return a.raceNumber - b.raceNumber;
            });

            html += `<div class="table-wrapper" style="margin-top:20px;">
                <table class="live-table">
                    <thead>
                        <tr>
                            <th style="width:50px;">#</th>
                            <th style="width:80px;">Group</th>
                            <th>Results</th>
                        </tr>
                    </thead>
                    <tbody>`;

            sortedRaces.forEach(race => {
                // Convert placements object { "pid": 1 } to sorted array
                const resultsArray = Object.entries(race.placements || {});
                resultsArray.sort((a, b) => a[1] - b[1]);

                // Build result string
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
            html += `<div style="padding:15px; opacity:0.6; font-style:italic;">No race results uploaded yet.</div>`;
        }

        html += `</div>`; // End Card
    });

    container.innerHTML = html;
}


// --- SEASON SWITCHER LOGIC ---
function switchSeason() {
    const season = document.getElementById('seasonSelector').value;
    
    // 1. Select the Data Source
    if (season === 's1') {
        activeDataset = S1_DATA;
    } else {
        activeDataset = (typeof S2_DATA !== 'undefined') ? S2_DATA : { compactData: [], tournamentRaceResults: {} };
    }

    // 2. Process the Raw Data for this season
    if (activeDataset.compactData) {
        currentRawData = activeDataset.compactData.map(r => {
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
    } else {
        currentRawData = [];
    }

    // 3. Refresh the UI
    updateData();
    renderStatsTable();
    // Removed renderRaceResults();
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
    // Removed Race Results tab logic
    if (tabId === 'live-data') tabs[4].classList.add('active');
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

    // 1. Get Points
    const pointsData = getChampionshipPoints(activeTournaments, filteredData);

    // 2. Process Basic Data
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

    // 3. Process Tourney Wins
    Object.values(trainerMap).forEach(t => {
        t.playedTourneys.forEach(tourneyID => {
            if (activeDataset.tournamentWinners && activeDataset.tournamentWinners[tourneyID]) {
                if (activeDataset.tournamentWinners[tourneyID].includes(t.name)) {
                    t.tournamentWins++;
                }
            }
        });
    });

    // 4. Process Bans
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

        const stats = {
            ...item,
            displayName: formatName(item.name),
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
            stats.favorite = fav ? `${formatName(fav.name)} <span class="stat-badge">x${fav.picks}</span>` : '-';
            historyArr.sort((a, b) => b.wins - a.wins || a.picks - b.picks);
            const best = historyArr[0];
            stats.ace = (best && best.wins > 0) ? `${formatName(best.name)} <span class="stat-badge win-badge">★${best.wins}</span>` : '<span style="color:var(--text-color); opacity:0.5;">-</span>';
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
             else if (val >= 25.0) tier = 'S'; 
             else if (val >= 15.0) tier = 'A';
             else if (val >= 10.0) tier = 'B';
             else if (val >= 5.0) tier = 'C';
        } else if (sortKey === 'tourneyWinPct') {
             if (val <= 0.0) tier = 'F';
             else if (val >= 25.0) tier = 'S';
             else if (val >= 15.0) tier = 'A';
             else if (val >= 10.0) tier = 'B';
             else if (val >= 5.0) tier = 'C';
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

    if(document.getElementById('minEntriesVal')) 
        document.getElementById('minEntriesVal').textContent = minEntries;

    // Use currentRawData (populated by switchSeason) instead of rawData
    const filtered = currentRawData.filter(d => {
        if (d.Trainer === "DQ") return false;
        const surfaceMatch = (surface === 'All' || d.Surface.includes(surface));
        const lengthMatch = (length === 'All' || d.DistanceCategory === length);
        return surfaceMatch && lengthMatch;
    });

    const stats = calculateStats(filtered);

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
    const leaderboard = Object.values(stats).map(player => {
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
        return `
            <tr>
                <td><span class="stat-badge">${index + 1}</span></td>
                <td>${player.name}</td>
                <td>${player.racesRun}</td>
                <td>${player.totalPoints}</td>
                <td>${player.avgPoints}</td>
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
    // Initialize with whatever is selected in the HTML dropdown (default S2)
    switchSeason();
};
