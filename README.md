# Choggy's Adventures

A beginner-friendly, responsive cat-themed Bubble Shooter built with plain HTML, CSS, and JavaScript. No build tools or framework required.

## Play locally

1. Download and unzip the project folder.
2. Open `index.html` in a modern browser. (For the most consistent experience, use VS Code with the Live Server extension.)
3. Click through the opening story, then aim with your mouse or finger and click/tap to shoot.

## Controls

- Mouse / touch: aim; click / tap to shoot
- Swap button or Space: swap the current and next bubble
- Pause button or P: pause/resume
- Restart: restart the current level
- Sound button: toggle generated sound effects

## Deploy on Netlify using GitHub

1. Create a GitHub account if you do not have one.
2. On GitHub, create a new **public** repository named `choggys-adventures`.
3. Upload `index.html`, `styles.css`, `game.js`, and `README.md` from this folder to the repository root. You can do this through GitHub's **Add file → Upload files** interface.
4. Sign in to Netlify and choose **Add new site → Import an existing project**.
5. Connect GitHub and select `choggys-adventures`.
6. Leave the build command blank and set the publish directory to `.` (a single dot).
7. Click **Deploy site**. Netlify will give you a public URL.
8. Open that URL on desktop and mobile to test it. Future commits to the connected GitHub repository will trigger a new deploy.

## Replace placeholder artwork later

The project now includes the supplied pixel-art assets: `assets/meadow-background.jpg`, `assets/choggy.png`, and `assets/purnata.png`. Replace these files with your own artwork using the same filenames to update the look without changing the game logic.

## Notes

- The game stores the best score in the current browser using localStorage when available.
- Audio is synthesized by the browser, so there are no external audio files yet.
- This is a first playable prototype. Level balancing, bespoke artwork, and additional power-up types can be refined after playtesting.

## Update: finite levels + retro pixel-art direction

- Levels now begin with a finite bubble layout and a 26-shot limit.
- New rows no longer spawn after a set of shots; running out of shots ends the level and offers a retry.
- The interface uses a retro pixel-RPG palette and squared dialogue panels inspired by classic handheld RPGs.
- Bubble faces are drawn with blocky shapes rather than glossy emoji bubbles.

To test the built-in logic checks, open the game, then open the browser developer console and run:

```js
ChoggyGameTests.run()
```

The checks cover matching groups, floating bubbles, and bubble counting. A full visual playthrough should still be checked in desktop Chrome and on a mobile browser.


## Supplied art update

- Added your meadow background to the game board.
- Added the provided Choggy and Purnata pixel-art portraits to character cards and story dialogue.
- Updated the dialogue box toward the classic handheld RPG reference.
- Kept level layouts finite: no rows are added during play; each level has a fixed board and shot limit.


Latest update: the user-provided combined Purnata-and-Choggy artwork is shown small in the bottom-right corner, separate from the shooter playfield. The user-provided MP3 is included as looping background music and begins after gameplay starts, following browser autoplay rules. Panels use a brighter purple/pink/blue palette.


Final art update: the Purnata-and-Choggy illustration is placed at the bottom-left of the playfield with a transparent background. Story dialogue panels play short retro sound blips; sound toggle controls effects and music.


## Final balancing update
- The game has 10 levels with a gentler opening and gradual difficulty increases.
- Level 1 begins with two rows and 36 shots; later levels add rows and carefully reduce shot allowance.
- Completing Level 10 displays: “Thank you Purnata for everything you have done.”
- Instruction and information panels use rounded corners.
