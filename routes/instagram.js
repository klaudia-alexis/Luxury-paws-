// Fetches recent posts from Instagram so the homepage can show a live feed
// without ever exposing your access token to the browser.
//
// Uses the Instagram Graph API (for an Instagram professional account
// connected to a Facebook Page). Docs: https://developers.facebook.com/docs/instagram-api
//
// Requires:
//   INSTAGRAM_ACCESS_TOKEN  — a long-lived Graph API access token
//   INSTAGRAM_USER_ID       — the Instagram professional account's numeric ID
//
// Long-lived tokens expire (~60 days) and need refreshing periodically —
// see README.md for how. If either env var is missing, or the request
// fails, this returns an empty list so the frontend just shows its
// placeholder tiles instead of breaking the page.
const express = require('express');
const router = express.Router();

let cache = { fetchedAt: 0, posts: [] };
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes — keeps us well under rate limits

async function fetchFromInstagram(){
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  if(!token || !userId) return [];

  const url = `https://graph.instagram.com/${userId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink&limit=8&access_token=${token}`;
  const res = await fetch(url);
  if(!res.ok){
    const text = await res.text();
    throw new Error(`Instagram API failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return (data.data || [])
    .filter(item => item.media_type !== 'VIDEO' || item.thumbnail_url) // need an image to show
    .map(item => ({
      id: item.id,
      mediaUrl: item.media_type === 'VIDEO' ? item.thumbnail_url : item.media_url,
      permalink: item.permalink,
    }));
}

// GET /api/instagram-feed
router.get('/', async (req, res) => {
  const isFresh = Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if(isFresh){
    return res.json({ posts: cache.posts });
  }
  try{
    const posts = await fetchFromInstagram();
    cache = { fetchedAt: Date.now(), posts };
    res.json({ posts });
  }catch(err){
    console.error('Instagram feed fetch failed:', err.message);
    // Serve the last good cache (even if stale) rather than nothing, if we have one.
    res.json({ posts: cache.posts });
  }
});

module.exports = router;
