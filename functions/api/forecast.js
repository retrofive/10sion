export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!env.GEMINI_API_KEY) return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured. Get a free key at aistudio.google.com and add it in Cloudflare Pages > Settings > Environment variables." }), { status: 500, headers: cors });
  let body;
  try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON." }), { status: 400, headers: cors }); }
  const { sst, shear, pressure, humidity, region, month, question, modelData, classification } = body;
  if (!sst || !shear || !pressure || !humidity || !region) return new Response(JSON.stringify({ error: "Missing required fields." }), { status: 400, headers: cors });
  const md = modelData || {};
  const prompt = "You are a senior NWS hurricane meteorologist. Synthesize this ensemble data into an expert forecast discussion.\n\nCONDITIONS:\nSST: " + sst + "F | Wind Shear: " + shear + " kt | Pressure: " + pressure + " mb | Humidity: " + humidity + "% | Region: " + region + " | Month: " + (month || "September") + " | Classification: " + (classification || "Unknown") + "\n\nMODELS (72-hr):\nGFS: " + (md.gfs&&md.gfs.int||"N/A") + " | " + (md.gfs&&md.gfs.track||"N/A") + " | RI: " + (md.gfs&&md.gfs.ri||"N/A") + " | LF: " + (md.gfs&&md.gfs.lf||"N/A") + "\nECMWF: " + (md.euro&&md.euro.int||"N/A") + " | " + (md.euro&&md.euro.track||"N/A") + " | RI: " + (md.euro&&md.euro.ri||"N/A") + " | LF: " + (md.euro&&md.euro.lf||"N/A") + "\nNAM: " + (md.nam&&md.nam.int||"N/A") + " | " + (md.nam&&md.nam.track||"N/A") + " | RI: " + (md.nam&&md.nam.ri||"N/A") + " | LF: " + (md.nam&&md.nam.lf||"N/A") + "\nUKMET: " + (md.ukmet&&md.ukmet.int||"N/A") + " | " + (md.ukmet&&md.ukmet.track||"N/A") + " | RI: " + (md.ukmet&&md.ukmet.ri||"N/A") + " | LF: " + (md.ukmet&&md.ukmet.lf||"N/A") + "\nSpread: " + (md.spread||"Unknown") + "\n\n" + (question ? "QUESTION: " + question + "\n\n" : "") + "Provide NWS-style forecast discussion: model agreement/disagreements, RI probability, 24/48/72-hr intensity with confidence, track and steering factors, historical analogs, key messaging for SW Florida. Plain text, no markdown.";
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + env.GEMINI_API_KEY, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 1024, temperature: 0.7 } }) });
    if (!r.ok) { const t = await r.text(); console.error("Gemini error:", t); return new Response(JSON.stringify({ error: "Gemini API error " + r.status }), { status: 502, headers: cors }); }
    const data = await r.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No forecast generated.";
    return new Response(JSON.stringify({ forecast: text }), { status: 200, headers: cors });
  } catch (err) { return new Response(JSON.stringify({ error: "Failed to reach Gemini API." }), { status: 502, headers: cors }); }
}
export async function onRequestOptions() {
  return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
}
