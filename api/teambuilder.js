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
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const { targetTrainer, topAces, topAnchors, globalMeta } = req.body;

    const prompt = `You are an automated data-to-HTML parser for an esports dashboard. 
    Analyze the draft pool and output an optimal 3-player team built around the Target Trainer.

    --- TOURNAMENT RULES ---
    - Teams consist of EXACTLY 3 different players.
    - Each player races EXACTLY 1 Uma.
    - Max 2 duplicate Umas allowed per team.
    - Max 2 of the same running style allowed per team.

    --- DRAFT DATA ---
    Target Trainer (MUST BE ON THE TEAM): ${targetTrainer}
    Available Aces (High Win Rate Pool): ${topAces.join(' | ')}
    Available Anchors (High Dominance Pool): ${topAnchors.join(' | ')}
    Global Meta Umas: ${globalMeta.join(', ')}

    --- STRICT INSTRUCTIONS ---
    1. Select EXACTLY 2 additional players from the Available pools to join the Target Trainer.
    2. Assign EXACTLY 1 Uma to each of the 3 players (based on their Comfort picks or the Global Meta).
    3. Return ONLY the raw HTML list. 
    4. DO NOT include markdown tags like \`\`\`html.
    5. DO NOT include conversational text. Output EXACTLY this HTML structure:

    <ul style="list-style-type: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;">
        <li style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; border-left: 3px solid #ffd700;">
            <strong style="color: #ffd700;">[Player 1 Name]</strong> - <em>Running: [Uma Name]</em><br>
            <span style="font-size: 0.85em; opacity: 0.8;">[1 short, analytical sentence explaining why this player and Uma combination strengthens the team]</span>
        </li>
        <li style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; border-left: 3px solid #c0c0c0;">
            <strong style="color: #c0c0c0;">[Player 2 Name]</strong> - <em>Running: [Uma Name]</em><br>
            <span style="font-size: 0.85em; opacity: 0.8;">[1 short, analytical sentence explaining why this player and Uma combination strengthens the team]</span>
        </li>
        <li style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; border-left: 3px solid #cd7f32;">
            <strong style="color: #cd7f32;">[Player 3 Name]</strong> - <em>Running: [Uma Name]</em><br>
            <span style="font-size: 0.85em; opacity: 0.8;">[1 short, analytical sentence explaining why this player and Uma combination strengthens the team]</span>
        </li>
    </ul>`;

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
        temperature: 0.4
      })
    });

    const groqData = await groqResponse.json();

    if (groqData.error) {
      res.status(500).json({ error: groqData.error.message });
      return;
    }
    
    let cleanHTML = groqData.choices[0].message.content;
    cleanHTML = cleanHTML.replace(/```html/g, '').replace(/```/g, '').trim();

    res.status(200).json({ teamHTML: cleanHTML });

  } catch (error) {
    res.status(500).json({ error: `Calculation Error: ${error.message}` });
  }
}
