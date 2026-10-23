/* ================================================================
   PelotonHub - deployment configuration
   ================================================================
   One place for the settings that differ per environment (staging vs.
   production). It is loaded as a plain (non-module) script by the pages
   that need it, before their module scripts, so window.PELOTONHUB_CONFIG
   is always ready in time.

   GOOGLE MAPS API KEY
   --------------------
   The key below is a *browser* key: it is sent to every visitor's browser
   by design, so the real protection is a restriction in Google Cloud:

     1. Enable "Maps JavaScript API" and "Routes API" for the project
     2. Create a key (APIs & Services > Credentials)
     3. Restrict it to your domain
        (Edit the key > Application restrictions > HTTP referrers)
        e.g.   pelotonhub.web.app/*
               localhost:*

   Leave the value empty and the Events page keeps the keyless
   OpenStreetMap map. "Route to me" then draws the route on that map
   using the free OpenStreetMap routing services (Valhalla / OSRM) - no
   key, no billing, no credit card needed.
   ================================================================ */

window.PELOTONHUB_CONFIG = {
  // Google Maps - Maps JavaScript API + Routes API (event map + routing)
  googleMapsApiKey: 'AIzaSyA4b3x6v02pX6h_XR7o2ihfmih7NtEqAIU',
};
