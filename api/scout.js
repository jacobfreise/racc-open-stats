export default async function handler(req, res) {
  // 1. Handle CORS so your GitHub Pages site can talk to Vercel
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ insight: 'Method Not Allowed' });
    return;
  }

  try {
    const trainerData = req.body;

    const prompt = `You are an expert esports color commentator and analyst for the 'Racc Open', a competitive Uma Musume tournament. 
    Write a short, punchy 2-paragraph scouting report for this trainer. 

    CRITICAL META CONTEXT (READ CAREFULLY):
    - Races feature 9 or more competitors (always multiples of 3, typically 9). 
    - Because there are at least 9 runners per race, a "true average" win rate is around 11.1% (and even lower in 12+ player races).
    - Win Rate Grading: 10-12% is standard/average. 15-18% is highly competitive. 20%+ is absolute top-tier dominance. NEVER call a win rate above 12% "low", "poor", or "struggling".
    - Average Position (Avg Pos): This scales from 1.0 (always 1st) to 9.0+ (always last). 5.0 is middle-of-the-pack. Anything in the 3.0-4.5 range is elite consistency.
    - Dominance: This measures their overall point-scoring pressure across all placements. Higher is better.
    
    Using the context above, interpret the numbers. Don't just list the stats—tell a story about the trainer's playstyle. Highlight their best Uma (Ace) and whether they are consistently placing high or relying on boom-or-bust wins. Keep the tone exciting, analytical, and professional. Do not use markdown headers.
    
    Trainer Data:
    Name: ${trainerData.name}
    Win Rate: ${trainerData.winRate}%
    Dominance: ${trainerData.dom}%
    Avg Position: ${trainerData.avgPos}
    Tourney Wins: ${trainerData.tournamentWins}
    Favorite Pick: ${trainerData.favorite}
    Ace (Most Wins): ${trainerData.ace}
    `;

    // 2. Call Gemini using Vercel's secret environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const aiData = await aiResponse.json();

    if (!aiData.candidates) {
      res.status(500).json({ insight: `GEMINI ERROR: ${JSON.stringify(aiData)}` });
      return;
    }
    
    const insightText = aiData.candidates[0].content.parts[0].text;
    
    // 3. Send it back to the frontend
    res.status(200).json({ insight: insightText });

  } catch (error) {
    res.status(500).json({ insight: `SERVER CRASH: ${error.message}` });
  }
}
