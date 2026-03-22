exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  
  const body = JSON.parse(event.body);
  const { token, posts } = body;
  const PAGE_ID = '978717005332489';
  const IG_ID = '17841441580105982';
  const BASE = 'https://graph.facebook.com/v25.0';
  const results = [];
  
  for (const post of posts) {
    try {
      // Facebook photo post
      const fbParams = new URLSearchParams({
        url: post.image_url,
        message: post.fb_text,
        access_token: token
      });
      const fbRes = await fetch(`${BASE}/${PAGE_ID}/photos?${fbParams}`, { method: 'POST' });
      const fbData = await fbRes.json();
      results.push({ platform: 'facebook', post: post.id, success: !!fbData.id, id: fbData.id, error: fbData.error || null });
      
      // Instagram container create
      const igParams = new URLSearchParams({
        image_url: post.image_url,
        caption: post.ig_text,
        access_token: token
      });
      const igRes = await fetch(`${BASE}/${IG_ID}/media?${igParams}`, { method: 'POST' });
      const igData = await igRes.json();
      
      if (igData.id) {
        // Wait for processing
        await new Promise(r => setTimeout(r, 5000));
        
        // Publish
        const pubParams = new URLSearchParams({
          creation_id: igData.id,
          access_token: token
        });
        const pubRes = await fetch(`${BASE}/${IG_ID}/media_publish?${pubParams}`, { method: 'POST' });
        const pubData = await pubRes.json();
        results.push({ platform: 'instagram', post: post.id, success: !!pubData.id, id: pubData.id, error: pubData.error || null });
      } else {
        results.push({ platform: 'instagram', post: post.id, success: false, error: igData.error || null });
      }
      
      // Delay between posts
      await new Promise(r => setTimeout(r, 3000));
    } catch(e) {
      results.push({ post: post.id, error: e.message });
    }
  }
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ results, total: results.length })
  };
};
