# Doberg — company site

Static site for Doberg, the studio behind Skintel and Blith. Meant to replace URank on playlocal.space.

- `index.html`: the whole page (no build step). `assets/`: logo mark (transparent), favicon, app icons.
- Brand: paper `#FAF8F3`, ink `#1F1F21`, bronze `#A39381` (from the logo). Each app card uses its own app's colours.
- Fonts: Hanken Grotesk and IBM Plex Mono (Google Fonts).

To do before launch: replace `[CONTACT EMAIL]` in `index.html`.

## Hosting on Vercel
Create a Vercel project with Root Directory `doberg` and Framework Preset "Other" (no build command), then
move `playlocal.space` and `www.playlocal.space` from the `agentrank` project to it. URank keeps its code in
`agentrank/` and stays reachable on its `*.vercel.app` address.
