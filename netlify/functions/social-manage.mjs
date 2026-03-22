export default async (req) => {
  const META_TOKEN = Netlify.env.get("META_USER_TOKEN");
  if (!META_TOKEN) return new Response(JSON.stringify({error:"No META_USER_TOKEN"}), {status:500});

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "list";
  const IG_ID = "17841441580105982";

  // Get page token
  let PAGE_TOKEN, PAGE_ID;
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${META_TOKEN}`);
    const d = await r.json();
    if (!d.data?.length) throw new Error("No pages");
    PAGE_TOKEN = d.data[0].access_token;
    PAGE_ID = d.data[0].id;
  } catch(e) {
    return new Response(JSON.stringify({error:`Auth: ${e.message}`}), {status:500});
  }

  // LIST
  if (action === "list") {
    const [fbR, igR] = await Promise.all([
      fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}/feed?access_token=${PAGE_TOKEN}&limit=100&fields=id,message,created_time,full_picture`),
      fetch(`https://graph.facebook.com/v21.0/${IG_ID}/media?access_token=${PAGE_TOKEN}&limit=100&fields=id,caption,timestamp,media_url,permalink`)
    ]);
    const [fb, ig] = await Promise.all([fbR.json(), igR.json()]);
    return new Response(JSON.stringify({
      facebook: fb.data || [], instagram: ig.data || [],
      page_id: PAGE_ID, ig_id: IG_ID
    }), {headers:{"Content-Type":"application/json"}});
  }

  // DELETE — uses PAGE_TOKEN for both FB and IG
  if (action === "delete" && req.method === "POST") {
    const body = await req.json();
    const fb_ids = body.fb_ids || body.ids || [];
    const ig_ids = body.ig_ids || [];
    const results = { facebook: [], instagram: [] };

    for (const id of fb_ids) {
      try {
        // Try page token first (works for all page posts)
        let r = await fetch(`https://graph.facebook.com/v21.0/${id}?access_token=${PAGE_TOKEN}`, {method:"DELETE"});
        let d = await r.json();
        if (!d.success) {
          // Fallback: try system user token
          r = await fetch(`https://graph.facebook.com/v21.0/${id}?access_token=${META_TOKEN}`, {method:"DELETE"});
          d = await r.json();
        }
        results.facebook.push({id, success: d.success === true, error: d.error?.message});
      } catch(e) {
        results.facebook.push({id, success: false, error: e.message});
      }
    }

    for (const id of ig_ids) {
      try {
        // IG deletion uses PAGE_TOKEN (not user token)
        let r = await fetch(`https://graph.facebook.com/v21.0/${id}?access_token=${PAGE_TOKEN}`, {method:"DELETE"});
        let d = await r.json();
        if (!d.success) {
          // Fallback: system user token
          r = await fetch(`https://graph.facebook.com/v21.0/${id}?access_token=${META_TOKEN}`, {method:"DELETE"});
          d = await r.json();
        }
        results.instagram.push({id, success: d.success === true, error: d.error?.message});
      } catch(e) {
        results.instagram.push({id, success: false, error: e.message});
      }
    }

    return new Response(JSON.stringify(results), {headers:{"Content-Type":"application/json"}});
  }

  // PURGE — delete all except specified keep lists
  if (action === "purge" && req.method === "POST") {
    const body = await req.json();
    const keep_fb = new Set(body.keep_fb || []);
    const keep_ig = new Set(body.keep_ig || []);

    const [fbR, igR] = await Promise.all([
      fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}/feed?access_token=${PAGE_TOKEN}&limit=100&fields=id`),
      fetch(`https://graph.facebook.com/v21.0/${IG_ID}/media?access_token=${PAGE_TOKEN}&limit=100&fields=id`)
    ]);
    const [fb, ig] = await Promise.all([fbR.json(), igR.json()]);

    const del_fb = (fb.data||[]).filter(p => !keep_fb.has(p.id)).map(p => p.id);
    const del_ig = (ig.data||[]).filter(p => !keep_ig.has(p.id)).map(p => p.id);

    const results = { facebook: [], instagram: [] };

    for (const id of del_fb) {
      try {
        let r = await fetch(`https://graph.facebook.com/v21.0/${id}?access_token=${PAGE_TOKEN}`, {method:"DELETE"});
        let d = await r.json();
        if (!d.success) {
          r = await fetch(`https://graph.facebook.com/v21.0/${id}?access_token=${META_TOKEN}`, {method:"DELETE"});
          d = await r.json();
        }
        results.facebook.push({id, success: d.success === true, error: d.error?.message});
      } catch(e) {
        results.facebook.push({id, success: false, error: e.message});
      }
    }

    for (const id of del_ig) {
      try {
        let r = await fetch(`https://graph.facebook.com/v21.0/${id}?access_token=${PAGE_TOKEN}`, {method:"DELETE"});
        let d = await r.json();
        if (!d.success) {
          r = await fetch(`https://graph.facebook.com/v21.0/${id}?access_token=${META_TOKEN}`, {method:"DELETE"});
          d = await r.json();
        }
        results.instagram.push({id, success: d.success === true, error: d.error?.message});
      } catch(e) {
        results.instagram.push({id, success: false, error: e.message});
      }
    }

    results.summary = {
      fb_deleted: results.facebook.filter(r=>r.success).length,
      fb_failed: results.facebook.filter(r=>!r.success).length,
      ig_deleted: results.instagram.filter(r=>r.success).length,
      ig_failed: results.instagram.filter(r=>!r.success).length
    };
    return new Response(JSON.stringify(results), {headers:{"Content-Type":"application/json"}});
  }

  return new Response(JSON.stringify({
    actions: ["GET ?action=list", "POST ?action=delete {fb_ids,ig_ids}", "POST ?action=purge {keep_fb,keep_ig}"]
  }), {status:400, headers:{"Content-Type":"application/json"}});
};

export const config = { path: "/api/social-manage" };
