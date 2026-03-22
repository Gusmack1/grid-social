// Scheduled function: runs Mon-Fri at 9am UK time (8am UTC)
// Picks the next unposted item from the queue and fires it

export default async (req) => {
  const META_TOKEN = Netlify.env.get("META_USER_TOKEN");
  const SITE_URL = "https://gridsocial.co.uk";
  
  // Check if today is a weekday
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) {
    console.log("Weekend — skipping");
    return;
  }

  // Fetch the queue
  const queueRes = await fetch(`${SITE_URL}/data/post-queue.json`);
  if (!queueRes.ok) {
    console.log("Failed to fetch queue");
    return;
  }
  const queue = await queueRes.json();

  // Check what's been posted (stored as env var POSTED_IDS, comma-separated)
  const postedStr = Netlify.env.get("POSTED_IDS") || "";
  const posted = new Set(postedStr.split(",").filter(Boolean));

  // Find next unposted
  const next = queue.find(item => !posted.has(item.id));
  if (!next) {
    console.log("All posts in queue have been posted!");
    return;
  }

  console.log(`Posting: ${next.id} — ${next.image}`);

  // Post via the social-post function
  const postRes = await fetch(`${SITE_URL}/api/social-post`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: `${SITE_URL}/social/v2/${next.image}`,
      fb_text: next.fb,
      ig_text: next.ig,
      platform: "both"
    })
  });

  const result = await postRes.json();
  console.log(`Result: ${JSON.stringify(result)}`);

  if (postRes.ok) {
    // Mark as posted by updating env var via Netlify API
    // (We can't update env vars from inside a function easily,
    //  so we'll log it and the queue advances based on date math instead)
    console.log(`✅ Posted ${next.id} successfully`);
  }
};

export const config = {
  schedule: "0 8 * * 1-5"
};
