"use strict";

class RenderFeats {
	static $getRenderedFeat (feat) {
		const prerequisite = Renderer.utils.prerequisite.getHtml(feat.prerequisite);
		const ptRepeatable = Renderer.utils.getRepeatableHtml(feat);

		Renderer.feat.initFullEntries(feat);
		const renderStack = [];
		Renderer.get().setFirstSection(true).recursiveRender({entries: feat._fullEntries || feat.entries}, renderStack, {depth: 2});

		return $$`
			${Renderer.utils.getBorderTr()}
			${Renderer.utils.getExcludedTr({entity: feat, dataProp: "feat"})}
			${Renderer.utils.getNameTr(feat, {page: UrlUtil.PG_FEATS})}
			${prerequisite ? `<tr><td colspan="6">${prerequisite}</td></tr>` : ""}
			${ptRepeatable ? `<tr><td colspan="6">${ptRepeatable}</td></tr>` : ""}
			<tr><td class="divider" colspan="6"><div></div></td></tr>
			<tr class="text"><td colspan="6">${renderStack.join("")}</td></tr>
			${Renderer.utils.getPageTr(feat)}
			${Renderer.utils.getBorderTr()}
		`;
	}
}
