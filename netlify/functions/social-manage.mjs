export default async (req) => {
  const META_TOKEN = Netlify.env.get("META_USER_TOKEN");
  if (!META_TOKEN) return new Response(JSON.stringify({error:"No token"}), {status:500});

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "list";

  // Get page token
  const acctRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${META_TOKEN}`);
  const acctData = await acctRes.json();
  if (!acctData.data?.length) return new Response(JSON.stringify({error:"No pages found"}), {status:500});
  const PAGE_TOKEN = acctData.data[0].access_token;
  const PAGE_ID = acctData.data[0].id;
  const IG_ID = "17841441580105982";

  if (action === "list") {
    // List FB posts
    const fbRes = await fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}/feed?access_token=${PAGE_TOKEN}&limit=50&fields=id,message,created_time,full_picture`);
    const fbData = await fbRes.json();

    // List IG posts
    const igRes = await fetch(`https://graph.facebook.com/v21.0/${IG_ID}/media?access_token=${PAGE_TOKEN}&limit=50&fields=id,caption,timestamp,media_url`);
    const igData = await igRes.json();

    return new Response(JSON.stringify({
      facebook: fbData.data || [],
      instagram: igData.data || []
    }), {headers:{"Content-Type":"application/json"}});
  }

  if (action === "delete" && req.method === "POST") {
    const body = await req.json();
    const ids = body.ids || [];
    const platform = body.platform || "facebook";
    const results = [];

    for (const id of ids) {
      try {
        const delRes = await fetch(`https://graph.facebook.com/v21.0/${id}?access_token=${PAGE_TOKEN}`, {method:"DELETE"});
        const delData = await delRes.json();
        results.push({id, success: delData.success || false, error: delData.error?.message});
      } catch(e) {
        results.push({id, success: false, error: e.message});
      }
    }
    return new Response(JSON.stringify({results}), {headers:{"Content-Type":"application/json"}});
  }

  return new Response(JSON.stringify({error:"Invalid action. Use ?action=list or POST ?action=delete"}), {status:400});
};

export const config = { path: "/api/social-manage" };
