export default async function handler(req, res) {
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

    const prompt = `You are an expert esports color commentator and analyst for the 'Racc Open', a highly competitive, team-based Uma Musume tournament. 
    Write a short, punchy 2-paragraph scouting report for this trainer. 

    CRITICAL TOURNAMENT RULES & META CONTEXT (READ CAREFULLY):
    - Format: 3 Teams of 3 trainers. Teams are formed via a snake draft. 
    - The "One-Shot" Rule: Players have only ONE attempt to raise their Uma on race day. Consistency is highly valued.
    - Blind Bans: Captains submit blind bans before the race. Roster depth is critical to survive targeted bans.
    - Scoring: Teams win by accumulating points based on placements across 5 races. 
    - Ace vs. Anchor Dynamic: Because of the point system, a trainer with a low Win Rate but HIGH Dominance % (e.g., 40%+) or a low Average Position (e.g., 3.0-5.0) is incredibly valuable. They act as the team's "Anchor", consistently grabbing 2nd-5th place to secure team points.
    
    HOW TO READ THE DATA:
    - "Best Track Surface" and "Best Track Distance" are now calculated entirely by DOMINANCE, not Win Rate. This tells you where the player scores the most team points by beating opponents, even if they don't get 1st place.
    
    Using the data below, tell a story about the trainer's draft value and playstyle. 
    - Analyze their "Roster Depth" (how many unique Umas they play). Are they a one-trick pony vulnerable to bans, or a flexible drafter?
    - Determine their role: Are they a "Boom-or-Bust Ace" (High WR, Low Dom), or a "Reliable Point-Scoring Anchor" (Low WR, High Dom)?
    - Mention their "Best Track" stats to highlight exactly what kind of races they should be drafted to run.
    - Keep the tone exciting, analytical, and professional, like an esports caster. Do not use markdown headers.
    
    Trainer Data:
    Name: ${trainerData.name}
    Total Races Run: ${trainerData.totalRaces}
    Roster Depth (Unique Umas Played): ${trainerData.rosterDepth}
    Win Rate: ${trainerData.winRate}%
    Dominance: ${trainerData.dom}%
    Avg Position: ${trainerData.avgPos}
    Tourney Wins: ${trainerData.tournamentWins}
    Favorite Pick: ${trainerData.favorite}
    Ace (Most Wins): ${trainerData.ace}
    Best Track Surface: ${trainerData.bestSurface}
    Best Track Distance: ${trainerData.bestDistance}
    `;

    // ==========================================
    // ENGINE 1: GOOGLE GEMINI (Primary)
    // ==========================================
    try {
      const geminiKey = process.env.GEMINI_API_KEY;
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

      const geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const geminiData = await geminiResponse.json();

      // If Gemini successfully generated text, send it back and stop here!
      if (geminiData.candidates && geminiData.candidates.length > 0) {
        const insightText = geminiData.candidates[0].content.parts[0].text;
        res.status(200).json({ insight: insightText });
        return; 
      } else {
        // If it failed (like hitting the 429 quota), we just log it and let the code continue to Engine 2
        console.warn("Gemini Engine failed or rate limited, falling back to Groq...", geminiData);
      }
    } catch (geminiError) {
      console.warn("Gemini fetch error, falling back to Groq...", geminiError);
    }

    // ==========================================
    // ENGINE 2: GROQ LLAMA 3 (Fallback)
    // ==========================================
    const groqKey = process.env.GROQ_API_KEY;
    const groqUrl = "https://api.groq.com/openai/v1/chat/completions";

    const groqResponse = await fetch(groqUrl, {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        model: "llama3-8b-8192", 
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    const groqData = await groqResponse.json();

    // If Groq ALSO fails, then we actually throw an error to the frontend
    if (groqData.error) {
      res.status(500).json({ insight: `BOTH ENGINES FAILED. Groq Error: ${groqData.error.message}` });
      return;
    }
    
    // Send Groq's answer back
    const insightText = groqData.choices[0].message.content;
    res.status(200).json({ insight: insightText });

  } catch (error) {
    res.status(500).json({ insight: `SERVER CRASH: ${error.message}` });
  }
}
