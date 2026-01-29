import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore, collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAOZOQKH7slZ2fW_jjZEvFCH0T82EMBiVg",
    projectId: "raggooneropen",
    appId: "1:389145362446:web:907a5c2f2c30a11db97c5f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fetchTournaments() {
    try {
        const tournamentsRef = collection(db, 'artifacts', 'default-app','public', 'data', 'tournaments');
        const snapshot = await getDocs(query(tournamentsRef, orderBy('createdAt', 'desc'))); // Changed to desc to see newest first

        if (snapshot.empty) {
            console.log("No live tournaments found.");
            return;
        }

        const tournaments = [];
        snapshot.forEach(doc => {
            tournaments.push({ id: doc.id, ...doc.data() });
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
