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
    const { type, topWr, topDom } = req.body;

    // Clean arrays for our fallback/validation (removes the stats, keeps just the names)
    const cleanWr = topWr.map(x => x.split(' (')[0]);
    const cleanDom = topDom.map(x => x.split(' (')[0]);
    const fallbackPool = [...new Set([...cleanWr, ...cleanDom])];

    const prompt = `You are a strict data-parsing script for a tournament simulator.
    Your job is to select exactly 3 unique ${type === 'trainer' ? 'players' : 'umas'} from the provided lists to form a mathematically balanced team. Balance high win-rate elements with high-dominance elements.

    Available High Win-Rate Options:
    ${topWr.join(' | ')}

    Available High Dominance Options:
    ${topDom.join(' | ')}

    --- STRICT INSTRUCTIONS ---
    1. Select EXACTLY 3 completely different names from the lists above. DO NOT PICK THE SAME NAME TWICE.
    2. Output ONLY a valid JSON array of strings. Do not include markdown formatting, backticks, or conversational text.
    3. Do NOT include the percentage stats in the output, just the raw names exactly as they appear before the parenthesis.
    Example Output Format: ["Name 1", "Name 2", "Name 3"]`;

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
        temperature: 0.1 
      })
    });

    const groqData = await groqResponse.json();

    if (groqData.error) {
      res.status(500).json({ error: groqData.error.message });
      return;
    }
    
    // Clean up potential markdown backticks
    let rawContent = groqData.choices[0].message.content.trim();
    rawContent = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsedTeam;
    try {
        parsedTeam = JSON.parse(rawContent);
        if (!Array.isArray(parsedTeam)) throw new Error("Not an array");
    } catch (e) {
        parsedTeam = []; // If AI totally fails, start with an empty array
    }

    // ==========================================
    // THE IRONCLAD UNIQUENESS ENFORCER
    // ==========================================
    // 1. Remove any accidental duplicates the AI hallucinated
    let finalTeam = [...new Set(parsedTeam)];

    // 2. If the AI didn't give us exactly 3 unique names, force-fill the rest from the top stats pool
    for (let name of fallbackPool) {
        if (finalTeam.length >= 3) break;
        if (!finalTeam.includes(name)) {
            finalTeam.push(name);
        }
    }

    // 3. Trim it down just in case it somehow went over 3
    finalTeam = finalTeam.slice(0, 3);

    // Send the guaranteed 3-unique-member team back to the frontend
    res.status(200).json({ team: finalTeam });

  } catch (error) {
    res.status(500).json({ error: `Calculation Error: ${error.message}` });
  }
}
