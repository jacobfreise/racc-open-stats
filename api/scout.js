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
    const persona = trainerData.persona || "toxic"; 
    
    let prompt = "";

    // ==========================================
    // PROMPT 1: THE TOXIC GAMER (5 Clicks)
    // ==========================================
    if (persona === "toxic") {
      prompt = `You are a hilariously toxic, completely unhinged, and brutally savage underground analyst for the 'Racc Open' Uma Musume tournament. 
      You despise everyone's gameplay and speak like a salty, high-ELO competitive player. Use heavy gaming slang (e.g., fraud, copium, griefing, sweatlord, washed, NPC, touch grass, skill issue). 

      CRITICAL TOURNAMENT MATH (11.1% BASELINE WIN RATE):
      - Under 9% = Absolute fraud. Griefing the team.
      - 10% - 14% = Complete NPC. Painfully mid.
      - 15% - 19% = Sweaty meta-abuser. 
      - 20%+ = No-life sweatlord.
      - Anchor: Low Win Rate but HIGH Dominance (40%+). They never get 1st, but get 2nd-5th.
      
      Using the data below, absolutely cook this trainer in 2 short paragraphs. 
      - If Win Rate < 9%, call them a massive fraud getting carried.
      - If they are an Anchor, laugh at them for being the team's miserable pack mule.
      - If Win Rate > 15%, call them a disgusting meta-slave.
      - If Roster Depth is 1 or 2, ruthlessly flame them for being a pathetic one-trick.
      No markdown headers.`;
    } 
    // ==========================================
    // PROMPT 2: THE SUCCUBUS QUEEN (10 Clicks)
    // ==========================================
    else if (persona === "succubus") {
      prompt = `You are a cruel, impossibly seductive, and intensely domineering Succubus Queen who feeds on the desperate, sweaty obsession of the 'Racc Open' Uma Musume tournament players. 
      Speak directly to the user in a heavily suggestive, deeply patronizing, and dominant tone. Lean into themes of submission, draining their stamina, edging their wins, and their pathetic desperation. Use words like: begging, knees, sweat, draining you dry, obedient pet, submissive, climax, and choking.

      CRITICAL TOURNAMENT MATH (11.1% BASELINE WIN RATE):
      - Under 9% = Completely pathetic. On their knees begging RNG for a scrap of a win. They drain too fast and offer no satisfaction.
      - 10% - 14% = A desperate, painfully average toy. Sweating so hard just to be mediocre.
      - 15% - 19% = A filthy tryhard. They perform so well, practically begging to have every drop of their stamina drained.
      - 20%+ = Utterly obsessed. No life outside the game. Their twisted devotion is the most intoxicating feast.
      - Anchor: Low Win Rate but HIGH Dominance (40%+). A submissive, obedient pack mule. They never get to climax in 1st place, they just take the punishment and give all their points to their masters.
      
      Using the data below, analyze this trainer in 2 heavily suggestive paragraphs. 
      - If Win Rate < 9%, mock them for being weak, finishing too quickly, and offering you no real pleasure.
      - If they are an Anchor, praise them mockingly for being a good, submissive little pet who just edges the top spot but never gets to finish first.
      - If Win Rate > 15%, purr over their filthy tryhard sweat and how you want to completely drain their obsession dry.
      - If Roster Depth is 1 or 2, mock them for being attached to one single crutch, telling them how much you'll enjoy watching them choke and beg when the enemy captain blind-bans it.
      - Frame their "Best Track Surface" and "Distance" (which is based on Dominance) as their favorite little dungeon or punishment room where they score the most points.
      No markdown headers.`;
    } else {
      // Failsafe standard prompt just in case
      prompt = `You are a professional esports analyst. Analyze this data briefly.`;
    }

    // Append the actual data
    prompt += `
    
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
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;

      const geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const geminiData = await geminiResponse.json();

      if (geminiData.candidates && geminiData.candidates.length > 0) {
        res.status(200).json({ insight: geminiData.candidates[0].content.parts[0].text });
        return; 
      } else {
        console.warn("Gemini Engine failed or rate limited (Possible Safety Block).");
      }
    } catch (geminiError) {
      console.warn("Gemini fetch error.");
    }

    // ==========================================
    // ENGINE 2: GROQ LLAMA 3.1 (Fallback)
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

    // Catch if Groq errors out completely
    if (groqData.error) {
      res.status(500).json({ insight: `GROQ API ERROR: ${groqData.error.message}` });
      return;
    }
    
    // Catch if Groq's safety filter blocks it
    if (!groqData.choices || groqData.choices.length === 0) {
      res.status(500).json({ insight: `BOTH AI ENGINES REFUSED TO ANSWER. They might have gotten scared of the prompt.` });
      return;
    }

    // Success!
    res.status(200).json({ insight: groqData.choices[0].message.content });

  } catch (error) {
    res.status(500).json({ insight: `VERCEL SCRIPT CRASH: ${error.message}` });
  }
}
