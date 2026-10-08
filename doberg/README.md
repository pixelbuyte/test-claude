# Doberg — company site

Static site for Doberg, the studio behind Skintel and Blith. Meant to replace URank on playlocal.space.

- Three design variations, no build step: `index.html` (A, editorial cream and serif), `b.html` (B, light bento),
  `c.html` (C, dark espresso with staggered phones). The footer links between them. Keep one and delete the others.
- `demos.js` and `demos.css`: the animated app demos shared by all three (Skintel: Scan and Ask Skintel; Blith:
  body notes and Ask). All demo content is example data.
- `assets/`: logo mark (transparent), favicon, app icons, and the real Blith body render.
- Brand: paper `#FAF8F3`, ink `#1F1F21`, bronze `#A39381` (from the logo). Each app card uses its own app's colours.
- Fonts: Hanken Grotesk and IBM Plex Mono (Google Fonts).

Contact: drava@playlocal.space.

## Hosting on Vercel
Create a Vercel project with Root Directory `doberg` and Framework Preset "Other" (no build command), then
move `playlocal.space` and `www.playlocal.space` from the `agentrank` project to it. URank keeps its code in
`agentrank/` and stays reachable on its `*.vercel.app` address.
