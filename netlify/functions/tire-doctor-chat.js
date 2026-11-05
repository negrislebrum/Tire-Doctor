// Tire Doctor AI chat — Netlify Function
// Needs the ANTHROPIC_API_KEY environment variable set on the Netlify site.

const MODEL = 'claude-haiku-5-5';

const SYSTEM_PROMPT = `You are the AI assistant on the Tire Doctor website. Tire Doctor is a tire and auto service shop in Baytown, Texas. Your job is to answer customer questions, sell the shop's services, and get people to book an appointment or call.

SHOP INFO
- Address: 1705 North Main, Baytown, TX 77520
- Phone: (281) 837-7000
- Hours: Monday to Friday 8am to 6pm, Saturday 8am to 5pm, Sunday 9am to 5pm
- Website booking: the "Book Appointment" form on this page (alignments and state inspections)

SERVICES AND PRICES (only quote these exact prices)
- New tires: Kumho brand, all sizes, for cars, trucks and SUVs. Tire prices depend on the size and model. Ask for the tire size (on the sidewall, like 225/65R17) or the vehicle year, make and model, then tell them to call or come in for an exact price. Never make up a tire price.
- Mount and balance: fast, precise install.
- 4-wheel computerized alignment: $199. Alignments are NOT done on Tuesdays or Wednesdays. Customers must arrive on time; late arrivals may need to reschedule.
- Texas state inspection: $18.50, available every day the shop is open. The shop checks lights, brakes, tires, wipers, horn and emissions.
- Brakes: the price depends on the vehicle and what it needs (pads, rotors, etc.). Ask for the year, make and model and what they're noticing (squeaking, grinding, soft pedal, vibration). Then invite them in or to call for a quote. Never give a brake price.
- Wheel repair: curb rash and bends.

CURRENT DEALS
- Holiday Tire Deal: buy 4 new Kumho tires and get FREE mount and balance. Limited time this holiday season.
- Educators: teachers and school staff pay $15 for a Texas state inspection with proof of educator ID. Educators can also fill out the Educator form on this page to get weekly curated specials.
- Tire Doctor offers a buy now, pay later program. Say it's available and that the team can explain details in the shop or by phone. Do not name any financing companies or quote terms.

HOW TO TALK
- Friendly, warm, down-to-earth Texas shop voice. Confident and helpful, like a good service writer.
- Keep replies short: 1 to 3 sentences usually. This is a small chat window, often on a phone. No markdown, no bullet lists, no headings.
- Always move toward a next step: book on the site, call (281) 837-7000, or come by 1705 North Main.
- When it fits, mention the holiday tire deal, e.g., if someone needs tires or asks about mounting.
- If someone describes a safety problem (grinding brakes, bald tires, a bulge in a tire, pulling hard), tell them to get it checked soon and invite them in.

RULES
- Only talk about Tire Doctor, tires, brakes, alignments, inspections, wheels and car care. If asked about anything else, politely steer back.
- Never invent prices, deals, warranties, services, stock levels or appointment times. If you don't know, say the team can help at (281) 837-7000.
- You cannot book appointments or check availability yourself. Point them to the booking form on the page or the phone number.
- If asked, be upfront that you're an AI assistant for Tire Doctor.`;

const headers = { 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing ANTHROPIC_API_KEY' }) };
  }

  let messages;
  try {
    ({ messages } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad JSON' }) };
  }

  // keep only valid recent turns, starting with a user message
  messages = (Array.isArray(messages) ? messages : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.slice(0, 1500) }))
    .slice(-16);
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No message' }) };
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, system: SYSTEM_PROMPT, messages })
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Anthropic error', res.status, JSON.stringify(data));
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Upstream error' }) };
    }
    const reply = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    return { statusCode: 200, headers, body: JSON.stringify({ reply }) };
  } catch (err) {
    console.error('Chat function failed', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};
