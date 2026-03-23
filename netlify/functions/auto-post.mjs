// Auto-poster: fires Mon-Fri at 9am UK (8am UTC)
// Returns proper Response to prevent Netlify retries

export default async (req) => {
  const SITE_URL = "https://gridsocial.co.uk";
  
  // Check weekday
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) {
    console.log("Weekend — skipping");
    return new Response(JSON.stringify({ status: "skipped", reason: "weekend" }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  }

  // Fetch queue
  let queue;
  try {
    const r = await fetch(`${SITE_URL}/data/post-queue.json?t=${Date.now()}`);
    queue = await r.json();
  } catch(e) {
    console.log("Failed to fetch queue:", e.message);
    return new Response(JSON.stringify({ status: "error", reason: "queue_fetch_failed" }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  }

  // Calculate weekday index since start date (Mon 24 Mar 2026)
  const start = new Date("2026-03-24T00:00:00Z");
  const diffDays = Math.floor((now - start) / 86400000);
  
  // If before start date, skip
  if (diffDays < 0) {
    console.log("Before start date — skipping");
    return new Response(JSON.stringify({ status: "skipped", reason: "before_start_date" }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  }
  
  // Count weekdays elapsed
  let weekdays = 0;
  for (let d = 0; d <= diffDays; d++) {
    const check = new Date(start.getTime() + d * 86400000);
    const dow = check.getUTCDay();
    if (dow >= 1 && dow <= 5) weekdays++;
  }
  // weekdays is now 1-based count of weekdays from start through today
  // Subtract 1 for 0-based index
  const idx = weekdays - 1;

  if (idx < 0 || idx >= queue.length) {
    console.log(`Queue exhausted or invalid index (idx=${idx}, queue=${queue.length}). Add more content!`);
    return new Response(JSON.stringify({ status: "skipped", reason: "queue_exhausted", idx, total: queue.length }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  }

  const post = queue[idx];
  console.log(`Day ${idx}: posting ${post.id}`);

  try {
    const r = await fetch(`${SITE_URL}/api/social-post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: `${SITE_URL}/social/v3/${post.image}`,
        fb_text: post.fb,
        ig_text: post.ig,
        platform: "both"
      })
    });
    const result = await r.json();
    console.log(`✅ ${post.id}: ${JSON.stringify(result)}`);
    return new Response(JSON.stringify({ status: "posted", id: post.id, idx, result }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  } catch(e) {
    console.log(`❌ ${post.id}: ${e.message}`);
    return new Response(JSON.stringify({ status: "error", id: post.id, error: e.message }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  }
};

export const config = {
  schedule: "0 8 * * 1-5"
};
