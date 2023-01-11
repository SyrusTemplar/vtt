async function main () {
	await (await import("./generate-search-index.js")).default;
	await import("./generate-dmscreen-reference.js");
	await import("./generate-quick-reference.js");
	await (await import("./generate-tables-data.js")).default;
	await import("./generate-subclass-lookup.js");
	await (await import("./generate-spell-source-lookup.js")).default;
	await import("./generate-nav-adventure-book-index.js");
	await import("./generate-all-maps.js");
	// await import("./generate-wotc-homebrew.js"); // unused
}

main().catch(e => { throw e; });
