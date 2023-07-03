"use strict";

class UtilConditions {
	static getDefaultState ({name, color, turns}) {
		return {
			id: CryptUtil.uid(),
			entity: {
				name,
				color,
				turns: turns ? Number(turns) : null,
			},
		};
	}
}

class RenderableCollectionConditions extends RenderableCollectionGenericRows {
	constructor (
		{
			comp,
			$wrpRows,
			isReadOnly = false,
			barWidth = null,
			barHeight = null,
		},
	) {
		super(comp, "conditions", $wrpRows);
		this._isReadOnly = isReadOnly;
		this._barWidth = barWidth;
		this._barHeight = barHeight;
	}

	_$getWrpRow () {
		const ptStyle = [
			this._barWidth != null ? `width: ${this._barWidth}px` : null,
			this._barHeight != null ? `height: ${this._barHeight}px` : null,
		]
			.filter(Boolean)
			.join(" ");

		return $$`<div class="init__cond relative" ${ptStyle ? `style="${ptStyle}"` : ""}></div>`;
	}

	/* -------------------------------------------- */

	_populateRow ({comp, $wrpRow, entity}) {
		this._populateRow_bindHookTooltip({comp, $wrpRow, entity});
		this._populateRow_bindHookBars({comp, $wrpRow, entity});
		this._populateRow_bindHookConditionHover({comp, $wrpRow, entity});

		$wrpRow
			.on("contextmenu", evt => {
				if (this._isReadOnly) return;
				evt.preventDefault();
				this._doTickDown({comp, entity, isFromClick: true});
			})
			.on("click", () => {
				if (this._isReadOnly) return;
				this._doTickUp({comp, entity, isFromClick: true});
			});
	}

	_populateRow_bindHookTooltip ({comp, $wrpRow, entity}) {
		const hkTooltip = () => {
			const turnsText = `${comp._state.turns} turn${comp._state.turns > 1 ? "s" : ""} remaining`;
			$wrpRow.title(
				comp._state.name && comp._state.turns
					? `${comp._state.name.escapeQuotes()} (${turnsText})`
					: comp._state.name
						? comp._state.name.escapeQuotes()
						: comp._state.turns
							? turnsText
							: "",
			);
		};
		comp._addHookBase("turns", hkTooltip);
		comp._addHookBase("name", hkTooltip);
		hkTooltip();
	}

	_populateRow_bindHookBars ({comp, $wrpRow, entity}) {
		comp._addHookBase("turns", () => {
			const htmlBars = comp._state.turns
				? [...new Array(Math.min(comp._state.turns, 3))]
					.map(() => this._populateRow_getHtmlBar({comp, $wrpRow, entity}))
					.join("")
				: this._populateRow_getHtmlBar({comp, $wrpRow, entity});

			$wrpRow
				.empty()
				.html(htmlBars);
		})();
	}

	_populateRow_bindHookConditionHover ({comp, $wrpRow, entity}) {
		comp._addHookBase("name", () => {
			$wrpRow
				.off("mouseover")
				.off("mousemove")
				.off("mouseleave");

			const cond = InitiativeTrackerUtil.CONDITIONS.find(it => it.condName !== null && it.name.toLowerCase() === comp._state.name.toLowerCase().trim());
			if (!cond) return;

			const ele = $wrpRow[0];
			$wrpRow.on("mouseover", (evt) => {
				if (!evt.shiftKey) return;

				evt.shiftKey = false;
				const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CONDITIONS_DISEASES]({name: cond.condName || cond.name, source: Parser.SRC_PHB});
				Renderer.hover.pHandleLinkMouseOver(evt, ele, {page: UrlUtil.PG_CONDITIONS_DISEASES, source: Parser.SRC_PHB, hash}).then(null);
			});
			$wrpRow.on("mousemove", (evt) => Renderer.hover.handleLinkMouseMove(evt, ele));
			$wrpRow.on("mouseleave", (evt) => Renderer.hover.handleLinkMouseLeave(evt, ele));
		})();
	}

	_populateRow_getHtmlBar ({comp, $wrpRow, entity}) {
		const styleStack = [
			comp._state.turns == null || comp._state.turns > 3
				? `background-image: linear-gradient(135deg, ${comp._state.color} 41.67%, transparent 41.67%, transparent 50%, ${comp._state.color} 50%, ${comp._state.color} 91.67%, transparent 91.67%, transparent 100%); background-size: 8.49px 8.49px;`
				: `background: ${comp._state.color};`,
		];
		if (this._barWidth != null) styleStack.push(`width: ${this._barWidth}px;`);
		return `<div class="init__cond_bar" style="${styleStack.join(" ")}"></div>`;
	}

	/* -------------------------------------------- */

	_doTickDown ({comp, entity, isFromClick = false}) {
		if (isFromClick && comp._state.turns == null) return this._doDelete({entity}); // remove permanent conditions

		if (comp._state.turns != null && (--comp._state.turns <= 0)) this._doDelete({entity});
	}

	_doTickUp ({comp, entity, isFromClick = false}) {
		if (isFromClick && comp._state.turns == null) return comp._state.turns = 1; // convert permanent condition

		if (comp._state.turns != null) comp._state.turns++;
	}
}

