import * as fs from "fs";
import "../js/parser.js";
import "../js/utils.js";
import probe from "probe-image-size";
import {ObjectWalker} from "5etools-utils";

const allFiles = [];

function addDir (dir) {
	fs.readdirSync(dir).forEach(filename => {
		const path = `${dir}/${filename}`;
		addFile(path);
	});
}

function addFile (path) {
	const json = JSON.parse(fs.readFileSync(path, "utf-8"));
	allFiles.push({json, path});
}

async function pMutImageDimensions (imgEntry) {
	const path = `img/${imgEntry.href.path}`;
	try {
		const input = fs.createReadStream(path);
		const dimensions = await probe(input);
		input.destroy(); // stream cleanup

		imgEntry.width = dimensions.width;
		imgEntry.height = dimensions.height;
	} catch (e) {
		console.error(`Failed to set dimensions for ${path} -- ${e.message}`);
	}
}

const _PROMISES = [];
function addMutImageDimensions (obj) {
	if (obj.type === "image" && obj.href && obj.href.type === "internal") {
		_PROMISES.push(pMutImageDimensions(obj));
	}
	return obj;
}

async function main () {
	addDir("./data/adventure");
	addDir("./data/book");
	addFile("./data/decks.json");
	allFiles.forEach(meta => {
		ObjectWalker.walk({
			filePath: meta.path,
			obj: meta.json,
			primitiveHandlers: {
				object: addMutImageDimensions,
			},
		});
	});
	await Promise.all(_PROMISES);
	allFiles.forEach(meta => fs.writeFileSync(meta.path, CleanUtil.getCleanJson(meta.json), "utf-8"));
}

main().catch(e => console.error(e));
