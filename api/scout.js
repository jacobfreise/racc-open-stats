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

    const prompt = `You are an expert analyst for the Racc Open, a competitive Uma Musume tournament. 
    Analyze this trainer's performance data and write a short, punchy 2-paragraph scouting report.
    Highlight their win rate, their most dominant Uma (Ace), their favorite pick, and any notable strengths or weaknesses. 
    Keep it fun, analytical, and professional. Do not use markdown headers, just plain text paragraphs.
    
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
