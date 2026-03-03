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

    const prompt = `You are a strict data-parsing script for a tournament simulator.
    Your job is to select exactly 3 optimal ${type === 'trainer' ? 'players' : 'umas'} from the provided lists to form a mathematically balanced team. Balance high win-rate elements with high-dominance elements.

    Available High Win-Rate Options:
    ${topWr.join(' | ')}

    Available High Dominance Options:
    ${topDom.join(' | ')}

    --- STRICT INSTRUCTIONS ---
    1. Select EXACTLY 3 unique names from the lists above.
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
        temperature: 0.1 // Keeping it incredibly low so it outputs strict, predictable JSON
      })
    });

    const groqData = await groqResponse.json();

    if (groqData.error) {
      res.status(500).json({ error: groqData.error.message });
      return;
    }
    
    // Clean up potential markdown backticks just in case the AI disobeys
    let rawContent = groqData.choices[0].message.content.trim();
    rawContent = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsedTeam;
    try {
        parsedTeam = JSON.parse(rawContent);
    } catch (e) {
        // Ultimate failsafe: if Groq messes up the formatting, grab top 2 WR and top 1 Dom manually
        parsedTeam = [topWr[0].split(' (')[0], topWr[1].split(' (')[0], topDom[0].split(' (')[0]]; 
    }

    res.status(200).json({ team: parsedTeam });

  } catch (error) {
    res.status(500).json({ error: `Calculation Error: ${error.message}` });
  }
}
