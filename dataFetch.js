import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore, collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAOZOQKH7slZ2fW_jjZEvFCH0T82EMBiVg",
    projectId: "raggooneropen",
    appId: "1:389145362446:web:907a5c2f2c30a11db97c5f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/**
 * Ensures players are returned as an array, regardless of whether
 * they are currently stored as a map or an array.
 */
export const playersToArray = (players) => {
    if (!players) return [];
    if (Array.isArray(players)) return players;

    // If it's a map/object, extract the values into an array
    return Object.values(players);
};

/**
 * Ensures races are returned as an array.
 */
export const racesToArray = (races) => {
    if (!races) return [];
    if (Array.isArray(races)) return races;

    return Object.values(races);
};

async function fetchTournaments() {
    try {
        await signInAnonymously(auth);
        const tournamentsRef = collection(db, 'artifacts', 'default-app','public', 'data', 'tournaments');
        const snapshot = await getDocs(query(tournamentsRef, orderBy('createdAt', 'desc'))); // Changed to desc to see newest first

        if (snapshot.empty) {
            console.log("No live tournaments found.");
            return;
        }

        const tournaments = [];
        snapshot.forEach(doc => {
            const data = doc.data();

            tournaments.push({
                id: doc.id,
                ...data,
                players: playersToArray(data.players),
                races: racesToArray(data.races)
            });
        });

        // Dispatch event to script.js
        const event = new CustomEvent('liveDataReady', { detail: tournaments });
        window.dispatchEvent(event);

    } catch (error) {
        console.error("Firebase Error:", error);
        const container = document.getElementById("liveDataOutput");
        if(container) container.innerHTML = `<div style="color:var(--accent-color); text-align:center;">Failed to load live data.</div>`;
    }
}

fetchTournaments();