class InitiativeTrackerUtil {
	static getWoundLevel (pctHp) {
		pctHp = Math.round(Math.max(Math.min(pctHp, 100), 0));
		if (pctHp === 100) return 0; // healthy
		if (pctHp > 50) return 1; // injured
		if (pctHp > 0) return 2; // bloody
		if (pctHp === 0) return 3; // defeated
		return -1; // unknown
	}

	static getWoundMeta (woundLevel) { return InitiativeTrackerUtil._WOUND_META[woundLevel] || InitiativeTrackerUtil._WOUND_META[-1]; }
}
InitiativeTrackerUtil._WOUND_META = {
	[-1]: {
		text: "Unknown",
		color: "#a5a5a5",
	},
	0: {
		text: "Healthy",
		color: MiscUtil.COLOR_HEALTHY,
	},
	1: {
		text: "Hurt",
		color: MiscUtil.COLOR_HURT,
	},
	2: {
		text: "Bloodied",
		color: MiscUtil.COLOR_BLOODIED,
	},
	3: {
		text: "Defeated",
		color: MiscUtil.COLOR_DEFEATED,
	},
};

InitiativeTrackerUtil.CONDITIONS = [
	...Object.keys(Parser.CONDITION_TO_COLOR).map(k => ({
		name: k,
		color: Parser.CONDITION_TO_COLOR[k],
	})),
	{
		name: "Drunk",
		color: "#ffcc00",
		condName: null,
	},
	{
		name: "!!On Fire!!",
		color: "#ff6800",
		condName: null,
	},
].sort((a, b) => SortUtil.ascSortLower(a.name.replace(/\W+/g, ""), b.name.replace(/\W+/g, "")));

class InitiativeTrackerPlayerUiV1 {
	constructor (view, playerName, serverToken) {
		this._view = view;
		this._playerName = playerName;
		this._serverToken = serverToken;
		this._clientPeer = new PeerVeClient();
	}

	async pInit () {
		try {
			await this._clientPeer.pConnectToServer(
				this._serverToken,
				data => this._view.handleMessage(data),
				{
					label: this._playerName,
					serialization: "json",
				},
			);
		} catch (e) {
			JqueryUtil.doToast({
				content: `Failed to create client! Are you sure the token was valid? (See the log for more details.)`,
				type: "danger",
			});
			throw e;
		}
	}
}

class InitiativeTrackerPlayerUiV0 {
	constructor (view, $iptServerToken, $btnGenClientToken, $iptClientToken) {
		this._view = view;
		this._$iptServerToken = $iptServerToken;
		this._$btnGenClientToken = $btnGenClientToken;
		this._$iptClientToken = $iptClientToken;
	}

	init () {
		this._$iptServerToken.keydown(evt => {
			this._$iptServerToken.removeClass("error-background");
			if (evt.which === 13) this._$btnGenClientToken.click();
		});

		this._$btnGenClientToken.click(async () => {
			this._$iptServerToken.removeClass("error-background");
			const serverToken = this._$iptServerToken.val();

			if (PeerUtilV0.isValidToken(serverToken)) {
				try {
					this._$iptServerToken.attr("disabled", true);
					this._$btnGenClientToken.attr("disabled", true);
					const clientData = await PeerUtilV0.pInitialiseClient(
						serverToken,
						msg => this._view.handleMessage(msg),
						function (err) {
							if (!this.isClosed) {
								JqueryUtil.doToast({
									content: `Server error:\n${err ? err.message || err : "(Unknown error)"}`,
									type: "danger",
								});
							}
						},
					);

					if (!clientData) {
						this._$iptServerToken.attr("disabled", false);
						this._$btnGenClientToken.attr("disabled", false);
						JqueryUtil.doToast({
							content: `Failed to create client. Are you sure the token was valid?`,
							type: "warning",
						});
					} else {
						this._view.clientData = clientData;

						// -- This has no effect; the client doesn't error on sending when there's no connection --
						// const livenessCheck = setInterval(async () => {
						// 	try {
						// 		await clientData.client.sendMessage({})
						// 	} catch (e) {
						// 		JqueryUtil.doToast({
						// 			content: `Could not reach server! You might need to reconnect.`,
						// 			type: "danger"
						// 		});
						// 		clearInterval(livenessCheck);
						// 	}
						// }, 5000);

						this._$iptClientToken.val(clientData.textifiedSdp).attr("disabled", false);
					}
				} catch (e) {
					JqueryUtil.doToast({
						content: `Failed to create client! Are you sure the token was valid? (See the log for more details.)`,
						type: "danger",
					});
					setTimeout(() => { throw e; });
				}
			} else this._$iptServerToken.addClass("error-background");
		});

		this._$iptClientToken.click(async () => {
			await MiscUtil.pCopyTextToClipboard(this._$iptClientToken.val());
			JqueryUtil.showCopiedEffect(this._$iptClientToken);
		});
	}
}

