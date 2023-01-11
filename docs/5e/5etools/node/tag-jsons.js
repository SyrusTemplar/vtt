import "../js/utils.js";
import "../js/render.js";
import "../js/render-dice.js";
import * as ut from "./util.js";
import {setUp, loadSpells, run, teardown} from "./util-tag-jsons.js";

/**
 * Args:
 * file="./data/my-file.json"
 * filePrefix="./data/dir/"
 * inplace
 * bestiaryFile="./data/my-file.json"
 */
export default async function main () {
	ut.ArgParser.parse();
	setUp();
	await TagJsons.pInit({
		spells: loadSpells(),
	});
	run(ut.ArgParser.ARGS);
	teardown();
	console.log("Run complete.");
}
