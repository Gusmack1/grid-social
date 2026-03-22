exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  
  const { token, image_url, fb_text, ig_text, platform } = JSON.parse(event.body);
  const PAGE_ID = '978717005332489';
  const IG_ID = '17841441580105982';
  const BASE = 'https://graph.facebook.com/v25.0';
  
  try {
    // First get the Page Access Token from the user token
    let pageToken = token;
    const accountsRes = await fetch(`${BASE}/me/accounts?access_token=${token}`);
    const accountsData = await accountsRes.json();
    if (accountsData.data) {
      const page = accountsData.data.find(p => p.id === PAGE_ID);
      if (page && page.access_token) {
        pageToken = page.access_token;
      }
    }
    
    if (platform === 'facebook') {
      const fbParams = new URLSearchParams({ url: image_url, message: fb_text, access_token: pageToken });
      const fbRes = await fetch(`${BASE}/${PAGE_ID}/photos?${fbParams}`, { method: 'POST' });
      const fbData = await fbRes.json();
      return { statusCode: 200, body: JSON.stringify({ platform: 'facebook', success: !!fbData.id, data: fbData }) };
    }
    
    if (platform === 'instagram') {
      const igParams = new URLSearchParams({ image_url, caption: ig_text, access_token: pageToken });
      const igRes = await fetch(`${BASE}/${IG_ID}/media?${igParams}`, { method: 'POST' });
      const igData = await igRes.json();
      
      if (igData.id) {
        // Check container status with polling
        for (let i = 0; i < 4; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const statusRes = await fetch(`${BASE}/${igData.id}?fields=status_code&access_token=${pageToken}`);
          const statusData = await statusRes.json();
          if (statusData.status_code === 'FINISHED') break;
        }
        
        const pubParams = new URLSearchParams({ creation_id: igData.id, access_token: pageToken });
        const pubRes = await fetch(`${BASE}/${IG_ID}/media_publish?${pubParams}`, { method: 'POST' });
        const pubData = await pubRes.json();
        return { statusCode: 200, body: JSON.stringify({ platform: 'instagram', success: !!pubData.id, data: pubData, container: igData.id }) };
      }
      return { statusCode: 200, body: JSON.stringify({ platform: 'instagram', success: false, data: igData }) };
    }
    
    // Get page token mode
    if (platform === 'get_page_token') {
      return { statusCode: 200, body: JSON.stringify({ page_token: pageToken, accounts: accountsData }) };
    }
    
    return { statusCode: 400, body: JSON.stringify({ error: 'specify platform' }) };
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