class InitiativeTrackerPlayerMessageHandlerV1 {
	constructor (isCompact) {
		this._isCompact = isCompact;
		this._isUiInit = false;

		this._$meta = null;
		this._$head = null;
		this._$rows = null;
	}

	get isActive () { return this._isUiInit; }

	setElements ($meta, $head, $rows) {
		this._$meta = $meta;
		this._$head = $head;
		this._$rows = $rows;
	}

	initUi () {} // to be overridden as required

	handleMessage (msg) {
		this.initUi();
		const data = msg.data || {};

		this._$meta.empty();
		this._$head.empty();
		this._$rows.empty();

		if (data.n) {
			this._$meta.append(`
				<div class="${this._isCompact ? "ve-flex-vh-center" : "ve-flex-v-center"}${this._isCompact ? " mb-3" : ""}">
					<div class="mr-2">Round: </div>
					<div class="bold">${data.n}</div>
				</div>
			`);
		}

		this._$head.append(`
			<div class="initp__h_name${this._isCompact ? " initp__h_name--compact" : ""}">Creature/Status</div>
			<div class="initp__h_hp${this._isCompact ? " initp__h_hp--compact" : ""}">Health</div>
			${(data.statsCols || []).map(statCol => `<div class="initp__h_stat">${statCol.abbreviation || ""}</div>`).join("")}
			<div class="initp__h_score${this._isCompact ? " initp__h_score--compact" : ""}">${this._isCompact ? "#" : "Init."}</div>
		`);

		(data.rows || []).forEach(rowData => {
			this._$rows.append(this._get$row(rowData));
		});
	}

	_get$row (rowData) {
		const comp = BaseComponent.fromObject(
			{
				conditions: rowData.conditions || [],
			},
			"*",
		);

		const $wrpConds = $$`<div class="init__wrp_conds"></div>`;

		const collectionConditions = new RenderableCollectionConditions({
			comp: comp,
			isReadOnly: true,
			barWidth: !this._isCompact ? 24 : null,
			barHeight: !this._isCompact ? 24 : null,
			$wrpRows: $wrpConds,
		});
		collectionConditions.render();

		const getHpContent = () => {
			if (rowData.hpWoundLevel != null) {
				const {text, color} = InitiativeTrackerUtil.getWoundMeta(rowData.hpWoundLevel);
				return {hpText: text, hpColor: color};
			} else {
				const woundLevel = InitiativeTrackerUtil.getWoundLevel(100 * Number(rowData.h) / Number(rowData.g));
				return {hpText: `${rowData.hpCurrent == null ? "?" : rowData.hpCurrent}/${rowData.hpMax == null ? "?" : rowData.hpMax}`, hpColor: InitiativeTrackerUtil.getWoundMeta(woundLevel).color};
			}
		};
		const {hpText, hpColor} = getHpContent();

		const $dispName = $(`<div></div>`).text(`${(rowData.nameMeta?.customName || rowData.nameMeta?.name || "")}${rowData.ordinal != null ? ` (${rowData.ordinal})` : ""}`);

		const ptStatColData = (rowData.rowStatColData || [])
			.map(statVal => `<div class="initp__r_stat ve-flex-vh-center">
				${statVal.isUnknown ? `<span class="ve-muted italic" title="This value is hidden!">?</span>` : statVal.value === true ? `<span class="text-success glyphicon glyphicon-ok"></span>` : statVal.value === false ? `<span class="text-danger glyphicon glyphicon-remove"></span>` : statVal.value}
			</div>`)
			.join("");

		return $$`
			<div class="initp__r${rowData.isActive ? ` initp__r--active` : ""}">
				<div class="initp__r_name">
					${$dispName}
					${$wrpConds}
				</div>
				<div class="initp__r_hp">
					<div class="initp__r_hp_pill" style="background: ${hpColor};">${hpText}</div>
				</div>
				${ptStatColData}
				<div class="initp__r_score${this._isCompact ? " initp__r_score--compact" : ""}">${rowData.initiative}</div>
			</div>
		`;
	}
}

class InitiativeTrackerPlayerMessageHandlerV0 extends InitiativeTrackerPlayerMessageHandlerV1 {
	constructor (...args) {
		super(...args);

		this._clientData = null;
	}

	set clientData (clientData) { this._clientData = clientData; }
}
