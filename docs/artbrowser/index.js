"use strict";

import {ArtBrowser} from "./ArtBrowser.js";

window.addEventListener("load", () => {
	// expose for debugging
	window.ART_BROWSER = new ArtBrowser($(`#main_content`));
	window.ART_BROWSER.pInit();
});
