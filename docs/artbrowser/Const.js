"use strict";

class Const {}
Const.STATES = ["0", "1", "2"]; // off, blue, red
Const.GH_PATH = `https://raw.githubusercontent.com/DMsGuild201/Roll20_resources/master/ExternalArt/dist/`;
Const.FAKE_FILTER_ARTIST = "Artist";
Const.FAKE_FILTER_SET = "Collection";
Const.IMG_LAZY_180 = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="100%" height="100%" fill="#8883"></rect></svg>`)}`;

export {Const};
