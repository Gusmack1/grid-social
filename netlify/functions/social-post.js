exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  
  const { token, image_url, fb_text, ig_text, platform } = JSON.parse(event.body);
  const PAGE_ID = '978717005332489';
  const IG_ID = '17841441580105982';
  const BASE = 'https://graph.facebook.com/v25.0';
  
  try {
    if (platform === 'facebook' || platform === 'both') {
      const fbParams = new URLSearchParams({ url: image_url, message: fb_text, access_token: token });
      const fbRes = await fetch(`${BASE}/${PAGE_ID}/photos?${fbParams}`, { method: 'POST' });
      const fbData = await fbRes.json();
      
      if (platform === 'facebook') {
        return { statusCode: 200, body: JSON.stringify({ platform: 'facebook', success: !!fbData.id, data: fbData }) };
      }
    }
    
    if (platform === 'instagram' || platform === 'both') {
      const igParams = new URLSearchParams({ image_url, caption: ig_text, access_token: token });
      const igRes = await fetch(`${BASE}/${IG_ID}/media?${igParams}`, { method: 'POST' });
      const igData = await igRes.json();
      
      if (igData.id) {
        const pubParams = new URLSearchParams({ creation_id: igData.id, access_token: token });
        const pubRes = await fetch(`${BASE}/${IG_ID}/media_publish?${pubParams}`, { method: 'POST' });
        const pubData = await pubRes.json();
        return { statusCode: 200, body: JSON.stringify({ platform: 'instagram', success: !!pubData.id, data: pubData, container: igData.id }) };
      }
      return { statusCode: 200, body: JSON.stringify({ platform: 'instagram', success: false, data: igData }) };
    }
    
    return { statusCode: 400, body: JSON.stringify({ error: 'specify platform: facebook, instagram, or both' }) };
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
