// Auto-poster: fires Mon-Fri at 9am UK (8am UTC)
// Uses date math to pick the right post from the queue

export default async (req) => {
  const SITE_URL = "https://gridsocial.co.uk";
  
  // Check weekday
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) {
    console.log("Weekend — skipping");
    return;
  }

  // Fetch queue
  let queue;
  try {
    const r = await fetch(`${SITE_URL}/data/post-queue.json`);
    queue = await r.json();
  } catch(e) {
    console.log("Failed to fetch queue:", e.message);
    return;
  }

  // Calculate weekday index since start date (Mon 24 Mar 2026)
  const start = new Date("2026-03-24T00:00:00Z");
  const diffDays = Math.floor((now - start) / 86400000);
  
  // Count weekdays elapsed
  let weekdays = 0;
  for (let d = 0; d < diffDays; d++) {
    const check = new Date(start.getTime() + d * 86400000);
    const dow = check.getUTCDay();
    if (dow >= 1 && dow <= 5) weekdays++;
  }

  if (weekdays >= queue.length) {
    console.log(`Queue exhausted (${weekdays} weekdays, ${queue.length} posts). Add more content!`);
    return;
  }

  const post = queue[weekdays];
  console.log(`Day ${weekdays}: posting ${post.id}`);

  try {
    const r = await fetch(`${SITE_URL}/api/social-post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: `${SITE_URL}/social/v2/${post.image}`,
        fb_text: post.fb,
        ig_text: post.ig,
        platform: "both"
      })
    });
    const result = await r.json();
    console.log(`✅ ${post.id}: ${JSON.stringify(result)}`);
  } catch(e) {
    console.log(`❌ ${post.id}: ${e.message}`);
  }
};

export const config = {
  schedule: "0 8 * * 1-5"
};
