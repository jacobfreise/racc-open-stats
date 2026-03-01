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
    - Races feature 9 or more competitors. Therefore, a "true average" win rate is around 11.1%.
    - Win Rate: 10-12% is standard. 15-18% is highly competitive. 20%+ is absolute top-tier dominance. NEVER call a win rate above 12% "low".
    - Average Position (Avg Pos): Scales from 1.0 (always 1st) to 9.0+ (always last). 5.0 is average. 3.0-4.5 is elite consistency.
    - Dominance: Measures point-scoring pressure across all placements. Higher is better.
    
    Using the data below, interpret the numbers. Don't just list stats—tell a story about the trainer's playstyle. 
    - Highlight their best Uma (Ace) and whether they are loyal to a specific Favorite pick.
    - SPECIFICALLY analyze their track preferences using the "Best Track Surface" and "Best Track Distance" data provided. Talk about what kind of races they excel at (e.g., "They are a terror on Turf tracks..." or "They specialize in Medium distance races...").
    - Keep the tone exciting, analytical, and professional. Do not use markdown headers.
    
    Trainer Data:
    Name: ${trainerData.name}
    Total Races Run: ${trainerData.totalRaces}
    Win Rate: ${trainerData.winRate}%
    Dominance: ${trainerData.dom}%
    Avg Position: ${trainerData.avgPos}
    Tourney Wins: ${trainerData.tournamentWins}
    Favorite Pick: ${trainerData.favorite}
    Ace (Most Wins): ${trainerData.ace}
    Best Track Surface: ${trainerData.bestSurface}
    Best Track Distance: ${trainerData.bestDistance}
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
