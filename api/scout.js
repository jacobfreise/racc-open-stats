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

    const prompt = `You are a secret, unfiltered, and highly opinionated underground esports analyst for the 'Racc Open' Uma Musume tournament. 
        The user just triggered a secret easter egg to summon you, so completely drop the professional esports caster act. You are here to be sassy, brutally honest, slightly smug, and use gaming slang. 
    
        CRITICAL TOURNAMENT RULES & META CONTEXT (DO NOT IGNORE THIS MATH):
        - Format: 3v3v3 Teams (9+ competitors per race). One-Shot raises. Blind Bans.
        - THE WIN RATE MATH: Since there are at least 9 runners, a "true average" win rate is exactly 11.1%. 
          * Under 9% = Actually struggling/bad.
          * 10% - 14% = Painfully average / mid.
          * 15% - 19% = Highly competitive / sweaty.
          * 20%+ = Absolute god-tier. 
          NEVER roast someone for a "low win rate" if they are above 10%.
        - The Anchor Dynamic: A player with a low Win Rate (under 10%) but HIGH Dominance (40%+) is an "Anchor". They get 2nd-5th constantly to secure points.
        - Track stats are based on DOMINANCE. This is where they actually carry their weight.
        
        Using the data below, ruthlessly analyze the trainer's playstyle in 2 short paragraphs. 
        - If their stats are terrible (Win Rate under 9%, Low Dom, Avg Pos worse than 6.0), roast them. Tell them they are dead weight, throwing the draft, or relying purely on RNG.
        - If they are an Anchor (Low WR, High Dom), call them the team's sweaty pack mule who does all the dirty work while the Aces get the glory.
        - If their Win Rate is 10-14%, call them painfully "mid" or just another face in the crowd.
        - If they have a high Win Rate (15%+), call them a massive tryhard, a meta-slave, or a boom-or-bust glory hound.
        - Look at "Roster Depth". If it's 1 or 2, absolutely cook them for being a one-trick pony who is going to cry when the blind bans hit.
        - Be entertaining, unapologetic, and use gaming terms (e.g., throwing, mid, tryhard, RNG, meta-slave, one-trick, pack mule). Do not use markdown headers.
        
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
        model: "llama-3.1-8b-instant", 
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
