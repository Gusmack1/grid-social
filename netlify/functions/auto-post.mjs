// Auto-poster DISABLED — all posting now handled by grid-social-autoposter dashboard
// Disabled on 2026-03-24 to prevent duplicate/triple posting

export default async (req) => {
  console.log("[auto-post] DISABLED — posting is handled by the auto-poster dashboard");
  return new Response(JSON.stringify({ 
    status: "disabled", 
    reason: "Posting moved to grid-social-autoposter dashboard",
    dashboard: "https://grid-social-autoposter.netlify.app"
  }), {
    status: 200, 
    headers: { "Content-Type": "application/json" }
  });
};

export const config = {
  path: "/api/auto-post"
};
