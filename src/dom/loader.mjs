"use strict";

const body = document.body;

const dialogLoader = body.appendChild(document.createElement(`dialog`));
dialogLoader.classList.add(`loader`, `layer`, `rounded`, `with-padding`, `large-padding`);
dialogLoader.style.maxWidth = `60vmin`;
dialogLoader.style.display = `grid`;
dialogLoader.style.gridTemplateRows = `1fr auto auto`;
dialogLoader.style.placeItems = `center`;

const imgLogo = dialogLoader.appendChild(document.createElement(`img`));
imgLogo.alt = `Logo`;

const h2Title = dialogLoader.appendChild(document.createElement(`h2`));
h2Title.textContent = `Loading`;

const bSubtitle = dialogLoader.appendChild(document.createElement(`b`));
bSubtitle.textContent = `Please wait`;

export { dialogLoader, h2Title, bSubtitle };
