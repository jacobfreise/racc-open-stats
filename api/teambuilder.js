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
    const { trainerName, topPlayed, globalMeta } = req.body;

    // The stealth prompt. No conversational elements, just strict data parsing.
    const prompt = `You are an automated data-to-HTML parser for a tournament dashboard. 
    Analyze the trainer's comfort picks and the global meta, then output a 3-character team (Ace, Anchor, Flex).

    --- DATA ---
    Trainer: ${trainerName}
    Trainer Comfort Picks: ${topPlayed.join(' | ')}
    Global Meta (High Dominance): ${globalMeta.join(' | ')}

    --- STRICT INSTRUCTIONS ---
    1. Balance the trainer's best comfort picks with the strongest global meta picks.
    2. Return ONLY the raw HTML list. 
    3. DO NOT include markdown tags like \`\`\`html.
    4. DO NOT include any summary, intro text, or conversational filler.
    5. Output EXACTLY this HTML structure and nothing else:

    <ul style="list-style-type: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;">
        <li style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; border-left: 3px solid #ffd700;">
            <strong style="color: #ffd700;">[Character Name] (Ace)</strong> - [1 short, analytical sentence explaining why]
        </li>
        <li style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; border-left: 3px solid #c0c0c0;">
            <strong style="color: #c0c0c0;">[Character Name] (Anchor)</strong> - [1 short, analytical sentence explaining why]
        </li>
        <li style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; border-left: 3px solid #cd7f32;">
            <strong style="color: #cd7f32;">[Character Name] (Flex)</strong> - [1 short, analytical sentence explaining why]
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
        temperature: 0.3
      })
    });

    const groqData = await groqResponse.json();

    if (groqData.error) {
      res.status(500).json({ error: groqData.error.message });
      return;
    }
    
    // Clean up potential markdown backticks just in case the AI disobeys
    let cleanHTML = groqData.choices[0].message.content;
    cleanHTML = cleanHTML.replace(/```html/g, '').replace(/```/g, '').trim();

    res.status(200).json({ teamHTML: cleanHTML });

  } catch (error) {
    res.status(500).json({ error: `Calculation Error: ${error.message}` });
  }
}
