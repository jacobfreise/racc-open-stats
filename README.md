# 🦝 Racc Open Analysis Dashboard

A comprehensive, browser-based dashboard for analyzing *Uma Musume Pretty Derby* tournament statistics. This tool visualizes pick rates, win rates, dominance metrics, and tier lists for custom community tournaments across multiple seasons.

## ✨ Features

* **📅 Multi-Season Support:** Dynamically switch between Season 1, Season 2, or an **All Seasons** combined view without refreshing the page.
* **📸 Image Export:** Generate and download clean, high-quality snapshots of your **Trainer Card** and **Tier Lists** directly to your device with one click.
* **📊 Dynamic Tier Lists:** * **Slider View:** Toggle tier lists between **Win Rate %**, **Dominance %**, and **Tournament Wins**.
  * Automatically generates S-F tiers based on performance thresholds.
* **📈 Comprehensive Statistics:**
  * **Uma Stats:** Pick Rate %, True Pick %, Win Rate %, Dominance %, Avg Rank, Best Tourney, Tournament Win %, Ban Rate, and Presence.
  * **Trainer Stats:** Entries, Win Rate %, Dominance %, Avg Rank, Best Tourney, "Ace" Character, Favorite Pick, and a detailed 5-race history log.
  * **🏆 Championship Tab:** Tracks individual trainer standings based on points accumulated across all rounds.
* **🔴 Live Data Integration:** Automatically fetches real-time tournament results and live bans directly from Firebase.
* **🧪 Secret Team Theorycrafter:** A hidden lab (`teambuilder.html`) to simulate 3-Uma team combinations and view statistical setups like "Comfort Zone," "Maximum Efficiency," and "Global Meta."
* **💾 CSV Export:** Export any of the data tables to a CSV file for your own spreadsheet tracking.
* **🔍 Filtering:** Filter data by **Surface** (Turf/Dirt), **Distance** (Short/Mile/Medium/Long), and search by specific names.
* **🎨 Theming:** Includes 12 distinct color themes (Default Dark, Ram, Rem, Miku, Succubus, Manga, etc.) with local storage persistence.
* **📱 Responsive Design:** Optimized and scaled for both desktop and mobile viewing.

## 🚀 Setup & Usage

No build tools required! This runs entirely in the browser.

### Method 1: GitHub Pages (Recommended)
1. Fork or clone this repository.
2. Enable **GitHub Pages** in your repository settings (Settings -> Pages -> Source: `main`).
3. Visit the provided URL to see your dashboard live.

### Method 2: Local Usage
1. Download all the project files.
2. Open `index.html` in any modern web browser. 
*(Note: Live Firebase data and HTML2Canvas image generation work best when served over a local server rather than a raw `file://` path).*

## 📂 Project Structure

* `index.html`: The main dashboard structure, season selector, and layout.
* `teambuilder.html`: The secret Team Theorycrafter and custom simulation tool.
* `style.css`: All visual styling, responsive layouts, animations, and theme definitions.
* `script.js`: The core logic engine. Handles season merging, calculates points/dominance, generates Trainer Cards, and renders tables.
* `dataFetch.js`: Handles the Firebase initialization and listener for the Live Data tab.
* `release_data.js`: Tracks character release timelines to calculate "True Pick %" accurately based on when Umas were introduced.
* `data.js`: Contains Season 1 data wrapped in the `S1_DATA` object.
* `data_s2.js`: Contains Season 2 data wrapped in the `S2_DATA` object. **(Edit this for current season updates!)**

## 📝 How to Update Data

Data is "Namespaced" to allow multiple seasons to exist without conflict. 

### 1. Data File Structure (`data_s2.js`)
To add results for a season, edit its respective data file. The file must follow this structure:

```javascript
const S2_DATA = {
    // 1. Race Entry Data (Used for Win Rates, Pick Rates, Filters)
    compactData: [
        // [Trainer, Uma Name (Variant), Wins, Surface, Tourney ID, Base Name, Variant, Total Races Run]
        ["TrainerName", "Oguri Cap (Christmas)", 1, "2500m Turf (R)", "S2-1", "Oguri Cap", "Christmas", 5],
        ["TrainerName", "Gold Ship (Original)", 3, "2500m Turf (R)", "S2-1", "Gold Ship", "Original", 10],
    ],

    // 2. Tournament Winners (Used for Tournament Win %)
    tournamentWinners: {
        "S2-1": ["TrainerA", "TrainerB", "TrainerC"],
    },

    // 3. Bans (Used for Ban Rate)
    tournamentBans: {
        "S2-1": ["Oguri Cap (Original)", "Silence Suzuka (Original)"],
    },

    // 4. Detailed Results (Used for Dominance, Avg Rank, Best Tourney, and Championship Points)
    tournamentRaceResults: {
        "S2-1": {
            "Group A": [ /* Array of Arrays of names representing exact race placements */ ],
            "Group B": [ /* Array of Arrays of names representing exact race placements */ ],
            "Finals":  [ /* Array of Arrays of names representing exact race placements */ ]
        }
    }
};

// Export for Node.js compatibility (optional)
if (typeof module !== 'undefined') { module.exports = { S2_DATA }; }

```

### 2. Updating Point Systems

The points awarded for the Championship tab and "Best Tourney" metrics are defined at the top of `script.js`:

```javascript
const POINTS_SYSTEM = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

```

Adjust these numbers to change how many points are awarded for 1st place, 2nd place, etc.

## 🛠 Customization

### Changing Tier Thresholds

The tier list logic is located in `script.js` inside the `renderTierList` function. You can adjust the strict numerical boundaries for `winRate`, `tourneyWinPct`, or `dom` (Dominance) to fit your community's meta.

### Adding New Seasons

1. Create a new file (e.g., `data_s3.js`) with `const S3_DATA = { ... }`.
2. Link it in `index.html` and `teambuilder.html`: `<script src="data_s3.js"></script>`.
3. Add the option to the dropdowns in both HTML files: `<option value="s3">Season 3</option>`.
4. Update `switchSeason()` in `script.js` to handle the 's3' case and include it in the 'all' combined merge.

## 📜 License

MIT License. Free to use and modify for your own tournament communities.

## ⚖️ Disclaimer & Copyrights

This project is a fan-made tool and is not affiliated with, endorsed, sponsored, or specifically approved by **Cygames, Inc.** or the *Uma Musume Pretty Derby* franchise.

* **Code:** The source code (HTML, CSS, JS) of this dashboard is licensed under the **MIT License**.
* **Assets:** All character names, game concepts, and related intellectual property belong to their respective owners.
